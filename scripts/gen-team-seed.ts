/**
 * Genera supabase/seed.sql con los 115 clubes de CLUBS (src/convex/footballData.ts)
 * listos para ejecutar en el SQL Editor de Supabase (idempotente, ON CONFLICT).
 * Uso: bun scripts/gen-team-seed.ts
 */
import { writeFileSync } from "node:fs";
import { CLUBS } from "../src/convex/footballData";

const rows = CLUBS.map((c) => {
  const q = (s: string) => s.replace(/'/g, "''");
  return `  ('${q(c.name)}', '${q(c.league)}', '${q(c.country)}', '${q(c.colors[0])}', '${q(c.colors[1])}')`;
}).join(",\n");

const sql = `-- 11Eleven · supabase/seed.sql — catálogo de equipos FC 27 (115 clubes)
-- Generado desde src/convex/footballData.ts · idempotente.
insert into public.team_catalog (name, league, country, color_primary, color_secondary)
values
${rows}
on conflict (name) do update set
  league = excluded.league,
  country = excluded.country,
  color_primary = excluded.color_primary,
  color_secondary = excluded.color_secondary;
`;

writeFileSync("supabase/seed.sql", sql);
console.log(`✅ supabase/seed.sql generado con ${CLUBS.length} equipos.`);
