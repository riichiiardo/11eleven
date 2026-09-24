# 11Eleven — Guía de despliegue

## Arquitectura

11Eleven consta de dos partes:

- **Frontend**: React + Vite → GitHub Pages (`riichiiardo/eleven11`)
- **Backend**: Convex (hosted en Convex Cloud) — no necesita deploy desde aquí

## Cómo funciona el deploy

El workflow `.github/workflows/deploy.yml` se ejecuta en cada push a `main`:

1. Instala dependencias con Bun
2. Typecheck (`tsc -b`) — `src/convex/_generated` **está versionado** a propósito,
   así que CI no necesita credenciales de Convex
3. Build con `vite build --base=/eleven11/` (la ruta base de GitHub Pages)
4. Publica el artifact en GitHub Pages

## URL del sitio

**https://riichiiardo.github.io/eleven11/**

El router usa `basename = import.meta.env.BASE_URL` y `public/404.html` hace el
redirect SPA de rafgraph/spa-github-pages con `pathSegmentsToKeep = 1`, así que
los deep links (`/eleven11/auth?returnTo=...`) sobreviven a un refresh.

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

## Estructura del Proyecto

```
eleven11/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions workflow (Pages)
├── public/
│   ├── 404.html            # SPA redirect para GitHub Pages
│   ├── logo.svg
│   └── manifest.webmanifest
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

## Troubleshooting

### El deploy falla en typecheck
- Verificar que `src/convex/_generated/*` exista y esté commiteado
- Regenerarlo localmente: `bun convex dev --once`

### La app carga pero no conecta con el backend
- Verificar el secret `VITE_CONVEX_URL` (o el fallback del workflow)
- Verificar que las funciones de Convex estén deployadas: `bun convex dev --once`

### Rutas no funcionan (404 en refresh)
- Verificar que `public/404.html` exista
- Verificar que Pages esté en modo **GitHub Actions** (Settings → Pages)
- GitHub Pages puede tardar unos minutos en propagar cambios
