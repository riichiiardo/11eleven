-- Extensiones para la sincronización recurrente de la hoja de equipos.
-- Ejecutar después de schema.sql.

alter table public.team_catalog add column if not exists crest_url text;
alter table public.team_catalog add column if not exists source_key text unique;
alter table public.players add column if not exists source_key text unique;
alter table public.players add column if not exists initial_value bigint;
alter table public.players add column if not exists source_updated_at timestamptz;

create table if not exists public.player_stat_history (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  source_key text not null,
  recorded_at timestamptz not null default now(),
  ovr integer not null,
  value bigint not null,
  initial_value bigint,
  ovr_delta integer not null default 0,
  value_delta bigint not null default 0,
  source text not null default 'google-sheet'
);
create index if not exists player_stat_history_player_idx
  on public.player_stat_history (player_id, recorded_at desc);
alter table public.player_stat_history enable row level security;

-- Primera liga: se crea una sola vez y recibe los equipos importados sin
-- presidente. Las reglas quedan con los valores por defecto para editarlas
-- desde Administración.
create or replace function public.bootstrap_first_league()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid;
begin
  select id into v_tid from public.tournaments
  where code = 'PRIMERA-11' limit 1;
  if v_tid is null then
    insert into public.tournaments (code, name, season, status)
    values ('PRIMERA-11', 'Primera Liga 11Eleven', to_char(now(), 'YYYY'), 'inscripciones')
    returning id into v_tid;
    insert into public.tournament_rules (tournament_id) values (v_tid);
  end if;

  insert into public.clubs (
    tournament_id, name, short_name, league, country,
    color_primary, color_secondary, catalog_team_id
  )
  select v_tid, t.name, left(t.name, 3), t.league, t.country,
         t.color_primary, t.color_secondary, t.id
  from public.team_catalog t
  where t.league = 'Primera Liga'
    and not exists (
      select 1 from public.clubs c
      where c.tournament_id = v_tid and c.catalog_team_id = t.id
    );
  return v_tid;
end;
$$;

-- Alta automática: los nuevos usuarios entran en la Primera Liga y reciben
-- el primer club libre. Si no hay clubes libres, podrán ser asignados después
-- desde Administración sin bloquear el registro.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid;
  v_club public.clubs%rowtype;
  v_president_id uuid;
  v_name text := coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1));
  v_nickname text := coalesce(new.raw_user_meta_data->>'nickname', v_name);
begin
  insert into public.profiles (id, email, name, nickname, is_anonymous)
  values (new.id, new.email, v_name, v_nickname, false)
  on conflict (id) do nothing;

  select id into v_tid from public.tournaments
  where code = 'PRIMERA-11' limit 1;
  if v_tid is null then return new; end if;

  update public.profiles set active_tournament_id = v_tid where id = new.id;
  insert into public.league_members (tournament_id, user_id, role)
  values (v_tid, new.id, 'presidente') on conflict do nothing;

  select c.* into v_club
  from public.clubs c
  where c.tournament_id = v_tid
    and not exists (select 1 from public.presidents p where p.club_id = c.id)
  order by c.name limit 1;
  if v_club.id is null then return new; end if;

  insert into public.presidents (tournament_id, user_id, nickname, display_name, club_id, budget)
  select v_tid, new.id, v_nickname, v_name, v_club.id, r.budget
  from public.tournament_rules r where r.tournament_id = v_tid
  on conflict (tournament_id, user_id) do nothing
  returning id into v_president_id;

  insert into public.squads (tournament_id, club_id, president_id)
  select v_tid, v_club.id, v_president_id
  where v_president_id is not null
  on conflict (club_id) do nothing;
  return new;
end;
$$;
