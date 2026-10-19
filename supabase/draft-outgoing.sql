-- After draft-prelists.sql. Publishes saved outgoing selections and settles them
-- ONLY on the first opening of a draft. Installation does not open any draft.
begin;
-- New preparation after closing creates a new cycle; resuming preserves its key.
alter table public.drafts add column if not exists outgoing_cycle_id uuid not null default gen_random_uuid();
create table if not exists app.draft_outgoing (
  president_id uuid not null references public.presidents(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  previous_availability text not null,
  cycle_id uuid,
  status text not null default 'selected' check(status in ('selected','withdrawn','released','negotiated','transferred')),
  selected_at timestamptz not null default now(),
  primary key(president_id,player_id)
);
create index if not exists draft_outgoing_active on app.draft_outgoing(tournament_id,president_id) where status='selected';
create table if not exists app.draft_release_receipts (
  draft_id uuid not null references public.drafts(id) on delete cascade,
  cycle_id uuid not null,
  president_id uuid not null references public.presidents(id) on delete cascade,
  player_id uuid not null references public.players(id),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_name text not null,
  market_value numeric not null check(market_value>=0),
  compensation numeric not null check(compensation>=0),
  outcome text not null check(outcome in ('released','negotiated','transferred')),
  created_at timestamptz not null default now(),
  primary key(cycle_id,president_id,player_id)
);
create index if not exists draft_release_receipts_owner on app.draft_release_receipts(president_id,created_at desc);
alter table app.draft_outgoing enable row level security;
alter table app.draft_release_receipts enable row level security;
revoke all on app.draft_outgoing,app.draft_release_receipts from public,anon,authenticated;

create or replace function app.lock_draft_outgoing(tid uuid) returns void
language sql volatile set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(tid::text,'no-tournament'),751106));
$$;
revoke all on function app.lock_draft_outgoing(uuid) from public,anon,authenticated;

create or replace function app.outgoing_has_agreement(tid uuid,pres uuid,pid uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from public.offers o where o.tournament_id=tid and o.status in ('aceptada','reservada')
    and ((o.seller_president_id=pres and pid=any(o.requested_player_ids))
      or (o.bidder_president_id=pres and pid=any(o.offered_player_ids))));
$$;
revoke all on function app.outgoing_has_agreement(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function app.sync_draft_outgoing() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner public.presidents%rowtype; row record; chosen uuid; prior text;
begin
  if tg_op='UPDATE' and new.outgoing=old.outgoing then return new; end if;
  select * into owner from public.presidents where id=new.president_id;
  if auth.uid() is not null and owner.user_id<>auth.uid() then raise exception 'Solo puedes editar tus bajas previstas.'; end if;
  perform app.lock_draft_outgoing(owner.tournament_id);
  if jsonb_array_length(new.outgoing)>6 then raise exception 'Puedes seleccionar un máximo de 6 bajas.'; end if;
  if exists(select 1 from public.drafts where tournament_id=owner.tournament_id and started_at is not null) then
    -- Settlement clears the historical selection only after every row has a receipt.
    if new.outgoing='[]'::jsonb and not exists(select 1 from app.draft_outgoing where president_id=owner.id and status='selected') then return new; end if;
    raise exception 'El draft ya comenzó: las bajas previstas están cerradas.';
  end if;
  for row in select * from app.draft_outgoing where president_id=owner.id and status='selected' order by player_id for update loop
    if not exists(select 1 from jsonb_array_elements_text(new.outgoing) p where p::uuid=row.player_id) then
      update app.draft_outgoing set status='withdrawn' where president_id=owner.id and player_id=row.player_id;
      update public.squad_players set availability=row.previous_availability
        where tournament_id=owner.tournament_id and president_id=owner.id and player_id=row.player_id and availability='transferible';
    end if;
  end loop;
  for chosen in select value::uuid from jsonb_array_elements_text(new.outgoing) order by value loop
    select availability into prior from public.squad_players where tournament_id=owner.tournament_id and president_id=owner.id and player_id=chosen for update;
    if not found then raise exception 'Solo puedes seleccionar bajas de tu plantilla actual.'; end if;
    insert into app.draft_outgoing(president_id,player_id,tournament_id,previous_availability,cycle_id)
      values(owner.id,chosen,owner.tournament_id,prior,(select outgoing_cycle_id from public.drafts where tournament_id=owner.tournament_id))
      on conflict(president_id,player_id) do update set previous_availability=case when app.draft_outgoing.status='selected' then app.draft_outgoing.previous_availability else excluded.previous_availability end,
        status='selected',cycle_id=excluded.cycle_id,selected_at=case when app.draft_outgoing.status='selected' then app.draft_outgoing.selected_at else now() end;
    update public.squad_players set availability='transferible' where tournament_id=owner.tournament_id and president_id=owner.id and player_id=chosen;
  end loop;
  return new;
end $$;
revoke all on function app.sync_draft_outgoing() from public,anon,authenticated;
drop trigger if exists sync_draft_outgoing on app.draft_prelists;
create trigger sync_draft_outgoing after insert or update of outgoing on app.draft_prelists for each row execute function app.sync_draft_outgoing();

create or replace function app.keep_outgoing_transferible() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from app.draft_outgoing d where d.tournament_id=old.tournament_id and d.president_id=old.president_id and d.player_id=old.player_id and d.status='selected') then
    if new.president_id<>old.president_id then
      new.availability:='neutro';
      update app.draft_outgoing set status='transferred' where president_id=old.president_id and player_id=old.player_id;
    elsif new.availability<>'transferible' then
      raise exception 'Retira primero al jugador de las bajas previstas para cambiar su disponibilidad.';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.keep_outgoing_transferible() from public,anon,authenticated;
