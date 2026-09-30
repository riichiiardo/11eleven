# 11Eleven — Guía de despliegue

## Arquitectura

11Eleven consta de dos partes:

- **Frontend**: React + Vite → GitHub Pages (`riichiiardo/11eleven`)
- **Backend**: Convex (hosted en Convex Cloud) — no necesita deploy desde aquí

## Cómo funciona el deploy

El workflow `.github/workflows/deploy.yml` se ejecuta en cada push a `main`:

1. Instala dependencias con Bun
2. Typecheck (`tsc -b`) — `src/convex/_generated` **está versionado** a propósito,
   así que CI no necesita credenciales de Convex
3. Build con `vite build --base=/<repo>/` — la base se deriva de
   `${{ github.event.repository.name }}` en cada run, así que el build nunca
   queda desincronizado del nombre real del repositorio
4. Publica el artifact en GitHub Pages

## URL del sitio

**https://riichiiardo.github.io/11eleven/**

El router usa `basename = import.meta.env.BASE_URL` y `public/404.html` hace el
redirect SPA de rafgraph/spa-github-pages con `pathSegmentsToKeep = 1`, así que
los deep links (`/11eleven/auth?returnTo=...`) sobreviven a un refresh.

## Configuración única en GitHub

1. **Settings → Pages → Source**: elegir **GitHub Actions**
2. *(Opcional)* **Settings → Secrets and variables → Actions**:
   - `VITE_CONVEX_URL`: URL del backend Convex
     (si no se define, el workflow usa `https://valuable-hedgehog-471.convex.cloud`,
     que es la URL pública del deployment de desarrollo)

Nada más: el resto del deploy es automático en cada push a `main`.

## Variables de Entorno

| Variable | Descripción | Dónde obtenerla |
|----------|-------------|-----------------|
| `VITE_CONVEX_URL` | URL del backend Convex | Dashboard de Convex → Settings |
| `SUPABASE_URL` | *(Convex → Settings → Environment Variables)* URL del proyecto Supabase (termina en `.supabase.co`). Alimenta la fuente **Supabase** del catálogo. | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Convex → Settings → Environment Variables)* Clave **service_role** (NO la anon). Solo la usa el backend de Convex y el script local; RLS bloquea el resto. | Supabase → Project Settings → API |
| `SOFIFA_PROXY_URL` | *(Opcional, alternativa)* Proxy HTTP(S) para llamar a la API de SoFIFA directamente desde Convex: Cloudflare le devuelve 403 a las IPs de datacenter. Formato `http://usuario:clave@host:puerto`. Con la ruta Supabase activa **no hace falta**; sin ella, sincroniza desde **EA Ratings**. | Proveedor de proxy residencial o de forwarding |

## Catálogo de jugadores: flujo Supabase (recomendado)

La ruta principal de staging usa tu suscripción de Supabase como base de datos
intermedia. Tu Mac (IP residencial, sin Cloudflare de por medio) baja el
catálogo de SoFIFA y lo sube a Postgres; Convex lee esa tabla servidor-a-
servidor y hace el upsert idempotente en la tabla `players` del juego.

```
SoFIFA ──(Mac, IP residencial)──▶ sofifa_players (Supabase)
                                        │
                 Convex action syncCatalog ──▶ players (Convex)
```

### Setup (una vez)

1. **Crear la tabla de staging**: ejecutar `supabase/catalog.sql` en
   Supabase → SQL Editor. Crea `public.sofifa_players` con PK `sofifa_id`,
   índice por OVR y RLS activada sin políticas (solo la service role key
   puede leer o escribir; la anon key queda bloqueada).
2. **Variables en Convex** (Dashboard → Settings → Environment Variables):
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
3. **Dependencias del script** (en tu Mac):
   `pip install requests supabase`.

### Cada actualización del catálogo

1. En la Mac: `python3 scripts/sync-players.py fetch` — baja
   `https://sofifa.com/api/players?r=270025&unit=EUR&offset=N` (60 filas por
   página, pausa de 1,2 s, reintentos por página) y hace upsert en
   `sofifa_players` con `on_conflict="sofifa_id"`. Sin las variables de
   entorno definidas, el script solo imprime lo que haría.
2. En la app: **Administración → Catálogo → fuente «Supabase · staging
   SoFIFA»** → Sincronizar. La action lee la tabla en bloques de 1.000 filas
   ordenadas por OVR descendente y el panel avanza el cursor solo hasta
   completar. Cada lote queda en la auditoría.

El upsert de Convex es por nombre vía índice `by_name`, así que repetir la
sincronización es seguro (idempotente): actualiza OVR/valor/edad y no toca
plantillas ni propiedad.

## Estructura del Proyecto

