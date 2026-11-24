create or replace function app.assert_competition_lineup(tid uuid, pres uuid, slots jsonb, rule_id text)
returns void language plpgsql set search_path = public as $$
declare c jsonb; active jsonb; xi jsonb; squad jsonb; r jsonb; players jsonb; value numeric; total int; g text; own_name text; origin record;
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
    value:=public.configured_rule_metric(jsonb_build_object('metric','nationality','parameter',active->>'nationality'),xi);
    if value<(active->'nationals'->>'min')::numeric or value>(active->'nationals'->>'max')::numeric then raise exception 'R-12: el XI incumple el rango de nacionales de esta competición.'; end if;
  end if;
  for r in select item from jsonb_array_elements(coalesce(c->'customRules','[]'::jsonb)||coalesce(active->'customRules','[]'::jsonb)) as entries(item) where (item->>'enabled')::boolean loop
    players:=case when r->>'scope'='xi' then xi else squad end;
    value:=public.configured_rule_metric(r,players);
    if value<(r->>'min')::numeric or value>(r->>'max')::numeric then raise exception 'Regla % incumplida: % fuera de %–%.',r->>'title',value,r->>'min',r->>'max'; end if;
  end loop;
end $$;
revoke all on function app.assert_competition_lineup(uuid,uuid,jsonb,text) from public,anon,authenticated;


create table app.competition_lineups (
 club_id uuid references public.clubs(id) on delete cascade,
 competition_id text not null,
 formation text not null,
 slots jsonb not null,
 primary key(club_id, competition_id)
);
alter table app.competition_lineups enable row level security;
revoke all on app.competition_lineups from public, anon, authenticated;

create function app.club_formation_options(tid uuid, club uuid)
returns table(id text, name text, rule_id text)
language sql stable set search_path='' as $$
 with configured as (
   select item->>'id' id,item->>'name' name
   from public.tournament_rules r cross join lateral jsonb_array_elements(r.configuration->'competitions') item
   where r.tournament_id=tid
 ), registered as (
   select c.id::text id,c.name, coalesce(nullif(c.rule_id,''), (select x.id from configured x where x.id=c.slug or lower(x.name)=lower(c.name) order by (x.id=c.slug) desc,x.id limit 1)) rule_id,
     exists(select from app.competition_teams t where t.competition_id=c.id and t.club_id=club) enrolled,c.archived
   from app.universe_competitions c where c.tournament_id=tid
 )
 select r.id,r.name,r.rule_id from registered r where not r.archived and (r.enrolled or (r.rule_id is not null and not exists(select from app.competition_teams t where t.competition_id::text=r.id and t.club_id is not null)))
 union all
 select x.id,x.name,x.id from configured x where not exists(select from registered r where r.rule_id=x.id);
$$;
revoke all on function app.club_formation_options(uuid,uuid) from public,anon,authenticated;

create function public.formation_competitions() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'ruleId',o.rule_id,'lineup',
   case when l.club_id is not null then jsonb_build_object('formation',l.formation,'slots',l.slots) end) order by o.name,o.id),'[]'::jsonb)
 from public.profiles u join public.presidents p on p.user_id=u.id and p.tournament_id=u.active_tournament_id
 cross join lateral app.club_formation_options(p.tournament_id,p.club_id) o
 left join app.competition_lineups l on l.club_id=p.club_id and l.competition_id=o.id
 where u.id=auth.uid() and p.club_id is not null;
$$;

create function public.save_competition_lineup(p_competition text,p_formation text,p_slots jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare owner public.presidents%rowtype; rule_key text;
begin
 select p.* into owner from public.profiles u join public.presidents p on p.user_id=u.id and p.tournament_id=u.active_tournament_id where u.id=auth.uid();
 select o.rule_id into rule_key from app.club_formation_options(owner.tournament_id,owner.club_id) o where o.id=p_competition;
 if owner.club_id is null or not found then raise exception 'Esta competición no está habilitada para tu club.'; end if;
 perform app.lock_draft_outgoing(owner.tournament_id);
 if p_formation is null or btrim(p_formation)='' or jsonb_typeof(p_slots) is distinct from 'array' then raise exception 'Alineación inválida.';end if;
 if jsonb_array_length(p_slots)<>11 or (select count(distinct s->>'playerId') from jsonb_array_elements(p_slots) s)<>11
 or (select count(distinct s->>'slotId') from jsonb_array_elements(p_slots) s)<>11 then
   raise exception 'El once debe tener 11 jugadores y posiciones sin repetir.';
 end if;
 perform app.assert_competition_lineup(owner.tournament_id,owner.id,p_slots,rule_key);
 insert into app.competition_lineups values(owner.club_id,p_competition,p_formation,p_slots)
 on conflict(club_id,competition_id) do update set formation=excluded.formation,slots=excluded.slots;
 perform public.audit(owner.tournament_id,'alineacion.guardada','squads','Once de competición actualizado ('||p_competition||').',owner.club_id);
end $$;
revoke all on function public.formation_competitions(),public.save_competition_lineup(text,text,jsonb) from public,anon;
grant execute on function public.formation_competitions(),public.save_competition_lineup(text,text,jsonb) to authenticated;
