// Isolated browser fixture. No Supabase connection or real player changes.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
const first = "00000000-0000-4000-8000-000000000060";
let current = { availability: "transferible", selected: true };
const fixture = {
  name: "market-draft-preview",
  enforce: "pre",
  resolveId(source) {
    if (source === "/market-draft-fixture.tsx") return "\0market-draft-fixture";
  },
  load(source) {
    if (source === path.resolve("src/infrastructure/supabase/client.ts"))
      return `export const supabaseConfigError=null;export const supabaseUrl='';export const supabase={};export async function rpc(name,args){const r=await fetch('/market-draft-fixture-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});const value=await r.json();if(!r.ok)throw Error(value.error);if(name==='change_squad_availability'&&!value.requiresWithdrawal)window.dispatchEvent(new Event('market-fixture-updated'));return value;}`;
    if (source === "\0market-draft-fixture")
      return `
 import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route,Outlet}from'react-router';import{Toaster}from'sonner';
 import PlayerStatus from '/src/pages/app/PlayerStatus.tsx';import{adaptTournamentState}from'/src/infrastructure/supabase/adapters.ts';import{DEFAULT_RULES,computeSquadStats}from'/src/domain/rulesEngine.ts';import'/src/index.css';
 function Fixture(){const[data,setData]=useState(null);useEffect(()=>{let active=true;const load=()=>fetch('/market-draft-fixture-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'read_fixture'})}).then(r=>r.json()).then(v=>{if(active)setData(v);});load();window.addEventListener('market-fixture-updated',load);return()=>{active=false;window.removeEventListener('market-fixture-updated',load);};},[]);if(!data)return React.createElement('p',null,'Cargando prueba local…');
 const squad=[{squadPlayerId:'${first}',playerId:'00000000-0000-4000-8000-000000000050',name:'Jugador anunciado',position:'LI',group:'DEF',ovr:80,age:25,nationality:'España',value:10000000,availability:data.availability},{squadPlayerId:'00000000-0000-4000-8000-000000000061',playerId:'00000000-0000-4000-8000-000000000051',name:'Jugador sin baja',position:'MC',group:'MID',ovr:80,age:25,nationality:'España',value:10000000,availability:'neutro'}];
 const state=adaptTournamentState({needsLeague:false,needsClub:false,rules:DEFAULT_RULES,club:{id:'00000000-0000-4000-8000-000000000020',name:'Club de prueba'},squad,stats:computeSquadStats(squad),availability:{transferible:data.availability==='transferible'?1:0,neutro:1+(data.availability==='neutro'?1:0),negociacion:data.availability==='negociacion'?1:0,intransferible:data.availability==='intransferible'?1:0},budget:{available:1000},president:{nickname:'Prueba'},tournament:{status:'inscripciones',name:'Prueba'},market:{},competition:{},activity:[]});
 return React.createElement(React.Fragment,null,React.createElement('p',{className:'mx-auto my-4 max-w-5xl rounded-lg border p-4'},'Prueba local · Datos ficticios · Bajas previstas: '+(data.selected?1:0)+' · Sin conexión a Supabase'),React.createElement(Outlet,{context:state}));}
 createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(Fixture)},React.createElement(Route,{path:'*',element:React.createElement(PlayerStatus)}))),React.createElement(Toaster)));
 `;
  },
  configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.url === "/market-draft-fixture-api" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const { name, args } = JSON.parse(body);
        let value = current;
        if (name === "change_squad_availability") {
          if (args.p_squad_player_id !== first) {
            res.statusCode = 400;
            value = { error: "Jugador no incluido en esta prueba" };
          } else if (
            current.selected &&
            args.p_availability !== "transferible" &&
            !args.p_withdraw
          )
            value = {
              requiresWithdrawal: true,
              withdrawn: false,
              playerName: "Jugador anunciado",
            };
          else {
            const withdrawn =
              current.selected && args.p_availability !== "transferible";
            current = {
              availability: args.p_availability,
              selected: withdrawn ? false : current.selected,
            };
            value = {
              requiresWithdrawal: false,
              withdrawn,
              availability: args.p_availability,
            };
          }
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(value));
        return;
      }
      if (req.url?.split("?")[0] !== "/market-draft-fixture") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(
        await vite.transformIndexHtml(
          "/market-draft-fixture",
          '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>11Eleven · Prueba de bajas y mercado</title></head><body><div id="root"></div><script type="module" src="/market-draft-fixture.tsx"></script></body></html>',
        ),
      );
    });
  },
};
const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-market-draft",
  plugins: [react(), tailwindcss(), fixture],
  resolve: {
    alias: { "@": path.resolve("src") },
    dedupe: ["react", "react-dom", "react-router"],
  },
  server: { host: "127.0.0.1", port: 5193, strictPort: true, hmr: false },
  optimizeDeps: { include: ["react", "react-dom/client", "react-router"] },
});
await server.listen();
console.log("Local fixture: http://127.0.0.1:5193/market-draft-fixture");
