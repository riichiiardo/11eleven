// Isolated PostgreSQL. No real messages, Supabase accounts or remote requests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  await db.exec(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;
    create role authenticated;create role anon;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid()to authenticated,anon;`);
  for (const name of [
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
    "chat",
    "chat",
  ])
    await db.exec(readFileSync(`supabase/${name}.sql`, "utf8"));
  for (const n of [1, 2, 3, 4, 5])
    await db.query("insert into auth.users(id,email)values($1,$2)", [
      id(n),
      `chat${n}@example.invalid`,
    ]);
  await db.exec(`insert into tournaments(id,code,name,season,market_open)values('${id(10)}','CHAT','Chat','2026',true),('${id(11)}','OTHER','Other','2026',true);
    insert into tournament_rules(tournament_id)values('${id(10)}'),('${id(11)}');
    insert into tournament_admins(tournament_id,user_id,role)values('${id(10)}','${id(1)}','principal');`);
  for (const n of [1, 2, 3, 4]) {
    const tid = id(n === 4 ? 11 : 10);
    await db.exec(`update profiles set active_tournament_id='${tid}'where id='${id(n)}';
      insert into league_members(tournament_id,user_id,role)values('${tid}','${id(n)}','presidente');
      insert into clubs(id,tournament_id,name,short_name,league,country)values('${id(20 + n)}','${tid}','Club ${n}','TST','Test','España');
      insert into presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget)values('${id(30 + n)}','${tid}','${id(n)}','${id(20 + n)}','Presidente ${n}','Test',1000);
      insert into squads(id,tournament_id,club_id,president_id)values('${id(40 + n)}','${tid}','${id(20 + n)}','${id(30 + n)}');`);
  }
  await db.exec(`insert into players(id,name,position,"group",ovr,age,value,nationality)values('${id(101)}','Jugador Uno','MC','MID',80,22,100,'España');
    insert into squad_players(tournament_id,club_id,squad_id,player_id,president_id)values('${id(10)}','${id(21)}','${id(41)}','${id(101)}','${id(31)}');`);
  const login = async (n, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify(n ? { sub: id(n), role } : {}),
    ]);
    await db.exec(`set role ${role}`);
  };
  const call = async (sql, args = []) =>
    (await db.query(sql, args)).rows[0]?.data;
  const inbox = () => call("select chat_inbox()data");
  const history = (kind, target = null, before = null) =>
    call("select chat_history($1,$2,$3)data", [kind, target, before]);
  let seq = 1000;
  const send = (kind, target, body, token = id(++seq)) =>
    call("select chat_send($1,$2,$3,$4)data", [kind, target, body, token]);
  const denied = async (task, reason) => {
    await assert.rejects(task, reason);
    checks++;
  };
  await login(1);
  await denied(db.query("select chat_inbox($1)", [id(11)]), /Universo cambió/);
  await denied(
    db.query("select chat_history('general',null,null,null,$1)", [id(11)]),
    /Universo cambió/,
  );
  await denied(
    db.query("select chat_send('general',null,'stale Universe',$1,$2)", [
      id(++seq),
      id(11),
    ]),
    /Universo cambió/,
  );
  ok((await inbox()).unread === 0, "Installation must not invent old messages");
  ok(
    (await inbox()).contacts.length === 2,
    "Only other presidents in this Universe",
  );
  ok(
    (await history("general")).messages.length === 0,
    "Empty conversation is a valid result",
  );
  await denied(send("general", null, "   "), /1 a 2000/);
  await denied(send("general", null, "a".repeat(2001)), /1 a 2000/);
  await denied(send("bot", null, "Soy el bot"), /Solo el servidor/);
  await denied(send(null, null, "bad"), /Tipo/);
  await denied(send("direct", id(31), "self"), /destinatario/);
  await denied(send("direct", id(34), "other Universe"), /destinatario/);
  const token = id(++seq);
  const generalId = await send("general", null, "Hola Universo", token);
  ok(
    (await send("general", null, "Hola Universo", token)) === generalId,
    "Retry returns original persisted message",
  );
  await denied(send("general", null, "Otra cosa", token), /reutilizado/);
  ok(
    (await history("general")).messages.length === 1,
    "Retries cannot duplicate messages",
  );
  const dm = await send("direct", id(32), "Mensaje privado");
  await login(2);
  ok(
    (await history("direct", id(31))).messages[0].id === dm,
    "Both sides share one DM",
  );
  ok(
    (await inbox()).unread === 2,
    "General and private incoming messages counted",
  );
  await db.query("select chat_mark_read('direct',$1,$2)", [id(31), dm]);
  ok(
    (await inbox()).unread === 1,
    "Reading only clears the chosen conversation",
  );
  await denied(
    db.query("select chat_mark_read('general',null,$1)", [dm]),
    /no pertenece/,
  );
  await login(1);
  ok((await inbox()).unread === 0, "Own messages do not count unread");
  await login(3);
  ok(
    !(await inbox()).threads.some((t) => t.kind === "direct"),
    "A third president cannot see private threads",
  );
  ok(
    (await history("direct", id(32))).messages.length === 0,
    "Cannot read another pair by changing target",
  );
  await send("direct", id(32), "Otro privado");
  await login(1);
  ok(
    !(await inbox()).threads.some((t) => t.preview === "Otro privado"),
    "Administrator has no special access to other DMs",
  );
  await login(4);
  ok(
    (await inbox()).unread === 0 &&
      (await history("general")).messages.length === 0,
    "Universe isolation includes general room",
  );
  await login(1);
  await db.query("select save_draft_prelist('[]',$1,0,false)", [
    JSON.stringify([id(101)]),
  ]);
  await login(2);
  const offerId = (
    await db.query("select place_departure_bid($1,100)id", [id(101)])
  ).rows[0].id;
  ok(
    (await history("offer", offerId)).messages[0].body.includes("Jugador Uno"),
    "Creating a real offer opens its context thread",
  );
  await send("offer", offerId, "¿Aceptas 100 €?");
  await login(1);
  const offered = await history("offer", offerId);
  ok(
    offered.messages.length === 2 && offered.offer.cash === 100,
    "Seller gets the offer event and private discussion",
  );
  await db.query("select respond_offer($1,'rechazar')", [offerId]);
  ok(
    (await history("offer", offerId)).messages.some(
      (m) => m.metadata.status === "rechazada",
    ),
    "Offer decision produces a server event",
  );
  await login(3);
  await denied(history("offer", offerId), /No tienes acceso/);
  await login(4);
  await denied(history("offer", offerId), /No tienes acceso/);
  await db.exec("reset role");
  await db.exec(
    `insert into fixtures(id,tournament_id,matchday,home_club_id,away_club_id,kickoff_at)values('${id(200)}','${id(10)}',1,'${id(21)}','${id(22)}','2026-10-24T18:00:00Z')`,
  );
  await login(1);
  ok(
    (await history("bot")).messages.some(
      (m) =>
        m.metadata.event === "fixture" && m.body.includes("Club 1 vs Club 2"),
    ),
    "Scheduled fixture informs both presidents",
  );
  const goals = JSON.stringify([
    { clubId: id(21), playerId: id(101), count: 2 },
  ]);
  await db.query("select report_fixture($1,2,0,$2,'[]','[]','[]')", [
    id(200),
    goals,
  ]);
  const bot = await history("bot");
  ok(
    bot.messages.some(
      (m) =>
        m.metadata.event === "result" &&
        m.body.includes("2–0") &&
        m.body.includes("Jugador Uno ×2"),
    ),
    "Bot uses recorded score and scorers",
  );
  await db.query("select report_fixture($1,2,0,$2,'[]','[]','[]')", [
    id(200),
    goals,
  ]);
  ok(
    (await history("bot")).messages.length === bot.messages.length,
    "Saving an identical result cannot duplicate the notice",
  );
  await db.query("select report_fixture($1,1,0,$2,'[]','[]','[]')", [
    id(200),
    JSON.stringify([{ clubId: id(21), playerId: id(101), count: 1 }]),
  ]);
  ok(
    (await history("bot")).messages.some(
      (m) => m.body.includes("corregido") && m.body.includes("1–0"),
    ),
    "Result corrections are explicit",
  );
  const beforeNextRound = (await history("bot")).messages.length;
  await db.exec("reset role");
  await db.exec(
    `insert into fixtures(id,tournament_id,matchday,home_club_id,away_club_id,kickoff_at)values('${id(201)}','${id(10)}',2,'${id(21)}','${id(22)}','2026-10-27T18:00:00Z')`,
  );
  await db.exec(
    `update tournaments set total_matchdays=3 where id='${id(10)}'`,
  );
  await login(1);
  ok(
    (await history("bot")).messages.length === beforeNextRound,
    "Future rounds must not flood the bot inbox",
  );
  await db.query("select close_matchday()");
  ok(
    (await history("bot")).messages.some(
      (m) => m.metadata.fixtureId === id(201) && m.metadata.event === "fixture",
    ),
    "Advancing the matchday announces the next real fixture",
  );
  await login(2);
  ok(
    (await history("bot")).messages.some((m) => m.metadata.event === "result"),
    "Opponent receives the result",
  );
  await login(3);
  ok(
    (await history("bot")).messages.length === 0,
    "Unrelated team cannot see private team results",
  );
  for (let i = 0; i < 59; i++) await send("general", null, `Historial ${i}`);
  await denied(send("general", null, "too many"), /Espera un minuto/);
  const page = await history("general");
  ok(
    page.messages.length === 50 && page.hasMore,
    "History is bounded and paginated",
  );
  const older = await history("general", null, page.messages[0].id);
  ok(
    older.messages.length === 10 && !older.hasMore,
    "Cursor reaches all older messages without gaps",
  );
  ok(
    new Set([...older.messages, ...page.messages].map((m) => m.id)).size === 60,
    "No duplicates between pages",
  );
  const burst = (
    await db.query("select chat_history('general',null,null,$1)data", [
      generalId,
    ])
  ).rows[0].data;
  ok(
    burst.messages.length === 50 && burst.hasNewer,
    "A burst is fetched from its beginning, not silently truncated",
  );
  const tail = (
    await db.query("select chat_history('general',null,null,$1)data", [
      burst.messages[49].id,
    ])
  ).rows[0].data;
  ok(
    tail.messages.length === 9 && !tail.hasNewer,
    "Forward cursor drains the remaining burst without losing messages",
  );
  await denied(db.query("select chat_history('general',null,1,2)"), /Cursor/);
  const last = page.messages[49].id;
  await db.query("select chat_mark_read('general',null,$1)", [last]);
  await db.query("select chat_mark_read('general',null,$1)", [generalId]);
  await login(1);
  await login(3);
  ok(
    !(await inbox()).threads.find((t) => t.kind === "general")?.unread,
    "Read state persists and cannot regress",
  );
  for (const table of ["chat_threads", "chat_messages", "chat_reads"])
    await denied(db.query(`select * from app.${table}`), /permission denied/);
  await denied(db.query("select app.chat_me()"), /permission denied/);
  await denied(
    db.query("select app.chat_resolve('general',null,true)"),
    /permission denied/,
  );
  await denied(
    db.query(
      "select app.chat_bot_post($1,'bot',$2,$3,null,null,'forged','{}','forged')",
      [id(10), id(33), id(33)],
    ),
    /permission denied/,
  );
  await login(null, "anon");
  await denied(inbox(), /permission denied/);
  await denied(history("general"), /permission denied/);
  await denied(send("general", null, "anonymous"), /permission denied/);
  await login(5);
  await denied(inbox(), /Selecciona/);
  await login(null);
  await denied(inbox(), /iniciar sesión/);
  await login(1);
  const before = (await history("offer", offerId)).messages.length;
  await db.exec("reset role");
  await db.exec(readFileSync("supabase/chat.sql", "utf8"));
  await login(1);
  ok(
    (await history("offer", offerId)).messages.length === before,
    "Reinstall preserves history",
  );
  await db.exec("reset role");
  await db.exec(
    `delete from league_members where tournament_id='${id(10)}'and user_id='${id(2)}'`,
  );
  await login(2);
  await denied(inbox(), /Selecciona/);
  console.log(
    `PASS chat PostgreSQL: ${checks} assertions; general/DM/offer/bot, real offer and result RPCs, corrections, retry idempotency, pagination, read ownership, rate limit, tenant isolation, anonymous/removed-member/internal-writer denial, reinstall without data loss.`,
  );
} finally {
  await db.close();
}
