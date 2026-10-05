-- 11Eleven — reinicio único de cuentas de usuario
-- EJECUCIÓN ADMINISTRATIVA: ejecutar una sola vez desde Supabase SQL Editor.
-- Este script borra únicamente identidad y perfiles; conserva torneos,
-- catálogos, clubes y demás datos operativos.
-- Requiere permisos del proyecto (service_role/SQL Editor), nunca la anon key.

begin;

-- profiles.id referencia auth.users(id) ON DELETE CASCADE. Borrar Auth limpia
-- perfiles y las tablas dependientes que tengan la misma relación.
delete from auth.users;

-- Elimina residuos de perfiles si existiera alguna relación antigua sin CASCADE.
delete from public.profiles;

commit;

-- Verificación posterior esperada:
-- select count(*) as auth_users from auth.users;
-- select count(*) as profiles from public.profiles;
