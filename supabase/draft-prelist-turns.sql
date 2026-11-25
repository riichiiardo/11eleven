create table app.draft_returned_entries(
 draft_id uuid references public.drafts(id) on delete cascade,
 cycle_id uuid not null,
 president_id uuid references public.presidents(id) on delete cascade,
 entry_id uuid not null,
 primary key(draft_id,cycle_id,president_id,entry_id)
);
create table app.draft_deferred_turns(
 draft_id uuid references public.drafts(id) on delete cascade,
 cycle_id uuid not null,
 round integer not null,
 turn_index integer not null,
 president_id uuid not null references public.presidents(id),
 primary key(draft_id,cycle_id,round,turn_index)
);
alter table app.draft_returned_entries enable row level security;
alter table app.draft_deferred_turns enable row level security;
revoke all on app.draft_returned_entries,app.draft_deferred_turns from public,anon,authenticated;

create function public.draft_prepare_ordered(p_rounds int,p_seconds int,p_snake boolean,p_order uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid());
begin
 if not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración puede preparar el draft.';end if;
 perform app.lock_draft_outgoing(tid);
 if exists(select from public.drafts d where d.tournament_id=tid and (d.status<>'borrador' or d.started_at is not null)) then
  raise exception 'El orden solo se puede preparar antes de abrir el draft.';
 end if;
 if p_rounds not between 1 and 100 or p_seconds not between 15 and 3600 or coalesce(cardinality(p_order),0)=0
 or (select count(distinct id) from unnest(p_order) id)<>cardinality(p_order)
 or exists(select from unnest(p_order) x(id) where not exists(select from public.presidents p where p.id=x.id and p.tournament_id=tid and p.club_id is not null))
 or (select count(*) from public.presidents p where p.tournament_id=tid and p.club_id is not null)<>cardinality(p_order) then
  raise exception 'Asigna una posición única a cada presidente con equipo y revisa las rondas y el reloj.';
 end if;
 perform public.draft_prepare(p_rounds,p_seconds,p_snake);
 update public.drafts set "order"=p_order,current_index=0,round=1 where tournament_id=tid;
end $$;

create function public.draft_return_conflicts()
returns integer language plpgsql security definer set search_path='' as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid()); d public.drafts%rowtype; item record; changed int:=0;
begin
 if not coalesce(app.can_review_draft(tid),false) then raise exception 'Solo los revisores del draft pueden retornar altas.';end if;
 perform app.lock_draft_outgoing(tid);
 select * into d from public.drafts where tournament_id=tid and status in ('en_curso','pausado');
 if not found then raise exception 'El draft debe estar abierto.';end if;
 for item in select r.president_id,(e->>'id')::uuid entry_id,pl.name
  from app.draft_prelists r join public.presidents pr on pr.id=r.president_id and pr.tournament_id=tid
  cross join lateral jsonb_array_elements(r.entries) e
  join public.players pl on pl.sofifa_id=substring(e->>'sofifaUrl' from '^https://sofifa[.]com/player/([0-9]+)')::bigint
  join public.draft_picks pick on pick.draft_id=d.id and pick.player_id=pl.id and pick.president_id<>r.president_id
  where e->>'kind'='new' and e->>'reviewStatus' in ('approved','pending')
 loop
  insert into app.draft_returned_entries values(d.id,d.outgoing_cycle_id,item.president_id,item.entry_id) on conflict do nothing;
   update app.draft_prelists r set entries=(
    select jsonb_agg(case when e->>'id'=item.entry_id::text then e||jsonb_build_object(
      'reviewStatus','rejected','reviewNote',item.name||' ya fue elegido en el draft. Envía un reemplazo.') else e end order by n)
    from jsonb_array_elements(r.entries) with ordinality x(e,n)),
    revision=revision+1,updated_at=now()
   where r.president_id=item.president_id;
   changed:=changed+1;
 end loop;
 return changed;
end $$;

create function public.draft_replacement_entries()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(e order by n),'[]')
 from public.profiles u join public.presidents p on p.user_id=u.id and p.tournament_id=u.active_tournament_id
 join public.drafts d on d.tournament_id=p.tournament_id and d.status in ('en_curso','pausado')
 join app.draft_prelists r on r.president_id=p.id
 cross join lateral jsonb_array_elements(r.entries) with ordinality x(e,n)
 where u.id=auth.uid() and e->>'reviewStatus'='rejected' and exists(
  select from app.draft_returned_entries a where a.draft_id=d.id and a.cycle_id=d.outgoing_cycle_id
  and a.president_id=p.id and a.entry_id::text=e->>'id');
