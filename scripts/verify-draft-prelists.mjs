import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
try {
  await db.exec(`create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
    create role authenticated; create role anon;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  for (const file of [
    "schema.sql",
    "rpc.sql",
    "sheet-sync.sql",
    "views.sql",
    "rules-configuration.sql",
    "club-budgets.sql",
    "rule-edit-session.sql",
    "draft-prelists.sql",
  ])
    await db.exec(readFileSync(`supabase/${file}`, "utf8"));
  // Rerun proves deployment is idempotent.
  await db.exec(readFileSync("supabase/draft-prelists.sql", "utf8"));
  for (const n of [1, 2, 3, 4])
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      uuid(n),
      `user${n}@example.invalid`,
    ]);
  await db.exec(`insert into tournaments(id,code,name,season) values('${uuid(10)}','DRAFT','Draft test','2026'),('${uuid(11)}','OTHER','Other','2026');
    insert into tournament_rules(tournament_id) values('${uuid(10)}'),('${uuid(11)}');
    insert into tournament_admins(tournament_id,user_id,role) values('${uuid(10)}','${uuid(1)}','principal');`);
  for (const n of [1, 2, 3, 4]) {
    const tid = uuid(n === 4 ? 11 : 10);
    await db.query("update profiles set active_tournament_id=$1 where id=$2", [
      tid,
      uuid(n),
    ]);
    await db.query(
      "insert into league_members(tournament_id,user_id,role) values($1,$2,'presidente')",
      [tid, uuid(n)],
    );
    await db.query(
      "insert into clubs(id,tournament_id,name,short_name,league,country) values($1,$2,$3,'TST','Test','España')",
      [uuid(20 + n), tid, `Club ${n}`],
    );
    await db.query(
      "insert into presidents(id,tournament_id,user_id,club_id,nickname,display_name) values($1,$2,$3,$4,$5,$5)",
      [uuid(30 + n), tid, uuid(n), uuid(20 + n), `President ${n}`],
    );
    await db.query(
      "insert into squads(id,tournament_id,club_id,president_id) values($1,$2,$3,$4)",
      [uuid(40 + n), tid, uuid(20 + n), uuid(30 + n)],
    );
    await db.query(
      `insert into players(id,name,position,"group",ovr,age,value,nationality) values($1,$2,'MC','MID',82,25,100,'Colombia')`,
      [uuid(50 + n), `Player ${n}`],
    );
    await db.query(
      "insert into squad_players(tournament_id,club_id,squad_id,player_id,president_id) values($1,$2,$3,$4,$5)",
      [tid, uuid(20 + n), uuid(40 + n), uuid(50 + n), uuid(30 + n)],
    );
  }
  const login = async (n, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(n ? { sub: uuid(n), role } : {}),
    ]);
    await db.exec(`set role ${role}`);
  };
  const state = async () =>
    (await db.query("select public.draft_prelist_state() data")).rows[0].data;
  const review = async () =>
    (await db.query("select public.draft_review_state() data")).rows[0].data;
  const save = async (entries, revision = 0, submit = false, outgoing = []) =>
    (
      await db.query(
        "select public.save_draft_prelist($1::jsonb,$2::jsonb,$3,$4) revision",
        [JSON.stringify(entries), JSON.stringify(outgoing), revision, submit],
      )
    ).rows[0].revision;
  const manual = (n) => ({
    id: uuid(100 + n),
    kind: "new",
    name: `Nuevo Jugador ${n}`,
    price: 1234.56,
    ovr: 81,
    nationality: "Argentina",
    positions: ["MC", "MCO"],
  });
  const owned = {
    id: uuid(100),
    kind: "owned",
    clubId: uuid(22),
    playerId: uuid(52),
    price: 1000,
    sofifaUrl: "https://sofifa.com/player/12345/player-name/",
  };
  await login(2);
  assert.equal((await state()).limit, 6);
  assert.equal((await state()).canReview, false);
  await assert.rejects(review(), /administrador.*designado/);
  await assert.rejects(
    db.query("select public.set_draft_reviewer($1,true)", [uuid(3)]),
    /Solo Administración/,
  );
  await login(1);
  const initial = await state();
  assert.equal(initial.players.length, 2);
  assert.equal(
    initial.players.find((p) => p.id === uuid(52)).nationality,
    "Colombia",
  );
  assert.ok(
    !initial.players.some((p) => p.id === uuid(54) || p.id === uuid(51)),
  );
  await assert.rejects(
    save([{ ...owned, clubId: uuid(24), playerId: uuid(54) }]),
    /equipo vendedor/,
  );
  await assert.rejects(
    save([{ ...owned, clubId: uuid(21), playerId: uuid(51) }]),
    /equipo vendedor/,
  );
  await assert.rejects(save([{ ...owned, price: -1 }]), /precio/);
  await assert.rejects(save([{ ...owned, price: 1.001 }]), /precio/);
  await assert.rejects(
    save([
      { ...owned, sofifaUrl: "https://sofifa.com.evil.invalid/player/123" },
    ]),
    /SoFIFA/,
  );
  await assert.rejects(
    save([manual(1), { ...manual(2), positions: ["INVALID"] }]),
    /Posiciones/,
  );
  await assert.rejects(save([{ ...manual(1), ovr: 80.5 }]), /media/);
  await assert.rejects(save([owned, { ...owned, id: uuid(999) }]), /repetido/);
  await assert.rejects(
    save(Array.from({ length: 7 }, (_, n) => manual(n + 1))),
    /máximo/,
  );
  await assert.rejects(save([owned], 0, false, [uuid(52)]), /tu plantilla/);
  await db.exec("reset role");
  await assert.rejects(
    db.exec(
      `update tournament_rules set configuration='{"draft":{"maxTransfers":1.5,"extraPlayer":false}}' where tournament_id='${uuid(10)}'`,
    ),
    /Draft:/,
  );
  await db.exec(
    `update tournament_rules set configuration='{"draft":{"maxTransfers":6,"extraPlayer":true}}' where tournament_id='${uuid(10)}'`,
  );
  await login(1);
  assert.equal((await state()).limit, 7);
  let revision = await save(Array.from({ length: 7 }, (_, n) => manual(n + 1)));
  assert.equal(revision, 1);
  await assert.rejects(save([owned], 0), /cambió/);
  revision = await save([owned, manual(1)], revision, true, [uuid(51)]);
  assert.equal((await state()).status, "submitted");
  await assert.rejects(save([manual(2)], revision), /en revisión/);
  await db.query("select public.set_draft_reviewer($1,true)", [uuid(3)]);
  await login(2);
  assert.equal(
    (await state()).entries.length,
    0,
    "Other presidents must not see another prelist",
  );
  await assert.rejects(
    db.query("select public.review_draft_entry($1,$2,$3,true,'')", [
      uuid(31),
      uuid(100),
      revision,
    ]),
    /permiso/,
  );
  await assert.rejects(
    db.query("select * from app.draft_prelists"),
    /permission denied/,
  );
  await login(3);
  assert.equal((await state()).canReview, true);
  let queue = await review();
  assert.equal(queue.lists[0].entries[0].name, "Player 2");
  assert.equal(queue.lists[0].entries[0].nationality, "Colombia");
  await db.query("select public.review_draft_entry($1,$2,$3,true,'Correcto')", [
    uuid(31),
    uuid(100),
    revision,
  ]);
  await assert.rejects(
    db.query("select public.review_draft_entry($1,$2,$3,false,'Revisar')", [
      uuid(31),
      uuid(101),
      revision,
    ]),
    /cambió/,
  );
  revision++;
  await assert.rejects(
    db.query("select public.review_draft_entry($1,$2,$3,false,'')", [
      uuid(31),
      uuid(101),
      revision,
    ]),
    /motivo/,
  );
  await db.query(
    "select public.review_draft_entry($1,$2,$3,false,'Corrige la valoración')",
    [uuid(31), uuid(101), revision],
  );
  revision++;
  await login(1);
  let response = await state();
  assert.equal(response.status, "reviewed");
  assert.equal(response.entries[0].reviewStatus, "approved");
  assert.equal(response.entries[1].reviewStatus, "rejected");
  assert.equal(response.entries[1].reviewNote, "Corrige la valoración");
  await assert.rejects(
    save(response.entries, revision, true),
    /pendientes|Modifica/,
  );
  const corrected = response.entries.map((e) =>
    e.kind === "new" ? { ...e, ovr: 80, reviewStatus: "approved" } : e,
  );
  revision = await save(corrected, revision, true, response.outgoing);
  response = await state();
  assert.equal(
    response.entries[0].reviewStatus,
    "approved",
    "Unchanged approved selections remain approved",
  );
  assert.equal(
    response.entries[1].reviewStatus,
    "pending",
    "Client cannot forge approval",
  );
  await db.query("select public.set_draft_reviewer($1,false)", [uuid(3)]);
  await login(3);
  await assert.rejects(review(), /administrador.*designado/);
  await login(4);
  await assert.rejects(review(), /administrador.*designado/);
  await login(null, "anon");
  await assert.rejects(state(), /permission denied/);
  await db.exec("reset role");
  const counts = await db.query(
    "select (select count(*)::int from players) players,(select count(*)::int from squad_players) squad",
  );
  assert.deepEqual(
    counts.rows[0],
    { players: 4, squad: 4 },
    "Preselection and approvals never mutate official players or squads",
  );
  console.log(
    "Draft prelists SQL OK: privacy, real ownership, manual fields, 6+1 limits, version conflicts, delegation, approval/rejection, correction/resubmission, durable feedback and no transfers.",
  );
} catch (e) {
  console.error(
    e.message,
    e.detail ?? "",
    e.where ?? "",
    e.stack?.split("\n").slice(-3).join("\n"),
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
