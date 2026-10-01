-- 11Eleven — esquema completo en Supabase (Postgres)
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor (reemplaza supabase/catalog.sql,
-- que solo creaba la tabla de staging).
--
-- Modelo de confianza:
--   · El cliente lee DIRECTO con la anon key: todas las tablas permiten solo
--     SELECT y cada política exige pertenecer a la liga (miembro) o ser
--     administrador. Nada es público.
--   · TODA escritura pasa por RPCs security definer (supabase/rpc.sql), que
--     aplican las invariantes del juego en el servidor. El cliente anon no
--     tiene INSERT/UPDATE/DELETE en ninguna tabla.
--   · auth.users de Supabase reemplaza a Convex Auth; el trigger
--     handle_new_user crea el perfil automáticamente al registrarse.

create extension if not exists "pgcrypto";

-- ============================================================
-- Utilidades RLS
-- ============================================================

create or replace function public.my_uid() returns uuid
language sql stable security definer set search_path = public as
$$ select nullif(auth.uid(), '')::uuid $$;

create or replace function public.is_admin(tid uuid) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.tournament_admins a
    where a.tournament_id = tid and a.user_id = public.my_uid()
  )
$$;

create or replace function public.is_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.league_members m
    where m.tournament_id = tid and m.user_id = public.my_uid()
  )
$$;

create or replace function public.my_president_id(tid uuid) returns uuid
language sql stable security definer set search_path = public as
$$
  select p.id from public.presidents p
  where p.tournament_id = tid and p.user_id = public.my_uid()
$$;

-- ============================================================
-- Identidad (reemplaza Convex Auth + tabla users)
-- ============================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  image      text,
  nickname   text,
  active_tournament_id uuid references public.tournaments(id),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, image, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'image',
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Torneo (liga) y reglas
-- ============================================================

create table if not exists public.tournaments (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  season            text not null,
  status            text not null default 'configuracion',
  current_matchday  integer not null default 1,
  total_matchdays   integer not null default 30,
  market_open       boolean not null default false,
  next_matchday_at  timestamptz,
  owner_user_id     uuid references public.profiles(id),
  competition_id    text,
  created_at        timestamptz not null default now()
);

