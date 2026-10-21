# Arquitectura de la versión actual

React 19, TypeScript y Vite forman el cliente. Supabase es el backend utilizado
por esta versión. La reorganización no cambia de proveedor, aplica SQL remoto
ni modifica datos de usuarios.

`src/main.tsx` monta la aplicación. `src/app/App.tsx` compone rutas,
proveedores, carga diferida y límites de error. Las páginas delegan acciones
en hooks y en el servicio de backend. El dominio contiene reglas puras de
plantillas, mercado, draft y competición.

## Dependencias

- `domain/` no importa React, Supabase, infraestructura ni servicios.
- `infrastructure/supabase/` configura el cliente y adapta respuestas.
- `services/backend/` expone operaciones y hooks sobre la infraestructura.
- Páginas, componentes y hooks consumen contratos del dominio y servicios.
- `public/` contiene los recursos estáticos de la aplicación.

Las referencias de operaciones son objetos explícitos y tipados. No se crean
con un Proxy ni se resuelven con aliases hacia APIs de otro proveedor.
El registro y los contratos viven junto a la implementación del servicio.
Los tipos son contratos de compilación, no validación automática de toda
respuesta HTTP: un cambio de payload requiere revisar adaptadores y pruebas.

## SQL y catálogo

`supabase/` conserva scripts instalables de la versión actual. Su README
indica el orden. No se ejecutan al arrancar Vite. El catálogo se actualiza
mediante sincronización explícita, sin catálogos alternativos incrustados.

## Verificación y recuperación

Las pruebas de arquitectura evitan JavaScript duplicado, imports retirados,
dependencias inversas del dominio y rutas inexistentes. Las suites de render
y PostgreSQL aislado se ejecutan desde `scripts/run-tests.mjs`.

No se conservan versiones anteriores dentro del repositorio. La recuperación
se realiza mediante Git o la copia de seguridad externa de la sesión.
