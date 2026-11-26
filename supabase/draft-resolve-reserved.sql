-- Reuse the installed settlement rules for both batch and individual execution.
do $$
declare definition text; single_definition text; marker text;
begin
 definition:=pg_get_functiondef('public.respond_offer_execute_reserved()'::regprocedure);
 marker:='where tournament_id=tid and status=''reservada'' order by agreed_at,id for update loop';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció la liquidación de acuerdos.';end if;
 single_definition:=replace(definition,'public.respond_offer_execute_reserved()','app.execute_reserved_offer(p_offer_id uuid)');
 single_definition:=replace(single_definition,marker,replace(marker,' order by',' and (p_offer_id is null or id=p_offer_id) order by'));
 marker:=' if auth.uid() is null or not coalesce(app.has_admin_permission(tid,''mercado''),false) then raise exception ''Solo Administración puede ejecutar los acuerdos.'';end if;';
 if strpos(single_definition,marker)=0 then raise exception 'No se reconoció el permiso de ejecución.';end if;
 single_definition:=replace(single_definition,marker,$access$
 if auth.uid() is null or not app.has_admin_permission(tid,case when p_offer_id is null then 'mercado' else 'draft' end) then
  raise exception 'Tu rol no puede ejecutar este acuerdo.';
 end if;$access$);
 marker:='if not coalesce((select market_open from public.tournaments where id=tid),false) then';
 if strpos(single_definition,marker)=0 then raise exception 'No se reconoció la ventana de ejecución.';end if;
 single_definition:=replace(single_definition,marker,$window$
 if p_offer_id is not null and not exists(select from public.drafts d where d.tournament_id=tid and d.status in ('en_curso','pausado')) then
  raise exception 'Abre el draft para ejecutar el acuerdo.';
 end if;
 if p_offer_id is null and not coalesce((select market_open from public.tournaments where id=tid),false) then$window$);
 marker:='exception when others then';
 single_definition:=replace(single_definition,marker,marker||' if p_offer_id is not null then raise;end if;');
 execute single_definition;
end $$;
revoke all on function app.execute_reserved_offer(uuid) from public,anon,authenticated;

create or replace function public.respond_offer_execute_reserved() returns jsonb
language sql security definer set search_path='' as $$
 select app.execute_reserved_offer(null);
$$;

create function public.draft_execute_reserved_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_offer_id is null then raise exception 'Selecciona un acuerdo reservado.';end if;
 if (app.execute_reserved_offer(p_offer_id)->>'executed')::int<>1 then
  raise exception 'El acuerdo ya no está reservado o faltan aprobaciones de sus bajas.';
 end if;
end $$;

create function public.draft_reserved_players() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid:=app.require_admin_permission('draft');
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('offerId',o.id,'playerId',p.id,'name',p.name,
 'destination',c.name,'exchange',cardinality(o.offered_player_ids)>0)
 order by p.name,o.id),'[]') from public.offers o
 cross join lateral (
  select unnest(o.requested_player_ids) player_id,o.bidder_club_id destination
  union all select unnest(o.offered_player_ids),o.seller_club_id
 ) leg join public.players p on p.id=leg.player_id join public.clubs c on c.id=leg.destination
 where o.tournament_id=tid and o.status='reservada');
end $$;
revoke all on function public.draft_execute_reserved_offer(uuid),public.draft_reserved_players() from public,anon;
grant execute on function public.draft_execute_reserved_offer(uuid),public.draft_reserved_players() to authenticated;
