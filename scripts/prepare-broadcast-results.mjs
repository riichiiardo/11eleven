/** Generate a reviewable SQL plan. Never connects or applies changes. */
import { readFileSync } from "node:fs";
import { BROADCAST_RECORDINGS } from "../src/domain/broadcast.ts";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
if (!/^[0-9a-f-]{36}$/i.test(args.universe ?? "") || !args.file)
  throw Error("Indica --universe=<UUID> --file=<informe.json>.");
const { matches } = JSON.parse(readFileSync(args.file, "utf8"));
if (!Array.isArray(matches) || !matches.length)
  throw Error("No hay partidos para revisar.");
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
console.log("begin;");
for (const m of matches) {
  const v = BROADCAST_RECORDINGS.find((v) => v.id === m.videoId);
  if (
    !v ||
    v.competition !== m.competition ||
    v.round !== m.round ||
    !m.verified ||
    !m.home?.trim() ||
    !m.away?.trim() ||
    m.home === m.away ||
    !Number.isInteger(m.expectedVersion) ||
    m.expectedVersion < 0
  )
    throw Error("Fuente, participantes o versión inválidos.");
  const comp = `(select id from app.universe_competitions where tournament_id=${q(args.universe)}::uuid and slug=${q(m.competition)} and not archived)`;
  console.log(
    `insert into app.competition_teams(competition_id,name)values(${comp},${q(m.home)}),(${comp},${q(m.away)})on conflict(competition_id,name)do nothing;`,
  );
  const { home, away, competition, expectedVersion, ...doc } = m;
  console.log(
    `select app.store_competition_result(${comp},${q(JSON.stringify(doc))}::jsonb||jsonb_build_object('homeId',(select id from app.competition_teams where competition_id=${comp} and name=${q(home)}),'awayId',(select id from app.competition_teams where competition_id=${comp} and name=${q(away)})),${expectedVersion});`,
  );
}
console.log("commit;");