drop trigger if exists keep_outgoing_transferible on public.squad_players;
create trigger keep_outgoing_transferible before update of availability,president_id on public.squad_players for each row execute function app.keep_outgoing_transferible();

create or replace function app.settle_draft_outgoing(tid uuid,did uuid) returns void
language plpgsql security definer set search_path='' as $$
declare item record; pres uuid; price numeric; amount numeric; result text; cycle uuid;
begin
  if auth.uid() is null or not public.is_admin(tid) then raise exception 'Solo Administración puede abrir y liquidar el draft.'; end if;
  if not exists(select 1 from public.drafts where id=did and tournament_id=tid) then raise exception 'Draft no válido.'; end if;
  select outgoing_cycle_id into cycle from public.drafts where id=did;
  perform app.lock_draft_outgoing(tid);
  -- Lock the same president rows used by saving lists before touching selections.
  perform 1 from public.presidents where tournament_id=tid order by id for update;
  for item in select d.*,p.name,p.value from app.draft_outgoing d join public.players p on p.id=d.player_id
      where d.tournament_id=tid and (d.cycle_id is null or d.cycle_id=cycle) and d.status in ('selected','transferred') order by d.president_id,d.player_id for update of d loop
    if exists(select 1 from app.draft_release_receipts where cycle_id=cycle and president_id=item.president_id and player_id=item.player_id) then continue; end if;
    select president_id into pres from public.squad_players where tournament_id=tid and player_id=item.player_id for update;
    price:=greatest(item.value,0); amount:=0;
    if pres is distinct from item.president_id then result:='transferred';
    elsif app.outgoing_has_agreement(tid,item.president_id,item.player_id) then result:='negotiated';
    else result:='released'; amount:=round(price*0.75,2); end if;
    insert into app.draft_release_receipts(draft_id,cycle_id,president_id,player_id,tournament_id,player_name,market_value,compensation,outcome)
      values(did,cycle,item.president_id,item.player_id,tid,item.name,price,amount,result);
    update app.draft_outgoing set status=result,cycle_id=cycle where president_id=item.president_id and player_id=item.player_id;
    if result='released' then
      delete from public.squad_players where tournament_id=tid and player_id=item.player_id and president_id=item.president_id;
      update public.presidents set budget=budget+amount where id=item.president_id and tournament_id=tid;
      update public.squads set lineup=(select coalesce(jsonb_agg(case when slot->>'playerId'=item.player_id::text then slot||jsonb_build_object('playerId',null) else slot end order by n),'[]') from jsonb_array_elements(lineup) with ordinality slots(slot,n)),lineup_updated_at=now()
        where tournament_id=tid and president_id=item.president_id;
      update public.offers set status='invalidada',invalid_reason='El jugador fue rescindido al inicio del draft.',updated_at=now()
        where tournament_id=tid and status in ('enviada','negociacion') and (item.player_id=any(requested_player_ids) or item.player_id=any(offered_player_ids));
      perform public.audit(tid,'draft.rescision','players',item.name||': rescisión al 75 % del valor actual ('||amount::text||' €).',
        (select club_id from public.presidents where id=item.president_id));
    end if;
  end loop;
  update app.draft_prelists r set outgoing='[]',revision=revision+1,updated_at=now()
    from public.presidents p where p.id=r.president_id and p.tournament_id=tid and r.outgoing<>'[]'::jsonb;
end $$;
revoke all on function app.settle_draft_outgoing(uuid,uuid) from public,anon,authenticated;

create or replace function app.on_first_draft_open() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='en_curso' and (tg_op='INSERT' or old.started_at is null) then
    perform app.settle_draft_outgoing(new.tournament_id,new.id);
  end if;
  return new;
end $$;
revoke all on function app.on_first_draft_open() from public,anon,authenticated;
drop trigger if exists settle_outgoing_on_first_open on public.drafts;
create trigger settle_outgoing_on_first_open after insert or update of status on public.drafts for each row execute function app.on_first_draft_open();

