-- Universo = torneo existente. Competiciones y reglas se guardan juntas de forma atómica.
alter table public.tournament_rules add column if not exists configuration jsonb;
-- R-08 y R-09 ya no forman parte del reglamento vigente.
update public.tournament_rules set min_ovr=0,max_u21=1000;
alter table public.tournament_rules alter column min_ovr set default 0;
alter table public.tournament_rules alter column max_u21 set default 1000;

create or replace function public.assert_rule_range(r jsonb, maximum numeric)
returns void language plpgsql set search_path = public as $$
begin
  if coalesce(jsonb_typeof(r),'') <> 'object' or coalesce(jsonb_typeof(r->'enabled'),'') <> 'boolean'
     or coalesce(jsonb_typeof(r->'min'),'') <> 'number' or coalesce(jsonb_typeof(r->'max'),'') <> 'number'
     or (r->>'min')::numeric < 0 or (r->>'min')::numeric > (r->>'max')::numeric
     or trunc((r->>'min')::numeric) <> (r->>'min')::numeric or trunc((r->>'max')::numeric) <> (r->>'max')::numeric
     or (r->>'max')::numeric > maximum then
    raise exception 'Rango inválido: debe cumplir 0 ≤ mínimo ≤ máximo ≤ %.', maximum;
  end if;
end $$;
revoke all on function public.assert_rule_range(jsonb,numeric) from public,anon,authenticated;

create or replace function public.assert_custom_rules(rules jsonb)
returns void language plpgsql set search_path = public as $$
declare r jsonb;
begin
  if jsonb_typeof(rules) <> 'array' then raise exception 'Reglas personalizadas inválidas.'; end if;
  for r in select value from jsonb_array_elements(rules) loop
    if coalesce(length(trim(r->>'title')),0) not between 1 and 100
       or coalesce(r->>'scope','') not in ('squad','xi')
       or coalesce(r->>'metric','') not in ('players','underAge','nationality','position','averageOvr','totalValue')
       or coalesce(jsonb_typeof(r->'enabled'),'') <> 'boolean'
       or (r->>'min')::numeric < 0 or (r->>'max')::numeric < (r->>'min')::numeric
       or (r->>'min') is null or (r->>'max') is null then
      raise exception 'Regla personalizada inválida.';
    end if;
    if r->>'metric'='underAge' and coalesce(r->>'parameter','') !~ '^[0-9]{1,3}$' then raise exception 'La edad debe ser numérica.'; end if;
    if r->>'metric' in ('nationality','position') and trim(coalesce(r->>'parameter',''))='' then raise exception 'Falta el parámetro de la regla.'; end if;
  end loop;
end $$;
revoke all on function public.assert_custom_rules(jsonb) from public,anon,authenticated;

create or replace function public.save_rule_configuration(p_configuration jsonb, p_formation text)
returns void language plpgsql security definer set search_path = public as $$
declare tid uuid := (select active_tournament_id from public.profiles where id=auth.uid());
  c jsonb := p_configuration; comp jsonb; g text; active jsonb; base jsonb; b jsonb;
