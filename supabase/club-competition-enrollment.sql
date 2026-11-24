-- Keep historical team IDs and results when a club stops participating.
alter table app.competition_teams add column current_participant boolean not null default true;

create or replace function app.club_formation_options(tid uuid, club uuid)
returns table(id text, name text, rule_id text)
language sql stable set search_path='' as $$
 select c.id::text,c.name,c.rule_id
 from app.universe_competitions c
 where c.tournament_id=tid and not c.archived and exists(
   select from app.competition_teams t
   where t.competition_id=c.id and t.club_id=club and t.current_participant
 );
$$;

create function public.admin_competition_enrollment()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin();
begin
 return jsonb_build_object(
 'competitions',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id),'[]') from app.universe_competitions c where c.tournament_id=tid and not c.archived),
 'clubs',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'competitions',
   (select coalesce(jsonb_agg(o.id),'[]') from app.club_formation_options(tid,c.id) o)) order by c.name,c.id),'[]')
   from public.clubs c where c.tournament_id=tid));
end $$;

create function public.admin_save_competition_enrollment(p_club uuid,p_competitions uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin(); club_name text;
begin
 perform app.lock_draft_outgoing(tid);
 select c.name into club_name from public.clubs c where c.id=p_club and c.tournament_id=tid for update;
 if not found then raise exception 'El equipo no pertenece al universo activo.';end if;
 if p_competitions is null or exists(select from unnest(p_competitions) as requested(id)
 where not exists(select from app.universe_competitions c where c.id=requested.id and c.tournament_id=tid and not c.archived)) then
 raise exception 'Selecciona competiciones habilitadas del universo activo.';end if;
 update app.competition_teams t set current_participant=t.competition_id=any(p_competitions)
 from app.universe_competitions c where c.id=t.competition_id and c.tournament_id=tid and not c.archived and t.club_id=p_club;
 insert into app.competition_teams(competition_id,name,club_id,current_participant)
 select distinct requested.id,club_name,p_club,true from unnest(p_competitions) as requested(id)
 where not exists(select from app.competition_teams t where t.competition_id=requested.id and t.club_id=p_club)
 on conflict(competition_id,name) do update set club_id=excluded.club_id,current_participant=true
 where app.competition_teams.club_id is null;
 if exists(select from unnest(p_competitions) as requested(id) where not exists(
 select from app.competition_teams t where t.competition_id=requested.id and t.club_id=p_club and t.current_participant)) then
 raise exception 'El nombre del club ya está vinculado a otro participante.';end if;
 perform public.audit(tid,'competicion.inscripciones','competition_teams','Competiciones de '||club_name||': '||array_to_string(p_competitions,', '),p_club);
end $$;
revoke all on function public.admin_competition_enrollment(),public.admin_save_competition_enrollment(uuid,uuid[]) from public,anon;
grant execute on function public.admin_competition_enrollment(),public.admin_save_competition_enrollment(uuid,uuid[]) to authenticated;
