do $$
declare d text; start_at int; stop_at int;
begin
 d:=pg_get_functiondef('public.market_overview()'::regprocedure);
 start_at:=strpos(d,'''received'', coalesce'); stop_at:=strpos(substr(d,start_at),'  );');
 if start_at=0 or stop_at=0 then raise exception 'Revisar market_overview'; end if;
 execute substr(d,1,start_at-1)||$q$'received', (select coalesce(jsonb_agg(public.offer_json(o) order by o.updated_at desc),'[]') from public.offers o where o.tournament_id=v_tid and o.seller_president_id=v_me.id and o.status in ('enviada','negociacion')),
 'sent', (select coalesce(jsonb_agg(public.offer_json(o) order by o.updated_at desc),'[]') from public.offers o where o.tournament_id=v_tid and o.bidder_president_id=v_me.id and o.status in ('enviada','negociacion','borrador')),
 'reserved', (select coalesce(jsonb_agg(public.offer_json(o) order by o.updated_at desc),'[]') from public.offers o where o.tournament_id=v_tid and v_me.id in(o.bidder_president_id,o.seller_president_id) and o.status in ('aceptada','reservada')),
 'history', (select coalesce(jsonb_agg(public.offer_json(o) order by o.updated_at desc),'[]') from public.offers o where o.tournament_id=v_tid and v_me.id in(o.bidder_president_id,o.seller_president_id) and o.status not in ('borrador','enviada','negociacion','aceptada','reservada'))
$q$||substr(d,start_at+stop_at-1);
end $$;

create or replace function public.prelist_pool_search(term text) returns jsonb
language sql stable security definer set search_path='' as $$
 with viewer as (select active_tournament_id tid from public.profiles where id=auth.uid()),
 matches as (
 select p.name,p.sofifa_id,p.value,p.position,p.ovr,p.nationality,'Pool' as source from public.players p,viewer v
 where public.is_member(v.tid) and p.catalog_active and p.sofifa_id is not null and length(trim(term))>=2
 and (strpos(lower(p.name),lower(trim(term)))>0 or p.sofifa_id::text=trim(term))
 and not exists(select from public.squad_players sp where sp.player_id=p.id and sp.tournament_id=v.tid)
 union all
 select s.name,s.sofifa_id,s.value_eur,s.position,s.ovr,s.nationality,'SoFIFA' from public.sofifa_players s,viewer v
 where public.is_member(v.tid) and length(trim(term))>=2 and (strpos(lower(s.name),lower(trim(term)))>0 or s.sofifa_id::text=trim(term))
 and not exists(select from public.players p where p.sofifa_id=s.sofifa_id and p.catalog_active)
 ), page as (select * from matches order by (lower(name)=lower(trim(term))) desc,source,name,sofifa_id limit 30)
 select coalesce(jsonb_agg(to_jsonb(page)),'[]') from page
$$;
revoke all on function public.prelist_pool_search(text) from public,anon;
grant execute on function public.prelist_pool_search(text) to authenticated;
