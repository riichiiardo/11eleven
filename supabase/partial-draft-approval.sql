create function public.revoke_departure_approval(p_president uuid,p_player uuid,p_revision text)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid; departure app.departure_review_rows%rowtype; message text;
begin
 select active_tournament_id into tid from public.profiles where id=auth.uid();
 if not coalesce(app.can_review_draft(tid),false) then raise exception 'Sin permiso para revisar bajas.';end if;
 perform app.lock_draft_outgoing(tid);
 select * into departure from app.departure_review_rows
 where tournament_id=tid and president_id=p_president and player_id=p_player and revision=p_revision;
 if not found then raise exception 'Esta baja cambió o ya se ejecutó.';end if;
 delete from app.departure_approvals where tournament_id=tid and president_id=p_president
 and player_id=p_player and revision=p_revision;
 if not found then return;end if;
 message:='Aprobación de baja revocada: '||departure.name||' · '||departure.club||'.';
 insert into app.transfer_notifications(tournament_id,recipient_id,offer_id,message)
 select tid,id,departure.offer_id,message from public.presidents where id in(p_president,departure.recipient);
 perform public.audit(tid,'draft.baja_aprobacion_revocada','players',message,departure.club_id);
end $$;
revoke all on function public.revoke_departure_approval(uuid,uuid,text) from public,anon;
grant execute on function public.revoke_departure_approval(uuid,uuid,text) to authenticated;

do $$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('app.settle_draft_outgoing(uuid,uuid)'::regprocedure);
 marker:='if exists(select from app.departure_review_rows r where r.tournament_id=tid and (r.approved_at is null or (r.offer_id is null and r.pending))) then raise exception ''Revisa las bajas pendientes antes de abrir el draft.'';end if;';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el requisito de apertura del draft.';end if;
 definition:=replace(definition,marker,
 $gate$if exists(select from app.departure_review_rows r where r.tournament_id=tid)
 and not exists(select 1 from app.departure_review_rows r where r.tournament_id=tid
 group by r.president_id having bool_and(r.approved_at is not null and (r.offer_id is not null or not r.pending)))
 then raise exception 'Aprueba todas las bajas y ventas de al menos un presidente antes de abrir el draft.';end if;$gate$);
 marker:='and d.status in (''selected'',''transferred'')';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el listado de bajas liquidables.';end if;
 definition:=replace(definition,marker,marker||$filter$
 and (d.status='transferred' or exists(select from app.departure_review_rows r
 where r.tournament_id=tid and r.president_id=d.president_id and r.player_id=d.player_id
 and r.approved_at is not null and (r.offer_id is not null or not r.pending)))
 $filter$);
 marker:='and r.outgoing<>''[]''::jsonb;';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció la limpieza de bajas.';end if;
 execute replace(definition,marker,$cleanup$and r.outgoing<>'[]'::jsonb
 and not exists(select from app.draft_outgoing pending where pending.president_id=p.id and pending.status='selected');$cleanup$);

 definition:=pg_get_functiondef('app.sync_draft_outgoing()'::regprocedure);
 marker:='if auth.uid() is not null and owner.user_id<>auth.uid()';
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el control de edición de bajas.';end if;
 execute replace(definition,marker,$cleanup$
 if tg_op='UPDATE' and new.outgoing='[]'::jsonb and public.is_admin(owner.tournament_id)
 and exists(select from public.drafts where tournament_id=owner.tournament_id and started_at is not null)
 and not exists(select from app.draft_outgoing where president_id=owner.id and status='selected')
 then return new;end if;
 $cleanup$||marker);
end $$;
