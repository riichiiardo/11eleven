-- 11Eleven — reinicio único de cuentas de usuario
-- EJECUCIÓN ADMINISTRATIVA: ejecutar una sola vez desde Supabase SQL Editor.
-- Este script borra únicamente identidad y perfiles; conserva torneos,
-- catálogos, clubes y demás datos operativos.
-- Requiere permisos del proyecto (service_role/SQL Editor), nunca la anon key.

begin;

-- Desvincula referencias históricas opcionales para conservar torneos y
-- configuración. Las relaciones de membresía/presidencia se eliminan por
-- CASCADE al borrar el perfil.
update public.audit_log set actor_user_id = null where actor_user_id is not null;
update public.budget_grants set granted_by = null where granted_by is not null;
update public.fixture_reports set reported_by = null where reported_by is not null;
update public.prizes set updated_by = null where updated_by is not null;
update public.tournament_rules set updated_by = null where updated_by is not null;
update public.tournaments set owner_user_id = null where owner_user_id is not null;

-- profiles.id referencia auth.users(id) ON DELETE CASCADE. Borrar Auth limpia
-- perfiles y las tablas dependientes que tengan la misma relación.
delete from auth.users;

-- Elimina residuos de perfiles si existiera alguna relación antigua sin CASCADE.
delete from public.profiles;

commit;

-- Verificación posterior esperada:
-- select count(*) as auth_users from auth.users;
-- select count(*) as profiles from public.profiles;
