-- Informational sale declaration. Never accepts an offer, moves a player or changes budgets.
-- Install after market-draft-availability.sql and draft-bids.sql.
begin;
alter table public.squad_players add column if not exists sold_offer_id uuid;
alter table public.squad_players add column if not exists sold_to_club_id uuid references public.clubs(id) on delete set null;
alter table public.squad_players add column if not exists sold_previous_availability text;
alter table public.squad_players add column if not exists sold_at timestamptz;
alter table public.squad_players drop constraint if exists squad_players_availability_check;
alter table public.squad_players add constraint squad_players_availability_check check(availability in('transferible','negociacion','neutro','intransferible','vendido'));
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.squad_players'::regclass and conname='squad_players_sold_offer_fkey') then
 alter table public.squad_players add constraint squad_players_sold_offer_fkey foreign key(sold_offer_id) references public.offers(id) on delete set null;
 end if;
end$$;

create or replace function public.squad_sale_negotiations(p_squad_player_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid; pres uuid; item public.squad_players%rowtype; result jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.';end if;
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_member(tid),false) then raise exception 'No perteneces al universo activo.';end if;
 select id into pres from public.presidents where user_id=auth.uid() and tournament_id=tid;
 select * into item from public.squad_players where id=p_squad_player_id and president_id=pres and tournament_id=tid and club_id=(select club_id from public.presidents where id=pres);
 if item.id is null then raise exception 'Solo puedes gestionar ventas de tu plantilla.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('offerId',o.id,'clubId',c.id,'clubName',c.name,'manager',p.nickname,'status',o.status,'cash',o.cash) order by o.updated_at desc,o.id),'[]'::jsonb) into result
 from public.offers o join public.clubs c on c.id=case when o.seller_president_id=pres and item.player_id=any(o.requested_player_ids) then o.bidder_club_id when o.bidder_president_id=pres and item.player_id=any(o.offered_player_ids) then o.seller_club_id end
 join public.presidents p on p.club_id=c.id and p.tournament_id=tid and p.id=case when o.seller_president_id=pres then o.bidder_president_id else o.seller_president_id end
 where o.tournament_id=tid and c.tournament_id=tid and p.id<>pres and o.status in('enviada','negociacion','aceptada','reservada');
 return result;
end$$;

create or replace function app.guard_squad_sale() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.president_id is distinct from old.president_id or new.club_id is distinct from old.club_id or (old.availability='vendido' and (new.sold_offer_id is null or new.sold_to_club_id is null))) then
  if new.availability='vendido' then new.availability:=case when new.president_id is distinct from old.president_id or new.club_id is distinct from old.club_id then 'neutro' else coalesce(old.sold_previous_availability,'neutro') end;end if;
 end if;
 if new.availability<>'vendido' then
  new.sold_offer_id:=null;new.sold_to_club_id:=null;new.sold_previous_availability:=null;new.sold_at:=null;return new;
 end if;
 if new.sold_offer_id is null or new.sold_to_club_id is null or new.sold_at is null or new.sold_previous_availability is null or new.sold_previous_availability not in('transferible','negociacion','neutro','intransferible') or not exists(
 select 1 from public.offers o join public.presidents p on p.club_id=new.sold_to_club_id and p.tournament_id=new.tournament_id
 where o.id=new.sold_offer_id and o.tournament_id=new.tournament_id and o.status in('enviada','negociacion','aceptada','reservada') and p.id<>new.president_id and (
 (o.seller_president_id=new.president_id and new.player_id=any(o.requested_player_ids) and o.bidder_club_id=new.sold_to_club_id and o.bidder_president_id=p.id)
 or (o.bidder_president_id=new.president_id and new.player_id=any(o.offered_player_ids) and o.seller_club_id=new.sold_to_club_id and o.seller_president_id=p.id))) then raise exception 'Selecciona una negociación activa y su equipo para marcar al jugador como vendido.';end if;
 return new;
