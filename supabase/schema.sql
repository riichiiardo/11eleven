-- ============================================================================
-- 11Eleven · supabase/schema.sql  —  PASO 1 de 3
-- Ejecutar PRIMERO en el SQL Editor de Supabase.
-- Crea: tablas del juego + helpers RLS + trigger de perfiles + políticas.
-- Es idempotente: puedes volver a ejecutarlo sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers de identidad y membresía (los usan las políticas RLS)
-- ---------------------------------------------------------------------------
create schema if not exists app;

create or replace function app.my_uid() returns uuid
language sql stable security definer set search_path = public as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function app.is_admin(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tournament_admins a
    where a.tournament_id = tid and a.user_id = app.my_uid()
  );
$$;

create or replace function app.is_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_admin(tid) or exists (
    select 1 from league_members m where m.tournament_id = tid and m.user_id = app.my_uid()
  );
$$;

-- Los mismos helpers en PUBLIC: rpc.sql y views.sql los llaman como
-- public.is_admin / public.is_member / public.my_president_id.
create or replace function public.my_uid() returns uuid
language sql stable as $$
  select app.my_uid();
$$;

create or replace function public.is_admin(tid uuid) returns boolean
language sql stable as $$
  select app.is_admin(tid);
$$;

create or replace function public.is_member(tid uuid) returns boolean
language sql stable as $$
  select app.is_member(tid);
$$;

-- Presidencia del usuario actual dentro de una liga (null si no preside nada).
create or replace function public.my_president_id(tid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from presidents p
  where p.tournament_id = tid and p.user_id = app.my_uid()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 1) Perfiles (1 fila por cuenta; la crea el trigger al registrarse)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  nickname text,
  image text,
  is_anonymous boolean default false,
  active_tournament_id uuid,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, nickname, is_anonymous)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1)),
    null,
    coalesce((new.raw_user_meta_data->>'is_anonymous')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2) Torneos y configuración
-- ---------------------------------------------------------------------------
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  season text not null,
  status text not null default 'configuracion'
    check (status in ('configuracion','inscripciones','seleccion_clubes','pre_draft','negociaciones',
                      'draft_abierto','draft_en_curso','draft_cerrado','plantillas_bloqueadas',
                      'competicion','cierre_jornada','suspendido','cancelado')),
  current_matchday integer not null default 1,
  total_matchdays integer not null default 0,
  market_open boolean not null default false,
  next_matchday_at timestamptz,
  owner_user_id uuid references profiles(id),
  competition_id text,
  created_at timestamptz not null default now()
);
alter table tournaments enable row level security;

create table if not exists tournament_rules (
  tournament_id uuid primary key references tournaments(id) on delete cascade,
  budget numeric not null default 350000000,
  squad_size integer not null default 26,
  gk_min integer not null default 2,  gk_max integer not null default 3,
  def_min integer not null default 5, def_max integer not null default 9,
  mid_min integer not null default 5, mid_max integer not null default 10,
  fwd_min integer not null default 5, fwd_max integer not null default 9,
  max_per_real_club integer not null default 3,
  min_ovr integer not null default 70,
  max_u21 integer not null default 5,
  lineup_lock_hours integer not null default 2,
  fc27_formation_code text not null default '4-2-3-1',
  formation_instructions text not null default 'Pendiente de completar por el presidente.',
  u20_min integer not null default 0,
  u20_in_starting_lineup text check (u20_in_starting_lineup in ('obligatory','substitute')),
  same_nationality_min integer not null default 0,
  same_nationality_rule text check (same_nationality_rule in ('obligatory','changeable')),
  same_nationality_match_duration_minutes integer not null default 0,
  club_nationality_min integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
alter table tournament_rules enable row level security;

create table if not exists tournament_admins (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('principal','coAdmin')),
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
alter table tournament_admins enable row level security;

create table if not exists league_members (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('presidente','administrador')),
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
alter table league_members enable row level security;

-- ---------------------------------------------------------------------------
-- 3) Catálogo global (equipos + jugadores, compartido por todas las ligas)
-- ---------------------------------------------------------------------------
create table if not exists team_catalog (
  id uuid primary key default gen_random_uuid(),
  sofifa_team_id bigint unique,
  name text not null,
  league text not null,
  country text not null,
  color_primary text not null default '#334155',
  color_secondary text not null default '#0f172a',
  created_at timestamptz not null default now()
);
alter table team_catalog enable row level security;

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  short_name text not null,
  league text not null,
  country text not null,
  color_primary text not null default '#334155',
  color_secondary text not null default '#0f172a',
  catalog_team_id uuid references team_catalog(id),
  unique (tournament_id, catalog_team_id)
);
alter table clubs enable row level security;

