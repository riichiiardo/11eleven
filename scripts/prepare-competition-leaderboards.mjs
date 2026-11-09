/** Build an owner-run SQL transaction from a reported leaderboard snapshot. */
import { readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
if (
  !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(args.universe ?? "") ||
  !args.file
)
  throw Error("Indica --universe=<UUID> --file=<informe.json>.");

const { competition, season, throughRound, source, rankings } = JSON.parse(
  readFileSync(args.file, "utf8"),
);
if (
  !/^[a-z0-9-]{1,60}$/.test(competition) ||
  !/^\d{4}$/.test(season) ||
  !Number.isInteger(throughRound) ||
  throughRound < 1 ||
  source !== "user_report"
)
  throw Error("Temporada, competición o fuente inválida.");

const q = (value) => "'" + value.replaceAll("'", "''") + "'";
const target = `(select id from app.universe_competitions where tournament_id=${q(args.universe)}::uuid and slug=${q(competition)} and current_season=${q(season)} and not archived)`;
const values = [];
for (const metric of ["goals", "assists", "cleanSheets"]) {
  const entries = rankings?.[metric];
  if (!Array.isArray(entries) || !entries.length)
    throw Error(`Falta el ranking ${metric}.`);
  const players = new Set();
  for (const [index, row] of entries.entries()) {
    const key = JSON.stringify([row.team, row.name]);
    if (
      typeof row.team !== "string" ||
      !row.team.trim() ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      players.has(key) ||
      !Number.isInteger(row.played) ||
      row.played < 1 ||
      row.played > throughRound ||
      !Number.isInteger(row.total) ||
      row.total < 0 ||
      (metric === "cleanSheets" && row.total > row.played) ||
      (index > 0 && row.total > entries[index - 1].total)
    )
      throw Error(`Entrada inválida en ${metric}, posición ${index + 1}.`);
    players.add(key);
    values.push(
      `(${target},${q(season)},${throughRound},${q(metric)},${index + 1},${q(row.team)},${q(row.name)},${row.total},${row.played},${q(source)})`,
    );
  }
}

const verifySnapshot = `begin
 if (select count(*) from app.competition_player_leaders where competition_id=${target} and season=${q(season)} and through_round=${throughRound}) <> ${values.length}
 or exists (select * from (values ${values.join(",\n")}) as supplied(competition_id,season,through_round,metric,position,team,player,total,played,source)
 except select competition_id,season,through_round,metric,position,team,player,total,played,source from app.competition_player_leaders where competition_id=${target} and season=${q(season)} and through_round=${throughRound})
 then raise exception 'La jornada ya tiene un ranking distinto.'; end if;
end`;

console.log(`begin;
insert into app.competition_player_leaders (competition_id,season,through_round,metric,position,team,player,total,played,source)
values ${values.join(",\n")}
on conflict (competition_id,season,through_round,metric,position) do nothing;
do ${q(verifySnapshot)};
commit;`);
