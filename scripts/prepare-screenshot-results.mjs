/** Prepare a transaction only. Requires an explicit Universe and verifies each source file. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isCompetitionEvidencePath } from "../src/lib/competition-evidence.ts";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    args.universe ?? "",
  ) ||
  !args.file
)
  throw Error("Indica --universe=<UUID> --file=<informe.json>.");
const source = JSON.parse(readFileSync(args.file, "utf8"));
if (
  !/^[a-z0-9-]{1,60}$/.test(source.competition) ||
  !String(source.season).trim() ||
  !Number.isInteger(source.round) ||
  source.round < 1 ||
  !source.stage?.trim() ||
  !source.title?.trim() ||
  !/^[a-z0-9-]{1,100}$/.test(source.sourceKey) ||
  !Array.isArray(source.images) ||
  source.images.length < 1 ||
  source.images.length > 10 ||
  !Array.isArray(source.matches) ||
  !source.matches.length
)
  throw Error("Fuente de capturas inválida.");
for (const image of source.images) {
  if (!isCompetitionEvidencePath(image.path) || !image.sha256)
    throw Error("Ruta o huella de evidencia inválida.");
  const digest = createHash("sha256")
    .update(readFileSync("public/" + image.path))
    .digest("hex");
  if (digest !== image.sha256)
    throw Error("La evidencia cambió: " + image.path);
}
const clubs = new Set();
for (const m of source.matches) {
  if (
    !m.home?.trim() ||
    !m.away?.trim() ||
    m.home === m.away ||
    clubs.has(m.home) ||
    clubs.has(m.away) ||
    !m.verified ||
    !Number.isInteger(m.homeGoals) ||
    !Number.isInteger(m.awayGoals) ||
    m.homeGoals < 0 ||
    m.awayGoals < 0 ||
    !Number.isInteger(m.sourceImage) ||
    m.sourceImage < 1 ||
    m.sourceImage > source.images.length ||
    !Number.isInteger(m.expectedVersion) ||
    m.expectedVersion < 0
  )
    throw Error("Participantes, marcador o captura inválidos.");
  clubs.add(m.home);
  clubs.add(m.away);
}
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'",
  sql = ["begin;"],
  tid = q(args.universe) + "::uuid";
const comp = `(select id from app.universe_competitions where tournament_id=${tid} and slug=${q(source.competition)} and current_season=${q(source.season)} and not archived)`;
const paths = `array[${source.images.map((i) => q(i.path)).join(",")}]::text[]`;
const evidence = `(select id from app.competition_evidence where competition_id=${comp} and season=${q(source.season)} and source_key=${q(source.sourceKey)})`;
sql.push(
  `do $$begin if ${comp} is null then raise exception 'La competición activa o su temporada no coinciden.';end if;end $$;`,
);
for (const club of clubs) {
  sql.push(
    `do $$begin if(select count(*)from public.clubs where tournament_id=${tid} and name=${q(club)})<>1 then raise exception 'El club no tiene una identidad única en este Universo.';end if;end $$;`,
  );
  sql.push(
    `insert into app.competition_teams(competition_id,name,club_id)select ${comp},name,id from public.clubs where tournament_id=${tid} and name=${q(club)} on conflict(competition_id,name)do nothing;`,
  );
  sql.push(
    `do $$begin if not exists(select 1 from app.competition_teams t join public.clubs c on c.id=t.club_id where t.competition_id=${comp} and t.name=${q(club)} and c.tournament_id=${tid} and c.name=t.name)then raise exception 'Participante no vinculado al club canónico.';end if;end $$;`,
  );
}
sql.push(
  `insert into app.competition_evidence(competition_id,season,source_key,round_number,kind,title,images)values(${comp},${q(source.season)},${q(source.sourceKey)},${source.round},'screenshots',${q(source.title)},${paths})on conflict(competition_id,season,source_key)do nothing;`,
);
sql.push(
  `do $$begin if not exists(select 1 from app.competition_evidence where id=${evidence} and images=${paths} and round_number=${source.round})then raise exception 'La fuente existente tiene otra evidencia.';end if;end $$;`,
);
if (source.rankingPhase)
  sql.push(
    `update app.universe_competitions set ranking_phase=${q(source.rankingPhase)} where id=${comp};`,
  );
sql.push(
  `update app.universe_competitions set review_from=least(coalesce(review_from,${source.round}),${source.round})where id=${comp};`,
);
for (const m of source.matches) {
  const { home, away, expectedVersion, ...fields } = m;
  const doc = {
    ...fields,
    round: source.round,
    stage: source.stage,
    leg: 1,
    videoId: null,
    evidenceSecond: null,
    homePenalties: null,
    awayPenalties: null,
  };
  const team = (name) =>
    `(select id from app.competition_teams where competition_id=${comp} and name=${q(name)})`;
  sql.push(
    `select app.store_competition_result(${comp},${q(JSON.stringify(doc))}::jsonb||jsonb_build_object('homeId',${team(home)},'awayId',${team(away)},'evidenceId',${evidence}),${expectedVersion});`,
  );
}
sql.push("commit;");
console.log(sql.join("\n"));
