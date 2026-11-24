create or replace function public.admin_team_pool_choices()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tid uuid:=app.require_pool_admin();
begin
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'catalogTeamId',t.id,'leagueClubId',c.id,'name',coalesce(c.name,t.name),
  'league',t.league,'country',t.country,'colors',jsonb_build_array(t.color_primary,t.color_secondary),
  'crestUrl',t.crest_url,'kind',t.team_kind,'occupied',exists(select from public.presidents p where p.club_id=c.id)
 ) order by t.name,t.id),'[]')
 from public.team_catalog t left join public.clubs c on c.tournament_id=tid and c.catalog_team_id=t.id);
end $$;
