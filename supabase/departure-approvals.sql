-- Individual decisions refer to the exact selection or accepted offer shown to the reviewer.
create table app.departure_approvals (
 tournament_id uuid not null references public.tournaments on delete cascade,
 president_id uuid not null references public.presidents on delete cascade,
 player_id uuid not null references public.players,
 revision text not null, reviewer uuid not null references public.profiles,
 approved_at timestamptz not null default now(),
 primary key(tournament_id,president_id,player_id,revision)
);
alter table app.departure_approvals enable row level security;
revoke all on app.departure_approvals from public,anon,authenticated;
alter table app.transfer_notifications alter column offer_id drop not null;

create view app.departure_review_rows with(security_invoker=true) as
with legs as (
 select o.*,leg.owner,leg.player,leg.destination,leg.recipient
 from public.offers o cross join lateral (
 select o.seller_president_id owner,unnest(o.requested_player_ids) player,o.bidder_club_id destination,o.bidder_president_id recipient
 union all select o.bidder_president_id,unnest(o.offered_player_ids),o.seller_club_id,o.seller_president_id
 ) leg
 where o.seller_president_id is not null and o.status in ('enviada','negociacion','aceptada','reservada')
), selected as (
 select d.* from app.draft_outgoing d left join public.drafts f on f.tournament_id=d.tournament_id
 where d.status='selected' and (d.cycle_id is null or d.cycle_id=f.outgoing_cycle_id)
), candidates as (
 select tournament_id,president_id,player_id from selected union
 select tournament_id,owner,player from legs where status in ('aceptada','reservada')
), items as (
 select c.*,p.name,pr.club_id,pr.nickname,cl.name club,other.name destination,
 a.id offer_id,a.cash,a.recipient, a.type offer_type,
 exists(select from legs l where l.tournament_id=c.tournament_id and l.owner=c.president_id and l.player=c.player_id and l.status in ('enviada','negociacion')) pending,
 md5(concat_ws('/',pr.club_id,c.player_id,extract(epoch from s.selected_at),s.cycle_id,a.id,a.cash,a.requested_player_ids,a.offered_player_ids,extract(epoch from a.agreed_at))) revision
 from candidates c join public.players p on p.id=c.player_id join public.presidents pr on pr.id=c.president_id
 join public.clubs cl on cl.id=pr.club_id join public.squad_players sp on sp.player_id=c.player_id and sp.tournament_id=c.tournament_id and sp.president_id=pr.id and sp.club_id=cl.id
 left join selected s on s.tournament_id=c.tournament_id and s.president_id=c.president_id and s.player_id=c.player_id
 left join legs a on a.tournament_id=c.tournament_id and a.owner=c.president_id and a.player=c.player_id and a.status in ('aceptada','reservada')
 left join public.clubs other on other.id=a.destination
)
select i.*,ap.approved_at from items i left join app.departure_approvals ap using(tournament_id,president_id,player_id,revision);
revoke all on app.departure_review_rows from public,anon,authenticated;

create function public.review_departures() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tid uuid;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(app.can_review_draft(tid),false) then raise exception 'Sin permiso para revisar el draft.';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('club',c.name,'id',c.id,'manager',p.nickname,'players',coalesce((
 select jsonb_agg(jsonb_build_object('playerId',r.player_id,'name',r.name,'presidentId',r.president_id,'revision',r.revision,'destination',r.destination,'cash',r.cash,'offerType',r.offer_type,'pending',r.pending,'approved',r.approved_at is not null) order by r.name,r.player_id)
 from app.departure_review_rows r where r.tournament_id=tid and r.club_id=c.id),'[]')) order by c.name),'[]') from public.clubs c left join public.presidents p on p.club_id=c.id where c.tournament_id=tid);
end $$;
create function public.approve_departure(p_president uuid,p_player uuid,p_revision text) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; r app.departure_review_rows%rowtype; msg text;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(app.can_review_draft(tid),false) then raise exception 'Sin permiso para aprobar bajas.';end if;
 perform app.lock_draft_outgoing(tid);
 select * into r from app.departure_review_rows where tournament_id=tid and president_id=p_president and player_id=p_player;
 if not found or r.revision is distinct from p_revision then raise exception 'La baja cambió. Actualiza la revisión.';end if;
 if r.offer_id is null and r.pending then raise exception 'La negociación requiere la aceptación del propietario.';end if;
 insert into app.departure_approvals(tournament_id,president_id,player_id,revision,reviewer) values(tid,p_president,p_player,r.revision,auth.uid()) on conflict do nothing;
 if not found then return;end if;
 msg:='Baja aprobada: '||r.name||' · '||r.club||coalesce(' → '||r.destination,' · rescisión prevista')||'.';
 insert into app.transfer_notifications(tournament_id,recipient_id,offer_id,message)
 select tid,id,r.offer_id,msg from public.presidents where id in(p_president,r.recipient);
 perform public.audit(tid,'draft.baja_aprobada','players',msg,r.club_id);
end $$;
revoke all on function public.review_departures(),public.approve_departure(uuid,uuid,text) from public,anon;
grant execute on function public.review_departures(),public.approve_departure(uuid,uuid,text) to authenticated;

do $$declare d text; m text;
begin
 d:=pg_get_functiondef('app.transfer_notifications_state()'::regprocedure);
 execute replace(d,'nt join public.offers','nt left join public.offers');
 d:=pg_get_functiondef('app.settle_draft_outgoing(uuid,uuid)'::regprocedure);
 m:='perform app.lock_draft_outgoing(tid);';
 if strpos(d,m)=0 then raise exception 'Revisar liquidación del draft';end if;
 execute replace(d,m,m||' if exists(select from app.departure_review_rows r where r.tournament_id=tid and (r.approved_at is null or (r.offer_id is null and r.pending))) then raise exception ''Revisa las bajas pendientes antes de abrir el draft.'';end if;');
 d:=pg_get_functiondef('public.respond_offer_execute_reserved()'::regprocedure);
 m:='order by agreed_at,id for update loop';
 if strpos(d,m)=0 then raise exception 'Revisar ejecución de acuerdos';end if;
 execute replace(d,m,m||' if o.seller_president_id is not null and (select count(*) from app.departure_review_rows r where r.offer_id=o.id and r.approved_at is not null) <> cardinality(o.requested_player_ids)+cardinality(o.offered_player_ids) then continue;end if;');
end $$;
