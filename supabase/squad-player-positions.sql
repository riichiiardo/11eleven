do $$
declare definition text:=pg_get_functiondef('public.squad_player_json(public.squad_players)'::regprocedure);
 marker text:='''position'', pl.position,';
begin
 if strpos(definition,marker)=0 then raise exception 'No se encontró la posición en la ficha del jugador.'; end if;
 execute replace(definition,marker,marker||
  ' ''positions'', case when jsonb_typeof(pl.source_record->''positions'')=''array'' then pl.source_record->''positions'' end,');
end $$;
