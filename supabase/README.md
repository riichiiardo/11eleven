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
2. **Claves** (Supabase → Project Settings → API):
   - `VITE_SUPABASE_URL` (pública, termina en `.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` (pública)
   - `SUPABASE_SERVICE_ROLE_KEY` — solo para el script de la Mac, **nunca** en el frontend.
3. **Variables en el proyecto** (Convex ya no aporta `VITE_CONVEX_URL`):
   - En el panel de Freebuff: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Script local de la Mac** (`scripts/sync-players.py`): sin cambios, sigue
   subiendo a `sofifa_players` con la service role key.

## Fases de migración

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Esquema + RLS + RPCs + cliente + auth + hooks de datos | ✅ hecha |
| 2 | Reescribir el frontend (68 archivos, 111 funciones) sobre los nuevos hooks | ⏳ pendiente |
| 3 | Eliminar `src/convex/`, dependencias y referencias; actualizar docs | ⏳ pendiente |

La fase 2 debe ir página por página (Home, Mercado, Draft, …), porque cada una
consume vistas compuestas (`AppStateView`, `MarketOverviewView`,
`AdminOverviewView`) que en Supabase se reconstruyen con vistas SQL o RPCs de
lectura (`tournament_state`, `market_overview`, `admin_overview`, …) que habrá
que crear en una fase 1.5 (SQL de vistas de lectura agregadas).
