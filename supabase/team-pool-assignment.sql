alter table public.team_catalog add column if not exists team_kind text not null default 'club'
  check (team_kind in ('club','national'));

-- Match historical aliases to the imported IDs, keeping club and roster identities.
with aliases(name, sofifa_id) as (values
 ('Arsenal Football Club',1),('Bayer 04 Leverkusen',32),('Club Atlético de Madrid',240),
 ('Club de Fútbol Cruz Azul',1878),('Club Deportivo Chivas de Guadalajara',1880),
 ('FC Porto',236),('Fútbol Club Barcelona',241),('Leicester City Football Club',95),
 ('Los Angeles Galaxy',697),('Manchester United',11),('Newcastle United Football Club',13),
 ('Palermo FC',1843),('París Saint-Germain Football Club',73),('Parma Calcio 1913',50),
 ('Racing Club',101085),('Racing Club de Estrasburgo',76),('Real Sociedad de Fútbol',457),
 ('Sporting Clube de Portugal',237))
update public.team_catalog t set sofifa_team_id=p.sofifa_id
from aliases a join public.club_pool p using(sofifa_id)
where t.name=a.name and t.sofifa_team_id is null
and not exists(select from public.team_catalog existing where existing.sofifa_team_id=p.sofifa_id);

insert into public.team_catalog(sofifa_team_id,name,league,country,crest_url,team_kind)
select sofifa_id,name,'Clubes',country,'data:image/png;base64,'||replace(encode(crest_png,'base64'),chr(10),''),'club' from public.club_pool
union all
select sofifa_id,name,'Selecciones nacionales',country,'data:image/png;base64,'||replace(encode(crest_png,'base64'),chr(10),''),'national' from public.national_team_pool
on conflict(sofifa_team_id) do update set
 country=excluded.country,crest_url=coalesce(excluded.crest_url,team_catalog.crest_url),team_kind=excluded.team_kind;
update public.clubs c set country=t.country from public.team_catalog t
where c.catalog_team_id=t.id and t.sofifa_team_id is not null and c.country is distinct from t.country;

do $$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('public.tournament_state()'::regprocedure);
 marker:='from public.team_catalog t'||chr(10)||'      ),';
 if strpos(definition,marker)=0 then raise exception 'No se encontró el catálogo de incorporación.';end if;
 execute replace(definition,marker,'from public.team_catalog t where t.team_kind=''club'''||chr(10)||'      ),');
 definition:=pg_get_functiondef('public.choose_catalog_team(uuid)'::regprocedure);
 marker:='select * into v_team from public.team_catalog where id = p_team_catalog_id;';
 if strpos(definition,marker)=0 then raise exception 'No se encontró la selección de club.';end if;
 definition:=replace(definition,marker,
   'if not coalesce(public.is_member(v_tid),false) then raise exception ''Primero únete a la liga.''; end if;'||chr(10)||
   'perform app.lock_draft_outgoing(v_tid);'||chr(10)||
   'select * into v_team from public.team_catalog where id = p_team_catalog_id and team_kind = ''club'';');
 marker:='where existing.squad_id = s.id and existing.player_id = p.id'||chr(10)||'    );';
 if strpos(definition,marker)=0 then raise exception 'No se encontró la carga de la plantilla inicial.';end if;
 execute replace(definition,marker,replace(marker,');',') on conflict(tournament_id,player_id) do nothing;'));
end $$;

create function public.admin_team_pool_choices()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin();
begin
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'catalogTeamId',t.id,'leagueClubId',c.id,'name',coalesce(c.name,t.name),
  'league',t.league,'country',t.country,'colors',jsonb_build_array(t.color_primary,t.color_secondary),
  'kind',t.team_kind,'occupied',exists(select from public.presidents p where p.club_id=c.id)
 ) order by t.name,t.id),'[]')
 from public.team_catalog t left join public.clubs c on c.tournament_id=tid and c.catalog_team_id=t.id);
end $$;

create or replace function public.change_president_club(
 p_president_id uuid,p_team_catalog_id uuid default null,p_league_club_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin(); destination uuid; squad_id uuid; target public.team_catalog%rowtype;
begin
 perform app.lock_draft_outgoing(tid);
 if not exists(select from public.presidents p where p.tournament_id=tid and p.id=p_president_id) then
  raise exception 'El presidente no pertenece al universo activo.';
 end if;
 if p_league_club_id is not null then
  select c.id into destination from public.clubs c where c.id=p_league_club_id and c.tournament_id=tid;
 else
  select * into target from public.team_catalog where id=p_team_catalog_id;
  if target.id is not null then
   select c.id into destination from public.clubs c where c.tournament_id=tid and c.catalog_team_id=target.id;
   if destination is null then
    insert into public.clubs(tournament_id,name,short_name,league,country,color_primary,color_secondary,catalog_team_id)
    values(tid,target.name,upper(left(target.name,3)),target.league,target.country,target.color_primary,target.color_secondary,target.id)
    returning id into destination;
    insert into public.squads(tournament_id,club_id,president_id,formation)
    select tid,destination,null,r.fc27_formation_code from public.tournament_rules r where r.tournament_id=tid returning id into squad_id;
    if squad_id is null then raise exception 'Configura las reglas del universo antes de asignar equipos.';end if;
    if target.team_kind='club' then
     insert into public.squad_players(tournament_id,club_id,squad_id,player_id,president_id,ovr_at_join,value_at_join)
     select tid,destination,squad_id,p.id,null,p.ovr,p.value from public.players p
     where p.source_record->>'game_team'=target.name
     on conflict(tournament_id,player_id) do nothing;
    end if;
   end if;
  end if;
 end if;
 if destination is null then raise exception 'Equipo de destino no válido.';end if;
 return app.assign_club_roster(tid,p_president_id,destination);
end $$;
revoke all on function public.admin_team_pool_choices(),public.change_president_club(uuid,uuid,uuid) from public,anon;
grant execute on function public.admin_team_pool_choices(),public.change_president_club(uuid,uuid,uuid) to authenticated;
