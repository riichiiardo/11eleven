/**
 * Validador local de los scripts SQL de supabase/ contra Postgres real (PGlite).
 * Simula el entorno de Supabase: schema auth (users + uid() + role()) y rol authenticated.
 * Uso: bun scripts/validate-sql.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();

async function run(sql: string, label: string): Promise<void> {
  try {
    await db.exec(sql);
    console.log(`✅ ${label}`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const position = (cause as { position?: string | number })?.position;
    console.error(`❌ ${label}: ${message}`);
    if (position) {
      const pos = Number(position);
      const upto = sql.slice(0, pos);
      const line = upto.split("\n").length;
      const lines = sql.split("\n");
      console.error(`   → línea ${line} del script:`);
      for (
        let i = Math.max(0, line - 4);
        i < Math.min(lines.length, line + 3);
        i++
      ) {
        console.error(
          `   ${i + 1 === line ? "→" : " "}${String(i + 1).padStart(4)} | ${lines[i]}`,
        );
      }
    }
    process.exit(1);
  }
}

// --- Stub del entorno Supabase ---------------------------------------------
await run(`create schema if not exists auth;`, "create schema auth");
await run(
  `create table if not exists auth.users (
     id uuid primary key,
     email text,
     raw_user_meta_data jsonb not null default '{}'::jsonb,
     created_at timestamptz not null default now()
   );`,
  "create auth.users",
);
await run(
  `create or replace function auth.uid() returns uuid
   language sql stable as $$
     select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
   $$;`,
  "create auth.uid()",
);
await run(
  `create or replace function auth.role() returns text
   language sql stable as $$
     select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'anon')
   $$;`,
  "create auth.role()",
);
await run(
  `do $$ begin
     if not exists (select 1 from pg_roles where rolname = 'authenticated') then
       create role authenticated nologin;
     end if;
     if not exists (select 1 from pg_roles where rolname = 'anon') then
       create role anon nologin;
     end if;
   end $$;`,
  "roles authenticated/anon",
);

// --- Scripts reales del proyecto -------------------------------------------
await run(readFileSync("supabase/schema.sql", "utf8"), "schema.sql");
await run(readFileSync("supabase/rpc.sql", "utf8"), "rpc.sql");
await run(readFileSync("supabase/sheet-sync.sql", "utf8"), "sheet-sync.sql");
await run(readFileSync("supabase/views.sql", "utf8"), "views.sql");
await run(
  readFileSync("supabase/rules-configuration.sql", "utf8"),
  "rules-configuration.sql",
);
await run(readFileSync("supabase/seed.sql", "utf8"), "seed.sql");
await run(
  readFileSync("supabase/club-budgets.sql", "utf8"),
  "club-budgets.sql",
);

await run(
  readFileSync("supabase/rule-edit-session.sql", "utf8"),
  "rule-edit-session.sql",
);

// --- Smoke tests ligeros ----------------------------------------------------
const smoke = await db.query<{
  ok_uid: boolean;
  ok_admin: boolean;
  ok_president: boolean;
}>(
  `select
     public.my_uid() is null as ok_uid,
     public.is_admin(null::uuid) = false as ok_admin,
     public.my_president_id(null::uuid) is null as ok_president;`,
);
console.log("🧪 smoke helpers:", JSON.stringify(smoke.rows[0]));

const uid = "00000000-0000-0000-0000-000000000001";
const tid = "00000000-0000-0000-0000-000000000002";
const pres = "00000000-0000-0000-0000-000000000003";
const club = "00000000-0000-0000-0000-000000000004";
await db.exec(`insert into auth.users(id,email) values('${uid}','rules-test@example.invalid');
insert into public.tournaments(id,code,name,season) values('${tid}','RULES-TEST','Test Universe','2026');
insert into public.tournament_rules(tournament_id) values('${tid}');
insert into public.tournament_admins(tournament_id,user_id,role) values('${tid}','${uid}','principal');
update public.profiles set active_tournament_id='${tid}' where id='${uid}';
select set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',false);
insert into public.clubs(id,tournament_id,name,short_name,league,country) values('${club}','${tid}','Test Club','TST','Test','México');
insert into public.presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget) values('${pres}','${tid}','${uid}','${club}','Test','Test',1000000);
insert into public.squads(tournament_id,club_id,president_id) values('${tid}','${club}','${pres}');
insert into public.players(name,position,"group",ovr,age,value,nationality,real_club,real_league,fc_version)
select 'Test player '||i,'MC','MID',80,case when i=1 then 19 else 25 end,100,case when i<=2 then 'México' else 'España' end,'Test Club','Test','FC27' from generate_series(1,11) i;
insert into public.squad_players(tournament_id,club_id,squad_id,player_id,president_id)
select '${tid}','${club}',s.id,p.id,'${pres}' from public.players p cross join public.squads s where p.name like 'Test player %' and s.club_id='${club}';`);
const range = { enabled: true, min: 0, max: 30 };
const competition = {
  id: "league",
  name: "League",
  kind: "league",
  rounds: 2,
  playoffTeams: 8,
  promotions: 0,
  relegations: 0,
  promotionTarget: "",
  relegationTarget: "",
  u20: { enabled: true, min: 1, max: 11 },
  nationals: { enabled: true, min: 2, max: 11 },
  nationality: "Mexico",
  customRules: [],
};
const configuration = {
  budget: 1000000.25,
  squadSize: 30,
  lineupLockHours: 2,
  groups: {
    GK: { ...range, enabled: false },
    DEF: range,
    MID: range,
    FWD: range,
  },
  realClub: range,
  activeCompetitionId: "league",
  competitions: [competition],
  customRules: [],
};
const saveConfig = (c: unknown) =>
  db.query("select public.save_rule_configuration($1::jsonb,'4-2-3-1')", [
    JSON.stringify(c),
  ]);
await saveConfig(configuration);
const persisted = await db.query<{ rules: Record<string, unknown> }>(
  "select public.rules_json(r) rules from public.tournament_rules r where tournament_id=$1",
  [tid],
);
assert.equal(persisted.rows[0].rules.budget, 1000000.25);
assert.equal(persisted.rows[0].rules.gkMin, 0);
assert.equal(persisted.rows[0].rules.gkMax, 30);
assert.deepEqual(persisted.rows[0].rules.configuration, configuration);
await assert.rejects(
  saveConfig({
    ...configuration,
    groups: { ...configuration.groups, GK: { enabled: true, min: 4, max: 1 } },
  }),
  /Rango inválido/,
);
const lineup = await db.query<{ slots: unknown }>(
  "select jsonb_agg(jsonb_build_object('slotId',p.name,'playerId',p.id)) slots from public.players p where p.name like 'Test player %'",
);
const saveLineup = () =>
  db.query("select public.save_lineup('4-2-3-1',$1::jsonb)", [
    JSON.stringify(lineup.rows[0].slots),
  ]);
await saveLineup();
await saveConfig({
  ...configuration,
  competitions: [{ ...competition, u20: { enabled: true, min: 2, max: 11 } }],
});
await assert.rejects(saveLineup(), /R-11/);
await saveConfig({
  ...configuration,
  competitions: [
    { ...competition, nationals: { enabled: true, min: 3, max: 11 } },
  ],
});
await assert.rejects(saveLineup(), /R-12/);
await saveConfig({
  ...configuration,
  customRules: [
    {
      id: "value-limit",
      title: "Valor máximo",
      enabled: true,
      scope: "xi",
      metric: "totalValue",
      parameter: "",
      min: 0,
      max: 500,
    },
  ],
});
await assert.rejects(saveLineup(), /Valor máximo/);
await saveConfig({
  ...configuration,
  groups: { ...configuration.groups, GK: { enabled: true, min: 1, max: 3 } },
});
await assert.rejects(saveLineup(), /Cupo GK/);
await saveConfig(configuration);
await saveLineup();
await db.query(
  "update public.presidents set budget=budget-200000 where id=$1",
  [pres],
);
await db.query("select public.grant_budget($1,100,'Test grant')", [pres]);
const setBudget = (amount: number | null) =>
  db.query("select public.set_club_budget($1,$2::numeric)", [club, amount]);
const wallet = async () => {
  const result = await db.query<{ budget: number; initial_budget: number }>(
    "select budget,initial_budget from public.presidents where id=$1",
    [pres],
  );
  return {
    budget: Number(result.rows[0].budget),
    initial_budget: Number(result.rows[0].initial_budget),
  };
};
await setBudget(1500000);
assert.equal((await wallet()).budget, 1300100);
assert.equal((await wallet()).initial_budget, 1500000);
await db.query("select public.update_rules($1::jsonb)", [
  JSON.stringify({ budget: 2000000 }),
]);
assert.equal(
  (await wallet()).budget,
  1300100,
  "General budget must preserve individual override",
);
await setBudget(null);
assert.equal(
  (await wallet()).budget,
  1800100,
  "Returning to general must preserve net spending and grants",
);
await assert.rejects(setBudget(100000), /saldo insuficiente/);
await db.query(
  "insert into public.offers(tournament_id,type,bidder_president_id,bidder_club_id,cash) values($1,'cash',$2,$3,1000000)",
  [tid, pres, club],
);
await assert.rejects(setBudget(1100000), /compromisos/);
assert.equal(
  (await wallet()).initial_budget,
  2000000,
  "Rejected reduction must be atomic",
);
await db.exec(
  `insert into public.clubs(id,tournament_id,name,short_name,league,country) values('00000000-0000-0000-0000-000000000005','${tid}','Future Club','FUT','Test','México');`,
);
await db.query("select public.set_club_budget($1,900000)", [
  "00000000-0000-0000-0000-000000000005",
]);
await db.exec(`insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000006','future-test@example.invalid');
insert into public.presidents(tournament_id,user_id,club_id,nickname,display_name,budget) values('${tid}','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000005','Future','Future',0);`);
const future = await db.query<{ budget: number }>(
  "select budget from public.presidents where club_id='00000000-0000-0000-0000-000000000005'",
);
assert.equal(
  Number(future.rows[0].budget),
  900000,
  "Unclaimed club must retain its independent starting budget",
);
console.log(
  "🧪 Per-club budgets: inheritance, overrides, net spending/grants, commitments and future presidents verified.",
);
const saveChanges = (c: unknown, budgets: Record<string, number | null>) =>
  db.query("select public.save_rule_changes($1::jsonb,'4-2-3-1',$2::jsonb)", [
    JSON.stringify(c),
    JSON.stringify(budgets),
  ]);
await saveChanges({ ...configuration, budget: 2500000 }, { [club]: 3000000 });
assert.deepEqual(await wallet(), { budget: 2800100, initial_budget: 3000000 });
await assert.rejects(
  saveChanges(
    {
      ...configuration,
      groups: {
        ...configuration.groups,
        GK: { enabled: true, min: 4, max: 1 },
      },
    },
    { [club]: 4000000 },
  ),
  /Rango inválido/,
);
assert.deepEqual(
  await wallet(),
  { budget: 2800100, initial_budget: 3000000 },
  "Invalid rules must roll back staged budgets",
);
await db.query("select public.update_rules($1::jsonb)", [
  JSON.stringify({ budget: 0 }),
]);
await saveChanges({ ...configuration, budget: 4000000 }, { [club]: null });
assert.deepEqual(
  await wallet(),
  { budget: 3800100, initial_budget: 4000000 },
  "Inheritance must use final general budget, not old budget",
);
await assert.rejects(
  saveChanges(
    { ...configuration, budget: 5000000 },
    { [club]: 6000000, "ffffffff-ffff-ffff-ffff-ffffffffffff": 100 },
  ),
  /Universo activo/,
);
assert.deepEqual(
  await wallet(),
  { budget: 3800100, initial_budget: 4000000 },
  "Invalid team must roll back preceding team changes",
);
console.log(
  "🧪 Atomic rule save: combined changes, rollback and final-budget inheritance verified.",
);
await db.exec("select set_config('request.jwt.claims','{}',false)");
await assert.rejects(saveChanges(configuration, {}), /Solo Administración/);
await assert.rejects(setBudget(1200000), /Solo Administración/);
await assert.rejects(saveConfig(configuration), /Solo Administración/);
console.log(
  "🧪 SQL rules: persisted config/euros; disabled bounds; R11/R12 rejection; unauthorized mutation refused.",
);
await db.close();
console.log(
  "🎉 SQL schema, RPCs and parametrizable rules verified against local PostgreSQL.",
);
