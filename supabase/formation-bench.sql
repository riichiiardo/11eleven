alter table app.competition_lineups
  add column if not exists bench uuid[] not null default '{}'
  check (cardinality(bench) <= 7);

create or replace function public.formation_competitions() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'ruleId',o.rule_id,'lineup',
   case when l.club_id is not null then jsonb_build_object('formation',l.formation,'slots',l.slots) end,
   'bench', coalesce(l.bench,'{}'::uuid[])) order by o.name,o.id),'[]'::jsonb)
 from public.profiles u join public.presidents p on p.user_id=u.id and p.tournament_id=u.active_tournament_id
 cross join lateral app.club_formation_options(p.tournament_id,p.club_id) o
 left join app.competition_lineups l on l.club_id=p.club_id and l.competition_id=o.id
 where u.id=auth.uid() and p.club_id is not null;
$$;

create or replace function public.save_competition_match_squad(
 p_competition text,p_formation text,p_slots jsonb,p_bench uuid[]
) returns void language plpgsql security definer set search_path='' as $$
declare owner public.presidents%rowtype;
begin
 select p.* into owner from public.profiles u
 join public.presidents p on p.user_id=u.id and p.tournament_id=u.active_tournament_id
 where u.id=auth.uid();
 if owner.club_id is null then raise exception 'Tu cuenta no tiene un club asignado.'; end if;
 perform app.lock_draft_outgoing(owner.tournament_id);
 if p_bench is null or cardinality(p_bench)>7
 or cardinality(p_bench)<>(select count(distinct id) from unnest(p_bench) id) then
  raise exception 'El banquillo admite hasta 7 jugadores distintos.';
 end if;
 perform public.save_competition_lineup(p_competition,p_formation,p_slots);
 if exists (
  select from unnest(p_bench) b(id)
  where exists(select from jsonb_array_elements(p_slots) s where s->>'playerId'=b.id::text)
  or not exists(select from public.squad_players sp where sp.club_id=owner.club_id
    and sp.tournament_id=owner.tournament_id and sp.president_id=owner.id and sp.player_id=b.id)
 ) then
  raise exception 'La banca solo puede incluir jugadores de tu plantilla que no estén en el XI.';
 end if;
 update app.competition_lineups set bench=p_bench
 where club_id=owner.club_id and competition_id=p_competition;
end $$;

revoke all on function public.save_competition_match_squad(text,text,jsonb,uuid[]) from public,anon;
grant execute on function public.save_competition_match_squad(text,text,jsonb,uuid[]) to authenticated;
