# 11Eleven - Guía de Despliegue

## Arquitectura

11Eleven consta de dos partes:
- **Frontend**: React + Vite → GitHub Pages
- **Backend**: Convex (hosted en Convex Cloud)

## Pasos para desplegar

### 1. Configurar el repositorio en GitHub

```bash
# Crear el repositorio (una vez)
gh repo create riichiiardo/11eleven --public --source=. --push
```

### 2. Configurar Variables de Entorno

En el repositorio de GitHub, ir a **Settings → Secrets and variables → Actions**:

Agregar el secret:
- `VITE_CONVEX_URL`: Tu URL de Convex (ej: `https://your-project.convex.cloud`)

### 3. Configurar GitHub Pages

En el repositorio de GitHub:
1. Ir a **Settings → Pages**
2. Source: **GitHub Actions**
3. Branch: `main`
4. Folder: `/ (root)`

### 4. Activar el Workflow

El workflow `.github/workflows/deploy.yml` se ejecutará automáticamente en cada push a `main`.

Para ejecutar manualmente:
1. Ir a **Actions** → **Deploy to GitHub Pages**
2. Click **Run workflow**

## Variables de Entorno Requeridas

| Variable | Descripción | Dónde obtenerla |
|----------|-------------|-----------------|
| `VITE_CONVEX_URL` | URL del backend Convex | Dashboard de Convex → Settings |

## Estructura del Proyecto

```
11eleven/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions workflow
├── public/
│   ├── 404.html            # SPA redirect para GitHub Pages
│   └── logo.svg            # Favicon
├── src/                    # Código fuente
├── convex/                 # Backend Convex
├── index.html              # Entry point
└── vite.config.ts          # Configuración de Vite
```

## URLs

- **Frontend**: `https://riichiiardo.github.io/11eleven/`
- **Backend**: `https://your-project.convex.cloud`

## Notas Importantes

1. **Convex Backend**: El backend se ejecuta independientemente en Convex Cloud. No necesita deploy.
2. **Rutas**: El `404.html` maneja las rutas SPA para que funcione la navegación.
3. **Variables de Entorno**: Nunca comprometer `VITE_CONVEX_URL` en el código fuente.
4. **Auth**: La autenticación usa Convex Auth, que funciona con el backend.

## Troubleshooting

### El deploy falla
- Verificar que `VITE_CONVEX_URL` esté configurado en GitHub Secrets
- Revisar los logs en **Actions** → **Deploy to GitHub Pages**

### La app carga pero no conecta con el backend
- Verificar que la URL de Convex sea correcta
- Asegurar que las funciones de Convex estén deployadas: `bunx convex dev --once`

### Rutas no funcionan (404)
- Verificar que el `404.html` esté en `public/`
- GitHub Pages puede tardar unos minutos en propagar cambios
