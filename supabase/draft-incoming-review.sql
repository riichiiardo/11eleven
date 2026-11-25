do $$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('app.draft_review_state()'::regprocedure);
 marker:='and r.status=''submitted''';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el filtro de prelistas.';end if;
 definition:=replace(definition,marker,'and jsonb_array_length(r.entries)>0');
 marker:='''president'',p.nickname,';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el encabezado de prelistas.';end if;
 execute replace(definition,marker,marker||'''club'',(select name from public.clubs where id=p.club_id),''status'',r.status,');

 definition:=pg_get_functiondef('app.review_draft_entry(uuid,uuid,integer,boolean,text)'::regprocedure);
 marker:='r.status<>''submitted''';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el control de revisión.';end if;
 definition:=replace(definition,marker,'r.status not in (''draft'',''submitted'')');
 marker:='status=case when exists';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció la transición de prelista.';end if;
 definition:=replace(definition,marker,'status=case when r.status=''draft'' then ''draft'' when exists');
 marker:='select r0.* into r';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció la lectura de prelista.';end if;
 execute replace(definition,marker,'perform app.lock_draft_outgoing(tid); '||marker);
end $$;
