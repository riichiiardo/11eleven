create or replace function public.draft_prepare_ordered(p_rounds int,p_seconds int,p_snake boolean,p_order uuid[])
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
 or exists(
   select case when p.id is null then c.id else p.id end
   from public.clubs c left join public.presidents p on p.club_id=c.id and p.tournament_id=tid
   where c.tournament_id=tid and coalesce((to_jsonb(c)->>'in_universe')::boolean,true)
   except select unnest(p_order))
 or (select count(*) from public.clubs c where c.tournament_id=tid and coalesce((to_jsonb(c)->>'in_universe')::boolean,true))<>cardinality(p_order) then
  raise exception 'Asigna una posición única a cada equipo del universo y revisa las rondas y el reloj.';
 end if;
 perform public.draft_prepare(p_rounds,p_seconds,p_snake);
 update public.drafts set "order"=p_order,current_index=0,round=1 where tournament_id=tid;
end $$;

-- Existing president slots keep their IDs. A Bot slot uses the club ID.
create function app.is_draft_bot_slot(tid uuid,slot_id uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(select from public.clubs c where c.tournament_id=tid and c.id=slot_id)
 and not exists(select from public.presidents p where p.tournament_id=tid and p.id=slot_id);
$$;

do $$
declare definition text; signature regprocedure; marker text;
begin
 definition:=pg_get_functiondef('public.draft_turn_json(uuid,uuid)'::regprocedure);
 marker:='where p.id = pid';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció la ficha del turno.';end if;
 execute replace(definition,marker,$turn$where p.id = pid
 union all
 select jsonb_build_object('presidentId',c.id,'nickname','Bot','clubName',c.name,
  'clubShortName',c.short_name,'clubColors',jsonb_build_array(c.color_primary,c.color_secondary),
  'isMe',false,'isCurrent',false,'picks',0,'spent',0,
  'squadSize',(select count(*) from public.squad_players s where s.club_id=c.id),'budget',0)
 from public.clubs c where c.id=pid and c.tournament_id=v_tid
 and not exists(select from public.presidents p where p.id=pid and p.tournament_id=v_tid)$turn$);

 foreach signature in array array['public.draft_summary_json(uuid,uuid)'::regprocedure,'public.draft_admin_json(uuid)'::regprocedure] loop
  definition:=pg_get_functiondef(signature);
  marker:='(select c.name from public.presidents p join public.clubs c on c.id = p.club_id where p.id = d."order"[d.current_index + 1])';
  if strpos(definition,marker)=0 then raise exception 'No se reconoció el club del turno en %',signature;end if;
  definition:=replace(definition,marker,'coalesce('||marker||', (select c.name from public.clubs c where c.tournament_id=v_tid and c.id=d."order"[d.current_index+1]))');
  marker:='(select p.nickname from public.presidents p where p.id = d."order"[d.current_index + 1])';
  execute replace(definition,marker,'coalesce('||marker||', (select ''Bot'' from public.clubs c where c.tournament_id=v_tid and c.id=d."order"[d.current_index+1]))');
 end loop;
 definition:=pg_get_functiondef('app.advance_expired_draft(uuid)'::regprocedure);
 marker:=' if not found or d.current_deadline is null or d.current_deadline>now() then return false;end if;';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el reloj del draft.';end if;
 execute replace(definition,marker,$clock$ if not found then return false;end if;
 if app.is_draft_bot_slot(tid,d."order"[d.current_index+1]) then
  perform app.advance_draft_turn(d,false);return true;
 end if;
 if d.current_deadline is null or d.current_deadline>now() then return false;end if;$clock$);
end $$;
revoke all on function app.is_draft_bot_slot(uuid,uuid) from public,anon,authenticated;
