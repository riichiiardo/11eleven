-- Apply AFTER draft-outgoing.sql. Does not place bids, accept offers or open drafts.
begin;
-- Correct the legacy offer query without replacing its transaction lock or ACL.
do $$ declare definition text; begin
  definition:=pg_get_functiondef('public.create_offer(text,uuid[],uuid[],bigint,text)'::regprocedure);
  if strpos(definition,'owned.availability')>0 or strpos(definition,'owned.president_id')>0 then
    execute replace(replace(definition,'owned.availability','sp.availability'),'owned.president_id','sp.president_id');
  end if;
end $$;
create table if not exists app.transfer_notifications (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  recipient_id uuid not null references public.presidents(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists transfer_notifications_recipient on app.transfer_notifications(recipient_id,created_at desc);
alter table app.transfer_notifications enable row level security;
revoke all on app.transfer_notifications from public,anon,authenticated;

create or replace function app.departure_bids() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid; me uuid;
begin
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
  if me is null or not public.is_member(tid) then raise exception 'Selecciona tu club para consultar las pujas.'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'playerId',d.player_id,'ownerIsMe',d.president_id=me,
    'closed',app.outgoing_has_agreement(tid,d.president_id,d.player_id),
    'count',(select count(distinct o.bidder_president_id) from public.offers o where o.tournament_id=tid and o.seller_president_id=d.president_id and d.player_id=any(o.requested_player_ids) and o.status in ('enviada','negociacion')),
    -- Packages and trades are not comparable with a per-player cash bid.
    'highestCash',(select max(o.cash) from public.offers o where o.tournament_id=tid and o.seller_president_id=d.president_id and o.requested_player_ids=array[d.player_id] and cardinality(o.offered_player_ids)=0 and o.type='cash' and o.status in ('enviada','negociacion')),
    'myCash',(select max(o.cash) from public.offers o where o.tournament_id=tid and o.bidder_president_id=me and o.seller_president_id=d.president_id and o.requested_player_ids=array[d.player_id] and cardinality(o.offered_player_ids)=0 and o.type='cash' and o.status in ('enviada','negociacion')),
    'offers',case when d.president_id=me then (select coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'club',c.name,'cash',o.cash,'status',o.status,'package',cardinality(o.requested_player_ids)>1 or cardinality(o.offered_player_ids)>0,
      'requested',(select coalesce(jsonb_agg(p.name),'[]') from public.players p where p.id=any(o.requested_player_ids)),
      'offered',(select coalesce(jsonb_agg(p.name),'[]') from public.players p where p.id=any(o.offered_player_ids))
    ) order by o.cash desc,o.created_at),'[]') from public.offers o join public.clubs c on c.id=o.bidder_club_id
      where o.tournament_id=tid and o.seller_president_id=d.president_id and d.player_id=any(o.requested_player_ids)
        and o.status in ('enviada','negociacion','aceptada','reservada')) else '[]'::jsonb end
  ) order by d.player_id),'[]') from app.draft_outgoing d
    join public.squad_players sp on sp.tournament_id=tid and sp.player_id=d.player_id and sp.president_id=d.president_id
    where d.tournament_id=tid and d.status in ('selected','negotiated'));
end $$;

