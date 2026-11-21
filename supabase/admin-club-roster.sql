-- Apply after club-budgets and the catalog import.
alter table public.squads alter column president_id drop not null;
alter table public.squad_players alter column president_id drop not null;

create or replace function app.assign_club_roster(tid uuid, pid uuid, destination uuid)
returns jsonb language plpgsql set search_path='' as $$
declare previous uuid; target public.clubs%rowtype; sid uuid;
begin
 select club_id into strict previous from public.presidents where id=pid and tournament_id=tid for update;
 select * into strict target from public.clubs where id=destination and tournament_id=tid for update;
 if exists(select from public.presidents where club_id=destination) then raise exception 'Ese club ya tiene presidente.'; end if;
 update public.squad_players set president_id=null where club_id=previous and president_id=pid;
 update public.squads set president_id=null where club_id=previous and president_id=pid;
 update public.presidents set club_id=destination where id=pid;
 select id into sid from public.squads where club_id=destination for update;
 if found then
   update public.squads set president_id=pid where id=sid;
   update public.squad_players set president_id=pid where squad_id=sid;
 else
   insert into public.squads(tournament_id,club_id,president_id) values(tid,destination,pid) returning id into sid;
   insert into public.squad_players(tournament_id,club_id,squad_id,player_id,president_id,ovr_at_join,value_at_join)
   select tid,destination,sid,p.id,pid,p.ovr,p.value from public.players p
   join public.team_catalog t on t.id=target.catalog_team_id and t.name=p.source_record->>'game_team';
   if not found then raise exception 'No hay plantilla asignada al club de destino.'; end if;
 end if;
 perform public.audit(tid,'presidente.movido','presidents','Reasignación a '||target.name||' con la plantilla del club.',destination);
 return jsonb_build_object('clubName',target.name);
end $$;
revoke all on function app.assign_club_roster(uuid,uuid,uuid) from public,anon,authenticated;

drop function public.change_president_club(uuid,uuid,uuid);
create function public.change_president_club(p_president_id uuid,p_team_catalog_id uuid default null,p_league_club_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid; destination uuid;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if auth.uid() is null or not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración puede cambiar el equipo.'; end if;
 select id into strict destination from public.clubs where tournament_id=tid and
 (id=p_league_club_id or (p_league_club_id is null and catalog_team_id=p_team_catalog_id));
 return app.assign_club_roster(tid,p_president_id,destination);
end $$;
revoke all on function public.change_president_club(uuid,uuid,uuid) from public,anon;
grant execute on function public.change_president_club(uuid,uuid,uuid) to authenticated;

do $migration$
declare d text; marker text;
begin
 d:=pg_get_functiondef('public.admin_overview()'::regprocedure);
 marker:=$m$'availableTeams', '[]'::jsonb$m$;
 if strpos(d,marker)=0 then raise exception 'Revisar definición admin_overview'; end if;
 execute replace(d,marker,$m$'availableTeams', coalesce((select jsonb_agg(jsonb_build_object('leagueClubId',c.id,'catalogTeamId',c.catalog_team_id,'name',c.name,'league',c.league) order by c.name) from public.clubs c where c.tournament_id=v_tid and not exists(select from public.presidents p where p.club_id=c.id)), '[]'::jsonb)$m$);
 d:=pg_get_functiondef('public.choose_catalog_team(uuid)'::regprocedure);
 marker:='insert into public.squad_players';
 if strpos(d,marker)=0 then raise exception 'Revisar definición choose_catalog_team'; end if;
 d:=replace(d,marker,'if exists(select from public.squad_players where club_id=v_club.id) then
 update public.squad_players set president_id=v_president where club_id=v_club.id;
 else '||marker);
 marker:='update public.squads set president_id';
 if strpos(d,marker)=0 then raise exception 'Revisar asignación de plantilla'; end if;
 execute replace(d,marker,'end if; '||marker);
end $migration$;
