-- Materialize unclaimed teams so the market and draft see actual ownership.
with created as (
 insert into public.squads(tournament_id,club_id,president_id)
 select c.tournament_id,c.id,null from public.clubs c
 where not exists(select from public.presidents pr where pr.club_id=c.id)
 and exists(select from public.players pl where pl.source_record->>'game_team'=c.name)
 on conflict(club_id) do nothing returning id,club_id,tournament_id
)
insert into public.squad_players(tournament_id,squad_id,club_id,player_id,president_id,ovr_at_join,value_at_join)
select s.tournament_id,s.id,c.id,pl.id,null,pl.ovr,pl.value from created s join public.clubs c on c.id=s.club_id
join public.players pl on pl.source_record->>'game_team'=c.name
on conflict(tournament_id,player_id) do nothing;


do $$
declare d text; signature regprocedure;
begin
 foreach signature in array array['public.choose_catalog_team(uuid)'::regprocedure,'public.team_squad(uuid)'::regprocedure] loop
 d:=pg_get_functiondef(signature);
 execute replace(replace(d,'coalesce(p.source_record->>''game_team'', p.real_club)','(p.source_record->>''game_team'')'),'coalesce(p.source_record->>''game_team'',p.real_club)','(p.source_record->>''game_team'')');
 end loop;
end $$;


-- A newly created league club holds its assigned game players even before signup.
create or replace function app.seed_unclaimed_game_team() returns trigger
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if new.catalog_team_id is null or not exists(select from public.players p where p.source_record->>'game_team'=new.name) then return new;end if;
 insert into public.squads(tournament_id,club_id,president_id) values(new.tournament_id,new.id,null)
 on conflict(club_id) do nothing returning id into sid;
 if sid is not null then
   insert into public.squad_players(tournament_id,club_id,squad_id,player_id,ovr_at_join,value_at_join)
   select new.tournament_id,new.id,sid,p.id,p.ovr,p.value from public.players p where p.source_record->>'game_team'=new.name
   on conflict(tournament_id,player_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function app.seed_unclaimed_game_team() from public,anon,authenticated;
create or replace trigger seed_unclaimed_game_team after insert on public.clubs for each row execute function app.seed_unclaimed_game_team();