$$;

create function public.draft_submit_replacement(p_entry uuid,p_sofifa bigint)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid());
 d public.drafts%rowtype; me uuid; player public.players%rowtype;
begin
 if not coalesce(public.is_member(tid),false) then raise exception 'No perteneces al universo.';end if;
 perform app.lock_draft_outgoing(tid);
 select * into strict d from public.drafts where tournament_id=tid and status in ('en_curso','pausado');
 me:=public.my_president_id(tid);
 if not exists(select from app.draft_returned_entries where draft_id=d.id and cycle_id=d.outgoing_cycle_id and president_id=me and entry_id=p_entry) then
  raise exception 'Solo puedes reemplazar un alta devuelta por el draft.';
 end if;
 select * into player from public.players p where p.sofifa_id=p_sofifa and p.catalog_active
 and not exists(select from public.squad_players sp where sp.tournament_id=tid and sp.player_id=p.id)
 and not exists(select from public.draft_picks dp where dp.draft_id=d.id and dp.player_id=p.id);
 if not found then raise exception 'Elige un agente libre vigente del pool.';end if;
 if exists(select from app.draft_prelists r cross join lateral jsonb_array_elements(r.entries) e
 where r.president_id=me and e->>'id'<>p_entry::text and substring(e->>'sofifaUrl' from '^https://sofifa[.]com/player/([0-9]+)')=p_sofifa::text) then
  raise exception 'Ese jugador ya está en tu prelista.';
 end if;
 perform app.check_signing_terms(tid,array[player.id],'{}',0,false);
 update app.draft_prelists r set entries=(select jsonb_agg(case when e->>'id'=p_entry::text and e->>'reviewStatus'='rejected' then
  jsonb_build_object('id',p_entry,'kind','new','name',player.name,'playerId',player.id,
   'nationality',player.nationality,'price',player.value,'ovr',player.ovr,'positions',jsonb_build_array(player.position),
   'sofifaUrl','https://sofifa.com/player/'||p_sofifa,'reviewStatus','pending','reviewNote','') else e end order by n)
  from jsonb_array_elements(r.entries) with ordinality x(e,n)),revision=revision+1,status='submitted',updated_at=now()
 where r.president_id=me and exists(select from jsonb_array_elements(r.entries) e where e->>'id'=p_entry::text and e->>'reviewStatus'='rejected');
 if not found then raise exception 'El reemplazo ya fue enviado.';end if;
end $$;

create function app.draft_waiting_replacement(d public.drafts,pid uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(select from app.draft_returned_entries a join app.draft_prelists r on r.president_id=a.president_id
 cross join lateral jsonb_array_elements(r.entries) e
 where a.draft_id=d.id and a.cycle_id=d.outgoing_cycle_id and a.president_id=pid
 and a.entry_id::text=e->>'id' and e->>'reviewStatus' is distinct from 'approved');
$$;

create function app.advance_draft_turn(d public.drafts,p_defer boolean)
returns void language plpgsql set search_path='' as $$
declare next_index int:=d.current_index+1; next_round int:=d.round;
 turn_order uuid[]:=d."order";
begin
 if p_defer and d.round<=d.total_rounds then
  insert into app.draft_deferred_turns values(d.id,d.outgoing_cycle_id,d.round,d.current_index,d."order"[d.current_index+1])
  on conflict do nothing;
 end if;
 if next_index>=cardinality(turn_order) then
  next_index:=0;
  next_round:=next_round+1;
  if next_round=d.total_rounds+1 then
   select array_agg(president_id order by round,turn_index) into turn_order
   from app.draft_deferred_turns where draft_id=d.id and cycle_id=d.outgoing_cycle_id;
  elsif next_round>d.total_rounds+1 then
   turn_order:=null;
  elsif d.snake then
   select array_agg(x order by n desc) into turn_order from unnest(turn_order) with ordinality o(x,n);
  end if;
 end if;
 if coalesce(cardinality(turn_order),0)=0 then
  update public.drafts set status='cerrado',closed_at=now(),current_deadline=null,updated_at=now() where id=d.id;
 else
  update public.drafts set "order"=turn_order,round=next_round,current_index=next_index,
  current_deadline=now()+make_interval(secs=>pick_seconds),updated_at=now() where id=d.id;
 end if;
end $$;

create function app.advance_expired_draft(tid uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare d public.drafts%rowtype;
begin
 perform app.lock_draft_outgoing(tid);
 select * into d from public.drafts where tournament_id=tid and status='en_curso' for update;
 if not found or d.current_deadline is null or d.current_deadline>now() then return false;end if;
 if not app.draft_waiting_replacement(d,d."order"[d.current_index+1]) then return false;end if;
 perform app.advance_draft_turn(d,d.round<=d.total_rounds);
 return true;
end $$;

create function public.draft_advance_expired() returns boolean
language plpgsql security definer set search_path='' as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid());
begin
 if not coalesce(public.is_member(tid),false) then return false;end if;
 return app.advance_expired_draft(tid);
end $$;
revoke all on function app.advance_expired_draft(uuid) from public,anon,authenticated;

create or replace function public.draft_skip_turn() returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid()); d public.drafts%rowtype;
begin
 if not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración puede saltar turnos.';end if;
 perform app.lock_draft_outgoing(tid);
 select * into d from public.drafts where tournament_id=tid and status in ('en_curso','pausado') for update;
 if not found then raise exception 'No hay turno activo.';end if;
 perform app.advance_draft_turn(d,app.draft_waiting_replacement(d,d."order"[d.current_index+1]));
