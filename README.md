# 11Eleven

Gestión de torneos de fútbol: clubes, plantillas, formación, mercado,
negociaciones, draft, competiciones y administración.

## Ejecutar en local

Requisitos: Node.js 24 y npm. Con nvm, ejecuta `nvm use`.

```sh
npm ci
cp .env.example .env.local
```

Completa `.env.local` con la Project URL y una clave **publishable** o **anon**
del proyecto Supabase correspondiente al entorno. La variable de la clave es
`VITE_SUPABASE_ANON_KEY` y admite ambos formatos. Nunca uses `service_role`
ni `sb_secret_`. El archivo local está excluido de Git.

```sh
npm run doctor -- --remote
npm run dev
```

Abre **http://127.0.0.1:5173**. El puerto es fijo: Vite se detiene si está
ocupado en vez de abrir silenciosamente otra instancia. `predev` valida Node
y la configuración antes de arrancar. La aplicación usa el proyecto Supabase
configurado: no crea una base de datos ni usuarios de prueba al ejecutarse.

## Estructura actual

```text
src/
  app/                     Composición, rutas y proveedores
  pages/                   Pantallas públicas y del dashboard
  components/              Componentes del producto y biblioteca de UI
  hooks/                   Casos de uso del cliente
  domain/                  Tipos y motores puros de reglas y competición
  services/backend/        Operaciones, contratos y hooks de datos
  infrastructure/supabase/ Cliente Supabase y adaptación de respuestas
  integrations/            Integraciones de herramientas de edición
  lib/                     Utilidades y validadores compartidos
scripts/                   Verificación, diagnóstico y sincronización explícita
tests/                     Pruebas de arquitectura
supabase/                  Esquema y funciones SQL de la versión actual
public/                    Recursos estáticos y escudos
docs/                      Arquitectura e integraciones
```

TypeScript es la única fuente de implementación en `src/`. No hay backend
Convex, aliases que lo suplanten, copias JavaScript del código TypeScript ni
carpetas de versiones anteriores. El historial previo permanece en Git.

## Verificar

```sh
npm run check
```

Ejecuta ESLint, TypeScript, nueve suites locales y el build de producción.
Las pruebas SQL usan PostgreSQL embebido (PGlite), sin credenciales, cuentas
reales ni conexión a producción. Las pruebas de render cubren Inicio, Mi club,
Plantilla, Formación, Reglas, Administración y las prelistas del draft.
Esto no sustituye la navegación autenticada contra el backend remoto.

- `npm run build`: genera `dist/`.
- `npm run preview`: sirve el build generado.
- `npm run preview:draft`: demostración aislada del draft con datos ficticios.
- `npm run test:structure`: comprueba límites arquitectónicos y rutas internas.

## Datos y seguridad

Supabase aporta Auth, PostgreSQL y RPCs. Las reglas de `src/domain/` no dependen
de React ni del cliente Supabase. Los contratos del cliente están en
`src/services/backend/contracts.ts`; los adaptadores normalizan las vistas
de lectura sin importar tipos generados de otro backend.

El catálogo utiliza la fuente de sincronización configurada. No existe un seed
alternativo de 115 equipos ni se importa automáticamente el Excel experimental.
La sincronización cambia datos y requiere una clave de servidor: ejecútala
solo expresamente para el entorno elegido mediante `npm run sync:sheet`.

Consulta [el backend](supabase/README.md), [la arquitectura](docs/architecture.md)
y [las normas de contribución](CONTRIBUTING.md).

## Publicación

Pages verifica el proyecto antes de compilar y necesita los secrets
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La sincronización utiliza
`SUPABASE_SERVICE_ROLE_KEY`, exclusivamente en servidor.
Los comandos de verificación y desarrollo no hacen push, despliegues ni
migraciones remotas.