create or replace function app.place_departure_bid(p_player_id uuid,p_cash bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare tid uuid; me public.presidents%rowtype; seller public.squad_players%rowtype; previous public.offers%rowtype; committed numeric; result uuid;
begin
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  if auth.uid() is null or not public.is_member(tid) then raise exception 'Debes pertenecer al Universo.'; end if;
  perform app.lock_draft_outgoing(tid);
  select * into me from public.presidents where tournament_id=tid and user_id=auth.uid() for update;
  if me.id is null then raise exception 'Selecciona primero tu club.'; end if;
  if p_cash is null or p_cash<=0 or p_cash>2000000000 then raise exception 'La oferta debe ser un importe positivo en euros.'; end if;
  select * into seller from public.squad_players sp where sp.tournament_id=tid and sp.player_id=p_player_id
    and exists(select 1 from app.draft_outgoing d where d.tournament_id=tid and d.player_id=p_player_id and d.president_id=sp.president_id and d.status='selected') for update;
  if seller.id is null or seller.president_id=me.id then raise exception 'Esta baja no está disponible para ti.'; end if;
  if app.outgoing_has_agreement(tid,seller.president_id,p_player_id) then raise exception 'El presidente ya cerró un acuerdo por este jugador.'; end if;
  select * into previous from public.offers o where o.tournament_id=tid and o.bidder_president_id=me.id and o.seller_president_id=seller.president_id
    and o.requested_player_ids=array[p_player_id] and cardinality(o.offered_player_ids)=0 and o.type='cash' and o.status in ('enviada','negociacion') order by o.created_at desc limit 1 for update;
  if previous.id is not null and p_cash<=previous.cash then raise exception 'La nueva puja debe superar tu oferta anterior.'; end if;
  select coalesce(sum(o.cash),0) into committed from public.offers o where o.tournament_id=tid and o.bidder_president_id=me.id
    and o.status in ('enviada','negociacion','aceptada','reservada') and o.id is distinct from previous.id;
  if p_cash>me.budget-committed then raise exception 'Presupuesto insuficiente para esta puja.'; end if;
  if previous.id is not null then
    update public.offers set cash=p_cash,updated_at=now(),status='enviada' where id=previous.id returning id into result;
  else
    insert into public.offers(tournament_id,type,bidder_president_id,bidder_club_id,seller_president_id,seller_club_id,requested_player_ids,cash,status)
      values(tid,'cash',me.id,me.club_id,seller.president_id,seller.club_id,array[p_player_id],p_cash,'enviada') returning id into result;
  end if;
  return result;
end $$;

-- Protect the seller's decision: a single firm agreement, no automatic winner.
create or replace function app.guard_departure_close() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('enviada','negociacion','aceptada','reservada') and exists(
    select 1 from app.draft_outgoing d where d.tournament_id=new.tournament_id and d.status in ('selected','negotiated')
      and (d.player_id=any(new.requested_player_ids) or d.player_id=any(new.offered_player_ids))) then
    perform app.lock_draft_outgoing(new.tournament_id);
    if exists(select 1 from public.offers o where o.tournament_id=new.tournament_id and o.id<>new.id and o.status in ('aceptada','reservada')
      and (o.requested_player_ids||o.offered_player_ids)&&(new.requested_player_ids||new.offered_player_ids)) then
      raise exception 'Ya existe un acuerdo aceptado o reservado por uno de estos jugadores.';
    end if;
    if new.status in ('aceptada','reservada') and exists(select 1 from unnest(new.requested_player_ids) pid where not exists(
      select 1 from public.squad_players sp where sp.tournament_id=new.tournament_id and sp.player_id=pid and sp.president_id=new.seller_president_id)) then
      raise exception 'El jugador ya no pertenece al vendedor.';
    end if;
    if new.status in ('aceptada','reservada') and exists(select 1 from unnest(new.offered_player_ids) pid where not exists(
      select 1 from public.squad_players sp where sp.tournament_id=new.tournament_id and sp.player_id=pid and sp.president_id=new.bidder_president_id)) then
      raise exception 'Un jugador ofrecido ya no pertenece al comprador.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_departure_close on public.offers;
create trigger guard_departure_close before insert or update on public.offers for each row execute function app.guard_departure_close();

create or replace function app.notify_departure_offer() returns trigger
language plpgsql security definer set search_path='' as $$
declare club text; names text; text_message text; related boolean;
begin
  if tg_op='UPDATE' and new.status=old.status and new.cash=old.cash then return new; end if;
  select exists(select 1 from app.draft_outgoing d where d.tournament_id=new.tournament_id and d.president_id=new.seller_president_id and d.player_id=any(new.requested_player_ids)) into related;
  if not related then return new; end if;
  select name into club from public.clubs where id=new.bidder_club_id;
  select string_agg(name,', ' order by name) into names from public.players where id=any(new.requested_player_ids);
  text_message:=coalesce(club,'Un club')||' · '||coalesce(names,'Jugador')||' · '||new.cash::text||' €'||case when cardinality(new.requested_player_ids)>1 or cardinality(new.offered_player_ids)>0 then ' (efectivo total de la operación)' else '' end||' · '||case new.status when 'enviada' then 'oferta enviada' when 'negociacion' then 'en negociación' when 'reservada' then 'acuerdo reservado' when 'aceptada' then 'oferta aceptada' when 'invalidada' then 'oferta invalidada' when 'rechazada' then 'oferta rechazada' when 'cancelada' then 'oferta cancelada' when 'ejecutada' then 'traspaso ejecutado' else new.status end;
  insert into app.transfer_notifications(tournament_id,recipient_id,offer_id,message) values(new.tournament_id,new.seller_president_id,new.id,text_message);
  if tg_op='UPDATE' and new.status<>old.status then
    insert into app.transfer_notifications(tournament_id,recipient_id,offer_id,message) values(new.tournament_id,new.bidder_president_id,new.id,'Respuesta a tu oferta: '||text_message);
  end if;
  if new.status in ('enviada','negociacion') and new.type='cash' and cardinality(new.requested_player_ids)=1 and cardinality(new.offered_player_ids)=0 then
    insert into app.transfer_notifications(tournament_id,recipient_id,offer_id,message)
      select distinct new.tournament_id,o.bidder_president_id,new.id,'Han superado tu puja por '||names||': nueva oferta de '||new.cash::text||' €. Puedes mejorarla; el vendedor decide.'
      from public.offers o where o.tournament_id=new.tournament_id and o.bidder_president_id<>new.bidder_president_id and o.seller_president_id=new.seller_president_id
        and o.requested_player_ids=new.requested_player_ids and o.type='cash' and cardinality(o.offered_player_ids)=0 and o.cash<new.cash and o.status in ('enviada','negociacion');
  end if;
  if new.status in ('aceptada','reservada') then
    update public.offers o set status='invalidada',invalid_reason='El propietario cerró un acuerdo por un jugador de esta oferta.',updated_at=now()
      where o.tournament_id=new.tournament_id and o.id<>new.id and o.status in ('enviada','negociacion')
        and (o.requested_player_ids||o.offered_player_ids)&&(new.requested_player_ids||new.offered_player_ids);
  end if;
  return new;
end $$;
drop trigger if exists notify_departure_offer on public.offers;
create trigger notify_departure_offer after insert or update on public.offers for each row execute function app.notify_departure_offer();

create or replace function app.transfer_notifications_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid; me uuid;
begin
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
  if me is null or not public.is_member(tid) then raise exception 'Selecciona primero tu club.'; end if;
  return jsonb_build_object('unread',(select count(*) from app.transfer_notifications where recipient_id=me and tournament_id=tid and read_at is null),
    'items',(select coalesce(jsonb_agg(to_jsonb(n) order by (n."readAt" is null) desc,n."createdAt" desc,n.id),'[]') from (
      select nt.id,nt.offer_id as "offerId",nt.message,nt.created_at as "createdAt",nt.read_at as "readAt",
        case when o.status in ('aceptada','reservada') then 'reservadas' when o.status not in ('enviada','negociacion') then 'historial' when o.bidder_president_id=me then 'enviadas' else 'recibidas' end as tab
      from app.transfer_notifications nt join public.offers o on o.id=nt.offer_id where nt.recipient_id=me and nt.tournament_id=tid order by (nt.read_at is null) desc,nt.created_at desc,nt.id limit 30) n));
end $$;
create or replace function app.read_transfer_notifications(p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid; me uuid;
begin
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
  if me is null or not public.is_member(tid) then raise exception 'Selecciona primero tu club.'; end if;
  update app.transfer_notifications set read_at=now() where recipient_id=me and tournament_id=tid and id=any(p_ids) and read_at is null;
end $$;

revoke all on function app.guard_departure_close(),app.notify_departure_offer() from public,anon,authenticated;
revoke all on function app.departure_bids(),app.place_departure_bid(uuid,bigint),app.transfer_notifications_state(),app.read_transfer_notifications(uuid[]) from public,anon;
grant execute on function app.departure_bids(),app.place_departure_bid(uuid,bigint),app.transfer_notifications_state(),app.read_transfer_notifications(uuid[]) to authenticated;
create or replace function public.departure_bids() returns jsonb language sql security invoker set search_path='' as $$ select app.departure_bids() $$;
create or replace function public.place_departure_bid(p_player_id uuid,p_cash bigint) returns uuid language sql security invoker set search_path='' as $$ select app.place_departure_bid(p_player_id,p_cash) $$;
create or replace function public.transfer_notifications_state() returns jsonb language sql security invoker set search_path='' as $$ select app.transfer_notifications_state() $$;
create or replace function public.read_transfer_notifications(p_ids uuid[]) returns void language sql security invoker set search_path='' as $$ select app.read_transfer_notifications(p_ids) $$;
revoke all on function public.departure_bids(),public.place_departure_bid(uuid,bigint),public.transfer_notifications_state(),public.read_transfer_notifications(uuid[]) from public,anon;
grant execute on function public.departure_bids(),public.place_departure_bid(uuid,bigint),public.transfer_notifications_state(),public.read_transfer_notifications(uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
