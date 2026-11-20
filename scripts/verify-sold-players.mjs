import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { withSaleStatus } from "../src/domain/sale-status.ts";
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
    "market-sold",
  ]) {
    let source = readFileSync(`supabase/${file}.sql`, "utf8");
    // Rehearse updating the installed pre-feature JSON functions.
    if (file === "views")
      source = source
        .replace(
          "'availability', case when sp.availability='vendido' then 'intransferible' else sp.availability end, 'saleStatus',case when sp.availability='vendido' then 'vendido' else null end,",
          "'availability', sp.availability,",
        )
        .replace(
          "'availability', case when pool.availability='vendido' then 'intransferible' else coalesce(pool.availability,'libre') end, 'saleStatus',case when pool.availability='vendido' then 'vendido' else null end,",
          "'availability', coalesce(pool.availability, 'libre'),",
        )
        .replace(
          "sp.squad_id = v_squad.id and sp.availability in ('intransferible','vendido')",
          "sp.squad_id = v_squad.id and sp.availability = 'intransferible'",
        )
        .replace(
          /\s*'soldToClubId', sp\.sold_to_club_id, 'soldToClubName', \(select name from public\.clubs where id=sp\.sold_to_club_id\),/g,
          "",
        )
        .replace(
          /\s*union all select 'vendido', count\(\*\) from public\.squad_players sp where sp\.squad_id = v_squad\.id and sp\.availability = 'vendido'/g,
          "",
        )
        .replace(
          " sp.sold_to_club_id, (select name from public.clubs where id=sp.sold_to_club_id) as sold_to_club_name,",
          "",
        )
        .replace(
          / 'soldToClubId',pool\.sold_to_club_id,'soldToClubName',pool\.sold_to_club_name,/g,
          "",
        )
        .replace(
          "or sp.availability in ('transferible','vendido')",
          "or sp.availability = 'transferible'",
        )
        .replace(
          /when pool\.availability = 'vendido' then 'Vendido a '\|\|coalesce\(pool\.sold_to_club_name,'otro equipo'\)\s*/g,
          "",
        );
    if (file === "rpc")
      source = source.replace(
        /when sp\.availability = 'vendido' then \(select name from public\.players where id = sp\.player_id\) \|\| ' está marcado como vendido\.'\s*/g,
        "",
      );
    await db.exec(source);
  }
  await db.exec(
    `insert into auth.users(id,email)values('${id(1)}','one@example.invalid'),('${id(2)}','two@example.invalid');insert into public.tournaments(id,code,name,season)values('${id(10)}','TACT','Tactics','2026'),('${id(11)}','OTHER','Other','2026');insert into public.tournament_rules(tournament_id)values('${id(10)}');update public.profiles set active_tournament_id='${id(10)}';insert into public.clubs(id,tournament_id,name,short_name,league,country)values('${id(20)}','${id(10)}','One','ONE','L','España'),('${id(21)}','${id(10)}','Two','TWO','L','España');insert into public.presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget)values('${id(30)}','${id(10)}','${id(1)}','${id(20)}','One','One',0),('${id(31)}','${id(10)}','${id(2)}','${id(21)}','Two','Two',0);insert into public.squads(id,tournament_id,club_id,president_id,formation,lineup)values('${id(40)}','${id(10)}','${id(20)}','${id(30)}','4-2-3-1','[]'),('${id(41)}','${id(10)}','${id(21)}','${id(31)}','4-3-3','[]');`,
  );

  await db.exec(
    `insert into public.players(id,name,position,"group",ovr,age,value,nationality)values('${id(50)}','Player One','MC','MID',80,25,1000,'España'),('${id(51)}','Player Two','DC','FWD',81,26,2000,'España');insert into public.squad_players(id,tournament_id,club_id,squad_id,player_id,president_id,value_at_join)values('${id(60)}','${id(10)}','${id(20)}','${id(40)}','${id(50)}','${id(30)}',1000),('${id(61)}','${id(10)}','${id(21)}','${id(41)}','${id(51)}','${id(31)}',2000);`,
  );
  await db.exec(
    `insert into public.league_members(tournament_id,user_id,role)values('${id(10)}','${id(1)}','presidente'),('${id(10)}','${id(2)}','presidente');`,
  );

  await db.exec(
    `insert into public.offers(id,tournament_id,type,bidder_president_id,bidder_club_id,seller_president_id,seller_club_id,requested_player_ids,cash,status)values('${id(70)}','${id(10)}','cash','${id(31)}','${id(21)}','${id(30)}','${id(20)}',array['${id(50)}']::uuid[],100,'negociacion'),('${id(71)}','${id(10)}','cash','${id(31)}','${id(21)}','${id(30)}','${id(20)}',array['${id(50)}']::uuid[],200,'cancelada'),('${id(72)}','${id(11)}','cash','${id(31)}','${id(21)}','${id(30)}','${id(20)}',array['${id(50)}']::uuid[],200,'negociacion');`,
  );
  const before = {
    owners: (
      await db.query(
        "select id,club_id,squad_id,president_id,player_id from public.squad_players order by id",
      )
    ).rows,
    budgets: (
      await db.query("select id,budget from public.presidents order by id")
    ).rows,
    squads: (await db.query("select * from public.squads order by id")).rows,
    offers: (await db.query("select * from public.offers order by id")).rows,
  };
  const candidates = async (sp = id(60)) =>
    (await db.query("select public.squad_sale_negotiations($1) value", [sp]))
      .rows[0].value;
  const sell = async (offer = id(70), withdraw = false, sp = id(60)) =>
    (
      await db.query("select public.mark_squad_player_sold($1,$2,$3) value", [
        sp,
        offer,
        withdraw,
      ])
    ).rows[0].value;
  const inspect = async () => {
    await db.exec("reset role");
    return (
      await db.query("select * from public.squad_players where id=$1", [id(60)])
    ).rows[0];
  };
  await login(1);
  assert.equal((await candidates()).length, 1);
  assert.equal((await candidates())[0].clubName, "Two");
  await assert.rejects(candidates(id(61)), /tu plantilla/);
  await assert.rejects(sell(id(71)), /no está activa/);
  await assert.rejects(sell(id(72)), /no está activa/);
  await assert.rejects(sell(id(70), true, id(61)), /tu plantilla/);
  await db.query("select public.save_draft_prelist('[]',$1,0,false)", [
    JSON.stringify([id(50)]),
  ]);
  const beforePrompt = await inspect();
  await login(1);
  const prompt = await sell();
  assert.equal(prompt.requiresWithdrawal, true);
  assert.deepEqual(await inspect(), beforePrompt);
  await login(1);
  const marked = await sell(id(70), true);
  assert.equal(marked.requiresWithdrawal, false);
  assert.equal(marked.withdrawn, true);
  assert.equal(marked.clubName, "Two");
  let row = await inspect();
  assert.equal(row.availability, "vendido");
  assert.equal(row.sold_to_club_id, id(21));
  assert.equal(row.sold_offer_id, id(70));
  assert.equal(row.sold_previous_availability, "transferible");
  assert.deepEqual(
    (
      await db.query(
        "select id,club_id,squad_id,president_id,player_id from public.squad_players order by id",
      )
    ).rows,
    before.owners,
  );
  assert.deepEqual(
    (await db.query("select id,budget from public.presidents order by id"))
      .rows,
    before.budgets,
  );
  assert.deepEqual(
    (await db.query("select * from public.squads order by id")).rows,
    before.squads,
  );
  assert.deepEqual(
    (await db.query("select * from public.offers order by id")).rows,
    before.offers,
  );
  assert.equal(
    (await db.query("select count(*) n from app.draft_release_receipts"))
      .rows[0].n,
    0,
  );
  const json = (
    await db.query(
      "select public.squad_player_json(sp) value from public.squad_players sp where id=$1",
      [id(60)],
    )
  ).rows[0].value;
  assert.equal(json.soldToClubName, "Two");
  assert.equal(json.availability, "intransferible");
  assert.equal(withSaleStatus(json).availability, "vendido");
  await login(1);
  assert.equal(
    (await db.query("select public.tournament_state() value")).rows[0].value
      .availability.vendido,
    1,
  );
  await login(2);
  const market = (await db.query("select public.market_browse('todos') value"))
    .rows[0].value;
  const listed = market.players.find((p) => p.playerId === id(50));
  assert.equal(listed.availability, "intransferible");
  assert.equal(withSaleStatus(listed).availability, "vendido");
  assert.equal(listed.soldToClubName, "Two");
  assert.equal(listed.offerable, false);
  assert.match(listed.blockedReason, /Vendido/);
  await assert.rejects(sell(), /tu plantilla/);
  await db.exec("reset role");
  await db.exec(readFileSync("supabase/market-sold.sql", "utf8"));
  assert.equal((await inspect()).availability, "vendido");
  await db.query("update public.offers set status='cancelada' where id=$1", [
    id(70),
  ]);
  row = await inspect();
  assert.equal(row.availability, "transferible");
  assert.equal(row.sold_to_club_id, null);
  assert.equal(row.sold_offer_id, null);
  await login(1);
  await assert.rejects(sell(), /no está activa/);
  await db.exec("reset role");
  await db.query("update public.offers set status='reservada' where id=$1", [
    id(70),
  ]);
  await login(1);
  await sell();
  row = await inspect();
  assert.equal(row.availability, "vendido");
  await login(1);
  await db.query("select public.change_squad_availability($1,'neutro',false)", [
    id(60),
  ]);
  row = await inspect();
  assert.equal(row.availability, "neutro");
  assert.equal(row.sold_offer_id, null);
  await db.exec("reset role");
  await db.exec(`insert into public.offers(id,tournament_id,type,bidder_president_id,bidder_club_id,seller_president_id,seller_club_id,requested_player_ids,offered_player_ids,status)values('${id(80)}','${id(10)}','trade','${id(30)}','${id(20)}','${id(31)}','${id(21)}',array['${id(51)}']::uuid[],array['${id(50)}']::uuid[],'negociacion');`);
  await login(2);assert.equal((await candidates(id(61)))[0].clubName,'One');assert.equal((await sell(id(80),false,id(61))).clubName,'One');
  await login(1);assert.equal((await sell(id(80))).clubName,'Two');
  await sell(id(70));await db.exec('reset role');await db.query('delete from public.offers where id=$1',[id(70)]);row=await inspect();assert.equal(row.availability,'neutro');assert.equal(row.sold_offer_id,null);
  await login(1);await sell(id(80));
  await db.exec("reset role");
  await db.query(
    "update public.squad_players set president_id=$1,club_id=$2,squad_id=$3 where id=$4",
    [id(31), id(21), id(41), id(60)],
  );
  row = await inspect();
  assert.equal(row.availability, "neutro");
  assert.equal(row.sold_to_club_id, null);
  await login(1);
  await assert.rejects(candidates(), /tu plantilla/);
  await db.exec('reset role');await db.query("update public.offers set status='cancelada' where id=$1",[id(80)]);assert.equal((await db.query('select availability from public.squad_players where id=$1',[id(61)])).rows[0].availability,'neutro');
  await login(2);await assert.rejects(sell(id(80),false,id(61)),/no está activa/);
  await db.exec('reset role');await db.query('update public.profiles set active_tournament_id=$1 where id=$2',[id(11),id(2)]);await login(2);await assert.rejects(candidates(id(61)),/universo/);
  await login(null, "anon");
  await assert.rejects(candidates(), /permission denied/);
  await assert.rejects(sell(), /permission denied/);
  console.log(
    "PASS sold labels: active negotiation and buyer scope, confirmation/no writes, draft withdrawal, no transfer/budget/offer/lineup changes, public buyer display, market exclusion, cancellation cleanup, normal status/ownership reset, upgrade/idempotence and unauthorized denial.",
  );
} finally {
  await db.close();
}
