# Contribuir a 11Eleven

## Fuente de verdad

La aplicación se implementa en TypeScript, sin emitir JavaScript dentro de
`src/`. El dominio no depende de proveedores ni de React. Supabase se aísla
en infraestructura y servicios; no se añaden aliases de backends retirados.

Usa npm y conserva `package-lock.json`. No añadas otros lockfiles ni carpetas
de versiones anteriores. Git conserva el historial del proyecto.

## Verificación y seguridad

Ejecuta `npm ci` y `npm run check`. Añade pruebas al cambiar reglas o contratos.
Las pruebas locales no deben enviar peticiones a producción ni usar secretos.
Un build correcto no prueba por sí solo autenticación ni RPCs remotas.

No publiques `.env.local`, tokens ni claves de servidor. Las variables `VITE_*`
son visibles en el navegador: nunca incluyen `service_role` ni `sb_secret_`.

Verifica cambios SQL en PostgreSQL aislado, incluyendo permisos, RLS,
pertenencia al Universo y ownership con casos negativos. Las migraciones,
sincronizaciones y publicaciones remotas son operaciones separadas y requieren
un destino explícito.
