import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [
    {
      name: "availability-client-fixture",
      enforce: "pre",
      load(path) {
        if (path.endsWith("/infrastructure/supabase/client.ts"))
          return `export const supabaseConfigError=null;export const supabaseUrl='';export const supabase={};let run;export const calls=[];export function setExecutor(fn){run=fn;}export async function rpc(name,args){calls.push({name,args});return run(name,args);}`;
      },
    },
  ],
});
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
    "market-availability",
    "market-draft-availability",
  ])
    await db.exec(readFileSync(`supabase/${file}.sql`, "utf8"));
  await db.exec(
    `insert into auth.users(id,email)values('${id(1)}','one@example.invalid'),('${id(2)}','two@example.invalid');insert into public.tournaments(id,code,name,season)values('${id(10)}','TACT','Tactics','2026'),('${id(11)}','OTHER','Other','2026');insert into public.tournament_rules(tournament_id)values('${id(10)}');update public.profiles set active_tournament_id='${id(10)}';insert into public.clubs(id,tournament_id,name,short_name,league,country)values('${id(20)}','${id(10)}','One','ONE','L','España'),('${id(21)}','${id(10)}','Two','TWO','L','España');insert into public.presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget)values('${id(30)}','${id(10)}','${id(1)}','${id(20)}','One','One',0),('${id(31)}','${id(10)}','${id(2)}','${id(21)}','Two','Two',0);insert into public.squads(id,tournament_id,club_id,president_id,formation,lineup)values('${id(40)}','${id(10)}','${id(20)}','${id(30)}','4-2-3-1','[]'),('${id(41)}','${id(10)}','${id(21)}','${id(31)}','4-3-3','[]');`,
  );

  await db.exec(
    `insert into public.players(id,name,position,"group",ovr,age,value,nationality)values('${id(50)}','Player One','MC','MID',80,25,1000,'España'),('${id(51)}','Player Two','DC','FWD',81,26,2000,'España');insert into public.squad_players(id,tournament_id,club_id,squad_id,player_id,president_id,value_at_join)values('${id(60)}','${id(10)}','${id(20)}','${id(40)}','${id(50)}','${id(30)}',1000),('${id(61)}','${id(10)}','${id(21)}','${id(41)}','${id(51)}','${id(31)}',2000);`,
  );
  await db.exec(
    `insert into public.league_members(tournament_id,user_id,role)values('${id(10)}','${id(1)}','presidente'),('${id(10)}','${id(2)}','presidente');`,
  );
  const client = await server.ssrLoadModule(
    "/src/infrastructure/supabase/client.ts",
  );
  let lastResult;
  client.setExecutor(async (name, args) => {
    assert.equal(name, "change_squad_availability");
    lastResult = (
      await db.query(
        "select public.change_squad_availability($1,$2,$3) value",
        [args.p_squad_player_id, args.p_availability, args.p_withdraw],
      )
    ).rows[0].value;
    return lastResult;
  });
  const { useSquadActions } = await server.ssrLoadModule(
    "/src/hooks/use-squad-actions.ts",
  );
  let actions;
  function Harness() {
    actions = useSquadActions();
    return null;
  }
  renderToString(React.createElement(Harness));
  const states = ["transferible", "negociacion", "intransferible", "neutro"];
  for (const who of [1, 2]) {
    await login(who);
    const squadId = id(who === 1 ? 60 : 61);
    for (const status of states) {
      assert.equal(
        await actions.saveAvailability(squadId, status, "Jugador de prueba"),
        true,
      );
      assert.deepEqual(client.calls.at(-1), {
        name: "change_squad_availability",
        args: {
          p_squad_player_id: squadId,
          p_availability: status,
          p_withdraw: false,
        },
      });
      await db.exec("reset role");
      assert.equal(
        (
          await db.query(
            "select availability from public.squad_players where id=$1",
            [squadId],
          )
        ).rows[0].availability,
        status,
      );
      await login(who);
    }
    assert.equal(
      await actions.saveAvailability(
        id(who === 1 ? 61 : 60),
        "transferible",
        "Ajeno",
      ),
      false,
    );
  }
  await login(1);
  assert.equal(
    await actions.saveAvailability(
      id(50),
      "transferible",
      "ID del catálogo incorrecto",
    ),
    false,
  );
  const previousCalls = client.calls.length;
  assert.equal(
    await actions.saveAvailability(undefined, "transferible", "ID faltante"),
    false,
  );
  assert.equal(
    await actions.saveAvailability(id(60), "invalida", "Estado inválido"),
    false,
  );
  assert.equal(client.calls.length, previousCalls);

  await db.exec("reset role");
  await db.exec(
    `insert into public.players(id,name,position,"group",ovr,age,value,nationality)values('${id(52)}','Other departure','MC','MID',80,25,1000,'España');insert into public.squad_players(id,tournament_id,club_id,squad_id,player_id,president_id,value_at_join)values('${id(62)}','${id(10)}','${id(20)}','${id(40)}','${id(52)}','${id(30)}',1000);`,
  );
  for (const status of ["enviada", "negociacion", "aceptada", "reservada"])
    await db.query(
      "insert into public.offers(tournament_id,type,bidder_president_id,bidder_club_id,seller_president_id,seller_club_id,requested_player_ids,status)values($1,'cash',$2,$3,$4,$5,$6,$7)",
      [id(10), id(31), id(21), id(30), id(20), [id(50)], status],
    );
  const offersBefore = (
    await db.query("select * from public.offers order by id")
  ).rows;
  const budgetsBefore = (
    await db.query("select id,budget from public.presidents order by id")
  ).rows;
  await login(2);
  await db.query("select public.save_draft_prelist('[]',$1,0,false)", [
    JSON.stringify([id(51)]),
  ]);
  await login(1);
  await db.query("select public.save_draft_prelist('[]',$1,0,false)", [
    JSON.stringify([id(50), id(52)]),
  ]);
  const change = async (status, confirm = false) =>
    (
      await db.query(
        "select public.change_squad_availability($1,$2,$3) value",
        [id(60), status, confirm],
      )
    ).rows[0].value;
  const { queryStore } = await server.ssrLoadModule(
    "/src/services/backend/query-store.ts",
  );
  const dashboardSnapshot = { club: "keeps the owning screen mounted" };
  await queryStore.load(
    "confirmation-regression",
    async () => dashboardSnapshot,
  );
  assert.equal(
    await actions.saveAvailability(id(60), "neutro", "Jugador anunciado"),
    false,
  );
  assert.equal(
    queryStore.get("confirmation-regression").data,
    dashboardSnapshot,
    "A confirmation response must not unmount the dashboard",
  );
  assert.equal((await change("neutro")).requiresWithdrawal, true);
  await db.exec("reset role");
  const snapshot = async () => ({
    list: (
      await db.query(
        "select outgoing,entries,revision,status from app.draft_prelists where president_id=$1",
        [id(30)],
      )
    ).rows[0],
    ledger: (
      await db.query(
        "select status from app.draft_outgoing where president_id=$1 and player_id=$2",
        [id(30), id(50)],
      )
    ).rows[0].status,
    availability: (
      await db.query(
        "select availability from public.squad_players where id=$1",
        [id(60)],
      )
    ).rows[0].availability,
  });
  const beforeWithdrawal = await snapshot();
  assert.deepEqual(beforeWithdrawal.list.outgoing, [id(50), id(52)]);
  assert.equal(beforeWithdrawal.ledger, "selected");
  assert.equal(beforeWithdrawal.availability, "transferible");
  // Test the actual installed trigger, not a simplified standalone function.
  await login(1);
  await assert.rejects(
    db.query("select public.set_availability($1,'neutro')", [id(60)]),
    /Retira primero/,
  );
  assert.equal((await change("neutro")).requiresWithdrawal, true);
  await db.exec("reset role");
  assert.deepEqual(await snapshot(), beforeWithdrawal);
  await db.exec(
    "create function public.test_reject_market() returns trigger language plpgsql as $$begin if new.availability='intransferible' then raise exception 'test rejected target';end if;return new;end$$;create trigger zz_test_reject_market before update of availability on public.squad_players for each row execute function public.test_reject_market();",
  );
  await login(1);
  await assert.rejects(change("intransferible", true), /test rejected target/);
  await db.exec("reset role");
  assert.deepEqual(await snapshot(), beforeWithdrawal);
  await db.exec(
    "drop trigger zz_test_reject_market on public.squad_players;drop function public.test_reject_market();",
  );
  await login(1);
  assert.equal(
    await actions.saveAvailability(id(60), "neutro", "Jugador anunciado", true),
    true,
  );
  const withdrawn = lastResult;
  assert.equal(
    queryStore.get("confirmation-regression").data,
    undefined,
    "A confirmed change must refresh the dashboard",
  );
  assert.equal(withdrawn.withdrawn, true);
  assert.equal(withdrawn.requiresWithdrawal, false);
  await db.exec("reset role");
  const afterWithdrawal = await snapshot();
  assert.deepEqual(afterWithdrawal.list.outgoing, [id(52)]);
  assert.equal(
    afterWithdrawal.list.revision,
    beforeWithdrawal.list.revision + 1,
  );
  assert.deepEqual(afterWithdrawal.list.entries, beforeWithdrawal.list.entries);
  assert.equal(afterWithdrawal.list.status, beforeWithdrawal.list.status);
  assert.equal(afterWithdrawal.ledger, "withdrawn");
  assert.equal(afterWithdrawal.availability, "neutro");
  assert.deepEqual(
    (await db.query("select * from public.offers order by id")).rows,
    offersBefore,
  );
  assert.deepEqual(
    (await db.query("select id,budget from public.presidents order by id"))
      .rows,
    budgetsBefore,
  );
  assert.equal(
    (
      await db.query(
        "select availability from public.squad_players where id=$1",
        [id(62)],
      )
    ).rows[0].availability,
    "transferible",
  );
  assert.equal(
    (
      await db.query(
        "select status from app.draft_outgoing where president_id=$1",
        [id(31)],
      )
    ).rows[0].status,
    "selected",
  );
  assert.equal(
    (await db.query("select count(*) n from app.draft_release_receipts"))
      .rows[0].n,
    0,
  );
  await login(1);
  assert.equal((await change("neutro", true)).withdrawn, false);
  await assert.rejects(
    db.query("select public.save_draft_prelist('[]',$1,$2,false)", [
      JSON.stringify([id(50), id(52)]),
      beforeWithdrawal.list.revision,
    ]),
    /cambió/,
  );
  await db.query("select public.save_draft_prelist('[]',$1,$2,false)", [
    JSON.stringify([id(50), id(52)]),
    afterWithdrawal.list.revision,
  ]);
  await db.exec("reset role");
  await db.query(
    "insert into public.drafts(tournament_id,started_at)values($1,now())",
    [id(10)],
  );
  await login(1);
  await assert.rejects(change("neutro", true), /ya comenzó/);
  await db.exec("reset role");
  await db.query(
    "update public.drafts set started_at=null where tournament_id=$1",
    [id(10)],
  );
  await db.query(
    "update app.draft_prelists set status='submitted' where president_id=$1",
    [id(30)],
  );
  await login(1);
  await assert.rejects(change("neutro", true), /en revisión/);
  await db.exec("reset role");
  await db.query(
    "update public.profiles set active_tournament_id=$1 where id=$2",
    [id(11), id(1)],
  );
  await login(1);
  assert.equal(
    await actions.saveAvailability(id(60), "transferible", "Otro universo"),
    false,
  );
  await db.exec("reset role");
  await db.query(
    "update public.profiles set active_tournament_id=$1 where id=$2",
    [id(10), id(1)],
  );
  await db.query("delete from public.league_members where user_id=$1", [id(1)]);
  await login(1);
  assert.equal(
    await actions.saveAvailability(id(60), "transferible", "Miembro retirado"),
    false,
  );
  await login(null, "anon");
  assert.equal(
    await actions.saveAvailability(id(60), "transferible", "Anónimo"),
    false,
  );
  await db.exec("reset role");
  assert.deepEqual(
    (
      await db.query(
        "select availability from public.squad_players order by id",
      )
    ).rows,
    [
      { availability: "transferible" },
      { availability: "transferible" },
      { availability: "transferible" },
    ],
  );
  console.log(
    "PASS availability: real hook/RPC/PostgreSQL for two presidents and four states, installed outgoing trigger, side-effect-free confirmation with retained dashboard cache, atomic withdrawal/status, rollback, stale revisions, draft/review locks and foreign/anonymous denial.",
  );
} finally {
  await db.close();
  await server.close();
}