end$$;
revoke all on function app.guard_squad_sale() from public,anon,authenticated;
drop trigger if exists guard_squad_sale on public.squad_players;
create trigger guard_squad_sale before insert or update of availability,president_id,club_id,sold_offer_id,sold_to_club_id,sold_previous_availability,sold_at on public.squad_players for each row execute function app.guard_squad_sale();

create or replace function public.mark_squad_player_sold(p_squad_player_id uuid,p_offer_id uuid,p_withdraw boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tid uuid; item public.squad_players%rowtype; candidate jsonb; result jsonb; pres uuid; prior text;
begin
 if auth.uid() is null or p_withdraw is null then raise exception 'Solicitud de venta no válida.';end if;
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(public.is_member(tid),false) then raise exception 'No perteneces al universo activo.';end if;
 perform app.lock_draft_outgoing(tid);
 select id into pres from public.presidents where user_id=auth.uid() and tournament_id=tid for update;
 select * into item from public.squad_players where id=p_squad_player_id and president_id=pres and tournament_id=tid;
 if item.id is null then raise exception 'Solo puedes gestionar ventas de tu plantilla.';end if;
 perform 1 from public.offers where id=p_offer_id and tournament_id=tid and ((seller_president_id=pres and item.player_id=any(requested_player_ids)) or (bidder_president_id=pres and item.player_id=any(offered_player_ids))) for update;
 select value into candidate from jsonb_array_elements(public.squad_sale_negotiations(p_squad_player_id)) where value->>'offerId'=p_offer_id::text;
 if candidate is null then raise exception 'La negociación ya no está activa o no corresponde a este jugador y equipo.';end if;
 if exists(select 1 from app.draft_outgoing where president_id=pres and player_id=item.player_id and tournament_id=tid and status='selected') then
  result:=public.change_squad_availability(p_squad_player_id,'neutro',p_withdraw);
  if coalesce((result->>'requiresWithdrawal')::boolean,false) then return result||jsonb_build_object('clubName',candidate->>'clubName');end if;
 else result:=jsonb_build_object('withdrawn',false);end if;
 prior:=case when item.availability='vendido' then item.sold_previous_availability else item.availability end;
 update public.squad_players set availability='vendido',sold_offer_id=p_offer_id,sold_to_club_id=(candidate->>'clubId')::uuid,sold_previous_availability=coalesce(prior,'neutro'),sold_at=now()
 where id=item.id and president_id=pres and tournament_id=tid;
 if not found then raise exception 'La plantilla cambió. Actualiza la página.';end if;
 perform public.audit(tid,'venta.anunciada','squad_players','Jugador marcado como vendido a '||(candidate->>'clubName')||'.',item.club_id);
 return result||jsonb_build_object('requiresWithdrawal',false,'clubName',candidate->>'clubName');
end$$;
revoke all on function public.squad_sale_negotiations(uuid),public.mark_squad_player_sold(uuid,uuid,boolean) from public,anon;
grant execute on function public.squad_sale_negotiations(uuid),public.mark_squad_player_sold(uuid,uuid,boolean) to authenticated;

create or replace function app.clear_inactive_sale_label() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status not in('enviada','negociacion','aceptada','reservada') then
 update public.squad_players set availability=coalesce(sold_previous_availability,'neutro') where sold_offer_id=new.id and availability='vendido';
 end if;
 return new;
end$$;
revoke all on function app.clear_inactive_sale_label() from public,anon,authenticated;
drop trigger if exists clear_inactive_sale_label on public.offers;
create trigger clear_inactive_sale_label after update of status on public.offers for each row when(old.status is distinct from new.status) execute function app.clear_inactive_sale_label();
create index if not exists squad_players_sold_offer on public.squad_players(sold_offer_id) where sold_offer_id is not null;

-- Preserve installed catalogue, chat and draft customizations while extending JSON views.
do $patch$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('public.squad_player_json(public.squad_players)'::regprocedure);
 if strpos(definition,'soldToClubName')=0 then
 marker:=$m$'availability', sp.availability,$m$;
 if strpos(definition,marker)=0 then raise exception 'No se encontró el campo de situación de plantilla.';end if;
 execute replace(definition,marker,marker||E'\n ''soldToClubId'', sp.sold_to_club_id, ''soldToClubName'', (select name from public.clubs where id=sp.sold_to_club_id),');
 end if;
 definition:=pg_get_functiondef('public.squad_player_json(public.squad_players)'::regprocedure);
 if strpos(definition,'saleStatus')=0 then
 execute replace(definition,$m$'availability', sp.availability,$m$,$m$'availability', case when sp.availability='vendido' then 'intransferible' else sp.availability end, 'saleStatus',case when sp.availability='vendido' then 'vendido' else null end,$m$);
 end if;
 definition:=pg_get_functiondef('public.tournament_state()'::regprocedure);
 if strpos(definition,'vendido')=0 then
 marker:=$m$union all select 'intransferible', count(*) from public.squad_players sp where sp.squad_id = v_squad.id and sp.availability = 'intransferible'$m$;
 if strpos(definition,marker)=0 then raise exception 'No se encontró el conteo de situaciones.';end if;
 execute replace(definition,marker,marker||$m$ union all select 'vendido',count(*) from public.squad_players sp where sp.squad_id=v_squad.id and sp.availability='vendido'$m$);
 end if;
 definition:=pg_get_functiondef('public.tournament_state()'::regprocedure);
 execute replace(definition,$m$sp.squad_id = v_squad.id and sp.availability = 'intransferible'$m$,$m$sp.squad_id = v_squad.id and sp.availability in ('intransferible','vendido')$m$);
 definition:=pg_get_functiondef('public.market_browse(text,text,boolean,integer,integer)'::regprocedure);
 if strpos(definition,'soldToClubName')=0 then
 marker:='sp.id as squad_player_id,';
 if strpos(definition,marker)=0 then raise exception 'No se encontró la ficha en market_browse.';end if;
 definition:=replace(definition,marker,marker||' sp.sold_to_club_id, (select name from public.clubs where id=sp.sold_to_club_id) as sold_to_club_name,');
 definition:=replace(definition,$m$'availability', coalesce(pool.availability, 'libre'),$m$,$m$'availability', coalesce(pool.availability, 'libre'), 'soldToClubId',pool.sold_to_club_id,'soldToClubName',pool.sold_to_club_name,$m$);
 definition:=replace(definition,$m$or sp.availability = 'transferible'$m$,$m$or sp.availability in ('transferible','vendido')$m$);
 definition:=replace(definition,$m$when pool.availability = 'intransferible' then 'Intransferible'$m$,$m$when pool.availability = 'vendido' then 'Vendido a '||coalesce(pool.sold_to_club_name,'otro equipo') when pool.availability = 'intransferible' then 'Intransferible'$m$);
 execute definition;
 end if;
 definition:=pg_get_functiondef('public.market_browse(text,text,boolean,integer,integer)'::regprocedure);
 if strpos(definition,'saleStatus')=0 then
 execute replace(definition,$m$'availability', coalesce(pool.availability, 'libre'),$m$,$m$'availability', case when pool.availability='vendido' then 'intransferible' else coalesce(pool.availability,'libre') end, 'saleStatus',case when pool.availability='vendido' then 'vendido' else null end,$m$);
 end if;
 definition:=pg_get_functiondef('public.create_offer(text,uuid[],uuid[],bigint,text)'::regprocedure);
 if strpos(definition,$m$sp.availability = 'vendido'$m$)=0 then
 marker:=$m$when sp.availability = 'intransferible' then$m$;
 if strpos(definition,marker)=0 then raise exception 'No se encontró la validación de mercado.';end if;
 execute replace(definition,marker,$m$when sp.availability = 'vendido' then (select name from public.players where id = sp.player_id)||' está marcado como vendido.' $m$||marker);
 end if;
end$patch$;
notify pgrst,'reload schema';
commit;
