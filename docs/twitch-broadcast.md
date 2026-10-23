# Transmisión de Superliga Nova

## Alcance

Reproductor del canal público https://www.twitch.tv/superliganova dentro de
Competición, disponible también cuando aún no se ha generado el calendario.

- El visitante pulsa «Ver transmisión» para cargar el reproductor. No se realiza
  ninguna conexión a Twitch desde este componente antes de esa acción.
- Sin reproducción automática; el reproductor inicia silenciado.
- `parent` utiliza el hostname real, sin puerto ni ruta de GitHub Pages.
- Twitch exige al menos 400 × 300 px. Cuando el contenedor no tiene ese ancho,
  se indica la limitación y se ofrece «Abrir en Twitch» sin desbordar la pantalla.
- El enlace externo permanece disponible ante restricciones del navegador.
- Se puede cerrar el reproductor para desmontarlo y detener su reproducción.
- No se afirma que el canal esté en directo sin comprobarlo. El propio
  reproductor muestra el estado online/offline que devuelve Twitch.
- La emisión no se asocia automáticamente con ningún partido o Universo.

No requiere nuevas dependencias, secrets ni cambios de base de datos.
No incluye OCR, extracción de goleadores, registro automático de resultados,
servidores de captura ni modificación de la clasificación del torneo.

## Verificación

- `npm run check`: lint, tipos, 12 suites de regresión y compilación de producción.
- `node scripts/verify-twitch.mjs`: URLs, hostname, canal, apertura explícita,
  ausencia de autoplay, enlace externo y disponibilidad sin calendario.
- `npm run preview:broadcast`: vista aislada del componente real en
  http://127.0.0.1:5189/broadcast-preview, sin autenticación ni conexión a Supabase.
- Comprobación manual en el navegador: apertura y carga del reproductor del
  canal. Al verificarlo, Twitch informó que el canal estaba sin conexión;
  no se certificó la reproducción de una emisión en directo.

## Referencia oficial

https://dev.twitch.tv/docs/embed/video-and-clips/
