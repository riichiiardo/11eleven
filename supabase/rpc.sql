-- 11Eleven — RPCs de escritura (security definer)
--
-- Complemento de supabase/schema.sql: TODA mutación del juego vive aquí.
-- El cliente (anon/authenticated) no tiene INSERT/UPDATE/DELETE en ninguna
-- tabla; cada RPC valida identidad, membresía, presupuesto e invariantes antes
-- de tocar una fila. Ejecutar DESPUÉS de schema.sql.
--
-- Convenciones:
--   · Dinero en euros enteros (bigint), igual que el motor de Convex.
--   · Los timestamps se guardan como timestamptz; el cliente convierte a ms.
--   · Cualquier violación lanza exception con mensaje en español (el cliente
--     lo muestra tal cual en el toast).

-- ============================================================
-- Utilidades
-- ============================================================

create or replace function public.audit(
  p_tid uuid, p_action text, p_entity text, p_detail text, p_club_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text; v_uid uuid := auth.uid();
begin
  select coalesce(nickname, name, 'Usuario') into v_name from public.profiles where id = v_uid;
  insert into public.audit_log (tournament_id, club_id, actor_user_id, actor_name, action, entity, detail)
  values (p_tid, p_club_id, v_uid, coalesce(v_name, 'Sistema'), p_action, p_entity, p_detail);
end $$;

-- Bootstrap idempotente: garantiza la fila de membresía del usuario logueado.
create or replace function public.ensure_setup() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sesión no válida.'; end if;
  insert into public.league_members (tournament_id, user_id)
  select t.id, v_uid
  from public.profiles p
  join public.tournaments t on t.id = p.active_tournament_id
  where p.id = v_uid
  on conflict do nothing;
  return true;
end $$;

-- ============================================================
-- Ligas (multi-liga)
-- ============================================================

create or replace function public.create_league(p_name text, p_season text, p_code text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid;
  v_code text := coalesce(nullif(trim(p_code), ''), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)));
begin
  if v_uid is null then raise exception 'Sesión no válida.'; end if;
  if p_name is null or length(trim(p_name)) < 3 then
    raise exception 'El nombre de la liga debe tener al menos 3 caracteres.';
  end if;

  insert into public.tournaments (code, name, season, owner_user_id)
  values (v_code, trim(p_name), coalesce(nullif(trim(p_season), ''), to_char(now(), 'YYYY')), v_uid)
  returning id into v_tid;

  insert into public.tournament_rules (tournament_id, updated_by) values (v_tid, v_uid);
  insert into public.tournament_admins (tournament_id, user_id, role) values (v_tid, v_uid, 'principal');
  insert into public.league_members (tournament_id, user_id, role) values (v_tid, v_uid, 'administrador');
  update public.profiles set active_tournament_id = v_tid where id = v_uid;

  perform public.audit(v_tid, 'liga.creada', 'tournaments', 'Liga ' || trim(p_name) || ' creada.');
  return v_tid;
end $$;