end $$;

do $$
declare definition text; marker text; start_at int; end_at int;
begin
 definition:=pg_get_functiondef('app.draft_prelist_state()'::regprocedure);
 marker:='''canReview'',app.can_review_draft(tid),';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el estado de prelista.';end if;
 execute replace(definition,marker,marker||' ''locked'',exists(select from public.drafts d where d.tournament_id=tid and d.started_at is not null),');
 definition:=pg_get_functiondef('app.save_draft_prelist(jsonb,jsonb,integer,boolean)'::regprocedure);
 marker:='if r.status=''submitted'' then raise exception ''La lista está en revisión. Espera la respuesta antes de modificarla.''; end if;';
 if strpos(definition,marker)=0 then raise exception 'La regla de edición de prelistas cambió.';end if;
 execute replace(definition,marker,'if exists(select from public.drafts d where d.tournament_id=tid and d.started_at is not null) then raise exception ''El draft ya abrió. Solo puedes reemplazar las altas devueltas.'';end if;');
 definition:=pg_get_functiondef('app.check_prelist_slots()'::regprocedure);
 marker:='if jsonb_array_length(new.entries)+extra<>jsonb_array_length(new.outgoing) then';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el balance de altas y bajas.';end if;
 execute replace(definition,marker,
   'if jsonb_array_length(new.entries)+extra<>jsonb_array_length(new.outgoing) and not (tg_op=''UPDATE'' and new.outgoing=old.outgoing and jsonb_array_length(new.entries)=jsonb_array_length(old.entries) and exists(select from public.drafts d where d.tournament_id=tid and d.started_at is not null)) then');
 definition:=pg_get_functiondef('public.draft_pick(uuid)'::regprocedure);
 marker:='select * into v_draft from public.drafts where tournament_id = v_tid;';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el turno actual.';end if;
 definition:=replace(definition,marker,'perform app.lock_draft_outgoing(v_tid); '||replace(marker,';',' for update;'));
 marker:='select * into v_me from public.presidents where id = v_turn;';
 definition:=replace(definition,marker,marker||' if app.draft_waiting_replacement(v_draft,v_turn) then raise exception ''Tienes un reemplazo pendiente de aprobación.'';end if;');
 start_at:=strpos(definition,'  -- Avanza el turno');
 end_at:=strpos(definition,'  perform public.audit');
 if start_at=0 or end_at<=start_at then raise exception 'No se reconoció el avance del draft.';end if;
 execute substring(definition from 1 for start_at-1)||'  perform app.advance_draft_turn(v_draft,false);'||chr(10)||substring(definition from end_at);
end $$;
revoke all on function app.draft_waiting_replacement(public.drafts,uuid),app.advance_draft_turn(public.drafts,boolean) from public,anon,authenticated;
revoke all on function public.draft_prepare_ordered(int,int,boolean,uuid[]),public.draft_return_conflicts(),public.draft_replacement_entries(),public.draft_submit_replacement(uuid,bigint),public.draft_advance_expired() from public,anon;
grant execute on function public.draft_prepare_ordered(int,int,boolean,uuid[]),public.draft_return_conflicts(),public.draft_replacement_entries(),public.draft_submit_replacement(uuid,bigint),public.draft_advance_expired() to authenticated;
