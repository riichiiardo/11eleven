# Transmisión de Superliga Nova

## Alcance

Reproductor del canal público https://www.twitch.tv/superliganova dentro de
Competición, disponible también cuando aún no se ha generado el calendario.

- El reproductor se carga automáticamente al entrar en Competición, después
  de conocer el dominio y medir un contenedor de tamaño suficiente. Esto
  conecta con Twitch sin requerir un clic previo.
- Solicita reproducción automática silenciada con `autoplay=true`, `muted=true`
  y permiso `autoplay` en el iframe. El visitante activa el sonido en sus controles.
- No redirige automáticamente a Twitch. Si se bloquea el autoplay, el visitante
  puede pulsar Reproducir dentro del video. En móviles Twitch puede exigir
  interacción; no se garantiza autoplay para todos los navegadores/dispositivos.
- Un aviso de ayuda visible junto al reproductor explica cómo pulsar Reproducir
  dentro del video y activar el sonido. Se redacta de forma condicional; no
  afirma haber detectado un bloqueo dentro del iframe de Twitch.
- `parent` utiliza el hostname real, sin puerto ni ruta de GitHub Pages.
- Twitch exige al menos 400 × 300 px. Cuando el contenedor no tiene ese ancho,
  se sugiere girar el dispositivo o ampliar la ventana para verlo dentro de la app.
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
- `node scripts/verify-twitch.mjs`: URLs, hostname, canal, autoplay silenciado,
  permiso del iframe, ausencia de redirección, enlace externo y disponibilidad sin calendario.
- `npm run preview:broadcast`: vista aislada del componente real en
  http://127.0.0.1:5189/broadcast-preview, sin autenticación ni conexión a Supabase.
- Comprobación manual en el navegador: apertura y carga del reproductor del
  canal. Al verificarlo, Twitch informó que el canal estaba sin conexión;
  no se certificó la reproducción de una emisión en directo.

## Referencia oficial

https://dev.twitch.tv/docs/embed/video-and-clips/
