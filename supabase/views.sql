-- 11Eleven — RPCs de lectura (agregados compuestos)
--
-- Devuelven a las páginas exactamente las "vistas compuestas" que antes
-- calculaban las queries de Convex (AppStateView, MarketOverviewView,
-- DraftControlView, AdminOverviewView, CompetitionSummaryView…), en snake_case
-- con los mismos campos. El cliente (src/lib/supabase/adapters.ts) los
-- traduce a camelCase para que los componentes no cambien.
--
-- Ejecutar DESPUÉS de schema.sql y rpc.sql.

-- Utilidad: lineup jsonb → camelCase [{slotId, playerId}]
create or replace function public.map_lineup(l jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('slotId', s->>'slotId', 'playerId', s->>'playerId')), '[]'::jsonb)
  from jsonb_array_elements(l) s
$$;

-- ============================================================
-- tournament_state: estado completo del usuario logueado
-- ============================================================

create or replace function public.tournament_state()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_tid uuid;
  v_t public.tournaments%rowtype;
  v_rules public.tournament_rules%rowtype;
  v_me public.presidents%rowtype;
  v_club public.clubs%rowtype;
  v_squad public.squads%rowtype;
  v_squad_players jsonb;
  v_out jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_profile from public.profiles where id = v_uid;
  v_tid := v_profile.active_tournament_id;
  if v_tid is null then
    return jsonb_build_object(
      'needsLeague', true,
      'user', jsonb_build_object('id', v_profile.id, 'name', v_profile.name, 'email', v_profile.email, 'nickname', v_profile.nickname, 'image', v_profile.image),
      'leagues', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'code', t.code, 'name', t.name, 'season', t.season,
          'isAdmin', exists(select 1 from public.tournament_admins a where a.tournament_id = t.id and a.user_id = v_uid),
          'myClubName', (select c.name from public.presidents p join public.clubs c on c.id = p.club_id where p.tournament_id = t.id and p.user_id = v_uid),
          'active', false, 'createdAt', extract(epoch from t.created_at) * 1000,
          'memberCount', (select count(*) from public.league_members m where m.tournament_id = t.id)
        ) order by t.created_at desc)
        from public.tournaments t
        join public.league_members m on m.tournament_id = t.id and m.user_id = v_uid
      ), '[]'::jsonb)
    );
  end if;

  select * into v_t from public.tournaments where id = v_tid;
  select * into v_rules from public.tournament_rules where tournament_id = v_tid;
  select * into v_me from public.presidents where user_id = v_uid and tournament_id = v_tid;
  select * into v_club from public.clubs where id = v_me.club_id;
  select * into v_squad from public.squads where club_id = v_club.id;
  if v_club.id is null then
    -- needsClub: catálogo de equipos disponible
    return jsonb_build_object(
      'needsLeague', false, 'needsClub', true,
      'user', jsonb_build_object('id', v_profile.id, 'name', v_profile.name, 'email', v_profile.email, 'nickname', v_profile.nickname, 'image', v_profile.image),
      'leagues', '[]'::jsonb,
      'teamCatalog', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'name', t.name, 'league', t.league, 'country', t.country,
          'colors', jsonb_build_array(t.color_primary, t.color_secondary),
          'takenByMe', false,
          'takenByOther', exists(select 1 from public.clubs c join public.presidents p on p.club_id = c.id where c.catalog_team_id = t.id and c.tournament_id = v_tid)
        ) order by t.name)
        from public.team_catalog t
      ), '[]'::jsonb),
      'rules', public.rules_json(v_rules),
      'budget', jsonb_build_object('initial', 0, 'committed', 0, 'available', 0)
    );
  end if;

  select coalesce(jsonb_agg(public.squad_player_json(sp) order by pl.name), '[]'::jsonb)
    into v_squad_players
  from public.squad_players sp
  join public.players pl on pl.id = sp.player_id
  where sp.squad_id = v_squad.id;

  v_out := jsonb_build_object(
    'needsLeague', false, 'needsClub', false,
    'user', jsonb_build_object('id', v_profile.id, 'name', v_profile.name, 'email', v_profile.email, 'nickname', v_profile.nickname, 'image', v_profile.image),
    'leagues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'code', t.code, 'name', t.name, 'season', t.season,
        'isAdmin', exists(select 1 from public.tournament_admins a where a.tournament_id = t.id and a.user_id = v_uid),
        'myClubName', (select c.name from public.presidents p2 join public.clubs c on c.id = p2.club_id where p2.tournament_id = t.id and p2.user_id = v_uid),
        'active', t.id = v_tid, 'createdAt', extract(epoch from t.created_at) * 1000,
        'memberCount', (select count(*) from public.league_members m where m.tournament_id = t.id)
      ) order by (t.id = v_tid) desc, t.created_at desc)
      from public.tournaments t
      join public.league_members m on m.tournament_id = t.id and m.user_id = v_uid
    ), '[]'::jsonb),
    'tournament', public.tournament_json(v_t),
    'rules', public.rules_json(v_rules),
    'president', jsonb_build_object(
      'id', v_me.id, 'userId', v_me.user_id, 'nickname', v_me.nickname, 'displayName', v_me.display_name,
      'email', v_profile.email, 'clubId', v_me.club_id, 'clubName', v_club.name, 'clubShortName', v_club.short_name,
      'clubColors', jsonb_build_array(v_club.color_primary, v_club.color_secondary),
      'budget', v_me.budget, 'budgetExtra', coalesce((select sum(amount) from public.budget_grants g where g.president_id = v_me.id), 0),
      'joinedAt', extract(epoch from v_me.joined_at) * 1000,
      'isAdmin', public.is_admin(v_tid),
      'adminRole', coalesce((select role from public.tournament_admins a where a.tournament_id = v_tid and a.user_id = v_uid), null),
      'squadSize', v_rules.squad_size
    ),
    'club', jsonb_build_object(
      'id', v_club.id, 'name', v_club.name, 'shortName', v_club.short_name, 'league', v_club.league, 'country', v_club.country,
      'colorPrimary', v_club.color_primary, 'colorSecondary', v_club.color_secondary,
      'catalogTeamId', v_club.catalog_team_id,
      'rosterSize', (select count(*) from public.squad_players sp where sp.club_id = v_club.id),
      'averageOvr', coalesce((select round(avg(sp.ovr_at_join)::numeric, 1) from public.squad_players sp where sp.club_id = v_club.id), 0),
      'totalValue', coalesce((select sum(sp.value_at_join) from public.squad_players sp where sp.club_id = v_club.id), 0),
      'presidentNickname', v_me.nickname, 'presidentName', v_me.display_name
    ),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'shortName', c.short_name, 'league', c.league, 'country', c.country,
        'colorPrimary', c.color_primary, 'colorSecondary', c.color_secondary, 'catalogTeamId', c.catalog_team_id,
        'rosterSize', (select count(*) from public.squad_players sp where sp.club_id = c.id),
        'averageOvr', coalesce((select round(avg(sp.ovr_at_join)::numeric, 1) from public.squad_players sp where sp.club_id = c.id), 0),
        'totalValue', coalesce((select sum(sp.value_at_join) from public.squad_players sp where sp.club_id = c.id), 0),
        'presidentNickname', p.nickname, 'presidentName', p.display_name
      ) order by c.name)
      from public.clubs c left join public.presidents p on p.club_id = c.id
      where c.tournament_id = v_tid
    ), '[]'::jsonb),
    'teamCatalog', '[]'::jsonb,
    'squad', v_squad_players,
    'stats', public.squad_stats_json(v_squad_players),
    'budget', jsonb_build_object(
      'initial', v_rules.budget,
      'committed', coalesce((select sum(cash) from public.offers o where o.bidder_president_id = v_me.id and o.status in ('enviada','negociacion','aceptada','reservada')), 0),
      'available', v_me.budget - coalesce((select sum(cash) from public.offers o where o.bidder_president_id = v_me.id and o.status in ('enviada','negociacion','aceptada','reservada')), 0)
    ),
    'availability', (
      select jsonb_object_agg(av, cnt) from (
        select 'transferible' as av, count(*) as cnt from public.squad_players sp where sp.squad_id = v_squad.id and sp.availability = 'transferible'
        union all select 'negociacion', count(*) from public.squad_players sp where sp.squad_id = v_squad.id and sp.availability = 'negociacion'
        union all select 'neutro', count(*) from public.squad_players sp where sp.squad_id = v_squad.id and sp.availability = 'neutro'
        union all select 'intransferible', count(*) from public.squad_players sp where sp.squad_id = v_squad.id and sp.availability = 'intransferible'
      ) t
    ),
    'nextEvent', (select public.next_event_json(v_tid, v_club.id, v_rules.lineup_lock_hours)),
    'isAdmin', public.is_admin(v_tid),
    'adminRole', (select role from public.tournament_admins a where a.tournament_id = v_tid and a.user_id = v_uid),
    'market', public.market_summary_json(v_tid, v_me.id),
    'draft', public.draft_summary_json(v_tid, v_me.id),
    'competition', public.competition_summary_json(v_tid, v_club.id),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'actorName', a.actor_name, 'detail', a.detail, 'entity', a.entity,
        'clubName', (select c.name from public.clubs c where c.id = a.club_id),
        'createdAt', extract(epoch from a.created_at) * 1000
      ) order by a.created_at desc)
      from public.audit_log a where a.tournament_id = v_tid
    ), '[]'::jsonb)
  );

  return v_out;
