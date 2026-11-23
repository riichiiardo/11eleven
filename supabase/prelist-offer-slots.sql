alter table public.offers add column if not exists prelist_cycle_id uuid;
update public.offers o set prelist_cycle_id=d.outgoing_cycle_id from public.drafts d where o.tournament_id=d.tournament_id and d.status<>'cerrado' and o.created_at>=d.created_at and o.prelist_cycle_id is null;
-- One requested player occupies one incoming slot, regardless of the number or status of offers.
create or replace function app.draft_offer_targets(tid uuid,pid uuid)
returns setof uuid language sql stable set search_path='' as $$
 select distinct unnest(o.requested_player_ids) from public.offers o
 join public.drafts d on d.tournament_id=o.tournament_id
 where o.tournament_id=tid and o.bidder_president_id=pid and o.seller_president_id is not null
 and o.prelist_cycle_id=d.outgoing_cycle_id
$$;
revoke all on function app.draft_offer_targets(uuid,uuid) from public,anon,authenticated;

create or replace function app.check_prelist_slots() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid; ids uuid[]; extra int;
begin
 select tournament_id into strict tid from public.presidents where id=new.president_id;
 select array_agg(distinct (e->>'playerId')::uuid) into ids from jsonb_array_elements(new.entries) e where e->>'kind'='owned';
 select count(*) into extra from app.draft_offer_targets(tid,new.president_id) target where not(target=any(coalesce(ids,'{}')));
 if jsonb_array_length(new.entries)+extra>6 then raise exception 'Las altas y los jugadores ofertados superan los seis cupos.'; end if;
 if new.status='submitted' then
   if exists(select from public.offers o join public.drafts d on d.tournament_id=o.tournament_id and o.prelist_cycle_id=d.outgoing_cycle_id cross join lateral unnest(o.requested_player_ids) target
      where o.bidder_president_id=new.president_id and o.seller_president_id is not null and o.status in ('enviada','negociacion','aceptada','reservada')
      and not(target=any(coalesce(ids,'{}')))) then raise exception 'Completa las altas de tus negociaciones abiertas antes de enviar.';end if;
   if jsonb_array_length(new.entries)+extra<>jsonb_array_length(new.outgoing) then raise exception 'Selecciona una baja por cada alta.';end if;
 end if;
 return new;
end $$;
create or replace trigger check_prelist_slots before insert or update of entries,status on app.draft_prelists for each row execute function app.check_prelist_slots();
revoke all on function app.check_prelist_slots() from public,anon,authenticated;
create or replace function app.check_offer_slots() returns trigger language plpgsql security definer set search_path='' as $$
declare entries jsonb; extra int;
begin
 if new.seller_president_id is null or not exists(select from public.drafts where tournament_id=new.tournament_id and status<>'cerrado') then return new; end if;
 select outgoing_cycle_id into new.prelist_cycle_id from public.drafts where tournament_id=new.tournament_id;
 perform 1 from public.presidents where id=new.bidder_president_id for update;
 select r.entries into entries from app.draft_prelists r where r.president_id=new.bidder_president_id;
 entries:=coalesce(entries,'[]');
 select count(*) into extra from (select * from app.draft_offer_targets(new.tournament_id,new.bidder_president_id) union select unnest(new.requested_player_ids)) t(id)
 where not exists(select from jsonb_array_elements(entries) e where e->>'playerId'=t.id::text);
 if jsonb_array_length(entries)+extra>6 then raise exception 'Esta oferta superaría el máximo de seis altas del draft.'; end if;
 if exists(select from app.draft_prelists r where r.president_id=new.bidder_president_id and r.status in ('submitted','reviewed')) and extra>0 then raise exception 'Antes de ofertar, incluye al jugador en la prelista revisada.';end if;
 return new;
end $$;
create or replace trigger check_offer_slots before insert on public.offers for each row execute function app.check_offer_slots();
revoke all on function app.check_offer_slots() from public,anon,authenticated;
create or replace function public.prelist_offer_players() returns jsonb language sql stable security definer set search_path='' as $$
 with me as (select p.* from public.presidents p join public.profiles f on f.id=p.user_id and f.active_tournament_id=p.tournament_id where p.user_id=auth.uid() and public.is_member(p.tournament_id)),
 latest as (select distinct on (target) target,o.* from me join public.drafts d on d.tournament_id=me.tournament_id
 join public.offers o on o.tournament_id=d.tournament_id and o.bidder_president_id=me.id and o.seller_president_id is not null
 cross join lateral unnest(o.requested_player_ids) target where o.prelist_cycle_id=d.outgoing_cycle_id
 order by target,o.created_at desc,o.id)
 select coalesce(jsonb_agg(jsonb_build_object('playerId',l.target,'clubId',l.seller_club_id,'name',p.name,'price',l.cash,'offeredPlayerId',l.offered_player_ids[1],'sofifaId',p.sofifa_id,'status',l.status) order by l.created_at),'[]')
 from latest l join public.players p on p.id=l.target
$$;
revoke all on function public.prelist_offer_players() from public,anon;
grant execute on function public.prelist_offer_players() to authenticated;
