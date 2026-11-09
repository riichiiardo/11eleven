-- Private, season-versioned competition records. No invented fixtures or scores.
begin;
create table if not exists app.universe_competitions(
 id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments(id) on delete cascade,
 slug text not null check(slug ~ '^[a-z0-9-]{1,60}$'),name text not null check(length(name) between 1 and 100),
 format text not null check(format in('league','cup','league_playoffs')),current_season text not null,
 ranking_phase text check(length(ranking_phase) between 1 and 100),
 rule_id text,archived boolean not null default false,
 review_from integer check(review_from>0),created_at timestamptz not null default now(),unique(tournament_id,slug)
);
alter table app.universe_competitions add column if not exists ranking_phase text check(length(ranking_phase) between 1 and 100);
create table if not exists app.broadcast_sources(
 video_id text primary key check(video_id ~ '^[A-Za-z0-9_-]{11}$'),channel_id text not null,
 title text not null,competition_slug text not null,round_number integer check(round_number>0),
 reviewed boolean not null default false
);
create table if not exists app.competition_teams(
 id uuid primary key default gen_random_uuid(),competition_id uuid not null references app.universe_competitions(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 100),club_id uuid references public.clubs(id) on delete set null,
 unique(competition_id,name)
);
create or replace function app.valid_competition_images(p_images text[])returns boolean
language sql immutable security invoker set search_path='' as $$
 select array_ndims(p_images)=1 and cardinality(p_images) between 1 and 10
 and not exists(select 1 from unnest(p_images)i where i is null or i !~ '^evidence/[a-z0-9_-]+(/[a-z0-9_-]+)*[.](png|jpg|jpeg|webp)$');
$$;
revoke all on function app.valid_competition_images(text[])from public,anon,authenticated;
create table if not exists app.competition_evidence(
 id uuid primary key default gen_random_uuid(),competition_id uuid not null references app.universe_competitions(id) on delete cascade,
 season text not null,source_key text not null check(source_key ~ '^[a-z0-9-]{1,100}$'),
 round_number integer not null check(round_number>0),kind text not null,
 title text not null check(length(btrim(title)) between 1 and 150),images text[] not null,
 created_at timestamptz not null default now(),unique(competition_id,season,source_key)
);
-- A directly reported score has its own source and no attached screenshots.
alter table app.competition_evidence drop constraint if exists competition_evidence_kind_check;
alter table app.competition_evidence drop constraint if exists competition_evidence_images_check;
alter table app.competition_evidence drop constraint if exists competition_evidence_source_check;
alter table app.competition_evidence add constraint competition_evidence_source_check check(
 (kind='screenshots' and app.valid_competition_images(images))
 or(kind='user_report' and cardinality(images)=0)
);
create table if not exists app.competition_results(
 id uuid primary key default gen_random_uuid(),competition_id uuid not null references app.universe_competitions(id) on delete cascade,
 season text not null,match_key text not null,round_number integer check(round_number>0),stage text not null,
 home_id uuid not null references app.competition_teams(id),away_id uuid not null references app.competition_teams(id),
 home_goals integer check(home_goals between 0 and 100),away_goals integer check(away_goals between 0 and 100),
 home_penalties integer check(home_penalties between 0 and 100),away_penalties integer check(away_penalties between 0 and 100),
 video_id text references app.broadcast_sources(video_id),evidence_second integer check(evidence_second>=0),
 evidence_id uuid references app.competition_evidence(id),
 goals jsonb,assists jsonb,yellow_cards jsonb,red_cards jsonb,
 verified boolean not null default false,version integer not null default 1,payload jsonb not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(competition_id,season,match_key),check(home_id<>away_id),
 check(not verified or(home_goals is not null and away_goals is not null))
);
alter table app.competition_results add column if not exists evidence_id uuid references app.competition_evidence(id);
alter table app.competition_results alter column video_id drop not null;
alter table app.competition_results alter column evidence_second drop not null;
alter table app.competition_results drop constraint if exists competition_results_evidence_source;
alter table app.competition_results add constraint competition_results_evidence_source check(
 (video_id is not null and evidence_second is not null and evidence_id is null)
 or(video_id is null and evidence_second is null and evidence_id is not null)
);
create index if not exists competition_results_evidence on app.competition_results(evidence_id);
create index if not exists competition_teams_club on app.competition_teams(club_id);
create index if not exists competition_results_source on app.competition_results(video_id);
create index if not exists competition_results_home on app.competition_results(home_id);
create index if not exists competition_results_away on app.competition_results(away_id);
create table if not exists app.competition_result_versions(
 report_id uuid not null references app.competition_results(id) on delete cascade,
 version integer not null,payload jsonb not null,recorded_at timestamptz not null default now(),primary key(report_id,version)
);
-- Reported rankings are snapshots, independent of events in individual match reports.
create table if not exists app.competition_player_leaders (
 competition_id uuid not null,
 season text not null,
 through_round integer not null check (through_round > 0),
 metric text not null check (metric in ('goals', 'assists', 'cleanSheets')),
 position integer not null check (position > 0),
 team text not null,
 player text not null check (length(btrim(player)) between 1 and 150),
 total integer not null check (total >= 0),
 played integer not null check (played between 1 and through_round),
 source text not null check (source = 'user_report'),
 primary key (competition_id, season, through_round, metric, position),
 foreign key (competition_id, team) references app.competition_teams (competition_id, name) on update cascade on delete cascade,
 check (metric <> 'cleanSheets' or total <= played)
);
create index if not exists competition_player_leaders_team on app.competition_player_leaders (competition_id, team);
alter table app.competition_player_leaders enable row level security;
revoke all on app.competition_player_leaders from public,anon,authenticated;

