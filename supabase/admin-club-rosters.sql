create function public.admin_roster_state(p_club uuid default null, p_search text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tid uuid;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración.'; end if;
 return jsonb_build_object(
 'clubs',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from public.clubs where tournament_id=tid),
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'value',sp.value_at_join,'rating',sp.ovr_at_join) order by p.name,p.id),'[]')
 from public.squad_players sp join public.players p on p.id=sp.player_id where sp.tournament_id=tid and sp.club_id=p_club),
 'free',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name,x.id),'[]') from (
 select p.id,p.name,p.nationality,p.ovr from public.players p where length(trim(p_search))>=2 and p.catalog_active
 and (strpos(lower(p.name),lower(trim(p_search)))>0 or p.sofifa_id::text=trim(p_search))
 and not exists(select from public.squad_players sp where sp.tournament_id=tid and sp.player_id=p.id)
 and not exists(select from app.blocked_signings b where b.tournament_id=tid and b.player_id=p.id)
 order by p.name,p.id limit 50) x));
end $$;

create function public.admin_roster_change(p_player uuid,p_source uuid,p_destination uuid,p_action text,p_value bigint default null,p_rating int default null)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; current_row public.squad_players%rowtype; target public.squads%rowtype; player public.players%rowtype;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración.'; end if;
 perform app.lock_draft_outgoing(tid);
 select * into strict player from public.players where id=p_player for update;
 select * into current_row from public.squad_players where tournament_id=tid and player_id=p_player for update;
 if current_row.club_id is distinct from p_source then raise exception 'La plantilla cambió. Actualiza y vuelve a intentarlo.'; end if;
 if p_action='edit' and p_source is not null and p_source=p_destination then
   if p_value is null or p_value<0 or p_rating is null or p_rating not between 0 and 99 then raise exception 'Revisa el valor y la media de incorporación.'; end if;
   update public.squad_players set value_at_join=p_value,ovr_at_join=p_rating where id=current_row.id;
 elsif (p_action='add' and p_source is null and p_destination is not null) or
       (p_action='move' and p_source is not null and p_destination is not null and p_source<>p_destination) or
       (p_action='release' and p_source is not null and p_destination is null) then
   if exists(select from public.offers o where o.tournament_id=tid and o.status in ('enviada','negociacion','aceptada','reservada') and (p_player=any(o.requested_player_ids) or p_player=any(o.offered_player_ids)))
   or exists(select from app.draft_outgoing d where d.tournament_id=tid and d.player_id=p_player and d.status='selected') then raise exception 'Resuelve primero las ofertas o bajas previstas de este jugador.'; end if;
   if p_destination is not null then
     select * into target from public.squads where club_id=p_destination and tournament_id=tid for update;
     if not found then raise exception 'El club de destino no tiene plantilla en este universo.'; end if;
     if exists(select from app.blocked_signings where tournament_id=tid and player_id=p_player) or (p_source is null and not player.catalog_active) then raise exception 'Jugador no elegible.'; end if;
   end if;
   if p_source is not null then
     update public.squads set lineup=(select coalesce(jsonb_agg(entry order by ord),'[]') from jsonb_array_elements(lineup) with ordinality e(entry,ord) where entry->>'playerId' is distinct from p_player::text),lineup_updated_at=now() where id=current_row.squad_id and lineup @> jsonb_build_array(jsonb_build_object('playerId',p_player));
   end if;
   if p_action='release' then delete from public.squad_players where id=current_row.id;
   elsif p_action='move' then update public.squad_players set club_id=target.club_id,president_id=target.president_id,squad_id=target.id,availability='neutro',sold_at=null,sold_offer_id=null,sold_previous_availability=null,sold_to_club_id=null,ovr_at_join=player.ovr,value_at_join=player.value,joined_at=now() where id=current_row.id;
   else insert into public.squad_players(tournament_id,club_id,squad_id,president_id,player_id,ovr_at_join,value_at_join) values(tid,target.club_id,target.id,target.president_id,p_player,player.ovr,player.value); end if;
 else raise exception 'Operación de plantilla inválida.'; end if;
 perform public.audit(tid,'admin.plantilla.'||p_action,'squad_players',concat_ws(' · ',player.name,p_source,p_destination,p_value,p_rating),coalesce(p_destination,p_source));
end $$;
revoke all on function public.admin_roster_state(uuid,text),public.admin_roster_change(uuid,uuid,uuid,text,bigint,int) from public,anon;
grant execute on function public.admin_roster_state(uuid,text),public.admin_roster_change(uuid,uuid,uuid,text,bigint,int) to authenticated;
