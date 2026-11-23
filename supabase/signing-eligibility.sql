create table app.blocked_signings(
 tournament_id uuid not null references public.tournaments on delete cascade,
 player_id uuid not null references public.players on delete restrict,
 primary key(tournament_id,player_id)
);
alter table app.blocked_signings enable row level security;
revoke all on app.blocked_signings from public,anon,authenticated;

insert into app.blocked_signings
select t.id,p.id from public.tournaments t cross join public.players p
where t.id='98d2ad67-9355-4d36-a19f-ed6a4941b322'
and (p.sofifa_id in(239085,231747,247827,252371,251854,277643,231443,247635,238794,252145,272834)
 or p.id='72136381-aa5c-5c02-9743-49171fc39b72');

create function public.admin_signing_players(p_search text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare tid uuid; result jsonb;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración.';end if;
 select coalesce(jsonb_agg(to_jsonb(rows) order by blocked desc,name,id),'[]') into result from (
 select p.id,p.name,p.nationality,p.ovr,(b.player_id is not null) blocked
 from public.players p left join app.blocked_signings b on b.player_id=p.id and b.tournament_id=tid
 where (b.player_id is not null or p.catalog_active) and
 ((trim(p_search)='' and b.player_id is not null) or (trim(p_search)<>'' and (strpos(lower(p.name),lower(trim(p_search)))>0 or p.sofifa_id::text=trim(p_search))))
 order by blocked desc,p.name,p.id limit 100) rows;
 return result;
end $$;
create function public.admin_set_signing_block(p_player uuid,p_blocked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_admin(tid),false) or p_blocked is null then raise exception 'Solo Administración.';end if;
 perform app.lock_draft_outgoing(tid);
 if p_blocked then insert into app.blocked_signings values(tid,p_player) on conflict do nothing;
 else delete from app.blocked_signings where tournament_id=tid and player_id=p_player; end if;
 perform public.audit(tid,'mercado.elegibilidad','players',p_player::text||case when p_blocked then ' bloqueado' else ' desbloqueado' end);
end $$;
revoke all on function public.admin_signing_players(text),public.admin_set_signing_block(uuid,boolean) from public,anon;
grant execute on function public.admin_signing_players(text),public.admin_set_signing_block(uuid,boolean) to authenticated;

create function app.check_signing_terms(tid uuid,requested uuid[],offered uuid[],cash numeric,between_clubs boolean) returns void
language plpgsql set search_path='' as $$
begin
 if exists(select from app.blocked_signings where tournament_id=tid and player_id=any(requested||offered)) then raise exception 'Jugador bloqueado por Administración.';end if;
 if between_clubs and cash+coalesce((select sum(value) from public.players where id=any(offered)),0)>200000000 then
 raise exception 'El máximo entre presidentes es de 200.000.000 € por operación, incluido el valor de los jugadores ofrecidos.';end if;
end $$;
create function app.guard_signing_terms() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='offers' then
   if new.status in ('enviada','negociacion','aceptada','reservada','ejecutada') then
    perform app.check_signing_terms(new.tournament_id,new.requested_player_ids,new.offered_player_ids,new.cash,new.seller_president_id is not null);
   end if;
 elsif tg_table_name='draft_prelists' then
   perform app.check_signing_terms(pr.tournament_id,array[p.id],array_remove(array[(e->>'offeredPlayerId')::uuid],null),(e->>'price')::numeric,e->>'kind'='owned')
   from public.presidents pr cross join lateral jsonb_array_elements(new.entries) e
   left join public.players p on p.id=(e->>'playerId')::uuid or p.sofifa_id=substring(e->>'sofifaUrl' from '/player/([0-9]+)')::bigint or lower(p.name)=lower(e->>'name')
   where pr.id=new.president_id;
 else
   perform app.check_signing_terms(new.tournament_id,array[new.player_id],'{}',0,false);
 end if;
 return new;
end $$;
revoke all on function app.check_signing_terms(uuid,uuid[],uuid[],numeric,boolean),app.guard_signing_terms() from public,anon,authenticated;
create trigger guard_offer_eligibility before insert or update of status,cash,requested_player_ids,offered_player_ids on public.offers for each row execute function app.guard_signing_terms();
create trigger guard_pick_eligibility before insert on public.draft_picks for each row execute function app.guard_signing_terms();
create trigger guard_prelist_eligibility before insert or update of entries on app.draft_prelists for each row execute function app.guard_signing_terms();

do $$
declare d text;
begin
 d:=pg_get_functiondef('public.market_search(text,text,text,text,boolean,integer,integer)'::regprocedure);
 if strpos(d,'from pool')=0 then raise exception 'Revisar market_search';end if;
 execute replace(replace(d,'where ((p_scope','where not exists(select from app.blocked_signings b where b.player_id=pool.id and b.tournament_id=v_tid) and ((p_scope'),'pool.position, pool.real_club, pool.owner_club_name','pool.position, pool.owner_club_name');
 d:=pg_get_functiondef('public.draft_pool(text,text,integer,integer)'::regprocedure);
 execute replace(d,'where not exists (select 1 from public.squad_players','where not exists(select from app.blocked_signings b where b.player_id=pl.id and b.tournament_id=v_tid) and not exists (select 1 from public.squad_players');
 d:=pg_get_functiondef('public.prelist_pool_search(text)'::regprocedure);
 execute replace(replace(d,'where public.is_member(v.tid) and p.catalog_active','where not exists(select from app.blocked_signings b where b.tournament_id=v.tid and b.player_id=p.id) and public.is_member(v.tid) and p.catalog_active'),'from public.sofifa_players s,viewer v','from public.sofifa_players s,viewer v');
 d:=pg_get_functiondef('app.validate_transfer_intent(text,uuid[],uuid[],bigint)'::regprocedure);
 execute replace(d,'if target.id is null then','perform app.check_signing_terms(tid,p_requested,p_offered,p_cash,target.id is not null); if target.id is null then');
end $$;
do $$declare d text;begin
 d:=pg_get_functiondef('public.tournament_state()'::regprocedure);
 execute replace(d,'coalesce(p.source_record->>''game_team'', p.real_club)','(p.source_record->>''game_team'')');
end $$;
do $$declare d text; a int; b int; sig regprocedure;
begin
 sig:='public.assert_configured_lineup(uuid,uuid,jsonb)'::regprocedure;
 d:=pg_get_functiondef(sig);
 a:=strpos(d,'  if (c->''realClub''->>''enabled'')::boolean then');
 b:=strpos(d,'  if coalesce((active->''u20''');
 if a=0 or b<=a then raise exception 'Revisar regla de alineación';end if;
 execute substr(d,1,a-1)||substr(d,b);
 d:=pg_get_functiondef('public.offer_json(public.offers)'::regprocedure);
 execute replace(d,'''clubName'', pl.real_club','''clubName'', coalesce((select c.name from public.squad_players sp join public.clubs c on c.id=sp.club_id where sp.tournament_id=o.tournament_id and sp.player_id=pl.id),''Agente libre'')');
end $$;