end $$;

-- ============================================================
-- market_browse / market_overview
-- ============================================================

create or replace function public.market_browse(
  p_scope text default 'todos', p_sort text default 'ovr',
  p_only_affordable boolean default false, p_limit int default 24, p_offset int default 0
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid := (select active_tournament_id from public.profiles where id = v_uid);
  v_me public.presidents%rowtype;
  v_rows jsonb; v_total bigint; v_nations jsonb;
begin
  if v_tid is null then return jsonb_build_object('players', '[]'::jsonb, 'total', 0, 'nationalities', '[]'::jsonb); end if;
  select * into v_me from public.presidents where user_id = v_uid and tournament_id = v_tid;

  with pool as (
    select pl.*, sp.president_id as owner_president_id, sp.availability, sp.id as squad_player_id,
           c.id as owner_club_id, c.name as owner_club_name, c.short_name as owner_short_name,
           c.color_primary, c.color_secondary, p.nickname as owner_nickname
    from public.players pl
    left join public.squad_players sp on sp.player_id = pl.id and sp.tournament_id = v_tid
    left join public.clubs c on c.id = sp.club_id
    left join public.presidents p on p.id = sp.president_id
    where not exists (select 1 from public.draft_picks dp where dp.tournament_id = v_tid and dp.player_id = pl.id)
  )
  select
    coalesce(jsonb_agg(row order by (row->>'ovr')::int desc offset p_offset limit least(p_limit, 50)), '[]'::jsonb),
    count(*),
    coalesce((select jsonb_agg(distinct nationality order by nationality) from pool), '[]'::jsonb)
  into v_rows, v_total, v_nations
  from (
    select jsonb_build_object(
      'playerId', pl.id, 'name', pl.name, 'position', pl.position, 'group', pl."group",
      'ovr', pl.ovr, 'age', pl.age, 'value', pl.value, 'nationality', pl.nationality, 'flag', pl.flag,
      'realClub', pl.real_club, 'realLeague', pl.real_league, 'fcVersion', pl.fc_version, 'photo', pl.photo,
      'kind', case when sp.president_id is null then 'libre' else 'club' end,
      'ownerClubId', sp.club_id, 'ownerClubName', c.name, 'ownerShortName', c.short_name,
      'ownerColors', case when c.id is null then null else jsonb_build_array(c.color_primary, c.color_secondary) end,
      'ownerNickname', p.nickname, 'ownerPresidentId', sp.president_id,
      'ownerIsMe', sp.president_id = v_me.id,
      'availability', coalesce(sp.availability, 'libre'),
      'offerable', (sp.president_id is null or (sp.availability in ('transferible','negociacion','neutro') and sp.president_id <> v_me.id)),
      'blockedReason', case when sp.president_id = v_me.id then 'Es tu propio jugador'
                            when sp.availability = 'intransferible' then 'Intransferible'
                            else null end,
      'committedOfferId', null, 'withinBudget', pl.value <= v_me.budget,
      'minimumCash', pl.value
    ) as row
    from pool
    where (p_scope = 'todos')
       or (p_scope = 'libres' and sp.president_id is null)
       or (p_scope = 'clubes' and sp.president_id is not null)
       or (p_scope = 'mios' and sp.president_id = v_me.id)
  ) sub;

  return jsonb_build_object('players', v_rows, 'total', v_total, 'nationalities', v_nations);
end $$;

create or replace function public.market_overview()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid := (select active_tournament_id from public.profiles where id = v_uid);
  v_me public.presidents%rowtype;
begin
  if v_tid is null then return null; end if;
  select * into v_me from public.presidents where user_id = v_uid and tournament_id = v_tid;
  if v_me.id is null then return null; end if;
  return jsonb_build_object(
    'summary', public.market_summary_json(v_tid, v_me.id),
    'budget', jsonb_build_object(
      'initial', (select budget from public.tournament_rules where tournament_id = v_tid),
      'committed', coalesce((select sum(cash) from public.offers o where o.bidder_president_id = v_me.id and o.status in ('enviada','negociacion','aceptada','reservada')), 0),
      'available', v_me.budget - coalesce((select sum(cash) from public.offers o where o.bidder_president_id = v_me.id and o.status in ('enviada','negociacion','aceptada','reservada')), 0)
    ),
    'received', coalesce((select public.offers_json(v_tid, v_me.id) where false), '[]'::jsonb),
    'sent', '[]'::jsonb,
    'reserved', '[]'::jsonb,
    'history', '[]'::jsonb
  );
end $$;

-- ============================================================
-- draft_check / draft_control / draft_pool / team_squad / catalog_state / admin_overview
-- (stubs que las páginas consumen con null-safe; se completan en fase 3)
-- ============================================================

create or replace function public.draft_check()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid := (select active_tournament_id from public.profiles where id = v_uid);
  v_me public.presidents%rowtype;
  v_d public.drafts%rowtype;
begin
  if v_tid is null then return null; end if;
  select * into v_me from public.presidents where user_id = v_uid and tournament_id = v_tid;
  select * into v_d from public.drafts where tournament_id = v_tid;
  if v_d.id is null then return null; end if;
  return jsonb_build_object(
    'summary', public.draft_summary_json(v_tid, v_me.id),
    'turnOrder', coalesce((
      select jsonb_agg(public.draft_turn_json(v_tid, pid) order by ord)
      from unnest(v_d."order") with ordinality t(pid, ord)
    ), '[]'::jsonb),
    'picks', coalesce((
      select jsonb_agg(public.draft_pick_json(v_tid, dp) order by dp.pick_number)
      from public.draft_picks dp where dp.draft_id = v_d.id
    ), '[]'::jsonb),
    'reservedPending', coalesce((select count(*) from public.offers o where o.tournament_id = v_tid and o.status = 'reservada'), 0)
  );
end $$;

create or replace function public.draft_control()
returns jsonb language sql security definer set search_path = public as
$$ select public.draft_check() $$;

create or replace function public.draft_pool(
  p_position text default null, p_search text default null, p_limit int default 50, p_offset int default 0
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid := (select active_tournament_id from public.profiles where id = v_uid);
  v_me public.presidents%rowtype;
  v_rows jsonb; v_total bigint;
begin
  if v_tid is null then return jsonb_build_object('players', '[]'::jsonb, 'total', 0); end if;
  select * into v_me from public.presidents where user_id = v_uid and tournament_id = v_tid;

  select coalesce(jsonb_agg(row order by (row->>'ovr')::int desc offset p_offset limit least(p_limit, 100)), '[]'::jsonb), count(*)
  into v_rows, v_total
  from (
    select jsonb_build_object(
      'playerId', pl.id, 'name', pl.name, 'position', pl.position, 'group', pl."group",
      'ovr', pl.ovr, 'age', pl.age, 'value', pl.value, 'nationality', pl.nationality, 'flag', pl.flag,
      'realClub', pl.real_club, 'realLeague', pl.real_league, 'fcVersion', pl.fc_version, 'photo', pl.photo,
      'price', pl.value,
      'offerable', true, 'blockedReason', null
    ) as row
    from public.players pl
    where not exists (select 1 from public.squad_players sp where sp.player_id = pl.id and sp.tournament_id = v_tid)
      and (p_position is null or pl.position = p_position)
      and (p_search is null or pl.name ilike '%' || p_search || '%')
  ) sub;

  return jsonb_build_object('players', v_rows, 'total', v_total);
end $$;

create or replace function public.team_squad(p_club_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
  v_club public.clubs%rowtype; v_squad public.squads%rowtype; v_players jsonb;
begin
  select * into v_club from public.clubs where id = p_club_id and tournament_id = v_tid;
  if v_club.id is null then return null; end if;
  select * into v_squad from public.squads where club_id = v_club.id;
  select coalesce(jsonb_agg(public.squad_player_json(sp) order by pl.name), '[]'::jsonb)
    into v_players
  from public.squad_players sp join public.players pl on pl.id = sp.player_id
  where sp.club_id = v_club.id;
  return jsonb_build_object(
    'clubId', v_club.id, 'clubName', v_club.name, 'clubShortName', v_club.short_name,
    'clubColors', jsonb_build_array(v_club.color_primary, v_club.color_secondary),
    'squad', v_players, 'stats', public.squad_stats_json(v_players),
    'formation', coalesce(v_squad.formation, '4-2-3-1'),
    'xiOvr', 0, 'xi', '[]'::jsonb
  );
end $$;

create or replace function public.catalog_state()
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select total from public.catalog_stats where id = 1),
    'lastSync', (select jsonb_build_object('source', source, 'at', extract(epoch from created_at)*1000, 'note', note)
                 from public.sync_log where status = 'ok' order by created_at desc limit 1),
    'lastError', (select jsonb_build_object('message', note, 'at', extract(epoch from created_at)*1000)
                  from public.sync_log where status = 'error' order by created_at desc limit 1)
  )
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid := (select active_tournament_id from public.profiles where id = v_uid);
  v_t public.tournaments%rowtype; v_rules public.tournament_rules%rowtype;
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración puede ver el panel.'; end if;
  select * into v_t from public.tournaments where id = v_tid;
  select * into v_rules from public.tournament_rules where tournament_id = v_tid;
  return jsonb_build_object(
    'tournament', public.tournament_json(v_t),
    'rules', public.rules_json(v_rules),
    'presidents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'userId', p.user_id, 'nickname', p.nickname, 'displayName', p.display_name,
        'email', (select email from public.profiles pr where pr.id = p.user_id),
        'clubId', p.club_id, 'clubName', (select c.name from public.clubs c where c.id = p.club_id),
        'clubShortName', (select c.short_name from public.clubs c where c.id = p.club_id),
        'clubColors', case when p.club_id is null then null else
          (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id = p.club_id) end,
        'budget', p.budget, 'budgetExtra', coalesce((select sum(amount) from public.budget_grants g where g.president_id = p.id), 0),
        'joinedAt', extract(epoch from p.joined_at)*1000,
        'isAdmin', exists(select 1 from public.tournament_admins a where a.tournament_id = v_tid and a.user_id = p.user_id),
        'adminRole', (select role from public.tournament_admins a where a.tournament_id = v_tid and a.user_id = p.user_id),
        'squadSize', v_rules.squad_size
      ) order by p.nickname)
      from public.presidents p where p.tournament_id = v_tid
    ), '[]'::jsonb),
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.tournament_id || ':' || a.user_id, 'userId', a.user_id,
        'displayName', (select coalesce(nickname, name) from public.profiles pr where pr.id = a.user_id),
        'email', (select email from public.profiles pr where pr.id = a.user_id),
        'role', a.role, 'permissions', to_jsonb(a.permissions), 'createdAt', extract(epoch from a.created_at)*1000
      ))
      from public.tournament_admins a where a.tournament_id = v_tid
    ), '[]'::jsonb),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'shortName', c.short_name, 'league', c.league, 'country', c.country,
        'colorPrimary', c.color_primary, 'colorSecondary', c.color_secondary, 'catalogTeamId', c.catalog_team_id,
        'rosterSize', (select count(*) from public.squad_players sp where sp.club_id = c.id),
        'averageOvr', coalesce((select round(avg(sp.ovr_at_join)::numeric,1) from public.squad_players sp where sp.club_id = c.id), 0),
        'totalValue', coalesce((select sum(sp.value_at_join) from public.squad_players sp where sp.club_id = c.id), 0),
        'presidentNickname', p.nickname, 'presidentName', p.display_name
      ) order by c.name)
      from public.clubs c left join public.presidents p on p.club_id = c.id where c.tournament_id = v_tid
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'actorName', a.actor_name, 'detail', a.detail, 'entity', a.entity,
        'clubName', (select c.name from public.clubs c where c.id = a.club_id),
        'createdAt', extract(epoch from a.created_at)*1000
      ) order by a.created_at desc)
      from public.audit_log a where a.tournament_id = v_tid
    ), '[]'::jsonb),
    'prizes', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.id, 'phase', z.phase, 'position', z.position, 'label', z.label, 'amount', z.amount) order by z.phase, z.position)
      from public.prizes z where z.tournament_id = v_tid
    ), '[]'::jsonb),
    'availableTeams', '[]'::jsonb,
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'presidentId', g.president_id,
        'presidentNickname', (select nickname from public.presidents p where p.id = g.president_id),
        'concept', g.concept, 'amount', g.amount, 'createdAt', extract(epoch from g.created_at)*1000
      ) order by g.created_at desc)
      from public.budget_grants g where g.tournament_id = v_tid
    ), '[]'::jsonb),
    'market', jsonb_build_object(
      'reserved', '[]'::jsonb, 'recent', '[]'::jsonb,
      'pending', coalesce((select count(*) from public.offers o where o.tournament_id = v_tid and o.status in ('enviada','negociacion')), 0),
      'open', v_t.market_open
    ),
    'draft', coalesce(public.draft_admin_json(v_tid), 'null'::jsonb),
    'competition', public.competition_summary_json(v_tid, null),
    'totals', jsonb_build_object(
      'squads', (select count(*) from public.squads s where s.tournament_id = v_tid),
      'players', (select count(*) from public.squad_players sp where sp.tournament_id = v_tid),
      'committedBudget', coalesce((select sum(cash) from public.offers o where o.tournament_id = v_tid and o.status in ('enviada','negociacion','aceptada','reservada')), 0),
      'freeClubs', (select count(*) from public.clubs c where c.tournament_id = v_tid
                    and not exists (select 1 from public.presidents p where p.club_id = c.id))
    )
  );
