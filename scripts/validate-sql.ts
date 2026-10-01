/**
 * Validador local de los scripts SQL de supabase/ contra Postgres real (PGlite).
 * Simula el entorno de Supabase: schema auth (users + uid() + role()) y rol authenticated.
 * Uso: bun scripts/validate-sql.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();

async function run(sql: string, label: string): Promise<void> {
  try {
    await db.exec(sql);
    console.log(`✅ ${label}`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const position = (cause as { position?: string | number })?.position;
    console.error(`❌ ${label}: ${message}`);
    if (position) {
      const pos = Number(position);
      const upto = sql.slice(0, pos);
      const line = upto.split("\n").length;
      const lines = sql.split("\n");
      console.error(`   → línea ${line} del script:`);
      for (let i = Math.max(0, line - 4); i < Math.min(lines.length, line + 3); i++) {
        console.error(`   ${i + 1 === line ? "→" : " "}${String(i + 1).padStart(4)} | ${lines[i]}`);
      }
    }
    process.exit(1);
  }
}

// --- Stub del entorno Supabase ---------------------------------------------
await run(`create schema if not exists auth;`, "create schema auth");
await run(
  `create table if not exists auth.users (
     id uuid primary key,
     email text,
     raw_user_meta_data jsonb not null default '{}'::jsonb,
     created_at timestamptz not null default now()
   );`,
  "create auth.users",
);
await run(
  `create or replace function auth.uid() returns uuid
   language sql stable as $$
     select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
   $$;`,
  "create auth.uid()",
);
await run(
  `create or replace function auth.role() returns text
   language sql stable as $$
     select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'anon')
   $$;`,
  "create auth.role()",
);
await run(
  `do $$ begin
     if not exists (select 1 from pg_roles where rolname = 'authenticated') then
       create role authenticated nologin;
     end if;
     if not exists (select 1 from pg_roles where rolname = 'anon') then
       create role anon nologin;
     end if;
   end $$;`,
  "roles authenticated/anon",
);

// --- Scripts reales del proyecto -------------------------------------------
await run(readFileSync("supabase/schema.sql", "utf8"), "schema.sql");
await run(readFileSync("supabase/rpc.sql", "utf8"), "rpc.sql");
await run(readFileSync("supabase/views.sql", "utf8"), "views.sql");
await run(readFileSync("supabase/seed.sql", "utf8"), "seed.sql");

// --- Smoke tests ligeros ----------------------------------------------------
const smoke = await db.query<{ ok_uid: boolean; ok_admin: boolean; ok_president: boolean }>(
  `select
     public.my_uid() is null as ok_uid,
     public.is_admin(null::uuid) = false as ok_admin,
     public.my_president_id(null::uuid) is null as ok_president;`,
);
console.log(
  "🧪 smoke helpers:",
  JSON.stringify(smoke.rows[0]),
);

console.log("🎉 Los 3 scripts ejecutan sin errores contra Postgres real.");
