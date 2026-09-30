-- 11Eleven · staging del catálogo de SoFIFA
--
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
--
-- Flujo:
--   1. `python3 scripts/sync-players.py fetch` (en tu Mac, IP residencial)
--      baja el catálogo de SoFIFA y hace upsert en esta tabla.
--   2. La app (Convex → Administración → Catálogo → fuente Supabase) lee esta
--      tabla por bloques y hace upsert en `players`. Convex → Supabase es una
--      conexión servidor-a-servidor: sin Cloudflare de por medio.
--
-- RLS activada SIN políticas: solo la service role key (script local y
-- backend de Convex) puede leer o escribir. La anon key queda bloqueada.

create table if not exists public.sofifa_players (
  sofifa_id    bigint      primary key,
  name         text        not null,
  position     text,
  ovr          int,
  potential    int,
  age          int,
  value_eur    bigint      default 0,
  nationality  text,
  club         text,
  club_country text,
  league       text,
  photo_url    text,
  r            text,
  fetched_at   timestamptz not null default now()
);

create index if not exists sofifa_players_ovr_idx
  on public.sofifa_players (ovr desc);

alter table public.sofifa_players enable row level security;