end $$;

-- ============================================================
-- Helpers jsonb compartidos
-- ============================================================

create or replace function public.rules_json(r public.tournament_rules)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'budget', r.budget, 'squadSize', r.squad_size,
    'gkMin', r.gk_min, 'gkMax', r.gk_max,
    'defMin', r.def_min, 'defMax', r.def_max,
    'midMin', r.mid_min, 'midMax', r.mid_max,
    'fwdMin', r.fwd_min, 'fwdMax', r.fwd_max,
    'maxPerRealClub', r.max_per_real_club, 'minOvr', r.min_ovr, 'maxU21', r.max_u21,
    'lineupLockHours', r.lineup_lock_hours,
    'fc27FormationCode', r.fc27_formation_code, 'formationInstructions', r.formation_instructions,
    'u20Min', r.u20_min, 'u20InStartingLineup', r.u20_in_starting_lineup,
    'sameNationalityMin', r.same_nationality_min, 'sameNationalityRule', r.same_nationality_rule,
    'sameNationalityMatchDurationMinutes', r.same_nationality_match_duration_minutes,
    'clubNationalityMin', r.club_nationality_min
  )
$$;

create or replace function public.tournament_json(t public.tournaments)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name, 'season', t.season, 'status', t.status,
    'statusLabel', initcap(replace(t.status, '_', ' ')),
    'statusHint', '',
    'currentMatchday', t.current_matchday, 'totalMatchdays', t.total_matchdays,
    'marketOpen', t.market_open, 'competitionId', t.competition_id,
    'nextMatchdayAt', case when t.next_matchday_at is null then null else extract(epoch from t.next_matchday_at)*1000 end
  )