create or replace function public.join_league(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid;
begin
  if v_uid is null then raise exception 'Sesión no válida.'; end if;
  select id into v_tid from public.tournaments
  where upper(code) = upper(trim(p_code)) limit 1;
  if v_tid is null then raise exception 'No existe una liga con el código %.', trim(p_code); end if;

  insert into public.league_members (tournament_id, user_id) values (v_tid, v_uid)
  on conflict do nothing;
  update public.profiles set active_tournament_id = v_tid where id = v_uid;

  perform public.audit(v_tid, 'liga.unirse', 'leagueMembers', 'Nuevo miembro en la liga.');
  return v_tid;
end $$;

create or replace function public.activate_league(p_tournament_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_tournament_id) then
    raise exception 'No perteneces a esa liga.';
  end if;
  update public.profiles set active_tournament_id = p_tournament_id where id = auth.uid();
end $$;

-- ============================================================
-- Selección de club y presidentes
-- ============================================================

-- Siembra el catálogo de equipos si está vacío (la carga inicial de los 115
-- clubes del FC 27 se hace con supabase/seed.sql desde el snapshot local).
create or replace function public.ensure_team_catalog() returns integer
language sql security definer set search_path = public as $$
  select count(*)::int from public.team_catalog
$$;

create or replace function public.choose_catalog_team(p_team_catalog_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid;
  v_club public.clubs%rowtype;
  v_rules public.tournament_rules%rowtype;
  v_president uuid;
  v_taken uuid;
begin
  if v_uid is null then raise exception 'Sesión no válida.'; end if;
  select active_tournament_id into v_tid from public.profiles where id = v_uid;
  if v_tid is null then raise exception 'Primero crea o únete a una liga.'; end if;
  select * into v_rules from public.tournament_rules where tournament_id = v_tid;

  -- Ya presidía un club: solo se cambia desde Administración.
  if exists (select 1 from public.presidents p where p.tournament_id = v_tid and p.user_id = v_uid and p.club_id is not null) then
    raise exception 'Ya presidís un club en esta liga.';
  end if;

  select c.id into v_taken from public.clubs c
  join public.presidents p on p.club_id = c.id
  where c.tournament_id = v_tid and c.catalog_team_id = p_team_catalog_id;
  if v_taken is not null then raise exception 'Ese equipo ya tiene presidente.'; end if;

  insert into public.clubs (tournament_id, name, short_name, league, country, color_primary, color_secondary, catalog_team_id)
  select v_tid, t.name, split_part(t.name, ' ', 1), t.league, t.country, t.color_primary, t.color_secondary, t.id
  from public.team_catalog t where t.id = p_team_catalog_id
  returning * into v_club;

  insert into public.squads (tournament_id, club_id, president_id, formation)
  values (v_tid, v_club.id, public.my_president_id(v_tid), v_rules.fc27_formation_code)
  returning id into v_president;

  insert into public.presidents (tournament_id, user_id, nickname, display_name, club_id, budget)
  values (v_tid, v_uid,
          coalesce((select nickname from public.profiles where id = v_uid), 'Presidente'),
          coalesce((select name from public.profiles where id = v_uid), 'Presidente'),
          v_club.id, v_rules.budget)
  on conflict (tournament_id, user_id) do update set club_id = excluded.club_id, budget = excluded.budget
  returning id into v_president;

  update public.squads set president_id = v_president where club_id = v_club.id;

  perform public.audit(v_tid, 'club.elegido', 'clubs',
    'Presidirá ' || v_club.name || ' con un presupuesto de ' || v_rules.budget::text || ' €.', v_club.id);
  return v_club.id;
end $$;

create or replace function public.update_profile(p_name text, p_nickname text, p_image text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid; v_uid uuid := auth.uid();
begin
  update public.profiles set
    name = coalesce(nullif(trim(p_name), ''), name),
    nickname = coalesce(nullif(trim(p_nickname), ''), nickname),
    image = coalesce(p_image, image)
  where id = v_uid;
  select active_tournament_id into v_tid from public.profiles where id = v_uid;
  if v_tid is not null then
    update public.presidents set
      nickname = coalesce(nullif(trim(p_nickname), ''), nickname),
      display_name = coalesce(nullif(trim(p_name), ''), display_name)
    where tournament_id = v_tid and user_id = v_uid;
  end if;
end $$;

-- ============================================================
-- Plantilla: disponibilidad y alineación
-- ============================================================

create or replace function public.set_availability(p_squad_player_id uuid, p_availability text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_mine uuid;
begin
  if p_availability not in ('transferible','negociacion','neutro','intransferible') then
    raise exception 'Disponibilidad no válida.';
  end if;
  select sp.president_id into v_mine from public.squad_players sp where sp.id = p_squad_player_id;
  if v_mine is null or v_mine <> public.my_president_id((select tournament_id from public.squad_players where id = p_squad_player_id)) then
    raise exception 'Solo puedes marcar jugadores de tu propia plantilla.';
  end if;
  update public.squad_players set availability = p_availability where id = p_squad_player_id;
end $$;

-- Guarda la alineación: 11 titulares, sin duplicados y todos propios.
create or replace function public.save_lineup(p_formation text, p_slots jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid; v_club uuid; v_pres uuid; v_count int; v_dup int; v_foreign int;
begin
  select p.tournament_id, p.club_id, p.id into v_tid, v_club, v_pres
  from public.presidents p where p.user_id = auth.uid() and p.tournament_id = (select active_tournament_id from public.profiles where id = auth.uid());
  if v_pres is null then raise exception 'No presidís ningún club en la liga activa.'; end if;

  select count(*) into v_count
  from jsonb_array_elements(p_slots) s
  where (s->>'playerId') is not null and (s->>'playerId') <> 'null';
  if v_count <> 11 then raise exception 'El once debe tener 11 titulares (hay %).', v_count; end if;

  select count(*) into v_dup from (
    select s->>'playerId' as pid from jsonb_array_elements(p_slots) s
    where (s->>'playerId') is not null and (s->>'playerId') <> 'null'
    group by 1 having count(*) > 1
  ) d;
  if v_dup > 0 then raise exception 'Hay jugadores repetidos en la alineación.'; end if;

  select count(*) into v_foreign
  from jsonb_array_elements(p_slots) s
  join public.squad_players sp on sp.player_id::text = s->>'playerId'
  where sp.president_id <> v_pres;
  if v_foreign > 0 then raise exception 'La alineación incluye jugadores que no son tuyos.'; end if;

  update public.squads
  set formation = p_formation, lineup = p_slots, lineup_updated_at = now()
  where club_id = v_club;

  perform public.audit(v_tid, 'alineacion.guardada', 'squads', 'Once titular actualizado (' || p_formation || ').', v_club);
end $$;

-- ============================================================
-- Mercado
-- ============================================================

create or replace function public.create_offer(
  p_type text, p_requested uuid[], p_offered uuid[], p_cash bigint, p_message text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid; v_me public.presidents%rowtype; v_offer uuid;
  v_budget_left bigint; v_blocker text; v_seller uuid; v_seller_club uuid;
begin
  if p_type not in ('cash','trade') then raise exception 'Tipo de oferta no válido.'; end if;
  select active_tournament_id into v_tid from public.profiles where id = auth.uid();
  select * into v_me from public.presidents where user_id = auth.uid() and tournament_id = v_tid;
  if v_me.id is null then raise exception 'No presidís ningún club.'; end if;
  if not (select market_open from public.tournaments where id = v_tid) then
    raise exception 'La ventana de mercado está cerrada.';
  end if;
  if p_cash < 0 then raise exception 'El efectivo no puede ser negativo.'; end if;

  -- Presupuesto: disponible menos lo ya comprometido en ofertas activas.
  select v_me.budget - coalesce(sum(cash), 0) into v_budget_left
  from public.offers
  where bidder_president_id = v_me.id and status in ('enviada','negociacion','aceptada','reservada');
  if p_cash > v_budget_left then
    raise exception 'Presupuesto insuficiente: disponible % €, solicitado % €.', v_budget_left, p_cash;
  end if;

  -- Cada jugador pedido: libre (sin dueño) o de otro presidente no intransferible.
  for v_blocker in
    select case
      when pl.id is null then 'Jugador desconocido en la oferta.'
      when owned.president_id is null then null
      when owned.president_id = v_me.id then 'No puedes pedirte un jugador a ti mismo.'
      when owned.availability = 'intransferible' then (select name from public.players where id = sp.player_id) || ' es intransferible.'
      else null end
    from unnest(p_requested) as rid(pid)
    left join public.players pl on pl.id = rid.pid
    left join public.squad_players sp on sp.player_id = rid.pid and sp.tournament_id = v_tid
    left join public.presidents owned on owned.id = sp.president_id
    loop
      if v_blocker is not null then raise exception '%', v_blocker; end if;
    end loop;

  -- Ofrecidos (trueques): deben ser propios y no estar comprometidos.
  for v_blocker in
    select case
      when owned.president_id is null or owned.president_id <> v_me.id then 'Solo puedes ofrecer jugadores de tu plantilla.'
      else null end
    from unnest(p_offered) as rid(pid)
    left join public.squad_players sp on sp.player_id = rid.pid and sp.tournament_id = v_tid
    left join public.presidents owned on owned.id = sp.president_id
    loop
      if v_blocker is not null then raise exception '%', v_blocker; end if;
    end loop;

  -- Vendedor implícito: si algún pedido tiene dueño, la oferta va a su presidente.
  select sp.president_id, sp.club_id into v_seller, v_seller_club
  from unnest(p_requested) as rid(pid)
  join public.squad_players sp on sp.player_id = rid.pid and sp.tournament_id = v_tid
  limit 1;

  insert into public.offers (tournament_id, type, bidder_president_id, bidder_club_id,
    seller_president_id, seller_club_id, requested_player_ids, offered_player_ids, cash, message, status)
  values (v_tid, p_type, v_me.id, v_me.club_id, v_seller, v_seller_club,
          p_requested, p_offered, p_cash, p_message, 'enviada')
  returning id into v_offer;

  perform public.audit(v_tid, 'oferta.creada', 'offers', 'Oferta registrada por % €.', v_me.club_id);
  return v_offer;
end $$;

create or replace function public.respond_offer(p_offer_id uuid, p_action text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_offer public.offers%rowtype; v_me uuid := public.my_president_id((select active_tournament_id from public.profiles where id = auth.uid()));
begin
  if p_action not in ('aceptar','rechazar','negociar','cancelar') then raise exception 'Acción no válida.'; end if;
  select * into v_offer from public.offers where id = p_offer_id;
  if v_offer.id is null then raise exception 'La oferta no existe.'; end if;
  if v_offer.status not in ('enviada','negociacion') then raise exception 'La oferta ya no admite respuesta (estado %).', v_offer.status; end if;

  if p_action = 'cancelar' then
    if v_offer.bidder_president_id <> v_me then raise exception 'Solo quien envió puede cancelarla.'; end if;
    update public.offers set status = 'cancelada', updated_at = now() where id = p_offer_id;
    perform public.audit(v_offer.tournament_id, 'oferta.cancelada', 'offers', 'Oferta cancelada.');
    return 'cancelada';
  end if;

  if v_offer.seller_president_id is not null and v_offer.seller_president_id <> v_me then
    raise exception 'Solo el vendedor puede responder esta oferta.';
  end if;

  if p_action = 'rechazar' then
    update public.offers set status = 'rechazada', updated_at = now() where id = p_offer_id;
    perform public.audit(v_offer.tournament_id, 'oferta.rechazada', 'offers', 'Oferta rechazada.');
    return 'rechazada';
  elsif p_action = 'negociar' then
    update public.offers set status = 'negociacion', updated_at = now() where id = p_offer_id;
    return 'negociacion';
  end if;

  -- aceptar
  if v_offer.seller_president_id is null then
    -- Agente libre: se ejecuta al instante (compra directa con efectivo).
    insert into public.squad_players (tournament_id, club_id, squad_id, player_id, president_id, ovr_at_join, value_at_join)
    select v_offer.tournament_id, v_offer.bidder_club_id, s.id, pl.id, v_offer.bidder_president_id, pl.ovr, pl.value
    from public.squads s, public.players pl
    where s.club_id = v_offer.bidder_club_id and pl.id = any(v_offer.requested_player_ids)
    on conflict (squad_id, player_id) do nothing;

    update public.presidents set budget = budget - v_offer.cash where id = v_offer.bidder_president_id;
    update public.offers set status = 'ejecutada', executed_at = now(), agreed_at = now(), updated_at = now() where id = p_offer_id;
    perform public.audit(v_offer.tournament_id, 'oferta.ejecutada', 'offers',
      'Fichaje de agente libre ejecutado por ' || v_offer.cash::text || ' €.', v_offer.bidder_club_id);
    return 'ejecutada';
  else
    -- Trueque entre presidentes: queda reservada para la ventana de draft.
    update public.offers set status = 'reservada', agreed_at = now(), updated_at = now() where id = p_offer_id;
    perform public.audit(v_offer.tournament_id, 'oferta.reservada', 'offers', 'Acuerdo reservado para la ventana de draft.');
    return 'reservada';
  end if;
end $$;

-- ============================================================
-- Draft
-- ============================================================

create or replace function public.draft_prepare(p_total_rounds int default null, p_pick_seconds int default null, p_snake boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración puede preparar el draft.'; end if;
  insert into public.drafts (tournament_id, total_rounds, pick_seconds, snake)
  values (v_tid, coalesce(p_total_rounds, 20), coalesce(p_pick_seconds, 120), p_snake)
  on conflict (tournament_id) do update
    set total_rounds = excluded.total_rounds, pick_seconds = excluded.pick_seconds,
        snake = excluded.snake, status = 'borrador', updated_at = now();
end $$;

create or replace function public.draft_set_status(p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración controla el draft.'; end if;
  if p_status not in ('borrador','en_curso','pausado','cerrado') then raise exception 'Estado no válido.'; end if;
  update public.drafts set
    status = p_status,
    started_at = case when p_status = 'en_curso' and started_at is null then now() else started_at end,
    closed_at = case when p_status = 'cerrado' then now() else closed_at end,
    current_deadline = case when p_status = 'en_curso' then now() + make_interval(secs => pick_seconds) else current_deadline end,
    updated_at = now()
  where tournament_id = v_tid;
end $$;

create or replace function public.draft_skip_turn()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
  v_draft public.drafts%rowtype; v_next int;
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración puede saltar turnos.'; end if;
  select * into v_draft from public.drafts where tournament_id = v_tid;
  v_next := v_draft.current_index + 1;
  if v_next >= array_length(v_draft."order", 1) then
    v_next := 0;
    update public.drafts set round = round + 1 where id = v_draft.id;
  end if;
  update public.drafts set current_index = v_next, current_deadline = now() + make_interval(secs => pick_seconds), updated_at = now() where id = v_draft.id;
end $$;

create or replace function public.draft_pick(p_player_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
  v_draft public.drafts%rowtype;
  v_me public.presidents%rowtype;
  v_player public.players%rowtype;
  v_turn uuid; v_taken uuid; v_next int; v_pick_no int; v_snake_idx int;
begin
  select * into v_draft from public.drafts where tournament_id = v_tid;
  if v_draft.id is null then raise exception 'El draft no está preparado.'; end if;
  if v_draft.status <> 'en_curso' then raise exception 'El draft no está en curso.'; end if;

  v_turn := v_draft."order"[v_draft.current_index + 1];
  if v_turn is null then raise exception 'No hay turno activo.'; end if;
  if v_turn <> public.my_president_id(v_tid) then raise exception 'No es tu turno.'; end if;
  select * into v_me from public.presidents where id = v_turn;

  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null then raise exception 'El jugador no existe.'; end if;

  select sp.id into v_taken from public.squad_players sp
  where sp.tournament_id = v_tid and sp.player_id = p_player_id;
  if v_taken is not null then raise exception 'El jugador ya tiene club.'; end if;

  if v_player.value > v_me.budget then raise exception 'Presupuesto insuficiente para fichar a %.', v_player.name; end if;

  v_pick_no := coalesce((select count(*) from public.draft_picks where draft_id = v_draft.id), 0) + 1;
  insert into public.draft_picks (tournament_id, draft_id, president_id, club_id, player_id, price, round, pick_number, mode)
  values (v_tid, v_draft.id, v_me.id, v_me.club_id, p_player_id, v_player.value, v_draft.round, v_pick_no, 'turno');

  insert into public.squad_players (tournament_id, club_id, squad_id, player_id, president_id, ovr_at_join, value_at_join)
  select v_tid, v_me.club_id, s.id, p_player_id, v_me.id, v_player.ovr, v_player.value
  from public.squads s where s.club_id = v_me.club_id
  on conflict (squad_id, player_id) do nothing;

  update public.presidents set budget = budget - v_player.value where id = v_me.id;

  -- Avanza el turno (con orden serpiente si aplica).
  v_next := v_draft.current_index + 1;
  if v_next >= array_length(v_draft."order", 1) then
    v_next := 0;
    update public.drafts set round = round + 1 where id = v_draft.id;
    if v_draft.snake then
      update public.drafts set "order" = (select array_agg(x order by x desc) from unnest(v_draft."order") x) where id = v_draft.id;
    end if;
  end if;
  update public.drafts set current_index = v_next, current_deadline = now() + make_interval(secs => pick_seconds), updated_at = now() where id = v_draft.id;

  perform public.audit(v_tid, 'draft.pick', 'draftPicks',
    v_me.nickname || ' fichó a ' || v_player.name || ' por ' || v_player.value::text || ' € (ronda ' || v_draft.round || ').', v_me.club_id);
end $$;

-- ============================================================
-- Catálogo: staging → players (reemplaza syncCatalog de Convex)
-- ============================================================

create or replace function public.sync_catalog_from_staging(p_limit int default 1000, p_offset int default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_applied int; v_total bigint; v_next_offset int;
begin
  with mapped as (
    select s.*,
      -- SoFIFA guarda códigos ingleses (GK/RB/CB/LB/CDM/CM/CAM/RW/LW/ST);
      -- el juego usa POR/LD/DFC/LI/MCD/MC/MCO/ED/EI/DC. Se aceptan ambos.
      case s.position
        when 'POR' then 'POR' when 'GK' then 'POR'
        when 'RB'  then 'LD'  when 'LD' then 'LD'
        when 'CB'  then 'DFC' when 'DFC' then 'DFC'
        when 'LB'  then 'LI'  when 'LI' then 'LI'
        when 'CDM' then 'MCD' when 'MCD' then 'MCD'
        when 'CM'  then 'MC'  when 'MC' then 'MC'
        when 'CAM' then 'MCO' when 'MCO' then 'MCO'
        when 'RW'  then 'ED'  when 'ED' then 'ED'
        when 'LW'  then 'EI'  when 'EI' then 'EI'
        when 'ST'  then 'DC'  when 'DC' then 'DC'
        else 'MC' end as es_position
    from public.sofifa_players s
    where s.ovr is not null and s.position is not null
  )
  insert into public.players (name, position, "group", ovr, age, value, nationality, flag, real_club, real_league, fc_version, photo)
  select m.name, m.es_position,
         case m.es_position when 'POR' then 'GK' when 'LD' then 'DEF' when 'DFC' then 'DEF' when 'LI' then 'DEF'
              when 'MCD' then 'MID' when 'MC' then 'MID' when 'MCO' then 'MID' when 'ED' then 'FWD' when 'EI' then 'FWD' when 'DC' then 'FWD' end,
         m.ovr, m.age, m.value_eur, coalesce(m.nationality, '—'), '🏳️',
         coalesce(nullif(m.club, ''), 'Agente libre'), coalesce(nullif(m.league, ''), 'SoFIFA'),
         'FC 27 · SoFIFA ' || to_char(now(), 'DD/MM/YYYY'), m.photo_url
  from mapped m
  order by m.ovr desc nulls last, m.sofifa_id asc
  limit p_limit offset p_offset
  on conflict (name) do update set
    ovr = excluded.ovr, age = excluded.age, value = excluded.value, photo = coalesce(excluded.photo, players.photo),
    real_club = excluded.real_club, real_league = excluded.real_league, fc_version = excluded.fc_version,
    position = excluded.position, "group" = excluded."group", nationality = excluded.nationality;

  get diagnostics v_applied = row_count;

  select count(*) into v_total from public.sofifa_players where ovr is not null;
  v_next_offset := p_offset + v_applied;

  insert into public.catalog_stats (id, total, updated_at) values (1, v_total, now())
  on conflict (id) do update set total = v_total, updated_at = now();

  insert into public.sync_log (actor_name, source, status, summary)
  values (coalesce((select nickname from public.profiles where id = auth.uid()), 'Admin'), 'Supabase (SoFIFA)', 'ok',
          jsonb_build_object('applied', v_applied, 'offset', v_next_offset, 'total', v_total));

  return jsonb_build_object('applied', v_applied, 'nextOffset', v_next_offset, 'total', v_total, 'done', v_next_offset >= v_total);
end $$;

-- ============================================================
-- Administración
-- ============================================================

create or replace function public.update_rules(p_rules jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración puede editar las reglas.'; end if;
  update public.tournament_rules set
    budget              = coalesce((p_rules->>'budget')::bigint, budget),
    squad_size          = coalesce((p_rules->>'squadSize')::int, squad_size),
    gk_min = coalesce((p_rules->>'gkMin')::int, gk_min), gk_max = coalesce((p_rules->>'gkMax')::int, gk_max),
    def_min = coalesce((p_rules->>'defMin')::int, def_min), def_max = coalesce((p_rules->>'defMax')::int, def_max),
    mid_min = coalesce((p_rules->>'midMin')::int, mid_min), mid_max = coalesce((p_rules->>'midMax')::int, mid_max),
    fwd_min = coalesce((p_rules->>'fwdMin')::int, fwd_min), fwd_max = coalesce((p_rules->>'fwdMax')::int, fwd_max),
    max_per_real_club   = coalesce((p_rules->>'maxPerRealClub')::int, max_per_real_club),
    min_ovr             = coalesce((p_rules->>'minOvr')::int, min_ovr),
    max_u21             = coalesce((p_rules->>'maxU21')::int, max_u21),
    lineup_lock_hours   = coalesce((p_rules->>'lineupLockHours')::int, lineup_lock_hours),
    fc27_formation_code = coalesce(p_rules->>'fc27FormationCode', fc27_formation_code),
    formation_instructions = coalesce(p_rules->>'formationInstructions', formation_instructions),
    u20_min             = coalesce((p_rules->>'u20Min')::int, u20_min),
    u20_in_starting_lineup = coalesce(nullif(p_rules->>'u20InStartingLineup', ''), u20_in_starting_lineup),
    same_nationality_min = coalesce((p_rules->>'sameNationalityMin')::int, same_nationality_min),
    same_nationality_rule = coalesce(nullif(p_rules->>'sameNationalityRule', ''), same_nationality_rule),
    same_nationality_match_duration_minutes = coalesce((p_rules->>'sameNationalityMatchDurationMinutes')::int, same_nationality_match_duration_minutes),
    club_nationality_min = coalesce((p_rules->>'clubNationalityMin')::int, club_nationality_min),
    updated_at = now(), updated_by = auth.uid()
  where tournament_id = v_tid;
  perform public.audit(v_tid, 'reglas.actualizadas', 'tournamentRules', 'Reglamento actualizado.');
end $$;

create or replace function public.set_tournament_status(p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración cambia el estado del torneo.'; end if;
  update public.tournaments set status = p_status where id = v_tid;
  perform public.audit(v_tid, 'torneo.estado', 'tournaments', 'Estado del torneo: ' || p_status || '.');
end $$;

create or replace function public.set_competition(p_competition_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración cambia la competición.'; end if;
  update public.tournaments set competition_id = nullif(trim(p_competition_id), '') where id = v_tid;
  perform public.audit(v_tid, 'torneo.competicion', 'tournaments', 'Competición FC 27: ' || coalesce(p_competition_id, '—') || '.');
end $$;

create or replace function public.set_prizes(p_prizes jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid()); v_row jsonb;
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración define los premios.'; end if;
  delete from public.prizes where tournament_id = v_tid;
  for v_row in select * from jsonb_array_elements(p_prizes) loop
    insert into public.prizes (tournament_id, phase, position, label, amount, updated_by)
    values (v_tid, v_row->>'phase', (v_row->>'position')::int, v_row->>'label', coalesce((v_row->>'amount')::bigint, 0), auth.uid());
  end loop;
  perform public.audit(v_tid, 'premios.actualizados', 'prizes', 'Tabla de premios reemplazada.');
end $$;

create or replace function public.grant_budget(p_president_id uuid, p_amount bigint, p_concept text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración otorga presupuesto.'; end if;
  update public.presidents set budget = budget + p_amount where id = p_president_id and tournament_id = v_tid;
  insert into public.budget_grants (tournament_id, president_id, concept, amount, granted_by)
  values (v_tid, p_president_id, p_concept, p_amount, auth.uid());
  perform public.audit(v_tid, 'presupuesto.otorgado', 'budgetGrants', p_concept || ': ' || p_amount::text || ' €.');
end $$;

create or replace function public.grant_admin(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración concede el rol.'; end if;
  if not public.is_member(v_tid) or p_user_id is null then raise exception 'El usuario debe ser miembro de la liga.'; end if;
  insert into public.tournament_admins (tournament_id, user_id, role) values (v_tid, p_user_id, p_role)
  on conflict (tournament_id, user_id) do update set role = excluded.role;
  perform public.audit(v_tid, 'admin.otorgado', 'tournamentAdmins', 'Nuevo administrador (' || p_role || ').');
end $$;

create or replace function public.revoke_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid()); v_principal uuid;
begin
  select user_id into v_principal from public.tournament_admins
  where tournament_id = v_tid and role = 'principal' limit 1;
  if v_principal <> auth.uid() then raise exception 'Solo el administrador principal puede revocar el rol.'; end if;
  if p_user_id = v_principal then raise exception 'El administrador principal no puede revocarse a sí mismo.'; end if;
  delete from public.tournament_admins where tournament_id = v_tid and user_id = p_user_id;
  perform public.audit(v_tid, 'admin.revocado', 'tournamentAdmins', 'Rol de administrador retirado.');
end $$;

-- ============================================================
-- Competición: calendario y partes de resultado
-- ============================================================

-- Round-robin a ida (cada club juega contra todos una vez).
create or replace function public.generate_calendar()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
  v_ids uuid[]; v_n int; v_i int; v_j int; v_md int; v_total int; v_kick timestamptz;
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración genera el calendario.'; end if;
  delete from public.fixtures where tournament_id = v_tid;
  select coalesce(array_agg(id order by name), '{}') into v_ids from public.clubs where tournament_id = v_tid;
  v_n := array_length(v_ids, 1);
  if v_n < 2 or v_n % 2 <> 0 then raise exception 'Se necesita un número par de clubes (hay %).', v_n; end if;

  v_total := v_n - 1; v_md := 0; v_kick := now() + interval '7 days';
  for v_i in 1..v_total loop
    v_md := v_md + 1;
    for v_j in 1..(v_n / 2) loop
      declare home int; away int;
      begin
        home := v_ids[((v_j + v_i - 2) % (v_n - 1)) + 1];
        away := v_ids[((v_n - v_j + v_i) % (v_n - 1)) + 1];
        if v_j = 1 then away := v_ids[v_n]; end if;
        insert into public.fixtures (tournament_id, matchday, home_club_id, away_club_id, kickoff_at)
        values (v_tid, v_md, home, away, v_kick + make_interval(days => (v_md - 1) * 3))
        on conflict do nothing;
      end;
    end loop;
  end loop;
  update public.tournaments set total_matchdays = v_md, status = 'competicion' where id = v_tid;
  perform public.audit(v_tid, 'calendario.generado', 'fixtures', 'Calendario de ' || v_md || ' jornadas generado.');
  return v_md;
end $$;

create or replace function public.report_fixture(
  p_fixture_id uuid, p_home_goals int, p_away_goals int,
  p_goals jsonb default '[]'::jsonb, p_yellow jsonb default '[]'::jsonb,
  p_red jsonb default '[]'::jsonb, p_injuries jsonb default '[]'::jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid; v_fx public.fixtures%rowtype; v_row jsonb; v_points_home int; v_points_away int;
begin
  if not public.is_admin((select tournament_id from public.fixtures where id = p_fixture_id)) then
    raise exception 'Solo Administración reporta resultados.';
  end if;
  select * into v_fx from public.fixtures where id = p_fixture_id;
  v_tid := v_fx.tournament_id;

  v_points_home := case when p_home_goals > p_away_goals then 3 when p_home_goals = p_away_goals then 1 else 0 end;
  v_points_away := case when p_away_goals > p_home_goals then 3 when p_home_goals = p_away_goals then 1 else 0 end;

  update public.fixtures set
    status = 'jugado', home_goals = p_home_goals, away_goals = p_away_goals,
    home_points = v_points_home, away_points = v_points_away, played_at = now()
  where id = p_fixture_id;

  insert into public.fixture_reports (tournament_id, fixture_id, home_goals, away_goals, goals, yellow_cards, red_cards, injuries, reported_by, reporter_name)
  values (v_tid, p_fixture_id, p_home_goals, p_away_goals, p_goals, p_yellow, p_red, p_injuries, auth.uid(),
          coalesce((select nickname from public.profiles where id = auth.uid()), 'Administración'))
  on conflict (fixture_id) do update set
    home_goals = excluded.home_goals, away_goals = excluded.away_goals, goals = excluded.goals,
    yellow_cards = excluded.yellow_cards, red_cards = excluded.red_cards, injuries = excluded.injuries,
    reported_by = excluded.reported_by, reporter_name = excluded.reporter_name, updated_at = now();

  -- Lesiones: el jugador queda inhabilitado hasta la jornada indicada.
  for v_row in select * from jsonb_array_elements(p_injuries) loop
    update public.squad_players set injured_until_matchday = (v_row->>'matchdays')::int
    where tournament_id = v_tid and player_id::text = v_row->>'playerId';
  end loop;

  perform public.audit(v_tid, 'partido.reportado', 'fixtures',
    'Resultado ' || p_home_goals::text || '-' || p_away_goals::text || ' registrado.', v_fx.home_club_id);
end $$;

-- Cierra la jornada actual y avanza a la siguiente.
create or replace function public.close_matchday()
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración cierra la jornada.'; end if;
  update public.tournaments
  set current_matchday = least(current_matchday + 1, total_matchdays),
      next_matchday_at = now() + interval '3 days'
  where id = v_tid;
  perform public.audit(v_tid, 'jornada.cerrada', 'tournaments', 'Jornada cerrada y avanzada.');
end $$;

-- ============================================================
-- Compatibilidad con el frontend (usadas por la capa convex-compat)
-- ============================================================

-- Ejecuta los acuerdos reservados cuando la ventana de draft está abierta.
create or replace function public.respond_offer_execute_reserved()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
  v_open boolean; v_o record; v_executed int := 0; v_invalid int := 0;
begin
  if v_tid is null then raise exception 'Sin liga activa.'; end if;
  select market_open into v_open from public.tournaments where id = v_tid;
  if not coalesce(v_open, false) then raise exception 'La ventana de ejecución está cerrada.'; end if;

  for v_o in select * from public.offers where tournament_id = v_tid and status = 'reservada' loop
    begin
      -- Transferencias: mover propiedad + presupuesto entre clubes.
      update public.squad_players sp
      set club_id = v_o.bidder_club_id,
          president_id = v_o.bidder_president_id,
          squad_id = (select s.id from public.squads s where s.club_id = v_o.bidder_club_id)
      where sp.tournament_id = v_tid
        and sp.player_id = any(coalesce(v_o.requested_player_ids, '{}'))
        and sp.president_id = v_o.seller_president_id;

      insert into public.squad_players (tournament_id, club_id, squad_id, player_id, president_id, ovr_at_join, value_at_join)
      select v_tid, v_o.bidder_club_id, s.id, pl.id, v_o.bidder_president_id, pl.ovr, pl.value
      from public.players pl
      join public.squads s on s.club_id = v_o.bidder_club_id
      where pl.id = any(coalesce(v_o.requested_player_ids, '{}'))
        and not exists (select 1 from public.squad_players sp
                        where sp.tournament_id = v_tid and sp.player_id = pl.id)
      on conflict (squad_id, player_id) do nothing;

      update public.presidents set budget = budget - v_o.cash where id = v_o.bidder_president_id;
      update public.presidents set budget = budget + v_o.cash where id = v_o.seller_president_id;
      update public.squad_players sp set president_id = v_o.bidder_president_id, club_id = v_o.bidder_club_id,
        squad_id = (select s.id from public.squads s where s.club_id = v_o.bidder_club_id)
      where sp.tournament_id = v_tid and sp.player_id = any(coalesce(v_o.offered_player_ids, '{}'))
        and sp.president_id = v_o.bidder_president_id;

      update public.offers set status = 'ejecutada', executed_at = now(), updated_at = now() where id = v_o.id;
      perform public.audit(v_tid, 'oferta.ejecutada', 'offers', 'Operación reservada ejecutada en la ventana.');
      v_executed := v_executed + 1;
    exception when others then
      update public.offers set status = 'invalidada', invalid_reason = sqlerrm, updated_at = now() where id = v_o.id;
      v_invalid := v_invalid + 1;
    end;
  end loop;
  return jsonb_build_object('executed', v_executed, 'invalidated', v_invalid);
end $$;

-- Mueve a un presidente a otro club (catálogo nuevo o club libre de la liga).
create or replace function public.change_president_club(
  p_president_id uuid, p_team_catalog_id uuid default null, p_league_club_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
  v_new_club uuid; v_old_club uuid;
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración cambia el club de un presidente.'; end if;
  select club_id into v_old_club from public.presidents where id = p_president_id and tournament_id = v_tid;
  if v_old_club is null then raise exception 'El presidente no existe.'; end if;

  if p_league_club_id is not null then
    if exists (select 1 from public.presidents p where p.club_id = p_league_club_id and p.id <> p_president_id) then
      raise exception 'Ese club ya tiene presidente.';
    end if;
    v_new_club := p_league_club_id;
  else
    insert into public.clubs (tournament_id, name, short_name, league, country, color_primary, color_secondary, catalog_team_id)
    select v_tid, t.name, split_part(t.name, ' ', 1), t.league, t.country, t.color_primary, t.color_secondary, t.id
    from public.team_catalog t where t.id = p_team_catalog_id
    returning id into v_new_club;
  end if;
  if v_new_club is null then raise exception 'Club de destino no válido.'; end if;

  update public.presidents set club_id = v_new_club where id = p_president_id;
  insert into public.squads (tournament_id, club_id, president_id)
  values (v_tid, v_new_club, p_president_id)
  on conflict (club_id) do update set president_id = excluded.president_id;
  perform public.audit(v_tid, 'presidente.movido', 'presidents', 'Cambio de club administrado por Administración.', v_new_club);
end $$;

-- Libera un club: el presidente pierde la plantilla y vuelve a la puerta.
create or replace function public.remove_president(p_president_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración puede liberar un club.'; end if;
  delete from public.squad_players where president_id = p_president_id and tournament_id = v_tid;
  update public.presidents set club_id = null where id = p_president_id and tournament_id = v_tid;
  perform public.audit(v_tid, 'presidente.libre', 'presidents', 'Club liberado: la plantilla vuelve al mercado.');
end $$;

-- Reinicio total de la liga: plantillas, ofertas, draft y competición.
create or replace function public.reset_league()
returns void
language plpgsql security definer set search_path = public as $$
declare v_tid uuid := (select active_tournament_id from public.profiles where id = auth.uid());
begin
  if not public.is_admin(v_tid) then raise exception 'Solo Administración puede reiniciar la liga.'; end if;
  delete from public.draft_picks where tournament_id = v_tid;
  delete from public.drafts where tournament_id = v_tid;
  delete from public.offers where tournament_id = v_tid;
  delete from public.squad_players where tournament_id = v_tid;
  delete from public.fixtures where tournament_id = v_tid;
  delete from public.fixture_reports where tournament_id = v_tid;
  update public.presidents set club_id = null, budget = (select budget from public.tournament_rules where tournament_id = v_tid) where tournament_id = v_tid;
  update public.tournaments set status = 'configuracion', current_matchday = 1 where id = v_tid;
  perform public.audit(v_tid, 'liga.reiniciada', 'tournaments', 'La liga volvió a su estado inicial.');
end $$;
