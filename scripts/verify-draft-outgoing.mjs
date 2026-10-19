// Isolated PostgreSQL tests: never connects to the real Supabase project.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sql = (file) => readFileSync(`supabase/${file}.sql`, "utf8");
try {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
    create role authenticated; create role anon; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const f of [
    "schema",
    "rpc",
    "sheet-sync",
    "views",
    "rules-configuration",
    "club-budgets",
    "rule-edit-session",
    "draft-prelists",
  ]) {
    // Exercise upgrading the OLD market function, not only a fresh install.
    let source = sql(f);
    if (f === "views")
      source = source
        .replace(" or sp.availability = 'transferible'", "")
        .replace(/\s+or \(p_scope = 'transferibles'[^\n]+\n/, "\n");
    await db.exec(source);
  }
  await db.exec(sql("draft-outgoing"));
  await db.exec(sql("draft-outgoing"));
  for (const n of [1, 2, 3]) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id(n),
      `outgoing${n}@example.invalid`,
    ]);
  }
  await db.exec(`insert into tournaments(id,code,name,season) values('${id(10)}','OUT','Outgoing','2026'),('${id(11)}','OTHER','Other','2026');
    insert into tournament_rules(tournament_id,configuration) values('${id(10)}','{"draft":{"maxTransfers":6,"extraPlayer":true}}'),('${id(11)}','{}');
    insert into tournament_admins(tournament_id,user_id,role) values('${id(10)}','${id(1)}','principal');`);
  for (const n of [1, 2, 3]) {
    const tid = id(n === 3 ? 11 : 10);
    await db.exec(`update profiles set active_tournament_id='${tid}' where id='${id(n)}';
      insert into league_members(tournament_id,user_id,role) values('${tid}','${id(n)}','presidente');
      insert into clubs(id,tournament_id,name,short_name,league,country) values('${id(20 + n)}','${tid}','Club ${n}','TST','Test','España');
      insert into presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget) values('${id(30 + n)}','${tid}','${id(n)}','${id(20 + n)}','President ${n}','Test',1000);
      insert into squads(id,tournament_id,club_id,president_id) values('${id(40 + n)}','${tid}','${id(20 + n)}','${id(30 + n)}');`);
  }
  for (let n = 1; n <= 9; n++) {
    const owner = n === 9 ? 3 : 1,
      tid = id(owner === 3 ? 11 : 10);
    await db.query(
      `insert into players(id,name,position,"group",ovr,age,value,nationality) values($1,$2,'MC','MID',82,25,100,'Colombia')`,
      [id(100 + n), `Player ${n}`],
    );
    await db.query(
      "insert into squad_players(tournament_id,club_id,squad_id,player_id,president_id,availability) values($1,$2,$3,$4,$5,'neutro')",
      [tid, id(20 + owner), id(40 + owner), id(100 + n), id(30 + owner)],
    );
  }
  await db.exec(`update presidents set budget=1000;
    insert into drafts(id,tournament_id) values('${id(50)}','${id(10)}');
    insert into draft_picks(tournament_id,draft_id,president_id,player_id) values('${id(10)}','${id(50)}','${id(31)}','${id(101)}');
    update squads set lineup='[{"position":"MC","playerId":"${id(101)}"},{"position":"DC","playerId":"${id(103)}"}]' where id='${id(41)}';`);
  const login = async (n, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(n ? { sub: id(n), role } : {}),
    ]);
    await db.exec(`set role ${role}`);
  };
  const state = async () =>
    (await db.query("select draft_prelist_state() data")).rows[0].data;
  const outgoing = async () =>
    (await db.query("select draft_outgoing_state() data")).rows[0].data;
  const save = async (ids) =>
    db.query("select save_draft_prelist('[]',$1,$2,false)", [
      JSON.stringify(ids),
      (await state()).revision,
    ]);
  const admin = async (query) => {
    await db.exec("reset role");
    return db.exec(query);
  };
  const count = async (table, where = "true") =>
    Number(
      (await db.query(`select count(*) n from ${table} where ${where}`)).rows[0]
        .n,
    );
  await login(1);
  assert.equal((await outgoing()).locked, false);
  await assert.rejects(
    save(Array.from({ length: 7 }, (_, i) => id(101 + i))),
    /máximo.*6/,
  );
  await assert.rejects(save([id(109)]), /tu plantilla/);
  await save([id(101)]);
  await login(2);
  let market = (await db.query("select market_browse('transferibles') data"))
    .rows[0].data;
  assert.equal(
    market.players.length,
    1,
    "Saved departures must be visible even if acquired in an earlier draft pick",
  );
  assert.equal(market.players[0].playerId, id(101));
  await login(1);
  assert.equal(
    (await db.query("select market_browse('transferibles') data")).rows[0].data
      .players.length,
    0,
    "Do not offer own players to self",
  );
  await assert.rejects(
    db.query(
      "update squad_players set availability='neutro' where player_id=$1",
      [id(101)],
    ),
    /permission denied|Retira primero/,
  );
  await save([]);
  await admin(`select 1`);
  assert.equal(
    (
      await db.query(
        `select availability from squad_players where player_id='${id(101)}'`,
      )
    ).rows[0].availability,
    "neutro",
  );
  await login(1);
  await save([1, 2, 3, 4, 5, 6].map((n) => id(100 + n)));
  await login(3);
  await save([id(109)]);
  assert.equal(
    (await db.query("select market_browse('transferibles') data")).rows[0].data
      .players.length,
    0,
    "Other leagues cannot see our departures",
  );
  await admin("select 1");
  // Sent/open offers do not protect; accepted/reserved protect both sides of a trade.
  for (const [n, status] of [
    [1, "enviada"],
    [2, "negociacion"],
    [3, "reservada"],
    [4, "aceptada"],
  ]) {
    await db.query(
      "insert into offers(tournament_id,type,bidder_president_id,bidder_club_id,seller_president_id,seller_club_id,requested_player_ids,status) values($1,'cash',$2,$3,$4,$5,$6,$7)",
      [id(10), id(32), id(22), id(31), id(21), [id(100 + n)], status],
    );
  }
  await db.query(
    "insert into offers(tournament_id,type,bidder_president_id,bidder_club_id,seller_president_id,seller_club_id,offered_player_ids,status) values($1,'trade',$2,$3,$4,$5,$6,'reservada')",
    [id(10), id(31), id(21), id(32), id(22), [id(105)]],
  );
  await db.exec(`update squad_players set president_id='${id(32)}',club_id='${id(22)}',squad_id='${id(42)}' where player_id='${id(106)}';
    update players set value=200 where id='${id(101)}';`);
  await login(1);
  assert.equal(
    (await outgoing()).players.filter((p) => p.negotiated).length,
    3,
  );
  await login(2);
  await assert.rejects(
    db.query("select draft_set_status('en_curso')"),
    /administrador|Admin|admin/,
  );
  // Force a failure halfway through: no budget, ownership, draft or receipt changes may survive.
  await admin(`create function app.test_fail_budget() returns trigger language plpgsql as $$ begin raise exception 'simulated failure'; end $$;
    create trigger test_fail_budget before update of budget on presidents for each row execute function app.test_fail_budget();`);
  await login(1);
  await assert.rejects(
    db.query("select draft_set_status('en_curso')"),
    /simulated failure/,
  );
  await admin("drop trigger test_fail_budget on presidents");
  assert.equal(await count("app.draft_release_receipts"), 0);
  assert.equal(
    (await db.query("select status from drafts")).rows[0].status,
    "borrador",
  );
  assert.equal(
    (await db.query(`select budget from presidents where id='${id(31)}'`))
      .rows[0].budget,
    "1000",
  );
  await login(1);
  await db.query("select draft_set_status('en_curso')");
  const result = await outgoing();
  assert.equal(result.locked, true);
  assert.deepEqual(result.receipts.map((r) => r.outcome).sort(), [
    "negotiated",
    "negotiated",
    "negotiated",
    "released",
    "released",
    "transferred",
  ]);
  assert.equal(
    result.receipts.find((r) => r.playerId === id(101)).amount,
    150,
    "75% must use updated current value, not acquisition value",
  );
  assert.equal(
    (await state()).outgoing.length,
    0,
    "Consumed departures must not prevent future saves",
  );
  await save([]);
  await assert.rejects(save([id(107)]), /ya comenzó/);
  await admin("select 1");
  assert.equal(
    Number(
      (await db.query(`select budget from presidents where id='${id(31)}'`))
        .rows[0].budget,
    ),
    1225,
  );
  assert.equal(
    await count("squad_players", `player_id in ('${id(101)}','${id(102)}')`),
    0,
  );
  assert.equal(
    await count("players"),
    9,
    "Released players remain in the catalog as free agents",
  );
  assert.equal(
    await count("squad_players", `player_id='${id(109)}'`),
    1,
    "Other league untouched",
  );
  assert.equal(await count("offers", "status='invalidada'"), 2);
  const lineup = (
    await db.query(`select lineup from squads where id='${id(41)}'`)
  ).rows[0].lineup;
  assert.equal(lineup[0].playerId, null);
  assert.equal(lineup[1].playerId, id(103));
  await login(1);
  assert.ok(
    (
      await db.query("select market_browse('todos') data")
    ).rows[0].data.players.some(
      (p) => p.playerId === id(101) && p.kind === "libre",
    ),
    "A released former draft pick must be visible as a free agent",
  );
  for (const status of ["pausado", "en_curso", "cerrado", "en_curso"])
    await db.query("select draft_set_status($1)", [status]);
  assert.equal((await outgoing()).receipts.length, 6);
  await admin("select 1");
  assert.equal(
    Number(
      (await db.query(`select budget from presidents where id='${id(31)}'`))
        .rows[0].budget,
    ),
    1225,
    "Reopening must never pay twice",
  );
  await db.exec(sql("draft-outgoing"));
  assert.equal(
    await count("app.draft_release_receipts"),
    6,
    "Reinstall must not settle or reopen anything",
  );
  await login(1);
  await assert.rejects(
    db.query("select draft_prepare(4,120,false)"),
    /Cierra el draft/,
  );
  await db.query("select draft_set_status('cerrado')");
  await db.query("select draft_prepare(4,120,false)");
  assert.equal(
    (await outgoing()).locked,
    false,
    "Closing and preparing must unlock the NEXT cycle, without opening it",
  );
  await admin(
    `insert into squad_players(tournament_id,club_id,squad_id,player_id,president_id) values('${id(10)}','${id(21)}','${id(41)}','${id(101)}','${id(31)}')`,
  );
  await login(1);
  await save([id(101), id(107)]);
  await db.query("select draft_set_status('en_curso')");
  assert.equal(
    (await outgoing()).receipts.length,
    8,
    "Historical receipts survive; same player may be released in a new cycle",
  );
  await admin("select 1");
  assert.equal(
    Number(
      (await db.query(`select budget from presidents where id='${id(31)}'`))
        .rows[0].budget,
    ),
    1450,
    "Next cycle pays once, with no extra receipt for a prior-cycle transfer",
  );
  await login(2);
  assert.equal(
    (await outgoing()).receipts.length,
    0,
    "Receipts are private to the owner",
  );
  await assert.rejects(
    db.query("select * from app.draft_release_receipts"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select app.settle_draft_outgoing($1,$2)", [id(10), id(50)]),
    /permission denied/,
  );
  await login(null, "anon");
  await assert.rejects(outgoing(), /permission denied/);
  console.log(
    "PASS: saved publication, market visibility, 6-player cap, removal, current-value 75%, firm agreements on both trade sides, ownership, league isolation, atomic rollback, lineup cleanup, pending offers, private receipts, reopen/reinstall idempotence and permissions.",
  );
} finally {
  await db.close();
}
