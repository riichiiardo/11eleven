-- Principal-only fallback for existing administrative checks. Named permissions
-- are granted explicitly at the operations that support delegation.
create or replace function app.is_admin(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select from public.tournament_admins a
 where a.tournament_id=tid and a.user_id=auth.uid() and a.role='principal');
$$;

create function app.has_admin_permission(tid uuid, permission text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select from public.tournament_admins a
 where a.tournament_id=tid and a.user_id=auth.uid()
 and (a.role='principal' or (a.role='coAdmin' and (permission is null or permission=any(a.permissions)))));
$$;
revoke all on function app.has_admin_permission(uuid,text) from public,anon;
grant execute on function app.has_admin_permission(uuid,text) to authenticated;

create function app.require_admin_permission(permission text) returns uuid
language plpgsql stable set search_path='' as $$
declare tid uuid:=(select active_tournament_id from public.profiles where id=auth.uid());
begin
 if not app.has_admin_permission(tid,permission) then raise exception 'Tu rol no tiene permiso para realizar esta acción.';end if;
 return tid;
end $$;
revoke all on function app.require_admin_permission(text) from public,anon,authenticated;

create function public.grant_admin_by_email(p_email text,p_role text,p_permissions text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_admin_permission(null); target uuid; selected text[];
begin
 if not app.is_admin(tid) then raise exception 'Solo el administrador principal puede asignar roles.';end if;
 perform app.lock_draft_outgoing(tid);
 if p_role is null or p_role not in ('principal','coAdmin') or p_permissions is null or
 exists(select from unnest(p_permissions) x where x is null or x not in ('configuracion','presidentes','jugadores','mercado','draft','calendario','noticias','ia','auditoria')) then
  raise exception 'Rol o permisos inválidos.';
 end if;
 select m.user_id into target from public.league_members m join auth.users u on u.id=m.user_id
 where m.tournament_id=tid and lower(trim(u.email))=lower(trim(p_email));
 if target is null then raise exception 'El correo debe pertenecer a una cuenta inscrita en este universo.';end if;
 if target=auth.uid() then raise exception 'No puedes cambiar tu propio rol.';end if;
 selected:=case when p_role='principal' then '{}'::text[] else array(select distinct x from unnest(p_permissions) x order by x) end;
 insert into public.tournament_admins(tournament_id,user_id,role,permissions) values(tid,target,p_role,selected)
 on conflict(tournament_id,user_id) do update set role=excluded.role,permissions=excluded.permissions;
 perform public.audit(tid,'admin.otorgado','tournamentAdmins','Rol '||p_role||' asignado a '||target::text||'.');
 return jsonb_build_object('granted',cardinality(selected));
end $$;
revoke all on function public.grant_admin_by_email(text,text,text[]) from public,anon;
grant execute on function public.grant_admin_by_email(text,text,text[]) to authenticated;
revoke execute on function public.grant_admin(uuid,text) from public,anon,authenticated;

create or replace function public.revoke_admin(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare tid uuid:=app.require_admin_permission(null);
begin
 if not app.is_admin(tid) then raise exception 'Solo el administrador principal puede revocar roles.';end if;
 perform app.lock_draft_outgoing(tid);
 if p_user_id=auth.uid() then raise exception 'No puedes revocar tu propio rol.';end if;
 delete from public.tournament_admins where tournament_id=tid and user_id=p_user_id;
 if found then perform public.audit(tid,'admin.revocado','tournamentAdmins','Rol retirado a '||p_user_id::text||'.');end if;
end $$;

do $$
declare entry record; definition text; updated text;
begin
 for entry in select * from (values
 ('public.tournament_state()',null),('public.admin_overview()',null),
 ('public.draft_prepare(integer,integer,boolean)','draft'),('public.draft_prepare_ordered(integer,integer,boolean,uuid[])','draft'),
 ('public.draft_set_status(text)','draft'),('public.draft_skip_turn()','draft'),('app.settle_draft_outgoing(uuid,uuid)','draft'),
 ('app.can_review_draft(uuid)','draft'),('app.sync_draft_outgoing()','draft'),
 ('public.respond_offer_execute_reserved()','mercado'),
 ('public.admin_signing_players(text)','mercado'),('public.admin_set_signing_block(uuid,boolean)','mercado'),
 ('public.admin_roster_state(uuid,text)','jugadores'),('public.admin_roster_change(uuid,uuid,uuid,text,bigint,integer)','jugadores'),
 ('public.admin_create_player(jsonb,text,uuid)','jugadores'),('public.admin_edit_player_profile(uuid,jsonb,jsonb)','jugadores'),
 ('public.admin_player_matches(text,text,integer,text)','jugadores'),('public.admin_player_profiles(text,integer,uuid,boolean)','jugadores'),
 ('public.admin_release_roster_player(uuid,uuid)','jugadores'),
 ('public.admin_team_pool_choices()','presidentes'),('public.change_president_club(uuid,uuid,uuid)','presidentes'),
 ('public.remove_president(uuid)','presidentes'),('public.grant_budget(uuid,bigint,text)','presidentes'),
 ('public.admin_competition_enrollment()','calendario'),('public.admin_save_competition_enrollment(uuid,uuid[])','calendario'),
 ('public.close_matchday()','calendario'),('public.generate_calendar()','calendario'),
 ('public.save_rule_configuration(jsonb,text)','configuracion'),('public.save_rule_changes(jsonb,text,jsonb)','configuracion'),
 ('public.set_club_budget(uuid,numeric)','configuracion'),('public.set_competition(text)','configuracion'),
 ('public.set_prizes(jsonb)','configuracion'),('public.update_rules(jsonb)','configuracion'),('public.set_tournament_status(text)','configuracion')
 ) as gates(signature,permission) loop
  if to_regprocedure(entry.signature) is null then continue;end if;
  definition:=pg_get_functiondef(to_regprocedure(entry.signature));
  updated:=regexp_replace(definition,'public[.]is_admin[(]([a-z_][a-z_.]*)[)]',
    'app.has_admin_permission(\1,'||quote_nullable(entry.permission)||')','g');
  updated:=replace(updated,'app.require_pool_admin()','app.require_admin_permission('||quote_nullable(entry.permission)||')');
  if updated=definition then raise exception 'No se reconoció el permiso de %',entry.signature;end if;
  if entry.signature='public.admin_overview()' then
   updated:=replace(updated,'from public.audit_log a where a.tournament_id = v_tid','from public.audit_log a where a.tournament_id = v_tid and app.has_admin_permission(v_tid,''auditoria'')');
  end if;
  execute updated;
 end loop;
end $$;

do $$
declare definition text; marker text:='public.is_admin((select tournament_id from public.fixtures where id = p_fixture_id))';
begin
 definition:=pg_get_functiondef('public.report_fixture(uuid,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'No se reconoció el permiso para registrar resultados.';end if;
 execute replace(definition,marker,'app.has_admin_permission((select tournament_id from public.fixtures where id = p_fixture_id),''calendario'')');
end $$;
