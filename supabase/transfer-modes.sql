-- Install after market-sold.sql. Informational prelists remain separate from agreements.
begin;
create or replace function app.validate_transfer_intent(p_type text,p_requested uuid[],p_offered uuid[],p_cash bigint) returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid; me public.presidents%rowtype; target public.squad_players%rowtype; amount bigint;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.';end if;
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_member(tid),false) then raise exception 'No perteneces al universo activo.';end if;
 perform app.lock_draft_outgoing(tid);
 select * into me from public.presidents where tournament_id=tid and user_id=auth.uid() for update;
 if me.id is null or me.club_id is null then raise exception 'Selecciona tu club.';end if;
 if p_type is null or p_type not in('cash','trade') or coalesce(cardinality(p_requested),0)<>1 or array_position(p_requested,null) is not null or p_offered is null or p_cash is null or p_cash<0 or p_cash>2000000000 then raise exception 'Indica un jugador de destino y un importe válido en euros.';end if;
 if not exists(select 1 from public.players where id=p_requested[1]) then raise exception 'Jugador no disponible en el catálogo.';end if;
 select * into target from public.squad_players where tournament_id=tid and player_id=p_requested[1];
 if target.id is null then
  if not coalesce((select market_open from public.tournaments where id=tid),false) then raise exception 'La ventana de mercado está cerrada para fichar jugadores libres.';end if;
  if p_type<>'cash' or cardinality(p_offered)<>0 or p_cash<>(select value from public.players where id=p_requested[1]) then raise exception 'Un jugador libre se adquiere pagando exactamente su valor actual, sin intercambio.';end if;
 else
  if target.president_id=me.id then raise exception 'No puedes comprarte tu propio jugador.';end if;
  if target.availability='intransferible' then raise exception 'El jugador es intransferible.';end if;
  if not exists(select 1 from public.presidents p join public.league_members m on m.user_id=p.user_id and m.tournament_id=p.tournament_id where p.id=target.president_id and p.club_id=target.club_id and p.tournament_id=tid) then raise exception 'El equipo vendedor no tiene un manager activo.';end if;
  if p_type='cash' and (cardinality(p_offered)<>0 or p_cash<=0) then raise exception 'La compra requiere un precio positivo y ningún jugador ofrecido.';end if;
  if p_type='trade' and (cardinality(p_offered)<>1 or array_position(p_offered,null) is not null or not exists(select 1 from public.squad_players where tournament_id=tid and player_id=p_offered[1] and president_id=me.id and club_id=me.club_id)) then raise exception 'El intercambio debe ser uno a uno con un jugador de tu plantilla.';end if;
 end if;
 select me.budget-coalesce(sum(cash),0) into amount from public.offers where tournament_id=tid and bidder_president_id=me.id and status in('enviada','negociacion','aceptada','reservada');
 if p_cash>amount then raise exception 'Presupuesto insuficiente para esta solicitud.';end if;
end$$;
revoke all on function app.validate_transfer_intent(text,uuid[],uuid[],bigint) from public,anon,authenticated;

create or replace function public.transfer_quote(p_requested uuid[],p_offered uuid[],p_cash bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare problem text; available bigint; value bigint; seller text; tid uuid; me uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.';end if;
 begin perform app.validate_transfer_intent(case when cardinality(p_offered)>0 then 'trade' else 'cash' end,p_requested,p_offered,p_cash);exception when others then problem:=sqlerrm;end;
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_member(tid),false) then raise exception 'No perteneces al universo activo.';end if;
 select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
 select p.budget-coalesce((select sum(o.cash) from public.offers o where o.tournament_id=tid and o.bidder_president_id=p.id and o.status in('enviada','negociacion','aceptada','reservada')),0) into available from public.presidents p where id=me;
 select pl.value into value from public.players pl where id=p_requested[1];
 select c.name into seller from public.squad_players sp join public.clubs c on c.id=sp.club_id where sp.tournament_id=tid and sp.player_id=p_requested[1];
 return jsonb_build_object('passed',problem is null,'checks',jsonb_build_array(jsonb_build_object('id','transfer-intent','ruleRef','Mercado','label','Propiedad, modalidad e importe','value',coalesce(p_cash,0)::text||' €','passed',problem is null,'detail',coalesce(problem,'Solicitud válida. La aceptación y la ejecución vuelven a comprobar el estado actual.'))),'blockers',case when problem is null then '[]'::jsonb else jsonb_build_array(problem) end,'spendable',coalesce(available,0),'guidance',jsonb_build_object('maxOffer',greatest(coalesce(available,0),0),'suggested',coalesce(value,0),'walkAway',greatest(coalesce(available,0),0)),'sellerClubName',seller);
