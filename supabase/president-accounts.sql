-- Server-only Auth management. No passwords pass through these RPCs or audit records.
begin;
create or replace function public.president_account_authorize(p_actor uuid,p_tournament uuid,p_target uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p join public.tournament_admins a on a.user_id=p.id and a.tournament_id=p.active_tournament_id join public.league_members m on m.user_id=p.id and m.tournament_id=a.tournament_id where p.id=p_actor and p.active_tournament_id=p_tournament and a.role='principal') then raise exception 'Solo el administrador principal del universo activo.';end if;
 if p_target is not null then
  if p_target=p_actor or exists(select 1 from public.tournament_admins where user_id=p_target) then raise exception 'Esta opción solo permite gestionar cuentas de presidentes sin rol administrativo.';end if;
  if not exists(select 1 from public.presidents p join public.league_members m on m.user_id=p.user_id and m.tournament_id=p.tournament_id where p.user_id=p_target and p.tournament_id=p_tournament) then raise exception 'El presidente no pertenece a este universo.';end if;
 end if;
end$$;

create or replace function public.president_account_complete(p_actor uuid,p_tournament uuid,p_target uuid,p_action text,p_password_changed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor_name text; user_email text;begin
 if p_action is null or p_action not in('create','update') then raise exception 'Acción no válida.';end if;
 perform public.president_account_authorize(p_actor,p_tournament,case when p_action='update' then p_target else null end);
 select email into user_email from auth.users where id=p_target;
 if user_email is null then raise exception 'No existe la cuenta de Auth.';end if;
 if p_action='create' then
  -- Only a newly created unassigned account may be enrolled; never adopt an existing president.
  if exists(select 1 from public.presidents where user_id=p_target) or exists(select 1 from public.tournament_admins where user_id=p_target) or p_target=p_actor then raise exception 'La cuenta ya tiene una presidencia o administración.';end if;
  delete from public.league_members where user_id=p_target and tournament_id<>p_tournament;
  insert into public.league_members(tournament_id,user_id,role) values(p_tournament,p_target,'presidente') on conflict do nothing;
  update public.profiles set active_tournament_id=p_tournament,email=user_email where id=p_target;
  insert into public.presidents(tournament_id,user_id,nickname,display_name,club_id,budget)
   select p_tournament,id,coalesce(nullif(nickname,''),split_part(user_email,'@',1)),coalesce(nullif(name,''),split_part(user_email,'@',1)),null,0 from public.profiles where id=p_target;
 else update public.profiles set email=user_email where id=p_target;
 end if;
 select coalesce(nickname,name,'Administrador principal') into actor_name from public.profiles where id=p_actor;
 insert into public.audit_log(tournament_id,actor_user_id,actor_name,action,entity,detail)
 values(p_tournament,p_actor,actor_name,case when p_action='create' then 'cuenta.creada' else 'cuenta.actualizada' end,'profiles','Cuenta de presidente '||p_target::text||case when p_action='create' then ' creada sin equipo.' else ' actualizada.' end||case when p_password_changed then ' Contraseña asignada; no se registra su contenido.' else ' Contraseña conservada.' end);
end$$;
revoke all on function public.president_account_authorize(uuid,uuid,uuid),public.president_account_complete(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.president_account_authorize(uuid,uuid,uuid),public.president_account_complete(uuid,uuid,uuid,text,boolean) to service_role;

create or replace function app.sync_auth_account_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin update public.profiles set email=new.email where id=new.id;return new;end$$;
revoke all on function app.sync_auth_account_email() from public,anon,authenticated;
drop trigger if exists sync_auth_account_email on auth.users;
create trigger sync_auth_account_email after update of email on auth.users for each row when(old.email is distinct from new.email) execute function app.sync_auth_account_email();
notify pgrst,'reload schema';
commit;
