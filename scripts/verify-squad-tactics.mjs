import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const login = async (n, role = "authenticated") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(n ? { sub: id(n) } : {}),
  ]);
  await db.exec("set role " + role);
};
try {
  await db.exec(
    "create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;create role authenticated;create role anon;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  for (const file of ["schema", "rpc", "squad-tactics"])
    await db.exec(readFileSync(`supabase/${file}.sql`, "utf8"));
  await db.exec(
    `insert into auth.users(id,email)values('${id(1)}','one@example.invalid'),('${id(2)}','two@example.invalid');insert into public.tournaments(id,code,name,season)values('${id(10)}','TACT','Tactics','2026'),('${id(11)}','OTHER','Other','2026');insert into public.tournament_rules(tournament_id)values('${id(10)}');update public.profiles set active_tournament_id='${id(10)}';insert into public.clubs(id,tournament_id,name,short_name,league,country)values('${id(20)}','${id(10)}','One','ONE','L','España'),('${id(21)}','${id(10)}','Two','TWO','L','España');insert into public.presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget)values('${id(30)}','${id(10)}','${id(1)}','${id(20)}','One','One',0),('${id(31)}','${id(10)}','${id(2)}','${id(21)}','Two','Two',0);insert into public.squads(id,tournament_id,club_id,president_id,formation,lineup)values('${id(40)}','${id(10)}','${id(20)}','${id(30)}','4-2-3-1','[]'),('${id(41)}','${id(10)}','${id(21)}','${id(31)}','4-3-3','[]');`,
  );
  const before = (await db.query("select * from public.tournament_rules")).rows;
  await login(1);
  const get = () => db.query("select public.squad_tactics($1) value", [id(20)]);
  const save = (code, instructions = "Minuto 60: cambio de extremo") =>
    db.query("select public.save_squad_tactics($1,$2,$3) value", [
      id(20),
      code,
      instructions,
    ]);
  assert.deepEqual((await get()).rows[0].value, { code: "", instructions: "" });
  assert.equal((await save("  AbC!27-XyZ  ")).rows[0].value.code, "AbC!27-XyZ");
  assert.equal((await get()).rows[0].value.code, "AbC!27-XyZ");
  await assert.rejects(save("x".repeat(65)));
  await assert.rejects(save("ok", "x".repeat(4001)));
  await assert.rejects(save("bad\ncode"));
  await assert.rejects(
    db.query("select public.save_squad_tactics($1,$2,$3)", [
      id(21),
      "foreign",
      "",
    ]),
  );
  await login(2);
  await assert.rejects(get());
  await assert.rejects(save("foreign"));
  await login(null, "anon");
  await assert.rejects(get());
  await assert.rejects(save("anonymous"));
  await db.exec("reset role");
  await db.query(
    "update public.profiles set active_tournament_id=$1 where id=$2",
    [id(11), id(1)],
  );
  await login(1);
  await assert.rejects(save("wrong universe"));
  await db.exec("reset role");
  await db.query(
    "update public.profiles set active_tournament_id=$1 where id=$2",
    [id(10), id(1)],
  );
  await login(1);
  assert.equal((await get()).rows[0].value.code, "AbC!27-XyZ");
  await save("", "");
  assert.deepEqual((await get()).rows[0].value, { code: "", instructions: "" });
  await db.exec("reset role");
  assert.deepEqual(
    (await db.query("select * from public.tournament_rules")).rows,
    before,
  );
  const squad = (
    await db.query("select formation,lineup from public.squads where id=$1", [
      id(40),
    ])
  ).rows[0];
  assert.equal(squad.formation, "4-2-3-1");
  assert.deepEqual(squad.lineup, []);
  await db.exec(readFileSync("supabase/squad-tactics.sql", "utf8"));
  console.log(
    "PASS squad tactics: independent persistence and clearing, ordinary president access, reload, unchanged formation/lineup/rules, foreign club/universe/anonymous denial, validation and reinstall.",
  );
} finally {
  await db.close();
}
