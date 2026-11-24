create or replace function app.assign_club_roster(tid uuid, pid uuid, destination uuid)
returns jsonb language plpgsql set search_path='' as $$
declare
 previous uuid;
 target public.clubs%rowtype;
 previous_squad public.squads%rowtype;
 destination_squad uuid;
begin
 perform app.lock_draft_outgoing(tid);
 select club_id into strict previous from public.presidents
 where id=pid and tournament_id=tid for update;
 select * into strict target from public.clubs
 where id=destination and tournament_id=tid for update;
 if previous=destination then return jsonb_build_object('clubName',target.name);end if;
 if exists(select from public.presidents where club_id=destination) then
  raise exception 'Ese club ya tiene presidente.';
 end if;
 select * into previous_squad from public.squads where club_id=previous for update;
 if previous_squad.id is not null and exists(select from public.squad_players where club_id=previous) then
  if exists(select from public.squad_players where club_id=destination) then
   raise exception 'El equipo de destino ya tiene jugadores. Libera su plantilla antes de trasladar la del presidente.';
  end if;
  if exists(select from public.offers where tournament_id=tid
     and status in ('enviada','negociacion','aceptada','reservada')
     and (seller_club_id=previous or bidder_club_id=previous)) then
   raise exception 'Resuelve las ofertas activas del club antes de trasladar su plantilla.';
  end if;
 end if;
 insert into public.squads(tournament_id,club_id,president_id)
 values(tid,destination,pid)
 on conflict(club_id) do update set president_id=excluded.president_id
 returning id into destination_squad;
 if previous_squad.id is not null then
  update public.squad_players set club_id=destination,squad_id=destination_squad,president_id=pid
  where squad_id=previous_squad.id;
  -- Rebuild the XI against the new club's competition and nationality rules.
  update public.squads set president_id=null,lineup='[]'::jsonb,lineup_updated_at=now()
  where id=previous_squad.id;
  update public.squads set formation=previous_squad.formation,lineup='[]'::jsonb,lineup_updated_at=now()
  where id=destination_squad;
 end if;
 update public.squad_players set president_id=pid where squad_id=destination_squad;
 update public.presidents set club_id=destination where id=pid;
 perform public.audit(tid,'presidente.movido','presidents',
  'Cambio de '||coalesce((select name from public.clubs where id=previous),'sin club')||
  ' a '||target.name||' ('||pid::text||').',destination);
 return jsonb_build_object('clubName',target.name);
end $$;
revoke all on function app.assign_club_roster(uuid,uuid,uuid) from public,anon,authenticated;
