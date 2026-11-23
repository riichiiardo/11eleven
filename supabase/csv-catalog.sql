begin;
alter table public.players drop constraint if exists players_name_key;
alter table public.players add column if not exists source_record jsonb;
alter table public.players add column if not exists catalog_active boolean not null default true;
create table if not exists app.catalog_csv_stage (
 batch text not null, row_no integer not null, payload jsonb not null,
 primary key(batch,row_no)
);
create table if not exists app.catalog_csv_backups (
 batch text primary key, recorded_at timestamptz not null default now(),
 players jsonb not null, squads jsonb not null, catalog_stats jsonb not null
);
alter table app.catalog_csv_stage enable row level security;
alter table app.catalog_csv_backups enable row level security;
revoke all on app.catalog_csv_stage,app.catalog_csv_backups from public,anon,authenticated;
create or replace view public.active_catalog_players with(security_invoker=true) as
select p.* from public.players p where p.catalog_active or exists(select 1 from public.squad_players sp where sp.player_id=p.id);
revoke all on public.active_catalog_players from public,anon,authenticated;


-- Catalog browsing excludes retired seed records. Squad reports can still read
-- owned exceptions until their identities are reconciled.
do $$declare f record; definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','app') and p.prokind='f' and pg_get_functiondef(p.oid) like '%from public.players pl%'
 loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'from public.players pl','from public.active_catalog_players pl');
  execute definition;
 end loop;
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','app') and p.prokind='f' and (pg_get_functiondef(p.oid) like '%p.real_club = v_team.name%' or pg_get_functiondef(p.oid) like '%p.real_club = t.name%')
 loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'p.real_club = v_team.name','(p.source_record->>''game_team'') = v_team.name');
  definition:=replace(definition,'p.real_club = t.name','(p.source_record->>''game_team'') = t.name');
  execute definition;
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