begin
  if auth.uid() is null or not public.is_admin(tid) then raise exception 'Solo Administración puede editar las reglas.'; end if;
  if jsonb_typeof(c)<>'object' or coalesce((c->>'budget')::numeric,-1) not between 0 and 2000000000
     or coalesce((c->>'squadSize')::int,0) not between 11 and 1000
     or coalesce((c->>'lineupLockHours')::int,-1) not between 0 and 72
     or jsonb_typeof(c->'competitions')<>'array' then raise exception 'Configuración inválida.'; end if;
  foreach g in array array['GK','DEF','MID','FWD'] loop perform public.assert_rule_range(c->'groups'->g,1000); end loop;
  perform public.assert_rule_range(c->'realClub',1000);
  perform public.assert_custom_rules(c->'customRules');
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(c->'competitions')) then raise exception 'Competiciones repetidas.'; end if;
  for comp in select value from jsonb_array_elements(c->'competitions') loop
    if coalesce(length(trim(comp->>'name')),0) not between 1 and 100
       or coalesce(comp->>'kind','') not in ('league','cup','league_playoffs')
       or coalesce((comp->>'rounds')::int,0) not between 1 and 10
       or coalesce((comp->>'promotions')::int,-1) not between 0 and 1000
       or coalesce((comp->>'relegations')::int,-1) not between 0 and 1000
       or coalesce((comp->>'playoffTeams')::int,-1) not between 0 and 1000 then raise exception 'Formato de competición inválido.'; end if;
    perform public.assert_rule_range(comp->'u20',11);
    perform public.assert_rule_range(comp->'nationals',11);
    if (comp->'nationals'->>'enabled')::boolean and trim(coalesce(comp->>'nationality',''))='' then raise exception 'Indica la nacionalidad de la competición.'; end if;
    perform public.assert_custom_rules(comp->'customRules');
    foreach g in array array['promotionTarget','relegationTarget'] loop
      if coalesce(comp->>g,'')<>'' and not exists (select 1 from jsonb_array_elements(c->'competitions') target where target->>'id'=comp->>g and target->>'id'<>comp->>'id' and target->>'kind'<>'cup') then raise exception 'Destino de ascenso/descenso inválido.'; end if;
    end loop;
    if comp->>'id'=c->>'activeCompetitionId' then active:=comp; end if;
  end loop;
  if coalesce(c->>'activeCompetitionId','')<>'' and active is null then raise exception 'La competición activa no existe.'; end if;
  if coalesce(p_formation,'') not in ('3-2-2-3','3-4-2-1','3-4-3','3-5-2','4-1-2-1-2','4-1-3-2','4-2-1-3','4-2-2-2','4-2-3-1','4-2-4','4-3-1-2','4-3-2-1','4-3-3','4-3-3 (2)','4-4-1-1','4-4-2','4-5-1','5-1-2-1-2','5-2-1-2','5-2-3','5-3-2','5-4-1','3-1-4-2','3-4-1-2','4-1-4-1','4-1-2-1-2 (2)','4-2-3-1 (2)','4-3-3 (3)','4-3-3 (4)','4-4-2 (2)','4-5-1 (2)') then raise exception 'Formación no admitida.'; end if;
  base:=jsonb_build_object('budget',c->'budget','squadSize',c->'squadSize','minOvr',0,'maxU21',1000,
    'lineupLockHours',c->'lineupLockHours','fc27FormationCode',p_formation,
    'maxPerRealClub',case when (c->'realClub'->>'enabled')::boolean then c->'realClub'->'max' else c->'squadSize' end,
    'u20Min',case when coalesce((active->'u20'->>'enabled')::boolean,false) then active->'u20'->'min' else '0'::jsonb end,
    'sameNationalityMin',0,'clubNationalityMin',0);
  foreach g in array array['GK','DEF','MID','FWD'] loop
    b:=c->'groups'->g;
    base:=base||jsonb_build_object(case g when 'GK' then 'gkMin' when 'DEF' then 'defMin' when 'MID' then 'midMin' else 'fwdMin' end,case when (b->>'enabled')::boolean then b->'min' else '0'::jsonb end,
      case g when 'GK' then 'gkMax' when 'DEF' then 'defMax' when 'MID' then 'midMax' else 'fwdMax' end,case when (b->>'enabled')::boolean then b->'max' else c->'squadSize' end);
  end loop;
  perform public.update_rules(base);
  update public.tournament_rules set configuration=c,budget=(c->>'budget')::numeric where tournament_id=tid;
end $$;
revoke all on function public.save_rule_configuration(jsonb,text) from public,anon;
grant execute on function public.save_rule_configuration(jsonb,text) to authenticated;

create or replace function public.configured_rule_metric(r jsonb, players jsonb)
returns numeric language sql immutable set search_path = public as $$
 select case r->>'metric'
   when 'players' then jsonb_array_length(players)
   when 'underAge' then (select count(*) from jsonb_array_elements(players) p where (p->>'age')::int<(r->>'parameter')::int)
   when 'nationality' then (select count(*) from jsonb_array_elements(players) p where translate(lower(trim(p->>'nationality')),'áéíóúüñ','aeiouun')=translate(lower(trim(r->>'parameter')),'áéíóúüñ','aeiouun'))
   when 'position' then (select count(*) from jsonb_array_elements(players) p where p->>'position'=r->>'parameter')
   when 'averageOvr' then (select coalesce(avg((p->>'ovr')::numeric),0) from jsonb_array_elements(players) p)
   when 'totalValue' then (select coalesce(sum((p->>'value')::numeric),0) from jsonb_array_elements(players) p)
 end
