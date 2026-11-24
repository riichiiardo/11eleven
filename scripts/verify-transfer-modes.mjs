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

  const migration = readFileSync("supabase/transfer-modes.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(`delete from public.offers; update public.tournaments set market_open=true where id='${id(10)}';update public.presidents set budget=100000;
   insert into auth.users(id,email)values('${id(3)}','three@example.invalid');update public.profiles set active_tournament_id='${id(10)}' where id='${id(3)}';
   insert into public.league_members(tournament_id,user_id,role)values('${id(10)}','${id(3)}','presidente');
   insert into public.clubs(id,tournament_id,name,short_name,league,country)values('${id(22)}','${id(10)}','Three','THR','L','España');
   insert into public.presidents(id,tournament_id,user_id,club_id,nickname,display_name,budget)values('${id(32)}','${id(10)}','${id(3)}','${id(22)}','Three','Three',100000);
   insert into public.squads(id,tournament_id,club_id,president_id)values('${id(42)}','${id(10)}','${id(22)}','${id(32)}');
   insert into public.players(id,name,position,"group",ovr,age,value,nationality)values('${id(52)}','Free Player','MC','MID',80,25,3456,'España'),('${id(53)}','Third Player','DC','FWD',80,25,2500,'España');
   insert into public.squad_players(tournament_id,club_id,squad_id,player_id,president_id)values('${id(10)}','${id(22)}','${id(42)}','${id(53)}','${id(32)}');`);
  const create = async (type, target, offered, cash) =>
    (
      await db.query(
        "select public.create_transfer($1,$2::uuid[],$3::uuid[],$4,null) data",
        [type, [id(target)], offered.map(id), cash],
      )
    ).rows[0].data;
  const respond = async (offer, action = "aceptar") =>
    (await db.query("select public.respond_offer($1,$2) data", [offer, action]))
      .rows[0].data;
  const asOwner = async (q, params = []) => {
    await db.exec("reset role");
    return db.query(q, params);
  };
  await login(2);
  await assert.rejects(create("cash", 52, [], 1), /exactamente/);
  await assert.rejects(create("trade", 52, [51], 3456), /exactamente/);
  const free = await create("cash", 52, [], 3456);
  assert.equal(free.status, "ejecutada");
  assert.equal(
    (
      await asOwner("select budget from public.presidents where id=$1", [
        id(31),
      ])
    ).rows[0].budget,
    "96544",
  );
  await login(2);
  await assert.rejects(respond(free.offerId), /ya fue respondida/);
  const purchase = await create("cash", 50, [], 4000);
  assert.equal(purchase.status, "enviada");
  await assert.rejects(respond(purchase.offerId), /propietario/);
  await login(1);
  assert.equal(await respond(purchase.offerId), "reservada");
  await login(2);
  await assert.rejects(
    respond(purchase.offerId, "cancelar"),
    /compra aprobada/,
  );
  await assert.rejects(
    db.query("select public.cancel_sale($1,$2,'Prefiero otro')", [
      purchase.offerId,
      purchase.offerId,
    ]),
    /Solo el vendedor/,
  );
  await login(3);
  const alternative = await create("trade", 50, [53], 0);
  assert.equal(alternative.status, "enviada");
  await login(1);
  const choices = (
    await db.query("select public.sale_alternatives($1) data", [
      purchase.offerId,
    ])
  ).rows[0].data;
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, alternative.offerId);
  assert.equal(choices[0].cash, 0);
  await assert.rejects(respond(alternative.offerId), /venta aprobada/);
  await assert.rejects(
    db.query("select public.cancel_sale($1,$2,'x')", [
      purchase.offerId,
      alternative.offerId,
    ]),
    /5 a 500/,
  );
  await db.query(
    "select public.cancel_sale($1,$2,'Prefiero su jugador para mi plantilla')",
    [purchase.offerId, alternative.offerId],
  );
  const afterCancel = (
    await asOwner(
      "select id,status from public.offers where id=any($1::uuid[]) order by id",
      [[purchase.offerId, alternative.offerId]],
    )
  ).rows;
  assert.equal(
    afterCancel.find((o) => o.id === purchase.offerId).status,
    "cancelada",
  );
  assert.equal(
    afterCancel.find((o) => o.id === alternative.offerId).status,
    "enviada",
  );
  await login(1);
  await respond(alternative.offerId);
  await assert.rejects(
    db.query("select public.respond_offer_execute_reserved()"),
    /Solo Administración/,
  );
  await asOwner(
    "insert into public.tournament_admins(tournament_id,user_id,role)values($1,$2,'principal')",
    [id(10), id(1)],
  );
  const budgetBefore = (
    await asOwner("select id,budget from public.presidents order by id")
  ).rows;
  await db.exec("reset role; begin");
  await db.exec(readFileSync("supabase/departure-approvals.sql","utf8"));
  await login(2);
  await assert.rejects(db.query("select public.review_departures()"),/permiso/).catch(()=>{throw Error("review permissions")});
  await db.exec("rollback");
  await db.exec("reset role; begin");
  await db.exec(readFileSync("supabase/departure-approvals.sql","utf8"));
  await login(1);
  const teams=(await db.query("select public.review_departures() data")).rows[0].data;
  const legs=teams.flatMap(team=>team.players);
  assert.equal(legs.length,2);
  for(const leg of legs){
    assert.equal((await db.query("select public.respond_offer_execute_reserved() data")).rows[0].data.executed,0);
    for(let retry=0;retry<2;retry++)await db.query("select public.approve_departure($1,$2,$3)",[leg.presidentId,leg.playerId,leg.revision]);
  }
  assert.equal((await db.query("select public.respond_offer_execute_reserved() data")).rows[0].data.executed,1);
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int n from app.transfer_notifications where message like 'Baja aprobada:%'")).rows[0].n,4);
  await db.exec("rollback");
  await login(1);
  assert.equal(
    (await db.query("select public.respond_offer_execute_reserved() data"))
      .rows[0].data.executed,
    1,
  );
  let owners = (
    await asOwner(
      "select player_id,president_id from public.squad_players order by player_id",
    )
  ).rows;
  assert.equal(owners.find((p) => p.player_id === id(50)).president_id, id(32));
  assert.equal(owners.find((p) => p.player_id === id(53)).president_id, id(30));
  assert.deepEqual(
    (await db.query("select id,budget from public.presidents order by id"))
      .rows,
    budgetBefore,
  );
  await login(1);
  assert.equal(
    (await db.query("select public.respond_offer_execute_reserved() data"))
      .rows[0].data.executed,
    0,
  );
  // Exchange plus cash, both clubs receive the correct player and money once.
  await login(2);
  const mixed = await create("trade", 53, [51], 1234);
  await login(1);
  await respond(mixed.offerId);
  await db.query("select public.respond_offer_execute_reserved()");
  owners = (
    await asOwner(
      "select player_id,president_id from public.squad_players order by player_id",
    )
  ).rows;
  assert.equal(owners.find((p) => p.player_id === id(53)).president_id, id(31));
  assert.equal(owners.find((p) => p.player_id === id(51)).president_id, id(30));
  assert.equal(
    (
      await db.query("select budget from public.presidents where id=$1", [
        id(31),
      ])
    ).rows[0].budget,
    "95310",
  );
  assert.equal(
    (
      await db.query("select budget from public.presidents where id=$1", [
        id(30),
      ])
    ).rows[0].budget,
    "101234",
  );
  await login(2);
  await assert.rejects(create("trade", 51, [53, 52], 0), /uno a uno/);
  await assert.rejects(create("cash", 51, [], 0), /precio positivo/);
  // Prelist mode persists; the offered player is a planned departure, not transferred.
  const entry = {
    id: id(90),
    kind: "owned",
    clubId: id(20),
    playerId: id(51),
    price: 0,
    sofifaUrl: "https://sofifa.com/player/12345/test/",
    transferMode: "exchange",
    offeredPlayerId: id(53),
  };
  await db.query(
    "select public.save_draft_prelist($1::jsonb,$2::jsonb,0,false)",
    [JSON.stringify([entry]), JSON.stringify([id(53)])],
  );
  const pre = (await db.query("select public.draft_prelist_state() data"))
    .rows[0].data;
  assert.equal(pre.entries[0].transferMode, "exchange");
  assert.equal(pre.entries[0].offeredPlayerId, id(53));
  assert.equal(pre.entries[0].price, 0);
  await assert.rejects(
    db.query("select public.save_draft_prelist($1::jsonb,$2::jsonb,$3,false)", [
      JSON.stringify([{ ...entry, offeredPlayerId: id(50) }]),
      JSON.stringify([id(50)]),
      pre.revision,
    ]),
    /propio/,
  );
  await login(null, "anon");
  await assert.rejects(
    db.query("select public.sale_alternatives($1)", [purchase.offerId]),
    /permission denied/,
  );
  await login(2);
  await asOwner(
    "update public.profiles set active_tournament_id=$1 where id=$2",
    [id(11), id(2)],
  );
  await login(2);
  await assert.rejects(respond(alternative.offerId), /universo/);
  console.log(
    "PASS transfer modes: exact free-agent cost, owner approval, cash purchase, 1:1 exchange, exchange+cash, both ownership directions, budget/idempotence, competing offers preserved, seller-only cancellation by documented choice, separate reapproval, prelist persistence, wrong universe and anonymous denial.",
  );
  await db.exec("reset role; alter table public.players add column if not exists sofifa_id bigint; alter table public.squads alter column president_id drop not null; alter table public.squad_players alter column president_id drop not null");
  for (const migration of ["bot-club-rosters","president-offer-lists","prelist-offer-slots","prelist-pick-priority","racing-roster-repair"]) {
    await db.exec(readFileSync("supabase/"+migration+".sql","utf8"));
  }
  const repair=readFileSync("supabase/racing-roster-repair.sql","utf8");
  const list=(label)=>repair.match(new RegExp(label+" uuid\\[\\]:=array\\[([^\\]]+)"))[1].match(/[0-9a-f-]{36}/g);
  const keep=list("keep"), release=list("release");
  assert.equal(keep.length,28);assert.equal(release.length,30);
  const club=repair.match(/club uuid:='([^']+)'/)[1];
  const tid=repair.match(/tid uuid:='([^']+)'/)[1];
  await db.query("insert into tournaments(id,code,name,season) values($1,'RACE','Ensayo','2026')",[tid]);
  await db.query("insert into clubs(id,tournament_id,name,short_name,league,country) values($1,$2,'Racing Club','RAC','L','Argentina')",[club,tid]);
  const squad=(await db.query("insert into squads(tournament_id,club_id)values($1,$2)returning id",[tid,club])).rows[0].id;
  for(const [index,rowId] of [...keep,...release].entries()){
    const player=(await db.query(`insert into players(name,real_club,position,"group",ovr,age,value,nationality,source_record)values($1,'Racing Club','MC','MID',70,20,10,'Argentina',$2::jsonb) returning id`,["Ensayo "+index,JSON.stringify(index<28?{game_team:"Racing Club"}:{})])).rows[0].id;
    await db.query("insert into squad_players(id,tournament_id,club_id,squad_id,player_id)values($1,$2,$3,$4,$5)",[rowId,tid,club,squad,player]);
  }
  await db.exec(repair);
  await db.exec(repair);
  assert.deepEqual((await db.query("select id from squad_players where club_id=$1",[club])).rows.map(r=>r.id).sort(),keep.sort());
  assert.equal((await db.query("select count(*)::int n from app.racing_roster_correction_backup")).rows[0].n,30);
  await login(1);
  const inbox=(await db.query("select public.market_overview() data")).rows[0].data;
  assert.ok(inbox.history.length>0);
  assert.ok(inbox.history.every(o=>o.side==="recibida" || o.side==="enviada"));
  await db.query("select public.prelist_offer_players(),public.next_prelist_pick(),public.prelist_pool_search('test')");
  console.log("PASS scoped negotiations and prelist RPCs");
  await db.exec("reset role;create or replace view public.active_catalog_players as select * from public.players");
  await db.exec(readFileSync("supabase/market-search.sql","utf8"));
  await db.exec(readFileSync("supabase/signing-eligibility.sql","utf8"));
  await db.query("insert into app.blocked_signings values ($1,$2)",[id(10),id(50)]);
  const terms=(players,cash,owned=true)=>db.query("select app.check_signing_terms($1,$2::uuid[],'{}',$3,$4)",[id(10),players,cash,owned]);
  await terms([],200000000);
  await assert.rejects(terms([],200000001),/200.000.000/);
  await terms([],200000001,false);
  await assert.rejects(terms([id(50)],1),/bloqueado/);
  await assert.rejects(db.query("select app.check_signing_terms($1,'{}',$2::uuid[],200000000,true)",[id(10),[id(51)]]),/200.000.000/);
  await login(null,"anon");
  await assert.rejects(db.query("select public.admin_set_signing_block($1,false)",[id(50)]),/permission denied/);
  console.log("PASS market eligibility and cash/exchange boundaries");
  await db.exec("reset role");
  const poolSql = readFileSync("supabase/player-pool.sql","utf8");
  await db.exec(poolSql.slice(poolSql.indexOf("create or replace function app.require_pool_admin"),poolSql.indexOf("create or replace function public.pool_status")));
  for (const file of ["admin-club-rosters","admin-player-profiles","manual-player-registration","admin-roster-resolution"]) {
    await db.exec(readFileSync("supabase/"+file+".sql","utf8"));
  }
  const profile = {name:"Alta manual",nationality:"España",age:22,ovr:75,value:1000000,potential:null,positions:["MD","ED"]};
  const createPlayer = (name,url,clubId) => db.query("select public.admin_create_player($1,$2,$3) id",[JSON.stringify({...profile,name}),url,clubId]);
  await login(2);
  await assert.rejects(createPlayer("Sin permiso",null,null),/Administración/);
  await login(1);
  await createPlayer("Libre manual",null,null);
  await assert.rejects(createPlayer("Libre manual","",null),/coincidente/);
  await assert.rejects(createPlayer("URL inválida","https://example.org/player/123",null),/enlace/);
  const link="https://sofifa.com/player/123456/jugador";
  const registered=(await createPlayer("Alta manual",link,id(20))).rows[0].id;
  await assert.rejects(createPlayer("Otro nombre",link,null),/coincidente/);
  await assert.rejects(createPlayer("Alta revertida",null,id(799)),/destino/);
  const result=(await db.query("select public.admin_player_profiles('Alta manual',0,$1,false) data",[id(20)])).rows[0].data;
  assert.equal(result[0].id,registered);
  assert.equal(result[0].sofifaUrl,"https://sofifa.com/player/123456");
  assert.deepEqual(result[0].profile.positions,profile.positions);
  assert.deepEqual((await db.query("select public.admin_player_profiles('Alta revertida',0,null,false) data")).rows[0].data,[]);
  console.log("PASS manual registration: free and assigned players, optional link, duplicate prevention, authorization and atomic rollback");
  const matches = (await db.query("select public.admin_player_matches($1,$2,$3,$4) data", ["Alta manual","España",22,link])).rows[0].data;
  assert.equal(matches[0].club_id,id(20));
  const freeMatches = (await db.query("select public.admin_player_matches($1,$2,$3,null) data",["Libre manual","España",22])).rows[0].data;
  assert.equal(freeMatches.length,1);
  assert.equal(freeMatches[0].club_id,null);
  await db.query("select public.admin_roster_change($1,null,$2,'add')",[freeMatches[0].id,id(20)]);
  const reused = (await db.query("select public.admin_player_matches($1,$2,$3,null) data",["Libre manual","España",22])).rows[0].data;
  assert.equal(reused.length,1);
  assert.equal(reused[0].id,freeMatches[0].id);
  assert.equal(reused[0].club_id,id(20));
  const releaseRosterPlayer = () => db.query("select public.admin_release_roster_player($1,$2)",[registered,id(20)]);
  await db.exec("reset role");
  await db.query("insert into app.draft_prelists(president_id,outgoing) values ($1,$2) on conflict(president_id) do update set outgoing=excluded.outgoing",[id(30),JSON.stringify([registered])]);
  const insertOffer = "insert into public.offers(tournament_id,type,bidder_president_id,bidder_club_id,seller_president_id,seller_club_id,requested_player_ids,cash,status)values($1,'cash',$2,$3,$4,$5,$6,100,$7) returning id";
  const releaseOffer=(await db.query(insertOffer,[id(10),id(31),id(21),id(30),id(20),[registered],"reservada"])).rows[0].id;
  await login(1);
  await assert.rejects(releaseRosterPlayer(),/acuerdo aceptado/);
  await db.exec("reset role");
  await db.query("update public.offers set status='enviada' where id=$1",[releaseOffer]);
  await login(1);
  await releaseRosterPlayer();
  await db.exec("reset role");
  assert.equal((await db.query("select status from public.offers where id=$1",[releaseOffer])).rows[0].status,"invalidada");
  assert.deepEqual((await db.query("select outgoing from app.draft_prelists where president_id=$1",[id(30)])).rows[0].outgoing,[]);
  assert.equal((await db.query("select id from public.squad_players where player_id=$1",[registered])).rows.length,0);
  console.log("PASS existing profile lookup and confirmed release with outgoing selection, open bid and protected agreement");
  await db.exec(readFileSync("supabase/preserve-roster-on-club-change.sql", "utf8"));
  const nextClub=id(895);
  await db.query("insert into public.clubs(id,tournament_id,name,short_name,league,country) values($1,$2,'FC Andorra','AND','L','España')",[nextClub,id(10)]);
  await db.query("update public.offers set status='invalidada' where tournament_id=$1 and status in ('enviada','negociacion','aceptada','reservada')",[id(10)]);
  const rosterBefore=(await db.query("select id,player_id,value_at_join from public.squad_players where club_id=$1 order by id",[id(20)])).rows;
  assert.ok(rosterBefore.length);
  await db.query("select app.assign_club_roster($1,$2,$3)",[id(10),id(30),nextClub]);
  assert.deepEqual((await db.query("select id,player_id,value_at_join from public.squad_players where club_id=$1 order by id",[nextClub])).rows,rosterBefore);
  assert.equal((await db.query("select count(*)::int n from public.squad_players where club_id=$1",[id(20)])).rows[0].n,0);
  assert.equal((await db.query("select c.country from public.presidents p join public.clubs c on c.id=p.club_id where p.id=$1",[id(30)])).rows[0].country,"España");
  console.log("PASS club reassignment preserves player IDs and acquisition values and frees the former club");
} finally {
  await db.close();
}
