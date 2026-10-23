# Backend Supabase de 11Eleven

El cliente utiliza Supabase Auth y PostgreSQL. Los scripts de este directorio
corresponden a la versión actual; arrancar Vite no los ejecuta.

## Instalación en un entorno nuevo

Aplica los scripts en este orden, después de revisar el destino y sus permisos:

1. `schema.sql`
2. `rpc.sql`
3. `sheet-sync.sql`
4. `views.sql`
5. `rules-configuration.sql`
6. `club-budgets.sql`
7. `rule-edit-session.sql`
8. `draft-prelists.sql`
9. `draft-outgoing.sql`
10. `draft-bids.sql`
11. `chat.sql`

No hay un seed alternativo de equipos. El catálogo se carga desde la fuente
configurada por sincronización explícita. `catalog.sql` configura staging
para las herramientas de catálogo cuando se necesitan.
`reset-users.sql` es una operación destructiva administrativa: no forma parte
del arranque, instalación ni suite normal de pruebas.

## Credenciales

- Navegador: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (anon o publishable).
- Herramientas de sincronización: `SUPABASE_SERVICE_ROLE_KEY`, solo en servidor.
- No se incluyen credenciales en Git, catálogos ni componentes del frontend.

## Seguridad y validación

Las lecturas y operaciones deben respetar sesión, pertenencia al Universo y
ownership. Las funciones privilegiadas requieren comprobar autorización; una
clave pública no sustituye esos controles. Las pruebas de PostgreSQL embebido
cubren estos casos sin acceder a una base remota.

`npm test` verifica esquema, reglas, presupuestos, prelistas, bajas y pujas.
Reaplica los módulos posteriores si reemplazas funciones de un script previo.
No apliques SQL remoto como efecto secundario de una refactorización local.

# Prelistas privadas y revisión del draft

Aplicar `supabase/draft-prelists.sql` después de `schema.sql`, `sheet-sync.sql`,
`rpc.sql`, `views.sql`, `rules-configuration.sql`, `club-budgets.sql` y
`rule-edit-session.sql`, antes de publicar el frontend que las consume.
Este script es idempotente; no elimina datos ni ejecuta traspasos.

- Mi club: borrador privado, guardar, cancelar, enviar y corregir selecciones rechazadas.
- Administración → Draft: revisión individual con aprobación/rechazo y motivo;
  designación y revocación de revisores del mismo Universo.
- Los designados también ven su panel de revisión en Mi club.
- Reglas: límite de altas inicialmente 6, con plaza adicional opcional. Las bajas
  tienen un tope absoluto de 6 (o el límite configurado si es menor).
- Las respuestas se conservan por jugador; Mi club consulta cambios cada 15 segundos
  cuando no hay modificaciones sin guardar. No envía correos.
- Los jugadores nuevos son propuestas, no inserciones en el catálogo oficial.
- El enlace HTTPS a la ficha del jugador en SoFIFA es obligatorio tanto para
  jugadores de otro presidente como para jugadores nuevos; se conserva en la
  prelista y está disponible para el revisor.
- La prelista no altera las rondas, los fichajes ni las bajas ejecutadas por el motor
  de transferencias existente. Su aprobación es exclusivamente una validación previa.

Verificación local sin credenciales ni acceso a producción:
`node scripts/verify-draft-prelists.mjs`, `node scripts/verify-draft-client.mjs`.
El primero ejecuta las funciones y sus controles de autorización en PostgreSQL local
(PGlite). `node scripts/preview-draft-prelists.mjs` abre una demostración aislada con
datos ficticios en `http://127.0.0.1:5186/draft-fixture`; no valida una conexión remota.

## Bajas públicas y rescisión del draft

Aplicar **`supabase/draft-outgoing.sql` al final**, después de los scripts
anteriores. Reaplicarlo después de reemplazar funciones de `rpc.sql` o de
`draft-prelists.sql`: integra el bloqueo transaccional entre guardar bajas,
aceptar acuerdos y abrir el draft. El script es idempotente y no abre drafts ni
rescinde jugadores durante su instalación.

- Guardar prelista publica las bajas como `transferible`; Cancelar no publica
  cambios. Retirar una baja y guardar restaura la disponibilidad anterior.
- Mercado → Transferibles muestra los jugadores transferibles de otros
  presidentes del mismo Universo, incluidos los adquiridos en un draft anterior.
- La **primera apertura** procesa las bajas guardadas. Solo los acuerdos en estado
  `aceptada` o `reservada` evitan la rescisión, tanto para jugadores solicitados
  como para los ofrecidos en un trueque. Ofertas enviadas o en negociación no bastan.
- Se abona exactamente el **75 % del valor actual del catálogo al abrir el draft**,
  redondeado a céntimos. No se usa el valor inicial ni se duplica el ingreso de
  jugadores ya vendidos. No se modifica el presupuesto inicial.
- La rescisión elimina la pertenencia a la plantilla y limpia su hueco en el once;
  conserva al jugador en el catálogo como agente libre. Invalida las ofertas
  abiertas que lo incluyen. Los acuerdos firmes no se ejecutan por este proceso.