create table if not exists public.tournament_rules (
  tournament_id       uuid primary key references public.tournaments(id) on delete cascade,
  budget              bigint not null default 350000000,
  squad_size          integer not null default 26,
  gk_min integer not null default 2, gk_max integer not null default 3,
  def_min integer not null default 5, def_max integer not null default 9,
  mid_min integer not null default 5, mid_max integer not null default 10,
  fwd_min integer not null default 5, fwd_max integer not null default 9,
  max_per_real_club   integer not null default 3,
  min_ovr             integer not null default 70,
  max_u21             integer not null default 5,
  lineup_lock_hours   integer not null default 2,
  fc27_formation_code text not null default '4-2-3-1',
  formation_instructions text not null default 'Pendiente de completar por el presidente.',
  u20_min             integer not null default 0,
  u20_in_starting_lineup text,               -- obligatory | substitute | null
  same_nationality_min integer not null default 0,
  same_nationality_rule  text,               -- obligatory | changeable | null
  same_nationality_match_duration_minutes integer not null default 0,
  club_nationality_min integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.tournament_admins (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text not null default 'principal',  -- principal | coAdmin
  permissions   text[] not null default '{configuracion,presidentes,jugadores,mercado,draft,calendario,noticias,ia,auditoria}',
  created_at    timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create table if not exists public.league_members (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text not null default 'presidente', -- presidente | administrador
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

-- ============================================================
-- Presidentes, clubes y catálogo de equipos
-- ============================================================

create table if not exists public.presidents (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  nickname      text not null,
  display_name  text not null,
  club_id       uuid,
  budget        bigint not null default 0,
  joined_at     timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.team_catalog (
  id             uuid primary key default gen_random_uuid(),
  sofifa_team_id bigint,
  name           text not null,
  league         text not null,
  country        text not null,
  color_primary  text not null default '#1e293b',
  color_secondary text not null default '#f8fafc'
);
create index if not exists team_catalog_name_idx on public.team_catalog (name);

create table if not exists public.clubs (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  name           text not null,
  short_name     text not null,
  league         text not null,
  country        text not null,
  color_primary  text not null,
  color_secondary text not null,
  catalog_team_id uuid references public.team_catalog(id),
  unique (tournament_id, name)
);
create index if not exists clubs_tournament_idx on public.clubs (tournament_id);

-- ============================================================
-- Catálogo global de jugadores (fuente: staging SoFIFA)
-- ============================================================

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  position    text not null check (position in ('POR','LD','DFC','LI','MCD','MC','MCO','ED','EI','DC')),
  "group"     text not null check ("group" in ('GK','DEF','MID','FWD')),
  ovr         integer not null,
  age         integer not null,
  value       bigint not null,
  nationality text not null,
  flag        text not null default '🏳️',
  real_club   text not null,
  real_league text not null,
  fc_version  text not null,
  photo       text
);
create unique index if not exists players_name_idx on public.players (name);
create index if not exists players_ovr_idx on public.players (ovr desc);
create index if not exists players_real_club_idx on public.players (real_club);
create index if not exists players_position_idx on public.players (position);

create table if not exists public.catalog_stats (
  id         smallint primary key default 1 check (id = 1),
  total      integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Staging de SoFIFA (la llena scripts/sync-players.py desde la Mac)
create table if not exists public.sofifa_players (
  sofifa_id    bigint primary key,
  name         text not null,
  position     text,
  ovr          integer,
  potential    integer,
  age          integer,
  value_eur    bigint default 0,
  nationality  text,
  club         text,
  club_country text,
  league       text,
  photo_url    text,
  r            text,
  fetched_at   timestamptz not null default now()
);
create index if not exists sofifa_players_ovr_idx on public.sofifa_players (ovr desc);

-- Bitácora de sincronizaciones (reemplaza logSyncSuccess/Failure)
create table if not exists public.sync_log (
  id         uuid primary key default gen_random_uuid(),
  actor_name text not null,
  source     text not null,
  status     text not null check (status in ('ok','error')),
  note       text,
  summary    jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Plantillas y propiedad de jugadores
-- ============================================================

create table if not exists public.squads (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null references public.tournaments(id) on delete cascade,
  club_id           uuid not null references public.clubs(id) on delete cascade,
  president_id      uuid not null references public.presidents(id) on delete cascade,
  formation         text not null default '4-2-3-1',
  lineup            jsonb not null default '[]'::jsonb,  -- [{slotId, playerId|null}]
  lineup_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (club_id)
);
create index if not exists squads_tournament_idx on public.squads (tournament_id);
create index if not exists squads_president_idx on public.squads (president_id);

create table if not exists public.squad_players (
  id                    uuid primary key default gen_random_uuid(),
  tournament_id         uuid not null references public.tournaments(id) on delete cascade,
  club_id               uuid not null references public.clubs(id) on delete cascade,
  squad_id              uuid not null references public.squads(id) on delete cascade,
  player_id             uuid not null references public.players(id) on delete cascade,
  president_id          uuid not null references public.presidents(id) on delete cascade,
  availability          text not null default 'neutro' check (availability in ('transferible','negociacion','neutro','intransferible')),
  ovr_at_join           integer not null,
  value_at_join         bigint not null,
  joined_at             timestamptz not null default now(),
  injured_until_matchday integer,
  unique (squad_id, player_id)
);
create index if not exists squad_players_tournament_idx on public.squad_players (tournament_id);
create index if not exists squad_players_squad_idx on public.squad_players (squad_id);
create index if not exists squad_players_player_idx on public.squad_players (player_id);

-- ============================================================
-- Mercado (ofertas)
-- ============================================================

create table if not exists public.offers (
  id                    uuid primary key default gen_random_uuid(),
  tournament_id         uuid not null references public.tournaments(id) on delete cascade,
  type                  text not null check (type in ('cash','trade')),
  bidder_president_id   uuid not null references public.presidents(id),
  bidder_club_id        uuid not null references public.clubs(id),
  seller_president_id   uuid references public.presidents(id),
  seller_club_id        uuid references public.clubs(id),
  requested_player_ids  uuid[] not null default '{}',
  offered_player_ids    uuid[] not null default '{}',
  cash                  bigint not null default 0,
  message               text,
  status                text not null default 'borrador' check (status in ('borrador','enviada','negociacion','aceptada','reservada','ejecutada','rechazada','cancelada','expirada','invalidada')),
  parent_offer_id       uuid references public.offers(id),
  last_validation       text,
  invalid_reason        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  agreed_at             timestamptz,
  executed_at           timestamptz
);
create index if not exists offers_tournament_idx on public.offers (tournament_id);
create index if not exists offers_bidder_idx on public.offers (bidder_president_id);
create index if not exists offers_seller_idx on public.offers (seller_president_id);

-- ============================================================
-- Draft
-- ============================================================

create table if not exists public.drafts (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references public.tournaments(id) on delete cascade,
  status             text not null default 'borrador' check (status in ('borrador','en_curso','pausado','cerrado')),
  "order"            uuid[] not null default '{}',   -- presidentes, en orden de turno
  current_index      integer not null default 0,
  round              integer not null default 1,
  total_rounds       integer not null default 20,
  pick_seconds       integer not null default 120,   -- 0 desactiva el reloj
  current_deadline   timestamptz,
  snake              boolean not null default false,
  executed_reserved  integer,
  invalidated_reserved integer,
  started_at         timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tournament_id)
);

create table if not exists public.draft_picks (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  draft_id      uuid not null references public.drafts(id) on delete cascade,
  president_id  uuid not null references public.presidents(id),
  club_id       uuid not null references public.clubs(id),
  player_id     uuid not null references public.players(id),
  price         bigint not null default 0,
  round         integer not null,
  pick_number   integer not null,
  mode          text not null default 'turno' check (mode in ('turno','reserva')),
  picked_at     timestamptz not null default now(),
  unique (draft_id, player_id)
);
create index if not exists draft_picks_tournament_idx on public.draft_picks (tournament_id);

-- ============================================================
-- Competición (calendario, resultados) y administración
-- ============================================================

create table if not exists public.fixtures (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  matchday      integer not null,
  home_club_id  uuid not null references public.clubs(id),
  away_club_id  uuid not null references public.clubs(id),
  status        text not null default 'programado' check (status in ('programado','en_curso','jugado')),
  kickoff_at    timestamptz not null,
  home_goals    integer,
  away_goals    integer,
  home_points   integer,
  away_points   integer,
  home_xi_ovr   integer,
  away_xi_ovr   integer,
  played_at     timestamptz,
  unique (tournament_id, matchday, home_club_id)
);
create index if not exists fixtures_tournament_matchday_idx on public.fixtures (tournament_id, matchday);

create table if not exists public.prizes (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  phase         text not null check (phase in ('todos_contra_todos','cuadrangulares','fase_siguiente')),
  position      integer not null,
  label         text not null,
  amount        bigint not null default 0,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id),
  unique (tournament_id, phase, position)
);

create table if not exists public.budget_grants (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  president_id  uuid not null references public.presidents(id) on delete cascade,
  concept       text not null,
  amount        bigint not null default 0,
  granted_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table if not exists public.fixture_reports (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  fixture_id    uuid not null references public.fixtures(id) on delete cascade,
  home_goals    integer not null,
  away_goals    integer not null,
  goals         jsonb not null default '[]'::jsonb,  -- [{clubId, playerId, count}]
  yellow_cards  jsonb not null default '[]'::jsonb,
  red_cards     jsonb not null default '[]'::jsonb,
  injuries      jsonb not null default '[]'::jsonb,  -- [{clubId, playerId, matchdays}]
  reported_by   uuid references public.profiles(id),
  reporter_name text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (fixture_id)
);

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  club_id       uuid references public.clubs(id),
  actor_user_id uuid references public.profiles(id),
  actor_name    text not null,
  action        text not null,
  entity        text not null,
  entity_id     text,
  detail        text not null,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_tournament_idx on public.audit_log (tournament_id, created_at desc);

-- ============================================================
-- Row Level Security: solo SELECT; toda escritura por RPC
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.tournaments        enable row level security;
alter table public.tournament_rules   enable row level security;
alter table public.tournament_admins  enable row level security;
alter table public.league_members     enable row level security;
alter table public.presidents         enable row level security;
alter table public.team_catalog       enable row level security;
alter table public.clubs              enable row level security;
alter table public.players            enable row level security;
alter table public.catalog_stats      enable row level security;
alter table public.sofifa_players     enable row level security;
alter table public.sync_log           enable row level security;
alter table public.squads             enable row level security;
alter table public.squad_players      enable row level security;
alter table public.offers             enable row level security;
alter table public.drafts             enable row level security;
alter table public.draft_picks        enable row level security;
alter table public.fixtures           enable row level security;
alter table public.prizes             enable row level security;
alter table public.budget_grants      enable row level security;
alter table public.fixture_reports    enable row level security;
alter table public.audit_log          enable row level security;

-- Perfil propio + perfiles de co-miembros de cualquiera de mis ligas.
create policy "profiles read own or co-members" on public.profiles
  for select to authenticated using (
    id = public.my_uid()
    or exists (
      select 1 from public.league_members mine
      join public.league_members theirs on mine.tournament_id = theirs.tournament_id
      where mine.user_id = public.my_uid() and theirs.user_id = id
    )
    or exists (
      select 1 from public.tournament_admins a
      where a.user_id = id and public.is_member(a.tournament_id)
    )
  );

create policy "tournaments read members" on public.tournaments
  for select to authenticated using (public.is_member(id));

create policy "rules read members" on public.tournament_rules
  for select to authenticated using (public.is_member(tournament_id));

create policy "admins read members" on public.tournament_admins
  for select to authenticated using (public.is_member(tournament_id));

create policy "members read members" on public.league_members
  for select to authenticated using (public.is_member(tournament_id));

create policy "presidents read members" on public.presidents
  for select to authenticated using (public.is_member(tournament_id));

create policy "team catalog read auth" on public.team_catalog
  for select to authenticated using (true);

create policy "clubs read members" on public.clubs
  for select to authenticated using (public.is_member(tournament_id));

create policy "players read auth" on public.players
  for select to authenticated using (true);

create policy "catalog stats read auth" on public.catalog_stats
  for select to authenticated using (true);

-- Staging: solo el rol service (script y RPC) la toca; los usuarios no la leen.
create policy "sofifa staging service only" on public.sofifa_players
  for select to service_role using (true);

create policy "sync log read admins" on public.sync_log
  for select to authenticated using (
    exists (
      select 1 from public.tournament_admins a
      where a.user_id = public.my_uid() and public.is_member(a.tournament_id)
    )
  );

create policy "squads read members" on public.squads
  for select to authenticated using (public.is_member(tournament_id));

create policy "squad players read members" on public.squad_players
  for select to authenticated using (public.is_member(tournament_id));

create policy "offers read members" on public.offers
  for select to authenticated using (public.is_member(tournament_id));

create policy "drafts read members" on public.drafts
  for select to authenticated using (public.is_member(tournament_id));

create policy "draft picks read members" on public.draft_picks
  for select to authenticated using (public.is_member(tournament_id));

create policy "fixtures read members" on public.fixtures
  for select to authenticated using (public.is_member(tournament_id));

create policy "prizes read members" on public.prizes
  for select to authenticated using (public.is_member(tournament_id));

create policy "budget grants read members" on public.budget_grants
  for select to authenticated using (public.is_member(tournament_id));

create policy "fixture reports read members" on public.fixture_reports
  for select to authenticated using (public.is_member(tournament_id));

create policy "audit log read members" on public.audit_log
  for select to authenticated using (public.is_member(tournament_id));

-- Sin políticas INSERT/UPDATE/DELETE: el cliente anon solo puede leer y solo
-- lo que su membresía le permite. Las escrituras viven en supabase/rpc.sql.