alter table app.universe_competitions enable row level security;
alter table app.competition_evidence enable row level security;
alter table app.broadcast_sources enable row level security;
alter table app.competition_teams enable row level security;
alter table app.competition_results enable row level security;
alter table app.competition_result_versions enable row level security;
revoke all on app.competition_evidence,app.universe_competitions,app.broadcast_sources,app.competition_teams,app.competition_results,app.competition_result_versions from public,anon,authenticated;

-- Existing Rules remains the canonical competition editor. Removing a competition
-- archives it; its past results and seasons are never deleted by this trigger.
create or replace function app.sync_universe_competitions()returns trigger
language plpgsql security definer set search_path='' as $$
declare entry jsonb; source_id text; key text;
begin
 if jsonb_typeof(new.configuration->'competitions')<>'array' then return new;end if;
 update app.universe_competitions c set archived=true where c.tournament_id=new.tournament_id and c.rule_id is not null and not exists(select 1 from jsonb_array_elements(new.configuration->'competitions')e where e->>'id'=c.rule_id);
 for entry in select value from jsonb_array_elements(new.configuration->'competitions')loop
  source_id:=entry->>'id';
  key:=case when source_id ~'^[a-z0-9-]{1,60}$' then source_id else 'rule-'||md5(source_id)end;
  insert into app.universe_competitions(tournament_id,slug,name,format,current_season,rule_id)
  values(new.tournament_id,key,entry->>'name',entry->>'kind',(select season from public.tournaments where id=new.tournament_id),source_id)
  on conflict(tournament_id,slug)do update set name=excluded.name,format=excluded.format,rule_id=excluded.rule_id,archived=false;
 end loop;
 return new;
end $$;
revoke all on function app.sync_universe_competitions()from public,anon,authenticated;
drop trigger if exists sync_universe_competitions on public.tournament_rules;
create trigger sync_universe_competitions after insert or update of configuration on public.tournament_rules for each row execute function app.sync_universe_competitions();

-- Owner-only importer. NOT exposed to the API or browser roles.
-- Participant UUIDs are explicit; source player names are never auto-linked to a namesake.
create or replace function app.store_competition_result(p_competition uuid,p_doc jsonb,p_expected_version integer default 0) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c app.universe_competitions%rowtype; old app.competition_results%rowtype; result_id uuid; home uuid; away uuid;
 hg integer; ag integer; rd integer; st text; leg integer; match_ref text; field text; rows jsonb; entry jsonb; count_value integer; team uuid; n numeric; stored_version integer; evidence uuid;