end$$;

create or replace function app.validate_transfer_response(p_offer_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid; me uuid; o public.offers%rowtype; amount bigint;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.';end if;
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_member(tid),false) then raise exception 'No perteneces al universo activo.';end if;
 perform app.lock_draft_outgoing(tid);
 select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
 select * into o from public.offers where id=p_offer_id and tournament_id=tid for update;
 if me is null or o.id is null then raise exception 'La oferta no pertenece a tu universo.';end if;
 if p_action='cancelar' then
  if o.bidder_president_id<>me or o.status not in('enviada','negociacion') then raise exception 'Solo puedes retirar tus ofertas pendientes, no una compra aprobada.';end if;
  return;
 end if;
 if p_action is null or p_action not in('aceptar','rechazar','negociar') then raise exception 'Acción no válida.';end if;
 if (o.seller_president_id is null and o.bidder_president_id<>me) or (o.seller_president_id is not null and o.seller_president_id<>me) then raise exception 'Solo el propietario destinatario puede aprobar esta compra.';end if;
 if o.status not in('enviada','negociacion') then raise exception 'La oferta ya fue respondida.';end if;
 if p_action<>'aceptar' then return;end if;
 if exists(select 1 from unnest(o.requested_player_ids) pid where case when o.seller_president_id is null then exists(select 1 from public.squad_players where tournament_id=tid and player_id=pid) else not exists(select 1 from public.squad_players where tournament_id=tid and player_id=pid and president_id=o.seller_president_id and club_id=o.seller_club_id) end) or exists(select 1 from unnest(o.offered_player_ids) pid where not exists(select 1 from public.squad_players where tournament_id=tid and player_id=pid and president_id=o.bidder_president_id and club_id=o.bidder_club_id)) then raise exception 'La propiedad de los jugadores cambió. Revisa la solicitud.';end if;
 if exists(select 1 from public.offers x where x.tournament_id=tid and x.id<>o.id and x.status in('aceptada','reservada') and (x.requested_player_ids||x.offered_player_ids)&&(o.requested_player_ids||o.offered_player_ids)) then raise exception 'Ya hay una venta aprobada. Cancélala antes de aceptar otra.';end if;
 select budget into amount from public.presidents where id=o.bidder_president_id and tournament_id=tid for update;
 if amount is null or o.cash>amount-coalesce((select sum(cash) from public.offers where tournament_id=tid and bidder_president_id=o.bidder_president_id and id<>o.id and status in('enviada','negociacion','aceptada','reservada')),0) then raise exception 'El comprador ya no dispone del presupuesto necesario.';end if;
 if o.seller_president_id is null and (o.type<>'cash' or cardinality(o.requested_player_ids)<>1 or cardinality(o.offered_player_ids)<>0 or o.cash<>(select value from public.players where id=o.requested_player_ids[1])) then raise exception 'El valor del jugador libre cambió. Envía una nueva solicitud.';end if;
end$$;
revoke all on function app.validate_transfer_response(uuid,text) from public,anon,authenticated;

