// Disposable local PostgreSQL only. No real accounts, bids or budgets.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
try {
  await db.exec(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
    create role authenticated;create role anon;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for (const file of [
    "schema",
    "rpc",
    "sheet-sync",
    "views",
    "rules-configuration",
    "club-budgets",
    "rule-edit-session",
    "draft-prelists",
    "draft-outgoing",
    "draft-bids",
    "draft-bids",
  ])
    await db.exec(readFileSync(`supabase/${file}.sql`, "utf8"));
  for (const n of [1, 2, 3, 4])
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id(n),
      `bids${n}@example.invalid`,
    ]);
  await db.exec(`insert into tournaments(id,code,name,season) values('${id(10)}','BIDS','Pujas','2026'),('${id(11)}','OTHER','Other','2026');
    insert into tournament_rules(tournament_id) values('${id(10)}'),('${id(11)}');
    insert into tournament_admins(tournament_id,user_id,role) values('${id(10)}','${id(1)}','principal');`);
  for (const n of [1, 2, 3, 4]) {
    const tid = id(n === 4 ? 11 : 10);
    await db.exec(`update profiles set active_tournament_id='${tid}' where id='${id(n)}';
      insert into league_members(tournament_id,user_id,role) values('${tid}','${id(n)}','presidente');
      insert into clubs(id,tournament_id,name,short_name,league,country) values('${id(20 + n)}','${tid}','Club ${n}','TST','Test','España');
      insert into presidents(id,tournament_id,user_id,club_id,nickname,display_name) values('${id(30 + n)}','${tid}','${id(n)}','${id(20 + n)}','President ${n}','Test');
      insert into squads(id,tournament_id,club_id,president_id) values('${id(40 + n)}','${tid}','${id(20 + n)}','${id(30 + n)}');`);
  }
  await db.exec(`update presidents set budget=1000;
    insert into players(id,name,position,"group",ovr,age,value,nationality) values('${id(101)}','Jugador Anunciado','MC','MID',82,25,100,'Colombia'),('${id(102)}','Jugador Sin Anunciar','DC','FWD',80,22,100,'España');
    insert into squad_players(tournament_id,club_id,squad_id,player_id,president_id) values('${id(10)}','${id(21)}','${id(41)}','${id(101)}','${id(31)}'),('${id(10)}','${id(21)}','${id(41)}','${id(102)}','${id(31)}');`);
  const login = async (n, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(n ? { sub: id(n), role } : {}),
    ]);
    await db.exec(`set role ${role}`);
  };
  const board = async () =>
    (await db.query("select departure_bids() data")).rows[0].data;
  const inbox = async () =>
    (await db.query("select transfer_notifications_state() data")).rows[0].data;
  const bid = async (amount, pid = id(101)) =>
    (await db.query("select place_departure_bid($1,$2) id", [pid, amount]))
      .rows[0].id;
  await login(1);
  await db.query("select save_draft_prelist('[]',$1,0,false)", [
    JSON.stringify([id(101)]),
  ]);
  assert.equal(
    (await inbox()).unread,
    0,
    "Installing/publishing must not fabricate bids",
  );
  await assert.rejects(bid(50), /no está disponible/);
  await login(2);
  await assert.rejects(bid(0), /positivo/);
  await assert.rejects(bid(1001), /Presupuesto/);
  await assert.rejects(bid(20, id(102)), /no está disponible/);
  const first = await bid(100);
  assert.equal((await board())[0].highestCash, 100);
  assert.deepEqual(
    (await board())[0].offers,
    [],
    "Buyers cannot see competitors identities or individual offers",
  );
  await login(3);
  const second = await bid(200);
  assert.equal((await board())[0].count, 2);
  await assert.rejects(
    db.query("select respond_offer($1,'aceptar')", [first]),
    /Solo el vendedor/,
  );
  await login(2);
  assert.ok(
    (await inbox()).items.some((n) => n.message.includes("superado tu puja")),
  );
  assert.equal(
    await bid(250),
    first,
    "Raising replaces the existing bid, not a second cash commitment",
  );
  assert.equal(
    await bid(950),
    first,
    "Improving must release the previous cash commitment before checking budget",
  );
  await assert.rejects(bid(249), /superar tu oferta/);
  await login(4);
  assert.deepEqual(
    await board(),
    [],
    "Another league must not see our bidding board",
  );
  assert.equal((await inbox()).unread, 0);
  await assert.rejects(bid(500), /no está disponible/);
  await login(1);
  let sellerBoard = (await board())[0];
  assert.equal(sellerBoard.offers.length, 2);
  assert.equal(sellerBoard.offers[0].cash, 950);
  assert.equal(sellerBoard.offers[0].club, "Club 2");
  // A multi-player operation is not a comparable individual cash price.
  await db.exec("reset role");
  await db.exec(
    `update tournaments set market_open=true where id='${id(10)}';update presidents set budget=2000 where id='${id(33)}'`,
  );
  await login(3);
  await db.query(
    "select create_offer('cash',$1,'{}',1200,'Paquete de dos jugadores')",
    [[id(101), id(102)]],
  );
  await login(1);
  const packagedBoard = (await board())[0];
  assert.equal(
    packagedBoard.highestCash,
    950,
    "A package amount must not inflate the individual highest bid",
  );
  assert.ok(
    packagedBoard.offers.some(
      (o) => o.package && o.cash === 1200 && o.requested.length === 2,
    ),
  );
  const notices = await inbox();
  assert.ok(notices.unread >= 3);
  await db.query("select read_transfer_notifications($1)", [
    notices.items.map((n) => n.id),
  ]);
  assert.equal((await inbox()).unread, 0);
  await login(2);
  const buyerNotices = await inbox();
  await login(1);
  await db.query("select read_transfer_notifications($1)", [
    buyerNotices.items.map((n) => n.id),
  ]);
  await login(2);
  assert.equal(
    (await inbox()).unread,
    buyerNotices.unread,
    "Owners cannot mark another presidents notifications read",
  );
  // Seller deliberately chooses the LOWER bid. There is no automatic highest-bid winner.
  await login(1);
  await db.query("select respond_offer($1,'aceptar')", [second]);
  sellerBoard = (await board())[0];
  assert.equal(sellerBoard.closed, true);
  assert.equal(sellerBoard.offers.length, 1);
  assert.equal(sellerBoard.offers[0].cash, 200);
  assert.equal(sellerBoard.offers[0].status, "reservada");
  await assert.rejects(
    db.query("select respond_offer($1,'aceptar')", [first]),
    /no admite respuesta/,
  );
  await login(2);
  await assert.rejects(bid(350), /cerró un acuerdo/);
  assert.ok(
    (await inbox()).items.some((n) => n.message.includes("invalidada")),
  );
  await assert.rejects(
    db.query("select * from app.transfer_notifications"),
    /permission denied/,
  );
  await db.exec("reset role");
  assert.equal((await db.query("select count(*) n from offers")).rows[0].n, 3);
  assert.equal(
    (
      await db.query(
        `select president_id from squad_players where player_id='${id(101)}'`,
      )
    ).rows[0].president_id,
    id(31),
    "Accepting reserves, never transfers automatically",
  );
  assert.equal(
    Number(
      (await db.query(`select budget from presidents where id='${id(31)}'`))
        .rows[0].budget,
    ),
    1000,
  );
  await db.exec(`update tournaments set market_open=true where id='${id(10)}'`);
  await login(2);
  await assert.rejects(
    db.query("select create_offer('cash',$1,'{}',300,'competidora')", [
      [id(101)],
    ]),
    /Ya existe un acuerdo/,
    "The legacy offer entrypoint cannot bypass the closed auction",
  );
  await login(null, "anon");
  await assert.rejects(board(), /permission denied/);
  await assert.rejects(inbox(), /permission denied/);
  await assert.rejects(bid(300), /permission denied/);
  console.log(
    "PASS draft bids: competing bids, improvements without duplicate commitments, current offers and seller-only details, outbid/decision notifications, durable owner-only read state, budget and ownership checks, league isolation, seller choosing a lower bid, competing closure, legacy bypass refused, no automatic transfer, anonymous access refused.",
  );
} finally {
  await db.close();
}
