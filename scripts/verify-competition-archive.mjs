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
  console.log(
    `PASS competition archive: ${checks} assertions; tenant isolation, scoped access, validated evidence and stats, unknown values, versioned corrections, no double counting, assists/cards, cups, archiving and seasons.`,
  );
} finally {
  await db.close();
}