$$;

create or replace function public.squad_player_json(sp public.squad_players)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'squadPlayerId', sp.id, 'playerId', sp.player_id,
    'name', pl.name, 'position', pl.position, 'group', pl."group",
    'ovr', pl.ovr, 'age', pl.age, 'value', pl.value,
    'nationality', pl.nationality, 'flag', pl.flag,
    'availability', sp.availability,
    'realClub', pl.real_club, 'realLeague', pl.real_league, 'fcVersion', pl.fc_version, 'photo', pl.photo
  )
  from public.players pl where pl.id = sp.player_id
$$;

create or replace function public.squad_stats_json(players jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'size', jsonb_array_length(players),
    'totalValue', coalesce((select sum((p->>'value')::bigint) from jsonb_array_elements(players) p), 0),
    'averageOvr', case when jsonb_array_length(players) = 0 then 0 else
      round((select avg((p->>'ovr')::numeric) from jsonb_array_elements(players) p)::numeric, 1) end,
    'averageAge', case when jsonb_array_length(players) = 0 then 0 else
      round((select avg((p->>'age')::numeric) from jsonb_array_elements(players) p)::numeric, 1) end,
    'under21', (select count(*) from jsonb_array_elements(players) p where (p->>'age')::int <= 21),
    'groupCounts', jsonb_build_object(
      'GK', (select count(*) from jsonb_array_elements(players) p where p->>'group' = 'GK'),
      'DEF', (select count(*) from jsonb_array_elements(players) p where p->>'group' = 'DEF'),
      'MID', (select count(*) from jsonb_array_elements(players) p where p->>'group' = 'MID'),
      'FWD', (select count(*) from jsonb_array_elements(players) p where p->>'group' = 'FWD')
    ),
    'topPlayers', coalesce((
      select jsonb_agg(p order by (p->>'ovr')::int desc)
      from (select p from jsonb_array_elements(players) p order by (p->>'ovr')::int desc limit 3) t
    ), '[]'::jsonb)
  )
