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
    if comp ? 'extraNationals' then
      perform public.assert_rule_range(comp->'extraNationals',11);
      if (comp->'extraNationals'->>'enabled')::boolean and coalesce(comp->>'nationality','') !~ '[^,[:space:]]'
      then raise exception 'Indica al menos un país para la cuota opcional.'; end if;
    end if;
    if length(coalesce(comp->>'nationality',''))>240 then raise exception 'La lista de nacionalidades supera el máximo permitido.'; end if;
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

create or replace function app.assert_competition_lineup(tid uuid, pres uuid, slots jsonb, rule_id text)
returns void language plpgsql set search_path = public as $$
declare c jsonb; active jsonb; xi jsonb; squad jsonb; r jsonb; players jsonb; value numeric; total int; g text; own_name text; origin record; club_country text; extra jsonb;
begin
  select configuration into c from public.tournament_rules where tournament_id=tid;
  select count(*) into total from jsonb_array_elements(slots) s join public.squad_players sp on sp.player_id::text=s->>'playerId' and sp.president_id=pres and sp.tournament_id=tid;
  if total<>11 then raise exception 'El XI debe contener 11 jugadores de tu plantilla.'; end if;
  if c is null then return; end if;
  select item into active from jsonb_array_elements(c->'competitions') as entries(item) where item->>'id'=rule_id;
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
    select c.country into club_country from public.clubs c join public.presidents p on p.club_id=c.id where p.id=pres;
    if coalesce(trim(club_country),'')='' then raise exception 'R-12: configura el país del equipo.';end if;
    value:=public.configured_rule_metric(jsonb_build_object('metric','nationality','parameter',club_country),xi);
    if value<(active->'nationals'->>'min')::numeric or value>(active->'nationals'->>'max')::numeric then
      raise exception 'R-12: el XI incumple la cuota del país del club (%).',club_country;
    end if;
  end if;
  extra:=coalesce(active->'extraNationals',case when trim(coalesce(active->>'nationality',''))<>'' then active->'nationals' end);
  if coalesce((extra->>'enabled')::boolean,false) then
    select count(*) into value from jsonb_array_elements(xi) p
    where exists(select from regexp_split_to_table(active->>'nationality',',') country
      where trim(country)<>'' and public.configured_rule_metric(jsonb_build_object('metric','nationality','parameter',country),jsonb_build_array(p))=1);
    if value<(extra->>'min')::numeric or value>(extra->>'max')::numeric then
      raise exception 'El XI incumple la cuota opcional de nacionalidades de la competición.';
    end if;
  end if;
  for r in select item from jsonb_array_elements(coalesce(c->'customRules','[]'::jsonb)||coalesce(active->'customRules','[]'::jsonb)) as entries(item) where (item->>'enabled')::boolean loop
    players:=case when r->>'scope'='xi' then xi else squad end;
    value:=public.configured_rule_metric(r,players);
    if value<(r->>'min')::numeric or value>(r->>'max')::numeric then raise exception 'Regla % incumplida: % fuera de %–%.',r->>'title',value,r->>'min',r->>'max'; end if;
  end loop;
end $$;
revoke all on function app.assert_competition_lineup(uuid,uuid,jsonb,text) from public,anon,authenticated;


create or replace function public.assert_configured_lineup(tid uuid, pres uuid, slots jsonb)
returns void language sql set search_path='' as $$
 select app.assert_competition_lineup(tid,pres,slots,
   (select configuration->>'activeCompetitionId' from public.tournament_rules where tournament_id=tid));
$$;
