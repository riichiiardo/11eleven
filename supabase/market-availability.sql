-- Repair ownership checks on existing installations. The base definition lives in rpc.sql.
begin;
create or replace function public.set_availability(p_squad_player_id uuid, p_availability text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para actualizar tu plantilla.'; end if;
  if p_availability is null or p_availability not in ('transferible','negociacion','neutro','intransferible') then
    raise exception 'Disponibilidad no válida.';
  end if;
  update public.squad_players sp set availability = p_availability
  from public.presidents p join public.profiles pr on pr.id=p.user_id and pr.active_tournament_id=p.tournament_id
  where sp.id=p_squad_player_id and sp.president_id=p.id and sp.club_id=p.club_id and sp.tournament_id=p.tournament_id
    and p.user_id=auth.uid() and exists(select 1 from public.league_members m where m.tournament_id=p.tournament_id and m.user_id=p.user_id);
  if not found then raise exception 'Solo puedes marcar jugadores de tu propia plantilla en el universo activo.'; end if;
end $$;
revoke all on function public.set_availability(uuid,text) from public,anon;
grant execute on function public.set_availability(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;