-- Add guards to installed functions while preserving previous migration logic.
do $$declare d text;marker text;begin
 d:=pg_get_functiondef('public.create_offer(text,uuid[],uuid[],bigint,text)'::regprocedure);
 if strpos(d,'app.validate_transfer_intent')=0 then d:=replace(d,E'\nbegin\n',E'\nbegin\n perform app.validate_transfer_intent(p_type,p_requested,p_offered,p_cash);\n');end if;
 d:=replace(d,$m$  if not (select market_open from public.tournaments where id = v_tid) then
    raise exception 'La ventana de mercado está cerrada.';
  end if;$m$,'');
 -- A sold announcement must still allow a competing request for the owner to consider.
 d:=regexp_replace(d,'when sp[.]availability = ''vendido'' then [^\n]*\n','','g');execute d;
 d:=pg_get_functiondef('public.respond_offer(uuid,text)'::regprocedure);
 if strpos(d,'app.validate_transfer_response')=0 then execute replace(d,E'\nbegin\n',E'\nbegin\n perform app.validate_transfer_response(p_offer_id,p_action);\n');end if;
 d:=pg_get_functiondef('app.guard_departure_close()'::regprocedure);
 d:=replace(d,'if exists(select 1 from public.offers o where o.tournament_id=new.tournament_id','if new.status in (''aceptada'',''reservada'') and exists(select 1 from public.offers o where o.tournament_id=new.tournament_id');execute d;
 d:=pg_get_functiondef('app.place_departure_bid(uuid,bigint)'::regprocedure);
 d:=replace(d,'if app.outgoing_has_agreement(tid,seller.president_id,p_player_id) then raise exception ''El presidente ya cerró un acuerdo por este jugador.''; end if;','');execute d;
 d:=pg_get_functiondef('app.notify_departure_offer()'::regprocedure);
 d:=replace(d,'if new.status in (''aceptada'',''reservada'') then','if false then');execute d;
 d:=pg_get_functiondef('public.market_browse(text,text,boolean,integer,integer)'::regprocedure);
 d:=replace(d,'pool.availability in (''transferible'',''negociacion'',''neutro'')','pool.availability in (''transferible'',''negociacion'',''neutro'',''vendido'')');
 d:=replace(d,'when pool.availability = ''vendido'' then ''Vendido a ''||coalesce(pool.sold_to_club_name,''otro equipo'')','');execute d;
 d:=pg_get_functiondef('public.offer_json(public.offers)'::regprocedure);
 if strpos(d,'canCancelSale')=0 then
  marker:=$m$'canCancel', o.bidder_president_id$m$;
  if strpos(d,marker)=0 then raise exception 'offer_json no compatible.';end if;
  execute replace(d,marker,$m$'canCancelSale', o.seller_president_id = public.my_president_id(o.tournament_id) and o.status in ('aceptada','reservada'), 'canCancel', o.bidder_president_id$m$);
 end if;
end$$;

