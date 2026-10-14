-- A single transaction saves rules and staged club budgets. Cancel stays client-side.
create or replace function public.save_rule_changes(p_configuration jsonb,p_formation text,p_budgets jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid());
  entry record; c public.clubs%rowtype; own_budget numeric; target numeric; general_budget numeric;
begin
  if auth.uid() is null or not public.is_admin(tid) then raise exception 'Solo Administración puede editar las reglas.'; end if;
  if coalesce(jsonb_typeof(p_budgets),'')<>'object' then raise exception 'Presupuestos por equipo inválidos.'; end if;
  general_budget:=(p_configuration->>'budget')::numeric;
  if general_budget is null or general_budget not between 0 and 2000000000 then raise exception 'Presupuesto general inválido.'; end if;
  perform 1 from public.tournament_rules where tournament_id=tid for update;
  for entry in select key,value from jsonb_each(p_budgets) order by key loop
    if jsonb_typeof(entry.value) not in ('number','null') then raise exception 'Importe del equipo inválido.'; end if;
    own_budget:=case when entry.value='null'::jsonb then null else entry.value::text::numeric end;
    if own_budget is not null and (own_budget<0 or own_budget>2000000000 or own_budget<>round(own_budget,2)) then raise exception 'Introduce importes válidos en euros, con hasta dos decimales.'; end if;
    select * into c from public.clubs where id=entry.key::uuid and tournament_id=tid for update;
    if c.id is null then raise exception 'El equipo no pertenece al Universo activo.'; end if;
    target:=coalesce(own_budget,general_budget);
    perform public.adjust_club_initial_budget(c.id,target);
    update public.clubs set initial_budget=own_budget where id=c.id;
    perform public.audit(tid,'presupuesto.equipo','clubs',c.name||': presupuesto inicial '||target::text||' €.',c.id);
  end loop;
  perform public.save_rule_configuration(p_configuration,p_formation);
end $$;
revoke all on function public.save_rule_changes(jsonb,text,jsonb) from public,anon;
grant execute on function public.save_rule_changes(jsonb,text,jsonb) to authenticated;
notify pgrst,'reload schema';
