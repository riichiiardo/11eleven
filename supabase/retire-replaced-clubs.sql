alter table public.clubs add column if not exists in_universe boolean not null default true;

create function app.sync_universe_club_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.club_id=new.club_id then return new;end if;
 if tg_op='UPDATE' and old.club_id is not null and new.club_id is not null then
  update public.clubs c set in_universe=false
  where c.id=old.club_id and c.tournament_id=new.tournament_id and c.catalog_team_id is not null
  and not exists(select from public.squad_players sp where sp.club_id=c.id)
  and not exists(select from public.presidents p where p.club_id=c.id);
 end if;
 if new.club_id is not null then
  update public.clubs set in_universe=true where id=new.club_id and tournament_id=new.tournament_id and not in_universe;
 end if;
 return new;
end $$;
revoke all on function app.sync_universe_club_assignment() from public,anon,authenticated;
create trigger sync_universe_club_assignment
after insert or update of club_id on public.presidents
for each row execute function app.sync_universe_club_assignment();

do $$
declare fn regprocedure; definition text; marker text;
begin
 for fn,marker in select * from (values
  ('public.tournament_state()'::regprocedure,'from public.clubs c left join public.presidents p on p.club_id = c.id'||chr(10)||'      where c.tournament_id = v_tid'),
  ('public.admin_overview()'::regprocedure,'from public.clubs c left join public.presidents p on p.club_id = c.id where c.tournament_id = v_tid'),
  ('public.admin_competition_enrollment()'::regprocedure,'from public.clubs c where c.tournament_id=tid'),
  ('public.admin_roster_state(uuid,text)'::regprocedure,'from public.clubs where tournament_id=tid')
 ) as targets(fn,marker) loop
  definition:=pg_get_functiondef(fn);
  if strpos(definition,marker)=0 then raise exception 'No se reconoció el listado de clubes de %',fn;end if;
  execute replace(definition,marker,marker||case when fn='public.admin_roster_state(uuid,text)'::regprocedure then ' and in_universe' else ' and c.in_universe' end);
 end loop;
 definition:=pg_get_functiondef('public.admin_team_pool_choices()'::regprocedure);
 marker:='c.tournament_id=tid and c.catalog_team_id=t.id';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el pool administrativo';end if;
 execute replace(definition,marker,marker||' and c.in_universe');
end $$;