create or replace function public.create_transfer(p_type text,p_requested uuid[],p_offered uuid[],p_cash bigint,p_message text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oid uuid; st text;begin
 oid:=public.create_offer(p_type,p_requested,p_offered,p_cash,p_message);
 select status into st from public.offers where id=oid;
 if (select seller_president_id is null from public.offers where id=oid) then st:=public.respond_offer(oid,'aceptar');end if;
 return jsonb_build_object('offerId',oid,'status',st,'message',case when st='ejecutada' then 'Jugador libre incorporado por su valor actual.' else 'Solicitud enviada. El propietario debe aprobarla para registrar el acuerdo.' end);
end$$;

create or replace function public.sale_alternatives(p_offer_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid; me uuid; o public.offers%rowtype;begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if auth.uid() is null or not coalesce(public.is_member(tid),false) then raise exception 'Inicia sesión en tu universo.';end if;
 select id into me from public.presidents where user_id=auth.uid() and tournament_id=tid;
 select * into o from public.offers where id=p_offer_id and tournament_id=tid and seller_president_id=me and status in('aceptada','reservada');
 if o.id is null then raise exception 'Solo el vendedor puede revisar alternativas de una venta aprobada.';end if;
 return(select coalesce(jsonb_agg(public.offer_json(x) order by x.updated_at desc),'[]') from public.offers x where x.tournament_id=tid and x.seller_president_id=me and x.bidder_president_id<>o.bidder_president_id and x.status in('enviada','negociacion') and cardinality(o.requested_player_ids)=1 and x.requested_player_ids=o.requested_player_ids
 and exists(select 1 from public.presidents p join public.league_members m on m.user_id=p.user_id and m.tournament_id=p.tournament_id where p.id=x.bidder_president_id and p.club_id=x.bidder_club_id and p.tournament_id=tid)
 and exists(select 1 from public.squad_players where tournament_id=tid and player_id=o.requested_player_ids[1] and president_id=me)
 and not exists(select 1 from unnest(x.offered_player_ids) pid where not exists(select 1 from public.squad_players where tournament_id=tid and player_id=pid and president_id=x.bidder_president_id and club_id=x.bidder_club_id))
 and x.cash<= (select p.budget-coalesce((select sum(cash) from public.offers b where b.tournament_id=tid and b.bidder_president_id=p.id and b.id<>x.id and b.status in('enviada','negociacion','aceptada','reservada')),0) from public.presidents p where p.id=x.bidder_president_id));
end$$;

create or replace function public.cancel_sale(p_offer_id uuid,p_alternative_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid; o public.offers%rowtype; candidate jsonb;begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if auth.uid() is null or not coalesce(public.is_member(tid),false) then raise exception 'Inicia sesión en tu universo.';end if;
 perform app.lock_draft_outgoing(tid);
 select * into o from public.offers where id=p_offer_id and tournament_id=tid for update;
 perform 1 from public.offers where id=p_alternative_id and tournament_id=tid for update;
 select value into candidate from jsonb_array_elements(public.sale_alternatives(p_offer_id)) where value->>'id'=p_alternative_id::text;
 if candidate is null then raise exception 'Elige una oferta activa de otro manager por el mismo jugador.';end if;
 if coalesce(length(trim(p_reason)),0) not between 5 and 500 then raise exception 'Indica por qué consideras mejor la otra oferta (5 a 500 caracteres).';end if;
 update public.offers set status='cancelada',invalid_reason='Venta cancelada por el propietario. Oferta preferida: '||p_alternative_id::text||'. Motivo: '||trim(p_reason),updated_at=now() where id=o.id;
 perform public.audit(tid,'venta.cancelada','offers','Venta '||o.id::text||' cancelada por oferta '||p_alternative_id::text||': '||trim(p_reason),o.seller_club_id);
 insert into app.transfer_notifications(tournament_id,recipient_id,offer_id,message) values(tid,o.bidder_president_id,o.id,'El propietario canceló la venta por otra oferta: '||trim(p_reason));
end$$;

create or replace function public.transfer_offer_check(p_offer_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tid uuid; me uuid; o public.offers%rowtype;begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
 select * into o from public.offers where id=p_offer_id and tournament_id=tid and me in(bidder_president_id,seller_president_id);
 if auth.uid() is null or not coalesce(public.is_member(tid),false) or o.id is null then raise exception 'No tienes acceso a esta operación.';end if;
 return jsonb_build_object('passed',o.status in('aceptada','reservada','ejecutada'),'checks',jsonb_build_array(jsonb_build_object('id','approval','ruleRef','Mercado','label','Aprobación del propietario','value',o.status,'passed',o.status in('aceptada','reservada','ejecutada'),'detail','La solicitud se registra como acuerdo cuando el propietario la aprueba. La ejecución vuelve a verificar propiedad y presupuesto.')),'blockers','[]'::jsonb);
end$$;
revoke all on function public.transfer_quote(uuid[],uuid[],bigint),public.create_transfer(text,uuid[],uuid[],bigint,text),public.sale_alternatives(uuid),public.cancel_sale(uuid,uuid,text),public.transfer_offer_check(uuid) from public,anon;
grant execute on function public.transfer_quote(uuid[],uuid[],bigint),public.create_transfer(text,uuid[],uuid[],bigint,text),public.sale_alternatives(uuid),public.cancel_sale(uuid,uuid,text),public.transfer_offer_check(uuid) to authenticated;
-- Execute one reserved operation at a time under the same universe lock.
create or replace function public.respond_offer_execute_reserved() returns jsonb
language plpgsql security definer set search_path='' as $$
declare tid uuid; o public.offers%rowtype; done integer:=0; failed integer:=0; pid uuid; bid public.presidents%rowtype; seller public.presidents%rowtype;begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if auth.uid() is null or not coalesce(public.is_admin(tid),false) then raise exception 'Solo Administración puede ejecutar los acuerdos.';end if;
 perform app.lock_draft_outgoing(tid);
 if not coalesce((select market_open from public.tournaments where id=tid),false) then raise exception 'La ventana de ejecución está cerrada.';end if;
 for o in select * from public.offers where tournament_id=tid and status='reservada' order by agreed_at,id for update loop
 begin
  select * into bid from public.presidents where id=o.bidder_president_id and tournament_id=tid and club_id=o.bidder_club_id for update;
  select * into seller from public.presidents where id=o.seller_president_id and tournament_id=tid and club_id=o.seller_club_id for update;
  if bid.id is null or (o.seller_president_id is not null and seller.id is null) then raise exception 'Uno de los managers cambió de club.';end if;
  if not exists(select 1 from public.league_members where tournament_id=tid and user_id=bid.user_id) or (seller.id is not null and not exists(select 1 from public.league_members where tournament_id=tid and user_id=seller.user_id)) then raise exception 'Uno de los managers ya no pertenece al universo.';end if;
  if o.cash>bid.budget then raise exception 'Presupuesto insuficiente al ejecutar.';end if;
  if cardinality(o.requested_player_ids)<>1 or cardinality(o.offered_player_ids) not between 0 and 1 then raise exception 'Revisa la operación antigua: debe ser uno a uno.';end if;
  foreach pid in array o.requested_player_ids loop
   if seller.id is null then
    if exists(select 1 from public.squad_players where tournament_id=tid and player_id=pid) then raise exception 'El jugador ya no está libre.';end if;
   elsif not exists(select 1 from public.squad_players where tournament_id=tid and player_id=pid and president_id=seller.id and club_id=seller.club_id) then raise exception 'El vendedor ya no tiene el jugador.';end if;
  end loop;
  foreach pid in array o.offered_player_ids loop
   if seller.id is null or not exists(select 1 from public.squad_players where tournament_id=tid and player_id=pid and president_id=bid.id and club_id=bid.club_id) then raise exception 'El jugador de intercambio ya no pertenece al comprador.';end if;
  end loop;
  update public.squads s set lineup=(select coalesce(jsonb_agg(case when slot->>'playerId'=any((o.requested_player_ids||o.offered_player_ids)::text[]) then slot||jsonb_build_object('playerId',null) else slot end order by n),'[]') from jsonb_array_elements(s.lineup) with ordinality slots(slot,n)),lineup_updated_at=now() where tournament_id=tid and president_id in(bid.id,seller.id);
  update public.squad_players set club_id=bid.club_id,president_id=bid.id,squad_id=(select id from public.squads where club_id=bid.club_id),availability='neutro' where tournament_id=tid and player_id=any(o.requested_player_ids) and president_id=seller.id;
  if seller.id is null then
   insert into public.squad_players(tournament_id,club_id,squad_id,player_id,president_id,ovr_at_join,value_at_join)
   select tid,bid.club_id,s.id,p.id,bid.id,p.ovr,p.value from public.players p join public.squads s on s.club_id=bid.club_id where p.id=any(o.requested_player_ids);
  end if;
  update public.squad_players set club_id=seller.club_id,president_id=seller.id,squad_id=(select id from public.squads where club_id=seller.club_id),availability='neutro' where tournament_id=tid and player_id=any(o.offered_player_ids) and president_id=bid.id;
  update public.presidents set budget=budget-o.cash where id=bid.id;
  update public.presidents set budget=budget+o.cash where id=seller.id;
  update public.offers set status='ejecutada',executed_at=now(),updated_at=now() where id=o.id;
  update public.offers set status='invalidada',invalid_reason='El jugador fue transferido en otra operación.',updated_at=now() where tournament_id=tid and id<>o.id and status in('enviada','negociacion') and (requested_player_ids||offered_player_ids)&&(o.requested_player_ids||o.offered_player_ids);
  perform public.audit(tid,'oferta.ejecutada','offers','Traspaso ejecutado: '||o.id::text,bid.club_id);
  done:=done+1;
 exception when others then
  update public.offers set status='invalidada',invalid_reason=sqlerrm,updated_at=now() where id=o.id;failed:=failed+1;
 end;
 end loop;
 return jsonb_build_object('executed',done,'invalidated',failed);
end$$;
revoke all on function public.respond_offer_execute_reserved() from public,anon;
grant execute on function public.respond_offer_execute_reserved() to authenticated;


create or replace function app.validate_prelist_transfer_modes(entries jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare e jsonb; mode text; tid uuid; me uuid; used uuid[]:='{}'; pid uuid;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
 for e in select value from jsonb_array_elements(entries) loop
  mode:=coalesce(e->>'transferMode',case when e->>'kind'='new' then 'free' else 'purchase' end);
  if (e->>'kind'='new' and mode<>'free') or (e->>'kind'='owned' and mode not in('purchase','exchange','exchange_cash')) then raise exception 'Motivo de ingreso no válido.';end if;
  if mode='exchange' then
   if (e->>'price')::numeric<>0 then raise exception 'Un intercambio sin dinero debe indicar 0 €.';end if;
  elsif (e->>'price')::numeric<=0 then raise exception 'Indica un importe positivo en euros.';end if;
  if mode in('exchange','exchange_cash') then
   pid:=(e->>'offeredPlayerId')::uuid;
   if pid is null or pid=any(used) or not exists(select 1 from public.squad_players where tournament_id=tid and president_id=me and player_id=pid) then raise exception 'El intercambio requiere un jugador propio distinto en cada alta.';end if;
   used:=array_append(used,pid);
  elsif e ? 'offeredPlayerId' then raise exception 'Esta modalidad no admite jugadores ofrecidos.';end if;
 end loop;
end$$;
revoke all on function app.validate_prelist_transfer_modes(jsonb) from public,anon,authenticated;
do $$declare d text;begin
 d:=pg_get_functiondef('app.save_draft_prelist(jsonb,jsonb,integer,boolean)'::regprocedure);
 if strpos(d,'app.validate_prelist_transfer_modes')=0 then
  d:=replace(d,$m$  clean jsonb:='[]';$m$,$m$  transfer_mode text; offered_id text; clean jsonb:='[]';$m$);
  d:=replace(d,'for item in select value from jsonb_array_elements(p_entries) loop', 'perform app.validate_prelist_transfer_modes(p_entries); for item in select value from jsonb_array_elements(p_entries) loop transfer_mode:=item->>''transferMode''; offered_id:=item->>''offeredPlayerId''; if offered_id is not null and not exists(select 1 from jsonb_array_elements_text(p_outgoing) v where v=offered_id) then raise exception ''El jugador de intercambio debe estar en tus bajas previstas.'';end if;');
  d:=replace(d,'not between 0.01 and 2000000000','not between 0 and 2000000000');
  d:=replace(d,'    select value into old from jsonb_array_elements(r.entries)', '    if transfer_mode is not null then item:=item||jsonb_build_object(''transferMode'',transfer_mode);end if; if offered_id is not null then item:=item||jsonb_build_object(''offeredPlayerId'',offered_id);end if; select value into old from jsonb_array_elements(r.entries)');
  execute d;
 end if;
end$$;

notify pgrst,'reload schema';
commit;
