# Transmisiones y archivo de competiciones

## Reproductor

El canal es [Super Nova League en YouTube](https://www.youtube.com/@SUPERNOVALEAGUEKTV).
Transmisiones (`/dashboard/transmision`) es una sección propia del menú Torneo, disponible también desde Más en móvil.
Resultados (`/dashboard/competicion`) contiene marcadores, clasificación y estadísticas, sin cargar el reproductor.
Solicita autoplay silenciado, permite activar el sonido y cerrar/reabrir el video.
Si el navegador impide el inicio automático, el aviso explica cómo reproducirlo dentro de la app.
El selector ofrece directo (cuando está disponible) y 17 grabaciones identificadas el 6 de noviembre de 2026.
La disponibilidad del directo depende del canal; no se presenta una grabación como si fuera en vivo.
No hay redirección automática ni se requieren credenciales de YouTube.
«Ver evidencia en Transmisiones» navega a la sección de video con `?video=<ID>&t=<segundos>`;
el ID y el instante se validan contra el catálogo antes de reproducir. La URL admite recarga y acceso directo.
«Volver a resultados» regresa a las tablas. Al abandonar Transmisiones, el iframe se desmonta y se detiene el video.

El contenedor exige 200 px de ancho y al menos 240 px de alto. El origen se valida antes de construir la URL.
Los videos admitidos están definidos en `src/domain/broadcast.ts`; actualizar el catálogo exige revisar los nuevos IDs.
No hay un monitor que descubra automáticamente futuras emisiones.

## Competiciones persistentes

`supabase/competitions-archive.sql` añade competiciones por Universo y temporada,
participantes, fuentes, resultados y versiones históricas en el esquema privado `app`.
Las seis competiciones iniciales son Primera, Ascenso, Liga MX, Champions, Libertadores y FA Cup.
La configuración de Reglas conserva su edición; eliminar allí una competición archiva su historial.
El cambio de temporada del archivo es explícito: no sobrescribe temporadas anteriores.

La lectura usa `public.competition_archive(p_tournament_id)`, exclusiva de miembros autenticados.
El navegador no puede ejecutar el importador `app.store_competition_result`.
Este requiere un operador de base de datos, participantes explícitos y evidencia de video/instante.
Cada partido tiene una clave estable y una versión esperada; repetir el mismo informe no duplica puntos.
Las correcciones conservan la versión anterior. La tabla se calcula a partir de resultados verificados.
Las copas muestran fases y resultados, sin inventar una clasificación de liga.

Las jornadas anteriores a J9 quedan pendientes de archivo para las ligas.
Las copas conservan su numeración propia: J5 Champions, J3 Libertadores y cuartos de FA Cup.
Un dato desconocido se guarda como null y se muestra como «Sin verificar»; una lista vacía significa cero confirmado.
La clasificación es provisional hasta completar las jornadas y los partidos faltantes.
Asistencias y tarjetas solo se registran cuando hay evidencia; la API de YouTube no proporciona esas estadísticas.
Abrir un video o ver una jugada nunca publica un resultado.
El calendario general anterior permanece separado para no mezclar ligas, copas o presupuestos.

## Instalación e importación

1. Instalar el módulo SQL después de `rules-configuration.sql`.
2. Generar el plan con `node scripts/prepare-competition-seed.mjs --universe=<UUID>` y revisar su destino antes de aplicarlo.
3. Crear participantes observados en `app.competition_teams` para cada competición; vincular `club_id` solo con identidad confirmada.
4. Enviar informes a `app.store_competition_result(comp_uuid, documento_json, versión_esperada)` desde el operador autorizado.

El documento contiene `homeId`, `awayId`, `round` o `stage`, `leg`, `homeGoals`, `awayGoals`,
`homePenalties`, `awayPenalties`, `videoId`, `evidenceSecond`, `verified`,
`goals`, `assists`, `yellowCards` y `redCards`.
Cada estadística es null o una lista de `{teamId, player, count}`; el desglose de goles completo debe coincidir con el marcador.
Los penaltis de desempate se guardan aparte del marcador del partido.

## Verificación

- `npm run check`: lint, tipos, 13 suites y compilación de producción.
- `node scripts/verify-competition-archive.mjs`: aislamiento entre Universos, permisos, versiones, duplicados, temporadas y estadísticas desconocidas.
- `npm run preview:broadcast`: vista aislada de las dos secciones, con navegación interna y sin autenticación ni conexión a Supabase.
  Por defecto usa `http://127.0.0.1:5189/broadcast-preview`; `BROADCAST_PREVIEW_PORT` permite otro puerto.
- La prueba visual del 6 de noviembre confirmó reproducción de una grabación dentro del componente.
  No certifica un directo cuando el canal está desconectado.

## Documentación oficial

- [Parámetros del reproductor](https://developers.google.com/youtube/player_parameters).
- [API del reproductor integrado](https://developers.google.com/youtube/iframe_api_reference).
