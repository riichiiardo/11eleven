-- NULL in clubs.initial_budget inherits the Universe-wide initial budget.
alter table public.clubs add column if not exists initial_budget numeric
  check (initial_budget is null or initial_budget between 0 and 2000000000);
alter table public.presidents add column if not exists initial_budget numeric;
update public.presidents p set initial_budget=coalesce(c.initial_budget,r.budget)
from public.tournament_rules r,public.clubs c
where p.tournament_id=r.tournament_id and p.club_id=c.id and p.initial_budget is null;

create or replace function public.adjust_club_initial_budget(club uuid, target numeric)
returns void language plpgsql set search_path=public as $$
declare p public.presidents%rowtype; reserved numeric; next_balance numeric;
begin
  for p in select * from public.presidents where club_id=club for update loop
    next_balance:=p.budget+target-coalesce(p.initial_budget,target);
    select coalesce(sum(cash),0) into reserved from public.offers
    where bidder_president_id=p.id and status in ('enviada','negociacion','aceptada','reservada');
    if next_balance<reserved then
      raise exception 'El presupuesto solicitado dejaría saldo insuficiente: saldo % €, compromisos % €. Cancela compromisos o aumenta el importe.',next_balance,reserved;
    end if;
    update public.presidents set budget=next_balance,initial_budget=target where id=p.id;
  end loop;
end $$;
revoke all on function public.adjust_club_initial_budget(uuid,numeric) from public,anon,authenticated;

create or replace function public.apply_general_initial_budget()
returns trigger language plpgsql security definer set search_path=public as $$
declare c public.clubs%rowtype;
begin
  if new.budget is distinct from old.budget then
    for c in select * from public.clubs where tournament_id=new.tournament_id and initial_budget is null loop
      perform public.adjust_club_initial_budget(c.id,new.budget);
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.apply_general_initial_budget() from public,anon,authenticated;
drop trigger if exists general_initial_budget_changed on public.tournament_rules;
create trigger general_initial_budget_changed after update of budget on public.tournament_rules
for each row execute function public.apply_general_initial_budget();

create or replace function public.assign_president_initial_budget()
returns trigger language plpgsql security definer set search_path=public as $$
declare amount numeric;
begin
  if new.club_id is not null and (tg_op='INSERT' or new.club_id is distinct from old.club_id) then
    select coalesce(c.initial_budget,r.budget) into amount from public.clubs c
    join public.tournament_rules r on r.tournament_id=c.tournament_id where c.id=new.club_id;
    new.initial_budget:=amount;
    new.budget:=amount;
  end if;
  return new;
end $$;
revoke all on function public.assign_president_initial_budget() from public,anon,authenticated;
drop trigger if exists president_initial_budget_assigned on public.presidents;
create trigger president_initial_budget_assigned before insert or update of club_id on public.presidents
for each row execute function public.assign_president_initial_budget();

create or replace function public.club_budgets()
returns jsonb language plpgsql security definer set search_path=public as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid());
begin
  if auth.uid() is null or not (public.is_admin(tid) or public.is_member(tid)) then raise exception 'No tienes acceso a este Universo.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,
    'override',c.initial_budget,'initial',coalesce(c.initial_budget,r.budget),
    'assigned',exists(select 1 from public.presidents p where p.club_id=c.id)) order by c.name)
    from public.clubs c join public.tournament_rules r on r.tournament_id=c.tournament_id
    where c.tournament_id=tid),'[]'::jsonb);
end $$;
revoke all on function public.club_budgets() from public,anon;
grant execute on function public.club_budgets() to authenticated;

create or replace function public.set_club_budget(p_club_id uuid,p_initial_budget numeric)
returns void language plpgsql security definer set search_path=public as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid());
  c public.clubs%rowtype; amount numeric;
begin
  if auth.uid() is null or not public.is_admin(tid) then raise exception 'Solo Administración puede editar presupuestos.'; end if;
  if p_initial_budget is not null and (p_initial_budget<0 or p_initial_budget>2000000000 or p_initial_budget<>round(p_initial_budget,2)) then raise exception 'Introduce un importe en euros válido, con hasta dos decimales.'; end if;
  select * into c from public.clubs where id=p_club_id and tournament_id=tid for update;
  if c.id is null then raise exception 'El equipo no pertenece al Universo activo.'; end if;
  select coalesce(p_initial_budget,budget) into amount from public.tournament_rules where tournament_id=tid;
  perform public.adjust_club_initial_budget(c.id,amount);
  update public.clubs set initial_budget=p_initial_budget where id=c.id;
  perform public.audit(tid,'presupuesto.equipo','clubs',c.name||': presupuesto inicial '||amount::text||' € ('||case when p_initial_budget is null then 'general' else 'individual' end||').',c.id);
end $$;
revoke all on function public.set_club_budget(uuid,numeric) from public,anon;
grant execute on function public.set_club_budget(uuid,numeric) to authenticated;

do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.tournament_state()'::regprocedure);
  definition:=replace(definition,'''initial'', v_rules.budget','''initial'', coalesce(v_me.initial_budget,v_rules.budget)');
  execute definition;
  definition:=pg_get_functiondef('public.market_overview()'::regprocedure);
  definition:=replace(definition,'''initial'', (select budget from public.tournament_rules where tournament_id = v_tid)','''initial'', coalesce(v_me.initial_budget,(select budget from public.tournament_rules where tournament_id = v_tid))');
  execute definition;
  definition:=pg_get_functiondef('public.choose_catalog_team(uuid)'::regprocedure);
  definition:=replace(definition,'v_club.id, v_rules.budget)','v_club.id, coalesce(v_club.initial_budget,v_rules.budget))');
  definition:=replace(definition,'v_rules.budget::text','coalesce(v_club.initial_budget,v_rules.budget)::text');
  execute definition;
end $migration$;
notify pgrst,'reload schema';