-- Posiciones válidas del juego (iguales al motor de reglas de la app).
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position text not null check (position in ('POR','LD','DFC','LI','MCD','MC','MCO','ED','EI','DC')),
  "group" text not null check ("group" in ('GK','DEF','MID','FWD')),
  ovr integer not null,
  age integer not null,
  value bigint not null,
  nationality text not null default '',
  flag text not null default '',
  real_club text not null default 'Agente libre',
  real_league text not null default '',
  fc_version text not null default 'FC 27',
  photo text,
  created_at timestamptz not null default now()
);
create index if not exists players_by_position on players(position);
create index if not exists players_by_real_club on players(real_club);
create index if not exists players_by_name on players(name);
alter table players enable row level security;

-- Contadores del catálogo (sustituye escaneos completos de `players`).
create table if not exists catalog_stats (
  id integer primary key default 1 check (id = 1),
  total bigint not null default 0,
  version text not null default '',
  last_sync jsonb,
  updated_at timestamptz not null default now()
);
alter table catalog_stats enable row level security;

-- Staging de SoFIFA que llena scripts/sync-players.py desde tu Mac.
-- Las columnas coinciden EXACTAMENTE con las claves que sube el script.
create table if not exists sofifa_players (
  sofifa_id bigint primary key,
  name text not null,
  position text,
  ovr integer,
  potential integer,
  age integer,
  value_eur bigint default 0,
  nationality text,
  club text,
  club_country text,
  league text,
  photo_url text,
  r text,
  fetched_at timestamptz not null default now()
);
create index if not exists sofifa_players_ovr_idx on sofifa_players (ovr desc);
alter table sofifa_players enable row level security;

create table if not exists sync_log (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  unchanged integer not null default 0,
  note text,
  actor_name text,
  status text,
  summary jsonb
);
alter table sync_log enable row level security;

-- ---------------------------------------------------------------------------
-- 4) Presidencias, plantillas y draft
-- ---------------------------------------------------------------------------
create table if not exists presidents (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  nickname text not null,
  display_name text not null,
  club_id uuid references clubs(id),
  budget numeric not null default 0,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id),
  unique (club_id)
);
alter table presidents enable row level security;

create table if not exists squads (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  club_id uuid not null unique references clubs(id) on delete cascade,
  president_id uuid not null references presidents(id) on delete cascade,
  formation text not null default '4-2-3-1',
  lineup jsonb not null default '[]'::jsonb,
  lineup_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table squads enable row level security;

create table if not exists squad_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  squad_id uuid not null references squads(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  president_id uuid not null references presidents(id) on delete cascade,
  availability text not null default 'neutro'
    check (availability in ('transferible','negociacion','neutro','intransferible')),
  ovr_at_join integer not null default 0,
  value_at_join bigint not null default 0,
  joined_at timestamptz not null default now(),
  injured_until_matchday integer,
  unique (tournament_id, player_id)
);
create index if not exists squad_players_by_club on squad_players(club_id);
create index if not exists squad_players_by_player on squad_players(player_id);
-- Índice árbitro exacto que usa respond_offer_execute_reserved (ON CONFLICT).
create unique index if not exists squad_players_squad_player_uq on squad_players(squad_id, player_id);
alter table squad_players enable row level security;

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references tournaments(id) on delete cascade,
  status text not null default 'borrador'
    check (status in ('borrador','en_curso','pausado','cerrado')),
  "order" uuid[] not null default '{}',
  current_index integer not null default 0,
  round integer not null default 1,
  total_rounds integer not null default 3,
  pick_seconds integer not null default 0,
  current_deadline timestamptz,
  snake boolean not null default false,
  executed_reserved integer not null default 0,
  invalidated_reserved integer not null default 0,
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table drafts enable row level security;

create table if not exists draft_picks (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  draft_id uuid not null references drafts(id) on delete cascade,
  president_id uuid not null references presidents(id) on delete cascade,
  club_id uuid references clubs(id),
  player_id uuid not null references players(id) on delete cascade,
  price numeric not null default 0,
  round integer not null default 1,
  pick_number integer not null default 1,
  mode text not null default 'turno' check (mode in ('turno','reserva')),
  picked_at timestamptz not null default now()
);
create index if not exists draft_picks_by_draft on draft_picks(draft_id);
create index if not exists draft_picks_by_player on draft_picks(player_id);
alter table draft_picks enable row level security;

-- ---------------------------------------------------------------------------
-- 5) Mercado
-- ---------------------------------------------------------------------------
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  type text not null check (type in ('cash','trade')),
  bidder_president_id uuid not null references presidents(id) on delete cascade,
  bidder_club_id uuid not null references clubs(id) on delete cascade,
  seller_president_id uuid references presidents(id),
  seller_club_id uuid references clubs(id),
  requested_player_ids uuid[] not null default '{}',
  offered_player_ids uuid[] not null default '{}',
  cash numeric not null default 0,
  message text,
  status text not null default 'enviada'
    check (status in ('borrador','enviada','negociacion','aceptada','reservada','ejecutada',
                      'rechazada','cancelada','expirada','invalidada')),
  parent_offer_id uuid references offers(id),
  last_validation text,
  invalid_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  agreed_at timestamptz,
  executed_at timestamptz
);
create index if not exists offers_by_tournament on offers(tournament_id);
create index if not exists offers_by_bidder on offers(bidder_president_id);
create index if not exists offers_by_seller on offers(seller_president_id);
alter table offers enable row level security;

