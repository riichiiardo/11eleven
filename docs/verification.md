# Verificación local — 21 de octubre de 2026

- [CODE] Instalación desde `package-lock.json` con Node.js 24 y `npm ci`.
- [CODE] `npm run check` comprueba lint, TypeScript, pruebas y compilación de producción.
- [CODE] ESLint: cero errores y 17 advertencias de Fast Refresh; no se deshabilitaron las reglas para ocultarlas.
- [CODE] Las pruebas cubren arquitectura, caché reactiva, render con datos controlados, reglas, administración, draft y SQL en PGlite aislado.
- [CODE] La caché prueba suscriptores múltiples, deduplicación, errores, resultados nulos e invalidación de respuestas antiguas.
- [CODE] Se comprobó en navegador la portada y el formulario de acceso, sin enviar credenciales.
- [CONFIG] El usuario eligió continuar sin prueba autenticada. No se certifican recorridos completos de módulos con una sesión real ni todos los contratos de integración remotos.
- [CODE] `npm run doctor -- --remote` consulta únicamente la salud de Supabase Auth con una clave pública; no crea usuarios ni modifica el torneo.
- [CONFIG] Las credenciales públicas locales residen en `.env.local`, excluido de Git. Ninguna clave administrativa debe utilizarse en Vite.
- [CONFIG] Esta reorganización no incluye push, despliegue ni cambios en la base de datos de producción.

## Alcance pendiente de integración

- [CODE] La lectura de informes de partidos (`adminOps.fixtureReport`) todavía no tiene un resolvedor remoto equivalente.
- [CODE] Las consultas `market.validateOffer` y `market.guidance` conservan su comportamiento previo sin resultado.
- [INFERENCE] La validación del diálogo de selección del draft requiere una prueba autenticada de su contrato remoto antes de certificar ese flujo completo.

[DOC] Para repetir la verificación: `npm ci`, `npm run check`, `npm run doctor -- --remote` y `npm run dev`.