begin
 select * into c from app.universe_competitions where id=p_competition for update;
 if p_expected_version is null or p_expected_version<0 then raise exception 'Versión inválida.';end if;
 if c.id is null then raise exception 'La competición no existe.';end if;
 if jsonb_typeof(p_doc)<>'object' then raise exception 'Informe inválido.';end if;
 home:=(p_doc->>'homeId')::uuid;away:=(p_doc->>'awayId')::uuid;
 if home is null or away is null or home=away or(select count(*) from app.competition_teams where competition_id=c.id and id in(home,away))<>2 then raise exception 'Participantes ajenos a esta competición.';end if;
 rd:=(p_doc->>'round')::integer;st:=btrim(coalesce(p_doc->>'stage',''));leg:=coalesce((p_doc->>'leg')::integer,1);
 if (rd is null and st='')or rd<=0 or leg not between 1 and 2 or length(st)>100 then raise exception 'Jornada o fase inválida.';end if;
 evidence:=(p_doc->>'evidenceId')::uuid;
 if evidence is not null then
  if p_doc->>'videoId' is not null or p_doc->>'evidenceSecond' is not null then raise exception 'El informe debe tener una sola fuente de evidencia.';end if;
  select cardinality(images) into count_value from app.competition_evidence where id=evidence and competition_id=c.id and season=c.current_season and round_number=rd;
  if count_value is null then raise exception 'Las capturas no corresponden a la competición, temporada o jornada.';end if;
  if count_value=0 then
   if p_doc ?'sourceImage' then raise exception 'Un marcador informado no tiene captura.';end if;
  else
   n:=coalesce((p_doc->>'sourceImage')::numeric,1);
   if (p_doc ?'sourceImage' and jsonb_typeof(p_doc->'sourceImage')<>'number') or n<1 or n>count_value or trunc(n)<>n then raise exception 'Captura de origen inválida.';end if;
  end if;
 else
  if not exists(select 1 from app.broadcast_sources where video_id=p_doc->>'videoId' and channel_id='UCdi3BBPwD7Y0XTp86qGCofA' and competition_slug=c.slug and(round_number is null or round_number=rd))then raise exception 'La grabación no corresponde a la competición o jornada.';end if;
  if jsonb_typeof(p_doc->'evidenceSecond')<>'number' or coalesce((p_doc->>'evidenceSecond')::numeric,-1)<0 or trunc((p_doc->>'evidenceSecond')::numeric)<>(p_doc->>'evidenceSecond')::numeric then raise exception 'Falta el instante de evidencia.';end if;
 end if;
 if jsonb_typeof(p_doc->'verified')<>'boolean' then raise exception 'Indica si el marcador está verificado.';end if;
 foreach field in array array['homeGoals','awayGoals','homePenalties','awayPenalties']loop
   if p_doc->>field is not null then
    n:=(p_doc->>field)::numeric;
    if jsonb_typeof(p_doc->field)<>'number' or n<0 or n>100 or trunc(n)<>n then raise exception 'Marcador inválido.';end if;
   end if;
 end loop;
 hg:=(p_doc->>'homeGoals')::integer;ag:=(p_doc->>'awayGoals')::integer;
 if (p_doc->>'verified')::boolean and(hg is null or ag is null)then raise exception 'No se puede verificar un marcador desconocido.';end if;
 if ((p_doc->>'homePenalties')is null)<>((p_doc->>'awayPenalties')is null)then raise exception 'Tanda de penaltis incompleta.';end if;
 if p_doc->>'homePenalties' is not null and(hg is null or ag is null or hg is distinct from ag or c.format<>'cup' or p_doc->>'homePenalties'=p_doc->>'awayPenalties')then raise exception 'Tanda de penaltis inválida.';end if;
 foreach field in array array['goals','assists','yellowCards','redCards']loop
  rows:=p_doc->field;
  if rows is not null and rows<>'null'::jsonb then
   if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>300 then raise exception 'Estadísticas inválidas.';end if;
   for entry in select value from jsonb_array_elements(rows)loop
    team:=(entry->>'teamId')::uuid;n:=(entry->>'count')::numeric;
    if jsonb_typeof(entry)<>'object' or team is null or team not in(home,away) or coalesce(length(btrim(entry->>'player')),0) not between 1 and 150
     or jsonb_typeof(entry->'count')<>'number' or n is null or n<1 or n>100 or trunc(n)<>n then raise exception 'Estadística sin jugador, equipo o cantidad verificable.';end if;
    if field='yellowCards' and n>2 or field='redCards' and n>1 then raise exception 'Tarjetas inválidas.';end if;
    if entry ?'ownGoal' and jsonb_typeof(entry->'ownGoal')<>'boolean' then raise exception 'Autogol inválido.';end if;
   end loop;
   if(select count(*)<>count(distinct(value->>'teamId',lower(btrim(value->>'player')),coalesce(value->>'ownGoal','false')))from jsonb_array_elements(rows))then raise exception 'Jugador repetido en el desglose.';end if;
   if field in('goals','assists')then
    foreach team in array array[home,away]loop
      select coalesce(sum((value->>'count')::int),0)into count_value from jsonb_array_elements(rows)where (value->>'teamId')::uuid=team;
      if (case when team=home then hg else ag end)is null then raise exception 'Primero verifica el marcador.';end if;
      if field='goals' and count_value<>(case when team=home then hg else ag end)or field='assists' and count_value>(case when team=home then hg else ag end)then raise exception 'El desglose no coincide con el marcador.';end if;
    end loop;
   end if;
  end if;
 end loop;
 match_ref:=md5(jsonb_build_array(rd,st,home,away,leg)::text);
 select * into old from app.competition_results where competition_id=c.id and season=c.current_season and match_key=match_ref;
 if old.id is not null and old.payload=p_doc then return jsonb_build_object('id',old.id,'version',old.version,'unchanged',true);end if;
 if coalesce(old.version,0)<>p_expected_version then raise exception 'El resultado cambió. Revisa su versión antes de corregirlo.';end if;
 insert into app.competition_results(competition_id,season,match_key,round_number,stage,home_id,away_id,home_goals,away_goals,home_penalties,away_penalties,video_id,evidence_second,evidence_id,goals,assists,yellow_cards,red_cards,verified,payload)
 values(c.id,c.current_season,match_ref,rd,st,home,away,hg,ag,(p_doc->>'homePenalties')::int,(p_doc->>'awayPenalties')::int,p_doc->>'videoId',(p_doc->>'evidenceSecond')::int,evidence,nullif(p_doc->'goals','null'),nullif(p_doc->'assists','null'),nullif(p_doc->'yellowCards','null'),nullif(p_doc->'redCards','null'),(p_doc->>'verified')::boolean,p_doc)
 on conflict(competition_id,season,match_key)do update set home_goals=excluded.home_goals,away_goals=excluded.away_goals,home_penalties=excluded.home_penalties,away_penalties=excluded.away_penalties,video_id=excluded.video_id,evidence_second=excluded.evidence_second,evidence_id=excluded.evidence_id,goals=excluded.goals,assists=excluded.assists,yellow_cards=excluded.yellow_cards,red_cards=excluded.red_cards,verified=excluded.verified,payload=excluded.payload,version=app.competition_results.version+1,updated_at=now()
 returning id,version into result_id,stored_version;
 insert into app.competition_result_versions(report_id,version,payload)values(result_id,stored_version,p_doc);
 return jsonb_build_object('id',result_id,'version',stored_version,'unchanged',false);
