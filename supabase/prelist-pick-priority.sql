create or replace function app.next_prelist_pick(tid uuid,pid uuid) returns uuid language sql stable set search_path='' as $$
 select pl.id from app.draft_prelists r cross join lateral jsonb_array_elements(r.entries) with ordinality e(item,priority)
 join public.players pl on pl.sofifa_id=substring(e.item->>'sofifaUrl' from '^https://sofifa[.]com/player/([0-9]+)')::bigint
 join public.presidents pr on pr.id=r.president_id
 where r.president_id=pid and pr.tournament_id=tid and e.item->>'reviewStatus'='approved' and e.item->>'kind'='new'
 and pl.catalog_active and pl.value<=pr.budget and not exists(select from public.squad_players sp where sp.player_id=pl.id and sp.tournament_id=tid)
 and not exists(select from public.draft_picks dp join public.drafts d on d.id=dp.draft_id where d.tournament_id=tid and dp.player_id=pl.id)
 order by e.priority limit 1
$$;
revoke all on function app.next_prelist_pick(uuid,uuid) from public,anon,authenticated;
create or replace function public.next_prelist_pick() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',pl.id,'name',pl.name) from public.profiles f join public.presidents p on p.user_id=f.id and p.tournament_id=f.active_tournament_id
 join public.players pl on pl.id=app.next_prelist_pick(p.tournament_id,p.id) where f.id=auth.uid() and public.is_member(p.tournament_id)
$$;
revoke all on function public.next_prelist_pick() from public,anon;
grant execute on function public.next_prelist_pick() to authenticated;
create or replace function app.enforce_pick_priority() returns trigger language plpgsql security definer set search_path='' as $$
declare expected uuid;
begin
 if new.mode='turno' and exists(select from app.draft_prelists r cross join lateral jsonb_array_elements(r.entries) e where r.president_id=new.president_id and e->>'reviewStatus'='approved') then
   expected:=app.next_prelist_pick(new.tournament_id,new.president_id);
   if expected is distinct from new.player_id then raise exception 'Selecciona la primera alta aprobada disponible de tu prelista.';end if;
 end if;
 return new;
end $$;
revoke all on function app.enforce_pick_priority() from public,anon,authenticated;
create or replace trigger enforce_pick_priority before insert on public.draft_picks for each row execute function app.enforce_pick_priority();
