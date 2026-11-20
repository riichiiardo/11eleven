import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { parsePoolCsv } from "../src/domain/player-pool.ts";
const header =
  "ID,Nombre y Apellido,Nacionalidad,Posiciones,Edad,Valoración General,Potencial,Equipo,Valor";
const parsed = parsePoolCsv(
  header + '\n100,"Name, Quoted",España,"MC, MCD",22,80+1,86,Club,€24.5M',
);
assert.equal(parsed[0].name, "Name, Quoted");
assert.equal(parsed[0].value, 24500000);
assert.equal(parsed[0].ovr, 80);
assert.throws(() =>
  parsePoolCsv(
    header +
      "\n100,A,España,MC,22,80,86,Club,€1M\n100,B,España,MC,22,80,86,Club,€1M",
  ),
);
assert.throws(() => parsePoolCsv(header + "\n,A,España,MC,22,80,86,Club,€1M"));
const db = new PGlite(),
  id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rpc = async (name, args = []) =>
  (
    await db.query(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
      args,
    )
  ).rows[0].value;
const login = async (n, role = "authenticated") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(n ? { sub: id(n) } : {}),
  ]);
  await db.exec("set role " + role);
};
const player = (sourceId, name = "Player") => ({
  sourceId,
  name,
  nationality: "España",
  position: "MC",
  group: "MID",
  positions: ["MC", "MCD"],
  age: 22,
  ovr: 80,
  potential: 86,
  club: "Club",
  value: 1000000,
});
const load = async (rows) => {
  const job = await rpc("pool_import_start", [rows.length, "test.csv"]);
  await rpc("pool_import_batch", [job, 0, rows]);
  const summary = await rpc("pool_import_finish", [job]);
  return { job, summary };
};
try {
  await db.exec(
    "create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;create role authenticated;create role anon;create role service_role;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  for (const f of [
    "schema",
    "rpc",
    "sheet-sync",
    "views",
    "rules-configuration",
    "club-budgets",
    "csv-catalog",
    "player-pool",
    "player-images",
  ])
    await db.exec(readFileSync(`supabase/${f}.sql`, "utf8"));
  await db.exec(
    `insert into auth.users(id,email)values('${id(1)}','pool-admin@example.invalid'),('${id(2)}','pool-other@example.invalid');insert into public.tournaments(id,code,name,season)values('${id(10)}','POOL','Pool','2026');insert into public.tournament_rules(tournament_id)values('${id(10)}');insert into public.tournament_admins(tournament_id,user_id,role)values('${id(10)}','${id(1)}','principal');update public.profiles set active_tournament_id='${id(10)}';insert into public.clubs(id,tournament_id,name,short_name,league,country)values('${id(20)}','${id(10)}','Game Club','TST','League','España');insert into public.presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget)values('${id(30)}','${id(10)}','${id(1)}','${id(20)}','Admin','Admin',1000);insert into public.squads(id,tournament_id,club_id,president_id,lineup)values('${id(40)}','${id(10)}','${id(20)}','${id(30)}','[{"slotId":"MC","playerId":"${id(50)}"}]');insert into public.players(id,name,position,"group",ovr,age,value,nationality,source_record)values('${id(50)}','Player','MC','MID',75,22,100,'España','{"game_team":"Game Club"}');insert into public.squad_players(tournament_id,club_id,squad_id,player_id,president_id,value_at_join)values('${id(10)}','${id(20)}','${id(40)}','${id(50)}','${id(30)}',100);`,
  );
  const before = (await db.query("select * from public.squad_players")).rows;
  await login(2);
  await assert.rejects(rpc("pool_import_start", [1, "no.csv"]));
  await assert.rejects(rpc("pool_status"));
  await login(null, "anon");
  await assert.rejects(rpc("pool_status"));
  await login(1);
  const first = await load([player("100")]);
  assert.equal(first.summary.updated, 1);
  assert.deepEqual(await rpc("pool_import_finish", [first.job]), first.summary);
  await rpc("pool_import_batch", [
    await rpc("pool_import_start", [2, "partial.csv"]),
    0,
    [player("101")],
  ]);
  const update = player("100", "Renamed Player");
  update.club = "Different Club";
  update.age = 23;
  update.value = 2000000;
  await load([update]);
  await db.exec("reset role");
  const bound = (
    await db.query("select * from public.players where sofifa_id=100")
  ).rows[0];
  assert.equal(bound.id, id(50));
  assert.equal(bound.name, "Renamed Player");
  assert.deepEqual(
    (await db.query("select * from public.squad_players")).rows,
    before,
  );
  assert.equal(
    (await db.query("select lineup from public.squads")).rows[0].lineup[0]
      .playerId,
    id(50),
  );
  await login(1);
  const fresh = await load([player("200", "Correct Identity")]);
  assert.equal(fresh.summary.inserted, 1);
  const status = await rpc("pool_status", ["Correct"]);
  assert.equal(status.pending[0].id, id(50));
  const target = status.candidates[0].id;
  await login(2);
  await assert.rejects(rpc("pool_reconcile", [id(50), target]));
  await login(1);
  await rpc("pool_reconcile", [id(50), target]);
  await assert.rejects(rpc("pool_reconcile", [id(50), target]));
  await db.exec("reset role");
  assert.equal(
    (await db.query("select id from public.players where sofifa_id=200"))
      .rows[0].id,
    id(50),
  );
  assert.deepEqual(
    (await db.query("select * from public.squad_players")).rows,
    before,
  );
  await login(1);
  await load([{ ...player("200", "Updated Correct"), value: 3000000 }]);
  await assert.rejects(db.query("select * from app.pool_import_rows"));
  await login(2);
  await assert.rejects(rpc("pool_import_finish", [fresh.job]));
  await login(1);
  const incomplete = await rpc("pool_import_start", [2, "incomplete.csv"]);
  await rpc("pool_import_batch", [incomplete, 0, [player("201")]]);
  await assert.rejects(rpc("pool_import_finish", [incomplete]));
  const retry = await rpc("pool_import_start", [2, "retry.csv"]);
  await rpc("pool_import_batch", [retry, 0, [player("301")]]);
  await rpc("pool_import_batch", [retry, 0, [player("301")]]);
  await assert.rejects(rpc("pool_import_batch", [retry, 0, [player("302")]]));
  await assert.rejects(rpc("pool_import_batch", [retry, 1, [player("301")]]));
  await assert.rejects(
    rpc("pool_import_batch", [retry, 1, [{ ...player("302"), age: 22.5 }]]),
  );
  await db.exec("reset role");
  assert.equal(
    (await db.query("select count(*) n from app.pool_import_snapshots")).rows[0]
      .n,
    4,
  );
  await db.query(
    `insert into public.players(id,name,position,"group",ovr,age,value,nationality) values($1,'Homonym','MC','MID',70,25,100,'España'),($2,'Homonym','MC','MID',70,25,100,'España')`,
    [id(60), id(61)],
  );
  await login(1);
  const ambiguous = await load([player("400", "Homonym")]);
  assert.equal(ambiguous.summary.inserted, 1);
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select count(*) n from public.players where id in ($1,$2) and sofifa_id is null",
        [id(60), id(61)],
      )
    ).rows[0].n,
    2,
  );
  await db.query(
    `insert into public.players(id,name,position,"group",ovr,age,value,nationality)values($1,'Incoming Homonym','MC','MID',70,25,100,'España')`,
    [id(62)],
  );
  await login(1);
  const incomingTwins = await load([
    player("401", "Incoming Homonym"),
    player("402", "Incoming Homonym"),
  ]);
  assert.equal(incomingTwins.summary.inserted, 2);
  await db.exec("reset role");
  assert.equal(
    (
      await db.query("select sofifa_id from public.players where id=$1", [
        id(62),
      ])
    ).rows[0].sofifa_id,
    null,
  );
  await login(1);
  const portrait = "https://cdn.sofifa.net/players/000/200/27_120.png";
  await load([{ ...player("200", "Portrait Player"), imageUrl: portrait }]);
  assert.equal((await rpc("player_images_status")).pending, 1);
  await assert.rejects(rpc("player_images_claim", [1]));
  await login(2);
  await assert.rejects(rpc("player_images_retry"));
  await login(null, "service_role");
  const claimed = await rpc("player_images_claim", [1]);
  assert.equal(claimed.length, 1);
  await rpc("player_images_complete", [
    claimed[0].playerId,
    claimed[0].lease,
    null,
    "HTTP 403",
  ]);
  await login(1);
  assert.equal((await rpc("player_images_status")).error, 1);
  await rpc("player_images_retry");
  await login(null, "service_role");
  const second = await rpc("player_images_claim", [1]);
  const stored =
    "https://usbchyviwsggqjbeqsit.supabase.co/storage/v1/object/public/player-faces/200/" +
    "a".repeat(64) +
    ".png";
  assert.equal(
    await rpc("player_images_complete", [
      second[0].playerId,
      second[0].lease,
      stored,
      null,
    ]),
    true,
  );
  await db.exec("reset role");
  const photo = (
    await db.query(
      'select "Imagen_URL",photo from public.players where id=$1',
      [id(50)],
    )
  ).rows[0];
  assert.equal(photo.Imagen_URL, stored);
  assert.equal(photo.photo, stored);
  assert.equal(
    (
      await db.query(
        "select public.squad_player_json(sp)->>'photo' photo from public.squad_players sp where player_id=$1",
        [id(50)],
      )
    ).rows[0].photo,
    stored,
  );
  await login(1);
  await load([player("200", "Preserved Portrait")]);
  await db.exec("reset role");
  assert.equal(
    (
      await db.query('select "Imagen_URL" from public.players where id=$1', [
        id(50),
      ])
    ).rows[0].Imagen_URL,
    stored,
  );
  await login(1);
  await load([{ ...player("200", "Portrait Player"), imageUrl: portrait }]);
  await login(null, "service_role");
  const stale = await rpc("player_images_claim", [1]);
  await login(1);
  await load([
    {
      ...player("200", "Portrait Player"),
      imageUrl: portrait.replace("27_", "28_"),
    },
  ]);
  await login(null, "service_role");
  assert.equal(
    await rpc("player_images_complete", [
      stale[0].playerId,
      stale[0].lease,
      stored,
      null,
    ]),
    false,
  );
  await login(1);
  await assert.rejects(load([{ ...player("201"), imageUrl: portrait }]));
  await db.exec("reset role");
  assert.deepEqual(
    (await db.query("select * from public.squad_players")).rows,
    before,
  );
  console.log(
    "PASS portrait SQL: image identity, admin-only retry, service-only claims, leases, failure preservation, canonical Imagen_URL/photo alias, absent-column compatibility and preserved ownership.",
  );
  if (process.env.POOL_CSV) {
    const all = parsePoolCsv(readFileSync(process.env.POOL_CSV, "utf8"));
    await login(1);
    const job = await rpc("pool_import_start", [
      all.length,
      "full-rehearsal.csv",
    ]);
    for (let offset = 0; offset < all.length; offset += 500)
      await rpc("pool_import_batch", [
        job,
        offset,
        all.slice(offset, offset + 500),
      ]);
    const started = Date.now();
    const summary = await rpc("pool_import_finish", [job]);
    assert.equal(summary.total, all.length);
    const replay = await rpc("pool_import_start", [
      all.length,
      "full-update.csv",
    ]);
    for (let offset = 0; offset < all.length; offset += 500)
      await rpc("pool_import_batch", [
        replay,
        offset,
        all.slice(offset, offset + 500),
      ]);
    const again = await rpc("pool_import_finish", [replay]);
    assert.equal(again.inserted, 0);
    assert.equal(again.updated, all.length);
    await db.exec("reset role");
    assert.equal((await db.query("select format from app.pool_import_snapshots where job=$1",[replay])).rows[0].format,"rows");
    assert.equal((await db.query("select count(*) n from app.pool_import_player_snapshots where job=$1",[replay])).rows[0].n,(await db.query("select count(*) n from public.players")).rows[0].n);
    assert.equal((await db.query("select count(*) n from app.pool_import_player_snapshots s join public.players p on p.id=s.player_id where s.job=$1 and (s.record->>'sofifa_id')::bigint is distinct from p.sofifa_id",[replay])).rows[0].n,0);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select count(distinct sofifa_id) n from public.players where catalog_active",
        )
      ).rows[0].n,
      all.length,
    );
    assert.deepEqual(
      (await db.query("select * from public.squad_players")).rows,
      before,
    );
    console.log(
      `PASS full CSV rehearsal: ${all.length} rows, repeat update inserted 0 duplicates; ${Date.now() - started}ms including full second upload.`,
    );
  }
  console.log(
    "PASS player pool: CSV validation, stable SoFIFA identity across name/club/age changes, idempotence, partial-import refusal, preserved ownership/lineup/purchase value, manual reconciliation, subsequent ID updates and unauthorized access denial.",
  );
} finally {
  await db.close();
}