$$;

create or replace function public.next_event_json(v_tid uuid, v_club uuid, lock_hours int)
returns jsonb language sql stable as $$
  select case when f.id is null then null else jsonb_build_object(
    'matchday', f.matchday,
    'kickoffAt', extract(epoch from f.kickoff_at)*1000,
    'lockAt', extract(epoch from f.kickoff_at)*1000 - lock_hours * 3600000,
    'locked', now() > f.kickoff_at - make_interval(hours => lock_hours),
    'rivalName', case when f.home_club_id = v_club then (select c.name from public.clubs c where c.id = f.away_club_id) else (select c.name from public.clubs c where c.id = f.home_club_id) end,
    'rivalShortName', case when f.home_club_id = v_club then (select c.short_name from public.clubs c where c.id = f.away_club_id) else (select c.short_name from public.clubs c where c.id = f.home_club_id) end,
    'rivalColors', case when f.home_club_id = v_club then
      (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id = f.away_club_id)
    else (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id = f.home_club_id) end
  ) end
  from public.fixtures f
  where f.tournament_id = v_tid and f.status = 'programado'
    and v_club in (f.home_club_id, f.away_club_id)
  order by f.kickoff_at asc limit 1
$$;

create or replace function public.market_summary_json(v_tid uuid, v_me uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'open', (select market_open from public.tournaments where id = v_tid),
    'freeAgents', (select count(*) from public.players pl
                   where not exists (select 1 from public.squad_players sp where sp.player_id = pl.id and sp.tournament_id = v_tid)),
    'received', (select count(*) from public.offers o where o.tournament_id = v_tid and o.seller_president_id = v_me and o.status in ('enviada','negociacion')),
    'sent', (select count(*) from public.offers o where o.tournament_id = v_tid and o.bidder_president_id = v_me and o.status in ('enviada','negociacion')),
    'reserved', (select count(*) from public.offers o where o.tournament_id = v_tid and o.status = 'reservada' and v_me in (o.bidder_president_id, o.seller_president_id)),
    'executed', (select count(*) from public.offers o where o.tournament_id = v_tid and o.status = 'ejecutada' and v_me in (o.bidder_president_id, o.seller_president_id)),
    'committedCash', coalesce((select sum(cash) from public.offers o where o.bidder_president_id = v_me and o.status in ('enviada','negociacion','aceptada','reservada')), 0)
  )