$$;
revoke all on function public.configured_rule_metric(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.assert_configured_lineup(tid uuid, pres uuid, slots jsonb)
returns void language plpgsql set search_path = public as $$
declare c jsonb; active jsonb; xi jsonb; squad jsonb; r jsonb; players jsonb; value numeric; total int; g text; own_name text; origin record;
begin
  select configuration into c from public.tournament_rules where tournament_id=tid;
  select count(*) into total from jsonb_array_elements(slots) s join public.squad_players sp on sp.player_id::text=s->>'playerId' and sp.president_id=pres and sp.tournament_id=tid;
  if total<>11 then raise exception 'El XI debe contener 11 jugadores de tu plantilla.'; end if;
  if c is null then return; end if;
  select item into active from jsonb_array_elements(c->'competitions') as entries(item) where item->>'id'=c->>'activeCompetitionId';
  select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into xi from public.players p join public.squad_players sp on sp.player_id=p.id where sp.president_id=pres and sp.tournament_id=tid and exists(select 1 from jsonb_array_elements(slots) s where s->>'playerId'=p.id::text);
  select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into squad from public.players p join public.squad_players sp on sp.player_id=p.id where sp.president_id=pres and sp.tournament_id=tid;
  if jsonb_array_length(squad)>(c->>'squadSize')::int then raise exception 'R-02: la plantilla supera el máximo permitido.'; end if;
  foreach g in array array['GK','DEF','MID','FWD'] loop
    r:=c->'groups'->g;
    if (r->>'enabled')::boolean then
      select count(*) into value from jsonb_array_elements(squad) as members(player) where player->>'group'=g;
      if value<(r->>'min')::numeric or value>(r->>'max')::numeric then raise exception 'Cupo % incumplido: % fuera de %–%.',g,value,r->>'min',r->>'max'; end if;
    end if;
  end loop;
  if (c->'realClub'->>'enabled')::boolean then
    select clubs.name into own_name from public.clubs clubs join public.presidents p on p.club_id=clubs.id where p.id=pres;
    for origin in select player->>'real_club' name,count(*) total from jsonb_array_elements(squad) as members(player) where player->>'real_club'<>own_name and player->>'real_club'<>'Agente libre' group by player->>'real_club' loop
      if origin.total<(c->'realClub'->>'min')::numeric or origin.total>(c->'realClub'->>'max')::numeric then raise exception 'R-07: rango del club de origen % incumplido.',origin.name; end if;
    end loop;
  end if;
  if coalesce((active->'u20'->>'enabled')::boolean,false) then
    select count(*) into value from jsonb_array_elements(xi) p where (p->>'age')::int<20;
    if value<(active->'u20'->>'min')::numeric or value>(active->'u20'->>'max')::numeric then raise exception 'R-11: el XI incumple el rango de sub-20 de esta competición.'; end if;
  end if;
  if coalesce((active->'nationals'->>'enabled')::boolean,false) then
    value:=public.configured_rule_metric(jsonb_build_object('metric','nationality','parameter',active->>'nationality'),xi);
    if value<(active->'nationals'->>'min')::numeric or value>(active->'nationals'->>'max')::numeric then raise exception 'R-12: el XI incumple el rango de nacionales de esta competición.'; end if;
  end if;
  for r in select item from jsonb_array_elements(coalesce(c->'customRules','[]'::jsonb)||coalesce(active->'customRules','[]'::jsonb)) as entries(item) where (item->>'enabled')::boolean loop
    players:=case when r->>'scope'='xi' then xi else squad end;
    value:=public.configured_rule_metric(r,players);
    if value<(r->>'min')::numeric or value>(r->>'max')::numeric then raise exception 'Regla % incumplida: % fuera de %–%.',r->>'title',value,r->>'min',r->>'max'; end if;
  end loop;
end $$;
revoke all on function public.assert_configured_lineup(uuid,uuid,jsonb) from public,anon,authenticated;

-- Integrar la configuración en las RPC existentes sin sustituir sus controles de acceso.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.update_rules(jsonb)'::regprocedure);
  definition:=replace(definition,'(p_rules->>''budget'')::bigint','(p_rules->>''budget'')::numeric');
  definition:=replace(definition,'coalesce((p_rules->>''minOvr'')::int, min_ovr)','0');
  definition:=replace(definition,'coalesce((p_rules->>''maxU21'')::int, max_u21)','1000');
  execute definition;
  definition:=pg_get_functiondef('public.rules_json(public.tournament_rules)'::regprocedure);
  if position('configuration' in definition)=0 then
    definition:=replace(definition,'''clubNationalityMin'', r.club_nationality_min','''clubNationalityMin'', r.club_nationality_min, ''configuration'', r.configuration');
    execute definition;
  end if;
  definition:=pg_get_functiondef('public.save_lineup(text,jsonb)'::regprocedure);
  if position('assert_configured_lineup' in definition)=0 then
    if position('update public.squads' in definition)=0 then raise exception 'No se encontró la integración de save_lineup.'; end if;
    definition:=replace(definition,'update public.squads','perform public.assert_configured_lineup(v_tid, v_pres, p_slots);' || chr(10) || '  update public.squads');
    execute definition;
  end if;
end $migration$;
notify pgrst,'reload schema';
