import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { accountHandler } from "../supabase/functions/president-accounts/handler.ts";
import { parseAccountInput } from "../src/domain/account-management.ts";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const db = new PGlite();
const passwords = new Map();
let writes = 0;
let next = 100;
let failComplete = false;
let failCreate = false;
let lastUpdate;
const owner = async (sql, args = []) => {
  await db.exec("reset role");
  return db.query(sql, args);
};
const service = async (sql, args = []) => {
  await db.exec("set role service_role");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
};
try {
  await db.exec(
    "create schema auth;create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;create role authenticated;create role anon;create role service_role;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  for (const name of ["schema", "rpc", "sheet-sync", "president-accounts"])
    await db.exec(readFileSync(`supabase/${name}.sql`, "utf8"));
  await db.exec(readFileSync("supabase/president-accounts.sql", "utf8"));
  for (const n of [1, 2, 3, 4, 5])
    await db.query("insert into auth.users(id,email)values($1,$2)", [
      id(n),
      `user${n}@example.invalid`,
    ]);
  await db.exec(
    `insert into public.tournaments(id,code,name,season)values('${id(10)}','TEST','Test','2026'),('${id(11)}','OTHER','Other','2026');update public.profiles set active_tournament_id='${id(10)}';insert into public.tournament_rules(tournament_id)values('${id(10)}');insert into public.tournament_admins(tournament_id,user_id,role)values('${id(10)}','${id(1)}','principal'),('${id(10)}','${id(2)}','coAdmin'),('${id(11)}','${id(5)}','principal');`,
  );
  for (const n of [1, 2, 3, 4, 5])
    await db.query(
      "insert into public.league_members(tournament_id,user_id,role)values($1,$2,'presidente')",
      [id(n === 4 ? 11 : 10), id(n)],
    );
  for (const n of [3, 4, 5])
    await db.query(
      "insert into public.presidents(tournament_id,user_id,nickname,display_name,budget)values($1,$2,'Test','Test',1234)",
      [id(n === 4 ? 11 : 10), id(n)],
    );
  const gateway = {
    async authenticate(token) {
      return /^user[1-5]$/.test(token) ? id(Number(token.slice(4))) : null;
    },
    async authorize(actor, tournament, target) {
      await service("select public.president_account_authorize($1,$2,$3)", [
        actor,
        tournament,
        target ?? null,
      ]);
    },
    async create(email, password) {
      writes++;
      if (failCreate) return { data: null, error: { code: "email_exists" } };
      const uid = id(next++);
      await owner("insert into auth.users(id,email)values($1,$2)", [
        uid,
        email,
      ]);
      passwords.set(uid, password);
      return { data: { id: uid }, error: null };
    },
    async update(uid, email, password) {
      writes++;
      lastUpdate = { uid, email, password };
      await owner("update auth.users set email=$1 where id=$2", [email, uid]);
      if (password) passwords.set(uid, password);
      return { data: { id: uid }, error: null };
    },
    async complete(actor, tournament, target, action, passwordChanged) {
      if (failComplete) throw Error("db unavailable");
      await service(
        "select public.president_account_complete($1,$2,$3,$4,$5)",
        [actor, tournament, target, action, passwordChanged],
      );
    },
    async rollbackNew(uid) {
      await owner("delete from auth.users where id=$1", [uid]);
      passwords.delete(uid);
      return true;
    },
  };
  const handler = accountHandler(gateway);
  const call = async (body, token = "user1", headers = {}) => {
    const response = await handler(
      new Request("https://example.invalid", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          origin: "http://127.0.0.1:5195",
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, data: await response.json() };
  };
  assert.equal(
    (await call({ action: "check", tournamentId: id(10) })).status,
    200,
  );
  assert.equal(
    (await call({ action: "check", tournamentId: id(10) }, "user2")).status,
    403,
  );
  assert.equal(writes, 0);
  const create = {
    action: "create",
    tournamentId: id(10),
    email: "  New@Example.invalid ",
    password: "Test1!",
  };
  for (const token of ["bad", "user2", "user3"]) {
    const r = await call(create, token);
    assert.ok([401, 403].includes(r.status));
  }
  assert.equal(writes, 0);
  assert.equal((await call({ ...create, tournamentId: id(11) })).status, 403);
  assert.equal(writes, 0);
  assert.equal((await call({ ...create, password: "short" })).status, 400);
  assert.equal((await call({ ...create, is_admin: true })).status, 400);
  assert.equal(writes, 0);
  assert.equal(
    (await call(create, "user1", { origin: "https://evil.invalid" })).status,
    403,
  );
  assert.equal(
    (await call(create, "user1", { "content-length": "99999" })).status,
    413,
  );
  let result = await call(create);
  assert.equal(result.status, 200);
  const target = result.data.userId;
  assert.ok(!JSON.stringify(result).includes(create.password));
  let pres = (
    await owner("select * from public.presidents where user_id=$1", [target])
  ).rows[0];
  assert.equal(pres.club_id, null);
  assert.equal(pres.budget, "0");
  assert.equal(pres.tournament_id, id(10));
  assert.equal(
    (await owner("select email from public.profiles where id=$1", [target]))
      .rows[0].email,
    "new@example.invalid",
  );
  const before = JSON.stringify(
    (await owner("select * from public.presidents order by id")).rows,
  );
  result = await call({
    action: "update",
    tournamentId: id(10),
    userId: target,
    email: "changed@example.invalid",
  });
  assert.equal(result.status, 200);
  assert.equal(lastUpdate.password, undefined);
  assert.equal(passwords.get(target), "Test1!");
  assert.equal(
    (await owner("select email from public.profiles where id=$1", [target]))
      .rows[0].email,
    "changed@example.invalid",
  );
  result = await call({
    action: "update",
    tournamentId: id(10),
    userId: target,
    email: "changed@example.invalid",
    password: "NewTest2!",
  });
  assert.equal(result.status, 200);
  assert.equal(passwords.get(target), "NewTest2!");
  assert.equal(
    before,
    JSON.stringify(
      (await owner("select * from public.presidents order by id")).rows,
    ),
  );
  for (const targetUser of [1, 2, 4, 5])
    assert.equal(
      (
        await call({
          action: "update",
          tournamentId: id(10),
          userId: id(targetUser),
          email: "other@example.invalid",
          password: "Change3!",
        })
      ).status,
      403,
    );
  failCreate = true;
  const countBefore = (await owner("select count(*) from auth.users")).rows[0]
    .count;
  assert.equal((await call(create)).status, 409);
  assert.equal(
    (await owner("select count(*) from auth.users")).rows[0].count,
    countBefore,
  );
  failCreate = false;
  failComplete = true;
  assert.equal(
    (await call({ ...create, email: "rollback@example.invalid" })).status,
    500,
  );
  assert.equal(
    (
      await owner(
        "select count(*) from auth.users where email='rollback@example.invalid'",
      )
    ).rows[0].count,
    0,
  );
  failComplete = false;
  const audit = (await owner("select action,detail from public.audit_log"))
    .rows;
  assert.equal(audit.filter((a) => a.action === "cuenta.creada").length, 1);
  assert.equal(
    audit.filter((a) => a.action === "cuenta.actualizada").length,
    2,
  );
  assert.ok(!JSON.stringify(audit).includes("NewTest2!"));
  assert.ok(!JSON.stringify(audit).includes("Test1!"));
  await db.exec("set role authenticated");
  await assert.rejects(
    db.query("select public.president_account_authorize($1,$2,null)", [
      id(1),
      id(10),
    ]),
    /permission denied/,
  );
  await db.exec("set role anon");
  await assert.rejects(
    db.query(
      "select public.president_account_complete($1,$2,$3,'create',true)",
      [id(1), id(10), id(3)],
    ),
    /permission denied/,
  );
  await db.exec("reset role");
  assert.throws(() => parseAccountInput({ ...create, password: "NoDigits!" }));
  assert.throws(() =>
    parseAccountInput({ ...create, password: "Nouppercase1" }),
  );
  assert.throws(() => parseAccountInput({ ...create, email: "not-an-email" }));
  console.log(
    "PASS president accounts: principal-only server gate, same universe, protected admin accounts, real membership/presidency creation, Auth email/profile synchronization, optional password preservation and replacement, no team/budget mutations, sanitized failures, new-account rollback, duplicate refusal, no credentials in responses/audit, denied direct RPC and invalid inputs. Auth admin calls use an isolated gateway, not production accounts.",
  );
} finally {
  await db.close();
}