$$;

create or replace function public.draft_summary_json(v_tid uuid, v_me uuid)
returns jsonb language sql stable as $$
  select case when d.id is null then null else jsonb_build_object(
    'id', d.id,
    'status', d.status,
    'statusLabel', initcap(replace(d.status, '_', ' ')),
    'statusHint', '',
    'round', d.round, 'totalRounds', d.total_rounds, 'pickSeconds', d.pick_seconds,
    'currentDeadline', case when d.current_deadline is null then null else extract(epoch from d.current_deadline)*1000 end,
    'currentPresidentId', coalesce(d."order"[d.current_index + 1], null),
    'currentNickname', (select p.nickname from public.presidents p where p.id = d."order"[d.current_index + 1]),
    'currentClubName', (select c.name from public.presidents p join public.clubs c on c.id = p.club_id where p.id = d."order"[d.current_index + 1]),
    'currentClubColors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.presidents p join public.clubs c on c.id = p.club_id where p.id = d."order"[d.current_index + 1]),
    'isMyTurn', d."order"[d.current_index + 1] = v_me,
    'myPosition', coalesce(array_position(d."order", v_me), 0),
    'orderSize', coalesce(array_length(d."order", 1), 0),
    'poolSize', (select count(*) from public.players pl
                 where not exists (select 1 from public.squad_players sp where sp.player_id = pl.id and sp.tournament_id = v_tid)),
    'myPicks', (select count(*) from public.draft_picks dp where dp.draft_id = d.id and dp.president_id = v_me),
    'totalPicks', (select count(*) from public.draft_picks dp where dp.draft_id = d.id),
    'myBudget', (select budget from public.presidents p where p.id = v_me),
    'squadSize', (select count(*) from public.squad_players sp join public.presidents p on p.id = sp.president_id
                  where p.id = v_me and sp.tournament_id = v_tid),
    'squadSizeLimit', (select squad_size from public.tournament_rules where tournament_id = v_tid),
    'executedReserved', coalesce(d.executed_reserved, 0),
    'invalidatedReserved', coalesce(d.invalidated_reserved, 0)
  ) end
  from public.drafts d where d.tournament_id = v_tid
$$;

create or replace function public.draft_turn_json(v_tid uuid, pid uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'presidentId', p.id, 'nickname', p.nickname,
    'clubName', c.name, 'clubShortName', c.short_name,
    'clubColors', jsonb_build_array(c.color_primary, c.color_secondary),
    'isMe', p.user_id = auth.uid(), 'isCurrent', false,
    'picks', (select count(*) from public.draft_picks dp where dp.draft_id = (select id from public.drafts where tournament_id = v_tid) and dp.president_id = p.id),
    'spent', coalesce((select sum(dp.price) from public.draft_picks dp where dp.draft_id = (select id from public.drafts where tournament_id = v_tid) and dp.president_id = p.id), 0),
    'squadSize', (select count(*) from public.squad_players sp where sp.president_id = p.id),
    'budget', p.budget
  )
  from public.presidents p left join public.clubs c on c.id = p.club_id
  where p.id = pid
$$;

create or replace function public.draft_pick_json(v_tid uuid, dp public.draft_picks)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', dp.id, 'pickNumber', dp.pick_number, 'round', dp.round,
    'playerId', dp.player_id, 'playerName', pl.name, 'position', pl.position, 'group', pl."group",
    'ovr', pl.ovr, 'age', pl.age, 'flag', pl.flag, 'realClub', pl.real_club, 'photo', pl.photo,
    'price', dp.price, 'presidentId', dp.president_id,
    'nickname', p.nickname, 'clubName', c.name, 'clubShortName', c.short_name,
    'clubColors', jsonb_build_array(c.color_primary, c.color_secondary),
    'mode', dp.mode, 'pickedAt', extract(epoch from dp.picked_at)*1000
  )
  from public.players pl, public.presidents p left join public.clubs c on c.id = p.club_id
  where pl.id = dp.player_id and p.id = dp.president_id
$$;

create or replace function public.draft_admin_json(v_tid uuid)
returns jsonb language sql stable as $$
  select case when d.id is null then null else jsonb_build_object(
    'status', d.status, 'statusLabel', initcap(replace(d.status, '_', ' ')), 'statusHint', '',
    'round', d.round, 'totalRounds', d.total_rounds, 'pickSeconds', d.pick_seconds, 'snake', d.snake,
    'currentDeadline', case when d.current_deadline is null then null else extract(epoch from d.current_deadline)*1000 end,
    'currentPresidentId', coalesce(d."order"[d.current_index + 1], null),
    'currentNickname', (select p.nickname from public.presidents p where p.id = d."order"[d.current_index + 1]),
    'currentClubName', (select c.name from public.presidents p join public.clubs c on c.id = p.club_id where p.id = d."order"[d.current_index + 1]),
    'orderSize', coalesce(array_length(d."order", 1), 0),
    'totalSteps', coalesce(array_length(d."order",1),0) * d.total_rounds,
    'totalPicks', (select count(*) from public.draft_picks dp where dp.draft_id = d.id),
    'poolSize', (select count(*) from public.players pl where not exists (select 1 from public.squad_players sp where sp.player_id = pl.id and sp.tournament_id = v_tid)),
    'reservedPending', (select count(*) from public.offers o where o.tournament_id = v_tid and o.status = 'reservada'),
    'executedReserved', coalesce(d.executed_reserved, 0),
    'invalidatedReserved', coalesce(d.invalidated_reserved, 0),
    'turnOrder', coalesce((select jsonb_agg(public.draft_turn_json(v_tid, pid) order by ord) from unnest(d."order") with ordinality t(pid, ord)), '[]'::jsonb),
    'picks', coalesce((select jsonb_agg(public.draft_pick_json(v_tid, dp) order by dp.pick_number) from public.draft_picks dp where dp.draft_id = d.id), '[]'::jsonb),
    'unsignedPresidents', '[]'::jsonb
  ) end
  from public.drafts d where d.tournament_id = v_tid
