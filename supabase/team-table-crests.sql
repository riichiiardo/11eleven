do $$
declare
 definition text:=pg_get_functiondef('public.admin_overview()'::regprocedure);
 marker text:='''catalogTeamId'', c.catalog_team_id,';
begin
 if strpos(definition,marker)=0 then raise exception 'No se encontró el catálogo en el listado administrativo.';end if;
 execute replace(definition,marker,marker||
  ' ''crestUrl'', (select t.crest_url from public.team_catalog t where t.id=c.catalog_team_id),');
end $$;
