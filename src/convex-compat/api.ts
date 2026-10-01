/**
 * 11Eleven — capa de compatibilidad: `api` proxy.
 *
 * Resuelve `api.module.function` de la era Convex hacia la capa Supabase.
 * Las páginas siguen importando `api` de "@/convex/_generated/api" (alias a
 * este archivo), así que no se reescriben: el proxy traduce en runtime.
 */

type ApiRef = { __ref: string };

function makeRef(moduleName: string, fn: string): ApiRef {
  return { __ref: `${moduleName}.${fn}` };
}

function makeModule(moduleName: string): Record<string, ApiRef> {
  return new Proxy(
    {},
    {
      get: (_t, prop: string) => makeRef(moduleName, prop),
    },
  );
}

export const api = new Proxy(
  {},
  {
    get: (_t, moduleName: string) => makeModule(moduleName),
  },
);

export type { ApiRef };