end $$;
revoke all on function app.store_competition_result(uuid,jsonb,integer)from public,anon,authenticated;

create or replace function app.competition_archive(p_tournament_id uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_member(p_tournament_id),false)then raise exception 'No tienes acceso a este Universo.';end if;
 with competitions as(select * from app.universe_competitions where tournament_id=p_tournament_id and not archived),
 matches as(select r.* from app.competition_results r join competitions c on c.id=r.competition_id and c.current_season=r.season),
 sides as(
  select m.competition_id,m.home_id team,m.home_goals gf,m.away_goals ga from matches m join competitions c on c.id=m.competition_id where m.verified and(c.format<>'cup' or m.stage=c.ranking_phase)
  union all select m.competition_id,m.away_id,m.away_goals,m.home_goals from matches m join competitions c on c.id=m.competition_id where m.verified and(c.format<>'cup' or m.stage=c.ranking_phase)
 ),
 totals as(select competition_id,team,count(*) played,count(*)filter(where gf>ga) won,count(*)filter(where gf=ga) drawn,count(*)filter(where gf<ga) lost,sum(gf) gf,sum(ga) ga,sum(case when gf>ga then 3 when gf=ga then 1 else 0 end)points from sides group by competition_id,team),
 events as(
  select m.competition_id,k.kind,(e.value->>'teamId')::uuid team,e.value->>'player'player,(e.value->>'count')::integer amount
  from matches m cross join lateral(values('goals',m.goals),('assists',m.assists),('yellowCards',m.yellow_cards),('redCards',m.red_cards))k(kind,items)
  cross join lateral jsonb_array_elements(coalesce(k.items,'[]'))e(value)
  where m.verified and not coalesce((e.value->>'ownGoal')::boolean,false)
 ),
 stats as(select e.competition_id,e.team,e.player,
  sum(amount)filter(where kind='goals')goals,sum(amount)filter(where kind='assists')assists,
  sum(amount)filter(where kind='yellowCards')yellow,sum(amount)filter(where kind='redCards')red
  from events e group by e.competition_id,e.team,e.player)
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'name',c.name,'slug',c.slug,'format',c.format,'season',c.current_season,'reviewFrom',c.review_from,'rankingPhase',c.ranking_phase,
  'latestRound',greatest((select max(round_number)from app.broadcast_sources where competition_slug=c.slug),(select max(round_number)from matches where competition_id=c.id)),
  'videoCount',(select count(*)from app.broadcast_sources where competition_slug=c.slug),
  'verifiedMatches',(select count(*)from matches where competition_id=c.id and verified),
  'standings',case when c.format='cup' and c.ranking_phase is null then '[]'::jsonb else(select coalesce(jsonb_agg(to_jsonb(v)order by v.points desc,v."goalDifference" desc,v."goalsFor" desc,v.team),'[]')from(
    select t.name team,s.played,s.won,s.drawn,s.lost,s.gf "goalsFor",s.ga "goalsAgainst",s.gf-s.ga "goalDifference",s.points from totals s join app.competition_teams t on t.id=s.team where s.competition_id=c.id)v)end,
  'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'round',m.round_number,'stage',m.stage,'homeId',m.home_id,'awayId',m.away_id,'home',h.name,'away',a.name,'homeGoals',m.home_goals,'awayGoals',m.away_goals,'homePenalties',m.home_penalties,'awayPenalties',m.away_penalties,'videoId',m.video_id,'evidenceSecond',m.evidence_second,'evidence',(select jsonb_build_object('kind',e.kind,'title',e.title,'images',case when e.kind='user_report' then e.images else array[e.images[coalesce((m.payload->>'sourceImage')::int,1)]] end)from app.competition_evidence e where e.id=m.evidence_id),'verified',m.verified,'goals',m.goals,'assists',m.assists,'yellowCards',m.yellow_cards,'redCards',m.red_cards,'version',m.version)order by m.round_number,m.stage,m.created_at),'[]')from matches m join app.competition_teams h on h.id=m.home_id join app.competition_teams a on a.id=m.away_id where m.competition_id=c.id),
  'reportedLeaders',(
   select jsonb_build_object('throughRound',p.through_round,'entries',jsonb_agg(
    jsonb_build_object('metric',p.metric,'position',p.position,'team',p.team,'name',p.player,'total',p.total,'played',p.played)
    order by p.metric,p.position))
   from app.competition_player_leaders p
   where p.competition_id=c.id and p.season=c.current_season
    and p.through_round=(select max(latest.through_round) from app.competition_player_leaders latest where latest.competition_id=c.id and latest.season=c.current_season)
   group by p.through_round
  ),
  'players',(select coalesce(jsonb_agg(jsonb_build_object('team',t.name,'name',s.player,'goals',s.goals,'assists',s.assists,'yellowCards',s.yellow,'redCards',s.red)order by s.goals desc nulls last,s.player),'[]')from stats s join app.competition_teams t on t.id=s.team where s.competition_id=c.id)
 )order by c.created_at,c.name),'[]')into result from competitions c;
 return result;
end $$;
revoke all on function app.competition_archive(uuid)from public,anon;
grant execute on function app.competition_archive(uuid)to authenticated;
create or replace function public.competition_archive(p_tournament_id uuid)returns jsonb language sql security invoker set search_path='' as $$select app.competition_archive(p_tournament_id)$$;
revoke all on function public.competition_archive(uuid)from public,anon;
grant execute on function public.competition_archive(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
