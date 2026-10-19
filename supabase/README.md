# 11Eleven — Supabase como única base de datos

Este documento reemplaza la parte de Convex de `DEPLOY.md` mientras dura la
transición. **Estado: capa Supabase construida; Convex todavía está presente
hasta completar la migración del frontend (fase 2) y su eliminación (fase 3).**

## Modelo de confianza

- **Lectura**: el navegador lee directo de Postgres con la **anon key**.
  Cada tabla tiene RLS con políticas de solo `SELECT` y cada política exige
  pertenecer a la liga (`is_member`) o ser administrador. Nada es público.
- **Escritura**: 100 % vía RPCs `security definer` (`supabase/rpc.sql`). El
  cliente no tiene INSERT/UPDATE/DELETE en ninguna tabla.
- **Auth**: `auth.users` de Supabase + trigger `handle_new_user` que crea el
  perfil automáticamente. Sustituye a Convex Auth.

## Setup (una vez)

1. **SQL Editor** de tu proyecto Supabase, en orden:
   1. `supabase/schema.sql` — tablas, RLS y trigger de perfiles.
   2. `supabase/rpc.sql` — RPCs de escritura del juego.
   3. `supabase/sheet-sync.sql` — columnas y catálogo del Sheets.
   4. `supabase/views.sql` — contratos de lectura del dashboard.
   5. `supabase/rules-configuration.sql` — reglas del Universo y competiciones.
   6. `supabase/club-budgets.sql` — presupuesto general e importes propios por equipo.
   7. `supabase/rule-edit-session.sql` — guardado conjunto y atómico de reglas y presupuestos.

Reglas abre en modo lectura. Administración utiliza «Editar reglas» y luego
«Guardar» o «Cancelar», situados al mismo nivel. Los presupuestos por equipo
son borradores hasta guardar; cancelar restaura los valores anteriores sin
enviar escrituras. Si falla cualquier validación, el guardado revierte todos
los cambios de la operación.

`save_rule_changes` es una RPC privilegiada: permite invocación a usuarios
autenticados, pero comprueba el rol de administrador del Universo activo antes
de escribir; `anon` no tiene permiso de ejecución. El aviso del asesor
`authenticated_security_definer_function_executable` es esperado para esta
interfaz y no sustituye esa comprobación de autorización.

`clubs.initial_budget = NULL` hereda el presupuesto general. Un importe propio
se aplica también a equipos sin presidente. `presidents.initial_budget` conserva
la base asignada; al editarla se ajusta el saldo por la diferencia, manteniendo
gastos y entradas anteriores. Las reducciones que no cubren compromisos abiertos
se rechazan. Solo un administrador del Universo activo puede editar importes.

El torneo existente actúa como Universo. `tournament_rules.configuration`
conserva los límites originales, interruptores, competiciones y reglas
personalizadas; las columnas numéricas mantienen los límites efectivos para
las operaciones existentes. `save_rule_configuration` permite guardar solamente
a administradores y `save_lineup` valida las reglas de la competición activa.
Los formatos de liga, copa, liguilla y los destinos de ascenso/descenso quedan
parametrizados; el generador de calendario existente no ejecuta todavía estas
fases automáticamente. 2. **Claves** (Supabase → Project Settings → API):

- `VITE_SUPABASE_URL` (pública, termina en `.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` (pública)
- `SUPABASE_SERVICE_ROLE_KEY` — solo para el script de la Mac, **nunca** en el frontend.

3. **Variables en el proyecto** (Convex ya no aporta `VITE_CONVEX_URL`):
   - En el panel de Freebuff: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Script local de la Mac** (`scripts/sync-players.py`): sin cambios, sigue
   subiendo a `sofifa_players` con la service role key.

## Fases de migración

| Fase | Contenido                                                                  | Estado       |
| ---- | -------------------------------------------------------------------------- | ------------ |
| 1    | Esquema + RLS + RPCs + cliente + auth + hooks de datos                     | ✅ hecha     |
| 2    | Reescribir el frontend (68 archivos, 111 funciones) sobre los nuevos hooks | ⏳ pendiente |
| 3    | Eliminar `src/convex/`, dependencias y referencias; actualizar docs        | ⏳ pendiente |

La fase 2 debe ir página por página (Home, Mercado, Draft, …), porque cada una
consume vistas compuestas (`AppStateView`, `MarketOverviewView`,
`AdminOverviewView`) que en Supabase se reconstruyen con vistas SQL o RPCs de
lectura (`tournament_state`, `market_overview`, `admin_overview`, …) que habrá
que crear en una fase 1.5 (SQL de vistas de lectura agregadas).

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
