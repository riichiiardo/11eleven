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
  for (const file of ["schema", "rpc", "market-availability"])
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
  client.setExecutor(async (name, args) => {
    assert.equal(name, "set_availability");
    await db.query("select public.set_availability($1,$2)", [
      args.p_squad_player_id,
      args.p_availability,
    ]);
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
        name: "set_availability",
        args: { p_squad_player_id: squadId, p_availability: status },
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
    [{ availability: "neutro" }, { availability: "neutro" }],
  );
  console.log(
    "PASS availability: real hook → mutation → RPC → PostgreSQL for two ordinary presidents and all four states; persisted reads, catalog-ID regression, missing/invalid arguments and foreign/anonymous denial.",
  );
} finally {
  await db.close();
  await server.close();
}