create or replace function app.prepare_outgoing_cycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='borrador' and old.started_at is not null then
    if old.status<>'cerrado' then raise exception 'Cierra el draft actual antes de preparar el siguiente.'; end if;
    new.started_at:=null; new.closed_at:=null; new.outgoing_cycle_id:=gen_random_uuid();
    new.current_index:=0; new.round:=1; new.current_deadline:=null;
  end if;
  return new;
end $$;
revoke all on function app.prepare_outgoing_cycle() from public,anon,authenticated;
drop trigger if exists prepare_outgoing_cycle on public.drafts;
create trigger prepare_outgoing_cycle before update of status on public.drafts for each row execute function app.prepare_outgoing_cycle();

create or replace function app.draft_outgoing_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tid uuid; me uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  select active_tournament_id into tid from public.profiles where id=auth.uid();
  select id into me from public.presidents where tournament_id=tid and user_id=auth.uid();
  if me is null or not public.is_member(tid) then raise exception 'Selecciona primero tu club.'; end if;
  return jsonb_build_object('locked',exists(select 1 from public.drafts where tournament_id=tid and started_at is not null),
    'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'value',p.value,'compensation',round(p.value*0.75,2),'negotiated',app.outgoing_has_agreement(tid,me,p.id))),'[]')
      from public.squad_players sp join public.players p on p.id=sp.player_id where sp.tournament_id=tid and sp.president_id=me),
    'receipts',(select coalesce(jsonb_agg(jsonb_build_object('cycleId',r.cycle_id,'playerId',r.player_id,'name',r.player_name,'value',r.market_value,'amount',r.compensation,'outcome',r.outcome) order by r.created_at,r.player_name),'[]')
      from app.draft_release_receipts r where r.tournament_id=tid and r.president_id=me));
end $$;
revoke all on function app.draft_outgoing_state() from public,anon;
grant execute on function app.draft_outgoing_state() to authenticated;
create or replace function public.draft_outgoing_state() returns jsonb language sql security invoker set search_path='' as $$ select app.draft_outgoing_state() $$;
revoke all on function public.draft_outgoing_state() from public,anon;
grant execute on function public.draft_outgoing_state() to authenticated;

-- All game entrypoints take one per-league lock BEFORE row locks. This keeps
-- accepting a deal, saving a departure and opening the draft atomic together.
do $migration$
declare signature text; definition text; marker text:='perform app.lock_draft_outgoing((select active_tournament_id from public.profiles where id=auth.uid()));';
begin
  foreach signature in array array['app.save_draft_prelist(jsonb,jsonb,integer,boolean)',
    'public.draft_set_status(text)','public.draft_prepare(integer,integer,boolean)','public.create_offer(text,uuid[],uuid[],bigint,text)',
    'public.respond_offer(uuid,text)','public.respond_offer_execute_reserved()'] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if strpos(definition,marker)=0 then
      if strpos(definition,E'\nbegin\n')=0 then raise exception 'No se pudo integrar el bloqueo en %.',signature; end if;
      execute replace(definition,E'\nbegin\n',E'\nbegin\n  '||marker||E'\n');
    end if;
  end loop;
  definition:=pg_get_functiondef('public.market_browse(text,text,boolean,integer,integer)'::regprocedure);
  if strpos(definition,'p_scope = ''transferibles''')=0 then
    if strpos(definition,'or (p_scope = ''mios''')=0 then raise exception 'Versión de market_browse no compatible.'; end if;
    definition:=replace(definition,'or (p_scope = ''mios''','or (p_scope = ''transferibles'' and pool.availability = ''transferible'' and pool.owner_president_id <> v_me.id) or (p_scope = ''mios''');
    definition:=replace(definition,'where not exists (select 1 from public.draft_picks dp','where sp.president_id is null or not exists (select 1 from public.draft_picks dp');
    definition:=replace(definition,'and dp.player_id = pl.id)','and dp.player_id = pl.id) or sp.availability = ''transferible''');
    execute definition;
  end if;
end $migration$;

-- Publish existing SAVED lists, but never settle them during installation.
do $backfill$
begin
  if exists(select 1 from app.draft_prelists where jsonb_array_length(outgoing)>6) then raise exception 'Revisa las listas existentes: hay más de 6 bajas.'; end if;
  insert into app.draft_outgoing(president_id,player_id,tournament_id,previous_availability)
    select r.president_id,sp.player_id,sp.tournament_id,sp.availability from app.draft_prelists r
      cross join lateral jsonb_array_elements_text(r.outgoing) pid join public.squad_players sp on sp.player_id=pid::uuid and sp.president_id=r.president_id
    where not exists(select 1 from public.drafts d where d.tournament_id=sp.tournament_id and d.started_at is not null)
    on conflict do nothing;
  update public.squad_players sp set availability='transferible' from app.draft_outgoing d
    where d.status='selected' and d.tournament_id=sp.tournament_id and d.player_id=sp.player_id and d.president_id=sp.president_id;
end $backfill$;
notify pgrst,'reload schema';
commit;