-- ---------------------------------------------------------------------------
-- 6) Competición, premios, presupuesto extra y auditoría
-- ---------------------------------------------------------------------------
create table if not exists fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  matchday integer not null,
  home_club_id uuid not null references clubs(id) on delete cascade,
  away_club_id uuid not null references clubs(id) on delete cascade,
  status text not null default 'programado' check (status in ('programado','en_curso','jugado')),
  kickoff_at timestamptz not null default now(),
  home_goals integer,
  away_goals integer,
  home_points numeric,
  away_points numeric,
  home_xi_ovr numeric,
  away_xi_ovr numeric,
  played_at timestamptz
);
create index if not exists fixtures_by_tournament_md on fixtures(tournament_id, matchday);
create index if not exists fixtures_by_home on fixtures(home_club_id);
create index if not exists fixtures_by_away on fixtures(away_club_id);
alter table fixtures enable row level security;

create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  phase text not null check (phase in ('todos_contra_todos','cuadrangulares','fase_siguiente')),
  position integer not null,
  label text not null default '',
  amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  unique (tournament_id, phase, position)
);
alter table prizes enable row level security;

create table if not exists budget_grants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  president_id uuid not null references presidents(id) on delete cascade,
  concept text not null default '',
  amount numeric not null default 0,
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table budget_grants enable row level security;

create table if not exists fixture_reports (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  fixture_id uuid not null unique references fixtures(id) on delete cascade,
  home_goals integer not null,
  away_goals integer not null,
  goals jsonb not null default '[]'::jsonb,
  yellow_cards jsonb not null default '[]'::jsonb,
  red_cards jsonb not null default '[]'::jsonb,
  injuries jsonb not null default '[]'::jsonb,
  reported_by uuid references profiles(id),
  reporter_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table fixture_reports enable row level security;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  club_id uuid references clubs(id),
  actor_user_id uuid references profiles(id),
  actor_name text not null default '',
  action text not null,
  entity text not null default '',
  entity_id text,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_by_tournament on audit_log(tournament_id);
alter table audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- 7) RLS: SOLO LECTURA para el cliente autenticado.
--    (Toda escritura pasa por RPCs security definer en rpc.sql.)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','tournaments','tournament_rules','tournament_admins','league_members',
    'team_catalog','clubs','players','catalog_stats','sofifa_players','sync_log',
    'presidents','squads','squad_players','drafts','draft_picks','offers',
    'fixtures','prizes','budget_grants','fixture_reports','audit_log'
  ]
  loop
    execute format($f$
      drop policy if exists "read %s" on public.%I;
      create policy "read %s" on public.%I
        for select to authenticated using (true);
    $f$, t, t, t, t);
  end loop;
end $$;