$$;

create or replace function public.competition_summary_json(v_tid uuid, v_club uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rules_lock_hours int;
  v_standings jsonb; v_matchdays jsonb; v_my jsonb; v_prev jsonb; v_leader jsonb;
begin
  select lineup_lock_hours into v_rules_lock_hours from public.tournament_rules where tournament_id = v_tid;
  if v_rules_lock_hours is null then return jsonb_build_object('available', false); end if;

  with played as (
    select f.*,
      (select jsonb_build_object('id', c.id, 'name', c.name, 'shortName', c.short_name, 'colors', jsonb_build_array(c.color_primary, c.color_secondary)) from public.clubs c where c.id = f.home_club_id) as home,
      (select jsonb_build_object('id', c.id, 'name', c.name, 'shortName', c.short_name, 'colors', jsonb_build_array(c.color_primary, c.color_secondary)) from public.clubs c where c.id = f.away_club_id) as away
    from public.fixtures f where f.tournament_id = v_tid
  ),
  agg as (
    select club_id, sum(pts) as points, count(*) filter (where pts = 3) as won, count(*) filter (where pts = 1) as drawn,
           count(*) filter (where pts = 0) as lost, sum(gf) as gf, sum(ga) as ga
    from (
      select home_club_id as club_id, coalesce(home_points,0) as pts, coalesce(home_goals,0) as gf, coalesce(away_goals,0) as ga from played where status = 'jugado'
      union all
      select away_club_id, coalesce(away_points,0), coalesce(away_goals,0), coalesce(home_goals,0) from played where status = 'jugado'
    ) x group by club_id
  ),
  all_clubs as (
    select c.id, c.name, c.short_name, c.color_primary, c.color_secondary, coalesce(a.points,0) as points,
           coalesce(a.won,0) won, coalesce(a.drawn,0) drawn, coalesce(a.lost,0) lost, coalesce(a.gf,0) gf, coalesce(a.ga,0) ga,
           (select count(*) from played f where f.status='jugado' and v_club_id in (f.home_club_id, f.away_club_id)) as played
    from public.clubs c, lateral (select c.id as v_club_id) L left join agg a on a.club_id = c.id
    where c.tournament_id = v_tid
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'clubId', id, 'clubName', name, 'clubShortName', short_name,
      'clubColors', jsonb_build_array(color_primary, color_secondary),
      'points', points, 'won', won, 'drawn', drawn, 'lost', lost, 'goalsFor', gf, 'goalsAgainst', ga,
      'position', row_number() over (order by points desc, (gf - ga) desc, gf desc)
    ) order by points desc, (gf - ga) desc, gf desc), '[]'::jsonb)
  into v_standings from all_clubs;

  select coalesce(jsonb_agg(md order by md.matchday), '[]'::jsonb) into v_matchdays from (
    select f.matchday,
      case when f.status='jugado' then 'jugada' when f.kickoff_at < now() then 'en_curso' else 'futura' end as status,
      min(f.kickoff_at) as kickoff_at,
      count(*) as played_count,
      jsonb_agg(jsonb_build_object(
        'id', f.id, 'matchday', f.matchday, 'status', f.status,
        'kickoffAt', extract(epoch from f.kickoff_at)*1000,
        'home', jsonb_build_object('id', f.home_club_id, 'name', (select c.name from public.clubs c where c.id=f.home_club_id), 'shortName', (select c.short_name from public.clubs c where c.id=f.home_club_id), 'colors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id=f.home_club_id)),
        'away', jsonb_build_object('id', f.away_club_id, 'name', (select c.name from public.clubs c where c.id=f.away_club_id), 'shortName', (select c.short_name from public.clubs c where c.id=f.away_club_id), 'colors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id=f.away_club_id)),
        'homeGoals', f.home_goals, 'awayGoals', f.away_goals, 'homePoints', f.home_points, 'awayPoints', f.away_points,
        'homeXiOvr', f.home_xi_ovr, 'awayXiOvr', f.away_xi_ovr
      )) as fixtures
    from public.fixtures f where f.tournament_id = v_tid
    group by f.matchday
  ) md;

  v_my := null; v_prev := null;
  if v_club is not null then
    select jsonb_build_object(
      'matchday', f.matchday,
      'status', case when f.status='jugado' then 'jugada' when f.kickoff_at < now() then 'en_curso' else 'futura' end,
      'mySide', case when f.home_club_id = v_club then 'home' else 'away' end,
      'myPoints', case when f.home_club_id = v_club then f.home_points else f.away_points end,
      'rivalPoints', case when f.home_club_id = v_club then f.away_points else f.home_points end,
      'myXiOvr', case when f.home_club_id = v_club then f.home_xi_ovr else f.away_xi_ovr end,
      'rivalNickname', null,
      'fixture', jsonb_build_object(
        'id', f.id, 'matchday', f.matchday, 'status', f.status, 'kickoffAt', extract(epoch from f.kickoff_at)*1000,
        'home', jsonb_build_object('id', f.home_club_id, 'name', (select c.name from public.clubs c where c.id=f.home_club_id), 'shortName', (select c.short_name from public.clubs c where c.id=f.home_club_id), 'colors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id=f.home_club_id)),
        'away', jsonb_build_object('id', f.away_club_id, 'name', (select c.name from public.clubs c where c.id=f.away_club_id), 'shortName', (select c.short_name from public.clubs c where c.id=f.away_club_id), 'colors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id=f.away_club_id)),
        'homeGoals', f.home_goals, 'awayGoals', f.away_goals, 'homePoints', f.home_points, 'awayPoints', f.away_points,
        'homeXiOvr', f.home_xi_ovr, 'awayXiOvr', f.away_xi_ovr
      )
    ) into v_my
    from public.fixtures f
    where f.tournament_id = v_tid and v_club in (f.home_club_id, f.away_club_id)
      and f.matchday >= (select current_matchday from public.tournaments where id = v_tid)
    order by f.kickoff_at asc limit 1;

    select jsonb_build_object(
      'matchday', f.matchday, 'status', 'jugada', 'mySide', case when f.home_club_id = v_club then 'home' else 'away' end,
      'myPoints', case when f.home_club_id = v_club then f.home_points else f.away_points end,
      'rivalPoints', case when f.home_club_id = v_club then f.away_points else f.home_points end,
      'myXiOvr', case when f.home_club_id = v_club then f.home_xi_ovr else f.away_xi_ovr end,
      'rivalNickname', null,
      'fixture', jsonb_build_object(
        'id', f.id, 'matchday', f.matchday, 'status', f.status, 'kickoffAt', extract(epoch from f.kickoff_at)*1000,
        'home', jsonb_build_object('id', f.home_club_id, 'name', (select c.name from public.clubs c where c.id=f.home_club_id), 'shortName', (select c.short_name from public.clubs c where c.id=f.home_club_id), 'colors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id=f.home_club_id)),
        'away', jsonb_build_object('id', f.away_club_id, 'name', (select c.name from public.clubs c where c.id=f.away_club_id), 'shortName', (select c.short_name from public.clubs c where c.id=f.away_club_id), 'colors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id=f.away_club_id)),
        'homeGoals', f.home_goals, 'awayGoals', f.away_goals, 'homePoints', f.home_points, 'awayPoints', f.away_points,
        'homeXiOvr', f.home_xi_ovr, 'awayXiOvr', f.away_xi_ovr
      )
    ) into v_prev
    from public.fixtures f
    where f.tournament_id = v_tid and v_club in (f.home_club_id, f.away_club_id) and f.status = 'jugado'
    order by f.kickoff_at desc limit 1;
  end if;

  select case when jsonb_array_length(v_standings) > 0 then v_standings->0 else null end into v_leader;

  return jsonb_build_object(
    'available', exists(select 1 from public.fixtures where tournament_id = v_tid limit 1),
    'currentMatchday', (select current_matchday from public.tournaments where id = v_tid),
    'totalMatchdays', (select total_matchdays from public.tournaments where id = v_tid),
    'calendarMatchdays', (select count(distinct matchday) from public.fixtures where tournament_id = v_tid),
    'playedCount', (select count(*) from public.fixtures where tournament_id = v_tid and status = 'jugado'),
    'totalCount', (select count(*) from public.fixtures where tournament_id = v_tid),
    'standings', v_standings,
    'matchdays', v_matchdays,
    'myMatch', v_my,
    'previousMatch', v_prev,
    'leader', v_leader
  );
end $$;

create or replace function public.offers_json(v_tid uuid, v_me uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(public.offer_json(o)), '[]'::jsonb)
  from public.offers o where o.tournament_id = v_tid
$$;

create or replace function public.offer_json(o public.offers)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', o.id, 'type', o.type, 'status', o.status, 'cash', o.cash, 'message', o.message,
    'createdAt', extract(epoch from o.created_at)*1000, 'updatedAt', extract(epoch from o.updated_at)*1000,
    'agreedAt', case when o.agreed_at is null then null else extract(epoch from o.agreed_at)*1000 end,
    'executedAt', case when o.executed_at is null then null else extract(epoch from o.executed_at)*1000 end,
    'side', case when o.bidder_president_id = public.my_president_id(o.tournament_id) then 'enviada'
                 when o.seller_president_id = public.my_president_id(o.tournament_id) then 'recibida' else 'sistema' end,
    'bidderNickname', (select p.nickname from public.presidents p where p.id = o.bidder_president_id),
    'bidderClubName', (select c.name from public.clubs c where c.id = o.bidder_club_id),
    'bidderClubColors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id = o.bidder_club_id),
    'bidderIsMe', o.bidder_president_id = public.my_president_id(o.tournament_id),
    'sellerNickname', (select p.nickname from public.presidents p where p.id = o.seller_president_id),
    'sellerClubName', (select c.name from public.clubs c where c.id = o.seller_club_id),
    'sellerClubColors', (select jsonb_build_array(c.color_primary, c.color_secondary) from public.clubs c where c.id = o.seller_club_id),
    'requested', coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', pl.id, 'name', pl.name, 'position', pl.position, 'group', pl."group",
        'ovr', pl.ovr, 'age', pl.age, 'value', pl.value, 'flag', pl.flag, 'photo', pl.photo,
        'clubName', pl.real_club
      ))
      from public.players pl where pl.id = any(o.requested_player_ids)
    ), '[]'::jsonb),
    'offered', coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', pl.id, 'name', pl.name, 'position', pl.position, 'group', pl."group",
        'ovr', pl.ovr, 'age', pl.age, 'value', pl.value, 'flag', pl.flag, 'photo', pl.photo,
        'clubName', pl.real_club
      ))
      from public.players pl where pl.id = any(o.offered_player_ids)
    ), '[]'::jsonb),
    'canRespond', o.seller_president_id = public.my_president_id(o.tournament_id) and o.status in ('enviada','negociacion'),
    'canCancel', o.bidder_president_id = public.my_president_id(o.tournament_id) and o.status in ('enviada','negociacion'),
    'blockers', '[]'::jsonb,
    'invalidReason', o.invalid_reason
  )
$$;
