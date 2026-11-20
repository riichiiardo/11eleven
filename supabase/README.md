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
12. `market-availability.sql`
13. `market-draft-availability.sql`
14. `squad-tactics.sql`

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

## Archivo de competiciones y transmisiones

Instalar `competitions-archive.sql` después de `rules-configuration.sql`. El módulo añade resultados privados por competición y temporada y una RPC de lectura para miembros. El plan de seis competiciones se genera con `node scripts/prepare-competition-seed.mjs --universe=<UUID>`; no se ejecuta automáticamente. Consultar [el flujo de importación y verificación](../docs/broadcast.md). No requiere nuevas claves públicas ni secrets.


### Pool actualizable por ID de SoFIFA

Aplicar `player-pool.sql` después de `csv-catalog.sql`. En Administración → Catálogo,
un administrador carga el CSV completo con ID de SoFIFA. Se valida y carga en lotes
de 500; solo se activa al completar todas las filas. Un ID de SoFIFA existente
actualiza su misma ficha interna: no modifica asignaciones, alineaciones ni precios
de adquisición. Los registros ausentes se inactivan; las fichas asignadas siguen
visibles en su equipo. Cada importación conserva una instantánea privada previa.

La primera carga vincula fichas sin ID únicamente por nombre y nacionalidad exactos
y únicos. Los homónimos no se fusionan automáticamente. Las fichas asignadas sin
coincidencia aparecen en «Conciliar un jugador de un equipo»: el administrador
selecciona y confirma la identidad. La ficha del catálogo elegida no puede tener
referencias; se conserva el ID interno de la ficha asignada y se registra la operación.
También se admite una columna opcional `ID Pool` para una vinculación explícita.

Campos requeridos: ID, Nombre y Apellido, Nacionalidad, Posiciones, Edad,
Valoración General, Potencial, Equipo y Valor. Valor admite euros, K y M;
se guarda como importe entero en euros. Todas las posiciones y los datos originales
se conservan en `source_record`. La tabla de consulta es `public.players`;
`catalog_active = true` identifica el pool vigente y `sofifa_id` su identidad externa.


### Rostros de jugadores

Aplicar `player-images.sql` después de `player-pool.sql` y desplegar
`supabase/functions/player-portraits/index.ts`, con verificación JWT activada y
`src/domain/player-image.ts` incluido como dependencia relativa.

El CSV admite la columna opcional `Imagen_URL`, con una URL directa de
`cdn.sofifa.net/players/.../.../27_120.png`. El ID de la ruta debe coincidir
con el ID de SoFIFA del registro. También se reconoce `data-src` antes de `src`
si se proporciona HTML de la primera celda. Los archivos anteriores sin foto
siguen siendo compatibles y no borran rostros almacenados.

La importación añade tareas privadas por jugador. El descargador autenticado
comprueba el permiso de administrador y procesa lotes acotados, intenta 240 px
y vuelve a 120/original cuando el origen responde 404. Un 403 o 429 detiene el
lote y conserva pendientes los trabajos restantes. No se eluden bloqueos.
Solo se aceptan PNG con límites de tamaño y dimensiones, sin redirecciones.

Las imágenes se guardan en el bucket público `player-faces`, creado por el
servicio al guardar la primera foto válida. Las escrituras usan exclusivamente
la credencial del servidor. La columna `public.players."Imagen_URL"` contiene
la URL pública en Storage; `photo` refleja este valor para mantener el contrato
del frontend. Cada archivo usa ID de SoFIFA y hash del contenido para evitar
avatares cacheados tras una actualización. La cola usa leases y no sobrescribe
con respuestas de una importación anterior.

Administración → Catálogo muestra guardadas, pendientes, en proceso y errores;
permite comprobar una foto antes de importar y reintentar descargas. Una foto
fallida conserva la anterior o muestra iniciales. El rostro mantiene su borde
circular y los overlays existentes de valoración y capitán.

Las importaciones completas guardan la cabecera del respaldo en `app.pool_import_snapshots`. Si `format = rows`, las fichas anteriores completas se conservan por separado en `app.pool_import_player_snapshots` (`job`, `player_id`, `record`); `players` en la cabecera queda vacío. Los respaldos anteriores con `format = json` mantienen sus jugadores en la cabecera. Las plantillas y sus asignaciones se conservan en `squads` y `squad_players` de la cabecera en ambos formatos. Estas tablas son privadas, sin acceso desde el cliente.

### Código táctico por equipo

Instalar `squad-tactics.sql` después de `schema.sql` y `rpc.sql`. Guarda el código de importación de FC 27 y las instrucciones en la plantilla del presidente; es independiente de `squads.formation`, del once y de las reglas generales. Las RPC comprueban propiedad y universo activo. El formulario tiene su propio botón Guardar, también disponible con un once incompleto y sin permisos de administrador. Los códigos antiguos de reglas no se copian porque representaban esquemas, no códigos de importación.

### Situación de mercado de la plantilla

Para instalaciones existentes, aplicar `market-availability.sql`; la definición canónica también está en `rpc.sql`. `set_availability` requiere el ID de `squad_players`, no el ID de `players`. Solo permite modificar una ficha propia con sesión válida, membresía vigente y universo activo coincidente. Mi Club, Plantilla y Estado de jugadores utilizan el mismo contrato; el cliente rechaza parámetros incompletos antes de enviar la consulta.

### Bajas previstas y cambios de mercado

Aplicar `market-draft-availability.sql` después de `draft-outgoing.sql` y `market-availability.sql`. La RPC `change_squad_availability` devuelve una solicitud de confirmación si el jugador es una baja seleccionada y se pretende quitar su situación de transferible. Con confirmación explícita retira esa baja, aumenta la revisión de la prelista y guarda la disponibilidad en una única transacción. Respeta el bloqueo de draft iniciado y de prelista enviada a revisión; conserva las otras selecciones, las revisiones de sus altas y las ofertas. El acceso sigue limitado al propietario y universo activo. Para verificar cancelación, confirmación y recarga en el navegador sin tocar producción: `node scripts/preview-market-draft.mjs`.