```
11eleven/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions workflow (Pages)
├── public/
│   ├── 404.html            # SPA redirect para GitHub Pages
│   ├── crests/             # Escudos de los 115 clubes del catálogo (256px)
│   ├── logo.svg
│   └── manifest.webmanifest
├── scripts/
│   └── sync-crests.py      # Descarga y optimiza los escudos (fuente: ESPN)
├── src/
│   └── convex/_generated/  # Typegen versionado (requerido para typecheck)
├── convex/  (src/convex/)  # Backend Convex
├── index.html              # Entry point
└── vite.config.ts          # Configuración de Vite
```

## Notas Importantes

1. **Convex Backend**: el backend corre en Convex Cloud. Deploy del backend:
   `bun convex dev --once` (o `bunx convex deploy` para producción).
2. **Rutas SPA**: `public/404.html` + el script de `index.html` manejan los
   deep links en GitHub Pages.
3. **Auth**: Convex Auth funciona con el backend; `VITE_CONVEX_URL` apunta al
   deployment correcto.
4. **Base path**: nunca hardcodear `/` en links; usar rutas relativas al router
   (`Link to="/dashboard"` se resuelve con el basename automáticamente).
5. **Escudos de clubes**: `public/crests/*.png` + el mapa `src/lib/crests.ts`.
   Fuente: API pública de ESPN (sin clave ni coste). El componente `Crest`
   muestra el PNG sobre un disco blanco con el aro en los colores del club y
   cae a las iniciales si un club no está en el mapa. Actualización:
   `python3 scripts/sync-crests.py fetch` (descarga + reduce a 256px).

## Troubleshooting

### El deploy falla en typecheck
- Verificar que `src/convex/_generated/*` exista y esté commiteado
- Regenerarlo localmente: `bun convex dev --once`

### La app carga en blanco (sin estilos ni contenido)
- Casi siempre es un base path mal inyectado: verificar el paso **Build** del
  workflow (`--base=/<repo>/` se genera de `github.event.repository.name`)
- Comprobar en DevTools → Network que los `/assets/*.js` respondan 200

### Sincronización del catálogo: «SoFIFA devolvió un bloqueo de Cloudflare (403)»
- **Causa**: SoFIFA protege su API con Cloudflare y bloquea las IPs de datacenter
  (la de Convex incluida); no es un bug de la app.
- **Solución recomendada**: Administración → Catálogo → fuente
  **Supabase · staging SoFIFA** (ver «Catálogo de jugadores: flujo Supabase»
  más arriba). El fetch de SoFIFA lo hace tu Mac; Convex solo lee tu Postgres.
- **Alternativa sin Supabase**: fuente **EA SPORTS FC 27 · ratings oficiales**
  (19.789 jugadores en lotes de 100 por página, sin proxy) o definir
  `SOFIFA_PROXY_URL` en Convex → Settings → Environment Variables (proxy
  HTTP(S), no SOCKS) para llamar a SoFIFA directamente.
- **Respaldo**: si ninguna fuente responde se aplica el snapshot local
  versionado y el torneo sigue siendo jugable.

### La fuente Supabase falla o la tabla está vacía
- «La tabla de staging en Supabase está vacía»: ejecutar
  `python3 scripts/sync-players.py fetch` en la Mac con
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` exportadas en la sesión.
- HTTP 401/403 al leer la tabla: la clave no es la **service_role**, o falta
  ejecutar `supabase/catalog.sql` en SQL Editor.
- HTTP 404: la tabla no existe en ese proyecto (URL de otro proyecto en
  `SUPABASE_URL`) o el SQL del paso 1 no se ejecutó.

### «Too many documents read in a single function execution (limit: 32000)»
- **Causa**: con el catálogo completo (~17.900 jugadores) una consulta que
  escanea la tabla `players` dos veces supera el tope de lecturas de Convex.
- **Solución aplicada**: los recuentos (agentes libres, pool del draft, total
  del catálogo) salen del contador singleton `catalogStats`, que mantienen las
  mutaciones de sincronización y siembra; `market.browse` y `draft.pool` son los
  únicos lugares que hacen un escaneo único de `players`.
- **Recuento manual**: `bun convex run footballSync:recountCatalog '{}'`
  (reconstruye el contador con una sola lectura acotada).

### La app carga pero no conecta con el backend
- Verificar el secret `VITE_CONVEX_URL` (o el fallback del workflow)
- Verificar que las funciones de Convex estén deployadas: `bun convex dev --once`

### Rutas no funcionan (404 en refresh)
- Verificar que `public/404.html` exista
- Verificar que Pages esté en modo **GitHub Actions** (Settings → Pages)
- GitHub Pages puede tardar unos minutos en propagar cambios