- Mi club muestra recibos privados del resultado. Se cierra la selección de bajas
  al empezar el draft; pausar, reabrir o reinstalar no vuelve a pagar.
- Para un nuevo ciclo, Administración debe cerrar el draft anterior y pulsar
  Preparar. No se permite preparar sobre un draft iniciado sin cerrarlo. Se
  conservan recibos anteriores y no se abre el nuevo draft automáticamente.
- La operación es atómica: un fallo revierte presupuesto, plantilla y apertura.
  Las tablas internas no admiten lectura/escritura directa de usuarios.

Pruebas aisladas: `node scripts/verify-draft-outgoing.mjs`. Cubren publicación,
tope de seis, acuerdos firmes en ambos lados, ofertas abiertas, valor actualizado,
traspasos previos, limpieza del once, aislamiento por Universo y propietario,
permisos, rollback y ausencia de abonos duplicados. No utilizan cuentas reales.

## Pujas y notificaciones de bajas anunciadas

Aplicar `supabase/draft-bids.sql` después de `draft-outgoing.sql`, antes del frontend.
No crea ofertas ni notificaciones ficticias durante la instalación.

- Mi club muestra estado, clubes interesados, importes y propuestas de cada baja.
  Los detalles de las ofertas son privados para el vendedor. Los compradores ven
  el número de interesados y la mayor oferta individual en efectivo para competir.
  Los paquetes y trueques se identifican como importe total, sin presentarlos
  incorrectamente como el precio de un solo jugador.
- Mercado permite pujar por bajas anunciadas incluso con la ventana de ejecución
  cerrada. Solo se registran ofertas; nunca se compra ni reserva automáticamente.
  Mejorar una puja actualiza la misma oferta y comprueba el presupuesto disponible.
- El vendedor revisa y acepta o rechaza en Negociaciones. Puede elegir una oferta
  menor: no hay adjudicación automática al mayor postor. Un acuerdo firme cierra
  las ofertas competidoras que compartan jugadores y evita dobles reservas.
- Notificaciones dentro de la app para nuevas/mejores ofertas, pujas superadas y
  respuestas del vendedor. Lectura persistente por presidente; consulta cada
  15 segundos. No son correos, notificaciones móviles ni avisos del navegador.
- No cambia la regla de rescisión: solo acuerdos aceptados o reservados protegen
  al jugador al inicio del draft, no una puja abierta.

Prueba aislada: `node scripts/verify-draft-bids.mjs`. La demostración local incluye
ofertas y avisos ficticios; `?bidder` permite revisar el formulario de puja.

## Chat interno

Aplicar `chat.sql` al final y antes de publicar el frontend que incorpora Chat.
La instalación es idempotente: no borra conversaciones ni reproduce eventos
anteriores. No modifica presupuestos, ofertas o resultados, ni crea correos.

- **Conversación casual:** sala general del Universo y mensajes privados entre
  sus presidentes. Cambiar de Universo o de usuario separa también el estado local.
- **Ofertas:** cada nueva oferta a otro presidente crea un hilo privado entre
  comprador y vendedor. Registra el jugador, efectivo total (distinguiendo
  paquetes/trueques), mensaje inicial y cambios de estado o importe. El botón
  «Conversar sobre la oferta» abre el hilo; aceptar/rechazar sigue realizándose
  exclusivamente en Negociaciones, con las reglas y controles existentes.
- **Bot 11Eleven:** buzón privado para los dos equipos de un partido. Avisa del
  encuentro de la jornada activa al programarlo/cambiarlo o al avanzar de jornada,
  sin inundar la bandeja con todo el calendario futuro. Cuando Administración registra/corrige el
  resultado y sus goleadores. Usa los datos de `fixtures` y `fixture_reports`;
  no se conecta al juego, no inventa goles y no retransmite partidos en vivo.
  No hay un envío programado adicional antes del inicio ni notificaciones push.
- Historial persistente, estado de lectura por presidente, máximo 2000 caracteres,
  reintentos idempotentes y límite de 60 mensajes por minuto/presidente. Lectura
  en páginas de 50 y consulta incremental para no perder ráfagas de mensajes.
- La conversación visible consulta cada 5 segundos; la bandeja/contador cada 15.
  Las consultas periódicas se pausan con la pestaña oculta. La bandeja muestra
  los 100 hilos más recientes; un hilo anterior sigue accesible desde su oferta
  o contacto. No se interpreta «sin coincidencias» como una pantalla en blanco.
- Tablas internas con RLS y sin permisos directos de cliente. RPCs autenticadas
  validan la presidencia y pertenencia al Universo; ser administrador no permite
  leer privados ajenos. Ningún cliente puede publicar como bot. No necesita
  claves nuevas, publicaciones Realtime ni exponer tablas internas al Data API.

Pruebas sin credenciales ni producción:
`node scripts/verify-chat.mjs` y `node scripts/verify-chat-client.mjs`.
La demostración opcional usa `npm run preview:chat` y datos ficticios aislados.
Publicación, SQL remoto y pruebas con sesiones reales son pasos separados.
