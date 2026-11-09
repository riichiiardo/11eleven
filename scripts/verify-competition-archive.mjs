import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let checks = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const denied = async (p) => {
  await assert.rejects(p);
  checks++;
};
try {
  await db.exec(
    `create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;create role authenticated;create role anon;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid()to authenticated,anon;`,
  );
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/rpc.sql", "utf8"));
  await db.exec(readFileSync("supabase/sheet-sync.sql", "utf8"));
  await db.exec(readFileSync("supabase/views.sql", "utf8"));
  await db.exec(readFileSync("supabase/rules-configuration.sql", "utf8"));
  await db.exec(readFileSync("supabase/competitions-archive.sql", "utf8"));
  await db.exec(
    `insert into auth.users(id,email)values('${id(1)}','archive1@example.invalid'),('${id(2)}','archive2@example.invalid');insert into public.tournaments(id,code,name,season)values('${id(10)}','ARC','Archive','2026'),('${id(11)}','OTHER','Other','2026');insert into public.tournament_rules(tournament_id,configuration)values('${id(10)}','{"competitions":[]}'),('${id(11)}','{"competitions":[]}');insert into public.league_members(tournament_id,user_id,role)values('${id(10)}','${id(1)}','presidente'),('${id(11)}','${id(2)}','presidente');`,
  );
  const config = [
    { id: "primera", name: "Primera", kind: "league" },
    { id: "fa-cup", name: "FA Cup", kind: "cup" },
  ];
  await db.query(
    "update public.tournament_rules set configuration=$1 where tournament_id=$2",
    [{ competitions: config }, id(10)],
  );
  const comps = (
    await db.query(
      "select id,slug from app.universe_competitions order by slug",
    )
  ).rows;
  const league = comps.find((c) => c.slug === "primera").id,
    cup = comps.find((c) => c.slug === "fa-cup").id;
  ok(comps.length === 2, "Rules creates distinct permanent competitions");
  await db.query(
    "insert into app.competition_teams(id,competition_id,name)values($1,$2,'Home'),($3,$2,'Away'),($4,$5,'Cup team')",
    [id(21), league, id(22), id(23), cup],
  );
  await db.query(
    "insert into app.broadcast_sources(video_id,channel_id,title,competition_slug,round_number)values('Ax3pHQdXZm8','UCdi3BBPwD7Y0XTp86qGCofA','J9','primera',9),('EWOxcfACXhQ','UCdi3BBPwD7Y0XTp86qGCofA','Cup','fa-cup',null)",
  );
  const doc = {
    round: 9,
    stage: "Regular",
    homeId: id(21),
    awayId: id(22),
    homeGoals: 2,
    awayGoals: 1,
    videoId: "Ax3pHQdXZm8",
    evidenceSecond: 100,
    verified: true,
    goals: [
      { teamId: id(21), player: "Test One", count: 2 },
      { teamId: id(22), player: "Test Two", count: 1 },
    ],
    assists: [{ teamId: id(21), player: "Test Assist", count: 1 }],
    yellowCards: [{ teamId: id(22), player: "Test Yellow", count: 1 }],
    redCards: null,
  };
  const store = async (d = doc, v = 0) =>
    (
      await db.query("select app.store_competition_result($1,$2,$3)data", [
        league,
        d,
        v,
      ])
    ).rows[0].data;
  let r = await store();
  ok(r.version === 1, "Persists score and four statistic families");
  ok((await store()).unchanged, "Duplicate import idempotent");
  await denied(store({ ...doc, homeGoals: 3 }));
  await denied(store({ ...doc, goals: [] }, 1));
  await denied(store({ ...doc, awayId: id(23) }, 1));
  await denied(store({ ...doc, videoId: "EWOxcfACXhQ" }, 1));
  await denied(store({ ...doc, evidenceSecond: -1 }, 1));
  await denied(store({ ...doc, homeGoals: -1 }, 1));
  await denied(store({ ...doc, round: 10 }, 1));
  await denied(
    store(
      { ...doc, assists: [{ teamId: id(21), player: "Test", count: 3 }] },
      1,
    ),
  );
  await denied(
    store(
      { ...doc, redCards: [{ teamId: id(21), player: "Test", count: 2 }] },
      1,
    ),
  );
  await denied(store({ ...doc, goals: [...doc.goals, doc.goals[0]] }, 1));
  const correction = {
    ...doc,
    homeGoals: 3,
    goals: [{ teamId: id(21), player: "Test One", count: 3 }, doc.goals[1]],
  };
  ok(
    (await store(correction, 1)).version === 2,
    "Version-controlled correction",
  );
  ok(
    (
      await db.query(
        "select count(*)::int n from app.competition_result_versions",
      )
    ).rows[0].n === 2,
    "Prior versions preserved",
  );
  await store({
    ...doc,
    round: 9,
    stage: "Unreviewed",
    verified: false,
    homeGoals: null,
    awayGoals: null,
    goals: null,
    assists: null,
    yellowCards: null,
    redCards: null,
  });
  const login = async (n, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(n ? { sub: id(n) } : {}),
    ]);
    await db.exec("set role " + role);
  };
  await login(1);
  let archive = (
    await db.query("select public.competition_archive($1)data", [id(10)])
  ).rows[0].data;
  let l = archive.find((c) => c.slug === "primera");
  ok(
    l.verifiedMatches === 1 && l.matches.length === 2,
    "Unknown matches do not count as played",
  );
  ok(
    l.standings[0].points === 3 && l.standings[0].goalsFor === 3,
    "Standings reflect corrected score once",
  );
  ok(
    l.players.find((p) => p.name === "Test One").goals === 3,
    "Goal leaderboard updated, not doubled",
  );
  ok(
    l.players.find((p) => p.name === "Test One").assists === null,
    "Unknown is not zero",
  );
  ok(
    l.players.find((p) => p.name === "Test Assist").assists === 1,
    "Assists retained",
  );
  ok(
    l.players.find((p) => p.name === "Test Yellow").yellowCards === 1,
    "Yellow cards retained",
  );
  ok(
    archive.find((c) => c.slug === "fa-cup").standings.length === 0,
    "Cups not mixed into league points",
  );
  await denied(db.query("select public.competition_archive($1)", [id(11)]));
  await denied(db.query("select * from app.competition_results"));
  await denied(
    db.query("select app.store_competition_result($1,$2,2)", [league, doc]),
  );
  await login(null, "anon");
  await denied(db.query("select public.competition_archive($1)", [id(10)]));
  await db.exec("reset role");
  await db.query(
    "update public.tournament_rules set configuration=$1 where tournament_id=$2",
    [{ competitions: [config[1]] }, id(10)],
  );
  ok(
    (
      await db.query(
        "select archived from app.universe_competitions where id=$1",
        [league],
      )
    ).rows[0].archived,
    "Rules removal archives, not deletes",
  );
  ok(
    (await db.query("select count(*)::int n from app.competition_results"))
      .rows[0].n === 2,
    "Archived history retained",
  );
  await db.query(
    "update public.tournament_rules set configuration=$1 where tournament_id=$2",
    [{ competitions: config }, id(10)],
  );
  await db.query(
    "update app.universe_competitions set current_season='2027' where id=$1",
    [league],
  );
  await login(1);
  archive = (
    await db.query("select public.competition_archive($1)data", [id(10)])
  ).rows[0].data;
  ok(
    archive.find((c) => c.slug === "primera").matches.length === 0,
    "Seasons isolated",
  );
  await db.exec("reset role");
  ok(
    (await db.query("select count(*)::int n from app.competition_results"))
      .rows[0].n === 2,
    "Past seasons preserved",
  );
  // Rehearse the deployed video-only table shape with existing results.
  await db.exec(
    "alter table app.competition_results drop constraint competition_results_evidence_source;alter table app.competition_results alter column video_id set not null;alter table app.competition_results alter column evidence_second set not null;alter table app.competition_results drop column evidence_id;drop table app.competition_evidence;alter table app.universe_competitions drop column ranking_phase;",
  );
  await db.exec(readFileSync("supabase/competitions-archive.sql", "utf8"));
  ok(
    (await db.query("select count(*)::int n from app.competition_results"))
      .rows[0].n === 2,
    "Reinstallation preserves data",
  );
  const runPlan = (file, args) =>
    execFileSync(process.execPath, [file, ...args], { encoding: "utf8" });
  await db.exec(
    runPlan("scripts/prepare-competition-seed.mjs", [`--universe=${id(10)}`]),
  );
  await db.query(
    "update app.universe_competitions set current_season='2026' where id=$1",
    [league],
  );
  const beforeImport = (
    await db.query("select count(*)::int n from app.competition_results")
  ).rows[0].n;
  const manifest = JSON.parse(
    readFileSync("data/broadcast-results/2026-11-06.json", "utf8"),
  );
  const importPlan = runPlan("scripts/prepare-broadcast-results.mjs", [
    `--universe=${id(10)}`,
    "--file=data/broadcast-results/2026-11-06.json",
  ]);
  await db.exec(importPlan);
  ok(
    (await db.query("select count(*)::int n from app.competition_results"))
      .rows[0].n ===
      beforeImport + manifest.matches.length,
    "Reviewed source dataset imports successfully",
  );
  await db.exec(importPlan);
  ok(
    (await db.query("select count(*)::int n from app.competition_results"))
      .rows[0].n ===
      beforeImport + manifest.matches.length,
    "Replaying real source dataset never duplicates matches",
  );
  ok(
    (
      await db.query(
        "select count(*)::int n from app.universe_competitions where tournament_id=$1 and not archived",
        [id(10)],
      )
    ).rows[0].n === 6,
    "Scoped seed creates all six competitions",
  );
  await login(1);
  const realArchive = (
    await db.query("select public.competition_archive($1)data", [id(10)])
  ).rows[0].data;
  const sourceMatch = realArchive
    .find((c) => c.slug === "primera")
    .matches.find((m) => m.home === "Palermo" && m.round === 11);
  ok(
    sourceMatch.homeGoals === 2 &&
      sourceMatch.awayGoals === 1 &&
      sourceMatch.goals === null,
    "Verified score remains separate from unknown scorers",
  );

  await db.exec("reset role");
  const screenshots = JSON.parse(
    readFileSync("data/competition-results/champions-2026-j1.json", "utf8"),
  );
  for (const name of screenshots.matches.flatMap((m) => [m.home, m.away]))
    await db.query(
      "insert into public.clubs(tournament_id,name,short_name,league,country)values($1,$2,'TEST','Test','Test')",
      [id(10), name],
    );
  const screenshotPlan = runPlan("scripts/prepare-screenshot-results.mjs", [
    `--universe=${id(10)}`,
    "--file=data/competition-results/champions-2026-j1.json",
  ]);
  await db.exec(screenshotPlan);
  await db.exec(screenshotPlan);
  const champion = (
    await db.query(
      "select id from app.universe_competitions where tournament_id=$1 and slug='champions'",
      [id(10)],
    )
  ).rows[0].id;
  const reports = (
    await db.query(
      "select * from app.competition_results where competition_id=$1",
      [champion],
    )
  ).rows;
  ok(
    reports.length === 9 && reports.every((m) => m.version === 1),
    "Nine screenshot results import idempotently at version one",
  );
  ok(
    reports.reduce((n, m) => n + m.home_goals + m.away_goals, 0) === 26,
    "All nine screenshot scores total 26 goals",
  );
  ok(
    (
      await db.query(
        "select count(*)::int n from app.competition_teams where competition_id=$1 and club_id is not null",
        [champion],
      )
    ).rows[0].n === 18,
    "All participants link to the 18 canonical clubs",
  );
  const sample = reports[0].payload;
  const save = (d) =>
    db.query("select app.store_competition_result($1,$2,1)", [champion, d]);
  await denied(save({ ...sample, sourceImage: 4 }));
  await denied(save({ ...sample, sourceImage: 1.5 }));
  await denied(save({ ...sample, sourceImage: "1" }));
  await denied(save({ ...sample, round: 2 }));
  await denied(
    save({ ...sample, videoId: "Ax3pHQdXZm8", evidenceSecond: 100 }),
  );
  await denied(
    db.query(
      "insert into app.competition_evidence(competition_id,season,source_key,round_number,kind,title,images)values($1,'2026','invalid',1,'screenshots','Bad',array['../bad.png'])",
      [champion],
    ),
  );
  await db.exec(readFileSync("supabase/competitions-archive.sql", "utf8"));
  await login(1);
  const getChampions = async () =>
    (
      await db.query("select public.competition_archive($1)data", [id(10)])
    ).rows[0].data.find((c) => c.slug === "champions");
  const ch = await getChampions();
  ok(
    ch.format === "cup" && ch.rankingPhase === "Fase de liga",
    "Champions preserves cup identity with league phase",
  );
  ok(
    ch.standings.length === 18 && ch.standings.every((t) => t.played === 1),
    "One table contains 18 teams with one match each",
  );
  ok(
    ch.standings.reduce((n, t) => n + t.points, 0) === 26,
    "Three points per win, one per draw",
  );
  ok(
    ch.standings[0].team === "Manchester United" &&
      ch.standings[0].goalDifference === 5,
    "Standings sorted by points and goal difference",
  );
  ok(
    ch.matches.every(
      (m) =>
        m.videoId === null &&
        m.evidenceSecond === null &&
        m.evidence.images.length === 1,
    ),
    "Screenshots never receive a fake video or timestamp",
  );
  ok(
    ch.matches
      .find((m) => m.home === "Parma Calcio 1913")
      .evidence.images[0].endsWith("03.png"),
    "Each match shows its own source screenshot",
  );
  ok(
    ch.players.length === 0 &&
      ch.matches.every((m) => m.yellowCards === null && m.redCards === null),
    "Unknown scorers and cards remain unknown",
  );
  await denied(db.query("select * from app.competition_evidence"));
  await denied(save(sample));
  await db.exec("reset role;begin;");
  await db.query("select app.store_competition_result($1,$2,0)", [
    champion,
    { ...sample, stage: "Semifinal" },
  ]);
  await login(1);
  ok(
    JSON.stringify((await getChampions()).standings) ===
      JSON.stringify(ch.standings),
    "Knockout results never add league-phase points",
  );
  await db.exec("reset role;rollback;reset role;");
  await db.query(
    "update app.universe_competitions set current_season='2027' where id=$1",
    [champion],
  );
  await denied(save(sample));
  await db.query(
    "update app.universe_competitions set current_season='2026' where id=$1",
    [champion],
  );

  const j2plan = runPlan("scripts/prepare-screenshot-results.mjs", [
    `--universe=${id(10)}`,
    "--file=data/competition-results/champions-2026-j2.json",
  ]);
  await db.exec(j2plan);
  await db.exec(j2plan);
  await login(1);
  const accumulated = await getChampions();
  ok(
    accumulated.matches.length === 18 &&
      accumulated.standings.length === 18 &&
      accumulated.standings.every((t) => t.played === 2),
    "J1 plus J2: 18 distinct matches and two appearances for all 18 teams",
  );
  ok(
    accumulated.standings.reduce((n, t) => n + t.goalsFor, 0) === 49,
    "J1 plus J2: 49 verified goals",
  );
  ok(
    accumulated.standings[0].team === "Manchester United" &&
      accumulated.standings[0].points === 6 &&
      accumulated.standings[0].goalDifference === 7,
    "Manchester United leads after J2 with six points and +7",
  );
  ok(
    accumulated.standings.reduce((n, t) => n + t.points, 0) === 52,
    "Two draws and 16 victories yield 52 accumulated points",
  );
  ok(
    accumulated.matches.filter((m) => m.round === 1).length === 9 &&
      accumulated.matches.every((m) => m.version === 1),
    "J2 replay preserves all J1 records and creates no duplicates",
  );
  ok(
    accumulated.matches
      .find((m) => m.round === 2 && m.home === "Racing Club")
      .evidence.images[0].endsWith("jornada-2-03.png"),
    "J2 results point to their actual screenshot",
  );
  await db.exec("reset role");
  const j3plan = runPlan("scripts/prepare-screenshot-results.mjs", [
    `--universe=${id(10)}`,
    "--file=data/competition-results/champions-2026-j3.json",
  ]);
  await db.exec(j3plan);
  await db.exec(j3plan);
  await login(1);
  const threeRounds = await getChampions();
  ok(
    threeRounds.matches.length === 27 &&
      threeRounds.standings.length === 18 &&
      threeRounds.standings.every((t) => t.played === 3),
    "J3 adds one match per club without duplicates",
  );
  ok(
    threeRounds.standings.reduce((n, t) => n + t.goalsFor, 0) === 69 &&
      threeRounds.standings[0].team === "Arsenal Football Club" &&
      threeRounds.standings[0].points === 9,
    "J3 updates total goals and leader",
  );
  const report = threeRounds.matches.find(
    (m) => m.round === 3 && m.home === "Bayer 04 Leverkusen",
  );
  ok(
    report.homeGoals === 1 &&
      report.awayGoals === 0 &&
      report.evidence.kind === "user_report" &&
      report.evidence.title === "Leverkusen 1-0 al Parma" &&
      report.evidence.images.length === 0,
    "User-reported score has its own text evidence without a screenshot",
  );
  ok(
    threeRounds.matches.filter(
      (m) => m.round === 3 && m.evidence.kind === "screenshots",
    ).length === 8,
    "Eight J3 results retain their screenshot provenance",
  );
  await db.exec("reset role");
  for (const round of [4, 5]) {
    const plan = runPlan("scripts/prepare-screenshot-results.mjs", [
      `--universe=${id(10)}`,
      `--file=data/competition-results/champions-2026-j${round}.json`,
    ]);
    await db.exec(plan);
    await db.exec(plan);
  }
  await login(1);
  const fiveRounds = await getChampions();
  const reported = fiveRounds.matches.filter(
    (m) => m.round === 4 || m.round === 5,
  );
  ok(
    reported.length === 18 &&
      reported.every(
        (m) =>
          m.evidence.kind === "user_report" &&
          m.evidence.images.length === 0 &&
          m.version === 1,
      ),
    "Text-only rounds import idempotently with individual written sources",
  );
  ok(
    fiveRounds.matches.length === 45 &&
      fiveRounds.standings.length === 18 &&
      fiveRounds.standings.every((t) => t.played === 5),
    "Five completed rounds cover all 18 clubs",
  );
  ok(
    fiveRounds.standings.reduce((n, t) => n + t.goalsFor, 0) === 115 &&
      fiveRounds.standings[0].team === "Arsenal Football Club" &&
      fiveRounds.standings[0].points === 12 &&
      fiveRounds.standings[0].goalDifference === 13,
    "J4 and J5 update cumulative goals and goal difference",
  );
  await db.exec("reset role");
  const leadersPlan = runPlan("scripts/prepare-competition-leaderboards.mjs", [
    `--universe=${id(10)}`,
    "--file=data/competition-results/champions-2026-leaders-j5.json",
  ]);
  await db.exec(leadersPlan);
  await db.exec(leadersPlan);
  await login(1);
  const withLeaders = await getChampions();
  const leaders = withLeaders.reportedLeaders;
  ok(
    leaders.throughRound === 5 && leaders.entries.length === 15,
    "Three reported rankings load without duplicates",
  );
  ok(
    leaders.entries.some(
      (row) =>
        row.name === "Marcus Rashford" &&
        row.metric === "assists" &&
        row.total === 6 &&
        row.played === 5,
    ) &&
      leaders.entries.some(
        (row) =>
          row.name === "Jan Oblak" &&
          row.metric === "cleanSheets" &&
          row.total === 4,
      ),
    "Reported totals and appearances are preserved",
  );
  assert.deepEqual(withLeaders.matches, fiveRounds.matches);
  assert.deepEqual(withLeaders.standings, fiveRounds.standings);
  assert.deepEqual(withLeaders.players, fiveRounds.players);
  await denied(db.query("select * from app.competition_player_leaders"));
  await db.exec("reset role");
  await db.query(
    "update app.universe_competitions set current_season='2027' where id=$1",
    [champion],
  );
  await login(1);
  ok(
    (await getChampions()).reportedLeaders === null,
    "Reported rankings stay in their own season",
  );
  console.log(
    `PASS competition archive: ${checks} assertions; tenant isolation, scoped access, validated evidence and stats, unknown values, versioned corrections, no double counting, assists/cards, cups, archiving and seasons.`,
  );
} finally {
  await db.close();
}
