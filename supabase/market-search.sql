CREATE OR REPLACE FUNCTION public.market_search(p_search text, p_group text, p_scope text DEFAULT 'todos'::text, p_sort text DEFAULT 'ovr'::text, p_only_affordable boolean DEFAULT false, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_tid uuid := (select active_tournament_id from public.profiles where id = v_uid);
  v_me public.presidents%rowtype;
  v_rows jsonb; v_total bigint; v_nations jsonb;
begin
  if v_tid is null then
    return jsonb_build_object('players', '[]'::jsonb, 'total', 0, 'nationalities', '[]'::jsonb);
  end if;
  select * into v_me from public.presidents where user_id = v_uid and tournament_id = v_tid;
  with pool as (
    select pl.*, sp.president_id as owner_president_id, sp.availability, sp.id as squad_player_id, sp.sold_to_club_id, (select name from public.clubs where id=sp.sold_to_club_id) as sold_to_club_name,
           c.id as owner_club_id, c.name as owner_club_name, c.short_name as owner_short_name,
           c.color_primary, c.color_secondary, p.nickname as owner_nickname
    from public.active_catalog_players pl
    left join public.squad_players sp on sp.player_id = pl.id and sp.tournament_id = v_tid
    left join public.clubs c on c.id = sp.club_id
    left join public.presidents p on p.id = sp.president_id
    where sp.president_id is null or not exists (select 1 from public.draft_picks dp where dp.tournament_id = v_tid and dp.player_id = pl.id) or sp.availability in ('transferible','vendido')
  ),
  filtered as (
    select jsonb_build_object(
      'playerId', pool.id, 'name', pool.name, 'position', pool.position, 'group', pool."group",
      'ovr', pool.ovr, 'age', pool.age, 'value', pool.value, 'nationality', pool.nationality, 'flag', pool.flag,
      'realClub', pool.real_club, 'realLeague', pool.real_league, 'fcVersion', pool.fc_version, 'photo', pool.photo,
      'kind', case when pool.owner_president_id is null then 'libre' else 'club' end,
      'ownerClubId', pool.owner_club_id, 'ownerClubName', pool.owner_club_name, 'ownerShortName', pool.owner_short_name,
      'ownerColors', case when pool.owner_club_id is null then null else jsonb_build_array(pool.color_primary, pool.color_secondary) end,
      'ownerNickname', pool.owner_nickname, 'ownerPresidentId', pool.owner_president_id,
      'ownerIsMe', pool.owner_president_id = v_me.id,
      'availability', case when pool.availability='vendido' then 'intransferible' else coalesce(pool.availability,'libre') end, 'saleStatus',case when pool.availability='vendido' then 'vendido' else null end, 'soldToClubId',pool.sold_to_club_id,'soldToClubName',pool.sold_to_club_name,
      'offerable', (pool.owner_president_id is null or (pool.availability in ('transferible','negociacion','neutro','vendido') and pool.owner_president_id <> v_me.id)),
      'blockedReason', case when pool.owner_president_id = v_me.id then 'Es tu propio jugador'
                             when pool.availability = 'intransferible' then 'Intransferible'
                            else null end,
      'committedOfferId', null, 'withinBudget', pool.value <= v_me.budget,
      'minimumCash', pool.value
    ) as item
    from pool
    where ((p_scope = 'todos')
        or (p_scope = 'libres' and pool.owner_president_id is null)
        or (p_scope = 'clubes' and pool.owner_president_id is not null and pool.owner_president_id is distinct from v_me.id)
        or (p_scope = 'transferibles' and pool.availability = 'transferible' and pool.owner_president_id <> v_me.id) or (p_scope = 'mios' and pool.owner_president_id = v_me.id))
      and (p_group is null or p_group = 'todos' or pool."group" = p_group)
      and strpos(translate(lower(pool.name), 'áéíóúüñ', 'aeiouun'),
                 translate(lower(trim(coalesce(p_search, ''))), 'áéíóúüñ', 'aeiouun')) > 0
      and (not p_only_affordable or pool.value <= v_me.budget)
  ),
  paged as (
    select row_number() over (
      order by
        case
          when p_sort in ('value','valor','precio') then (item->>'value')::numeric
          when p_sort in ('age','edad') then (item->>'age')::numeric
          else (item->>'ovr')::numeric
        end desc,
        (item->>'name') asc
    ) as ord,
    item
    from filtered
    order by ord
    limit least(p_limit, 50) offset p_offset
  )
  select
    coalesce((select jsonb_agg(item order by ord) from paged), '[]'::jsonb),
    (select count(*) from filtered),
    coalesce((select jsonb_agg(distinct nationality order by nationality) from pool), '[]'::jsonb)
  into v_rows, v_total, v_nations;
  return jsonb_build_object('players', v_rows, 'total', v_total, 'nationalities', v_nations);
end $function$
;
revoke all on function public.market_search(text,text,text,text,boolean,integer,integer) from public, anon;
grant execute on function public.market_search(text,text,text,text,boolean,integer,integer) to authenticated;
