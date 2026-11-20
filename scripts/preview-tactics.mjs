// Local browser fixture: real formation UI, fictitious roster, no backend access.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
let savedTactics = { code: "", instructions: "" };
const fixture = {
  name: "tactics-preview",
  enforce: "pre",
  resolveId(source) {
    if (source === "/formation-fixture.tsx") return "\0formation-fixture";
  },
  load(source) {
    if (source === path.resolve("src/services/backend/react.tsx"))
      return "export const useQuery=()=>undefined; export const useMutation=()=>async()=>{throw Error('Prueba local: guardado deshabilitado.');};";
    if (source === path.resolve("src/infrastructure/supabase/client.ts"))
      return `export const supabaseConfigError=null;export async function rpc(name,args){const r=await fetch('/tactics-test-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});if(!r.ok)throw Error('Error en prueba local');return r.json();}`;
    if (source === "\0formation-fixture")
      return `
   import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router';
   import Formation from '/src/pages/app/Formation.tsx';import{adaptTournamentState}from'/src/infrastructure/supabase/adapters.ts';
   import{DEFAULT_RULES,computeSquadStats,groupOf,autoLineup}from'/src/domain/rulesEngine.ts';import'/src/index.css';
   const squad=['POR','LI','LD','DFC','MCD','MC','MCO','EI','ED','DC'].flatMap(position=>Array.from({length:4},(_,i)=>({playerId:position+'-'+i,name:'Jugador '+position+' '+(i+1),position,group:groupOf(position),ovr:85-i,age:25,nationality:'España',value:1000000,flag:'🇪🇸'})));
   const state=adaptTournamentState({needsLeague:false,needsClub:false,rules:DEFAULT_RULES,club:{id:'fixture-club',name:'Club de prueba',shortName:'TST',country:'España',colorPrimary:'#000000',colorSecondary:'#ffffff'},squad,budget:{available:350000000},president:{nickname:'Prueba'},tournament:{status:'inscripciones',name:'Prueba local',currentMatchday:1},stats:computeSquadStats(squad),activity:[],competition:{standings:[],previousMatch:null,myMatch:null},market:{freeAgents:0},draft:null,availability:{},lineup:autoLineup(squad,'4-2-3-1')});
   createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement('main',{className:'mx-auto max-w-6xl p-4'},React.createElement('p',{className:'mb-4 rounded-lg border p-3'},'Prueba local · Datos ficticios · Guardado de prueba independiente, sin conexión a Supabase'),React.createElement(Formation,{state}))));
  `;
  },
  configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.url === "/tactics-test-api" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const { name, args } = JSON.parse(body);
        if (name === "save_squad_tactics")
          savedTactics = {
            code: args.p_code,
            instructions: args.p_instructions,
          };
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(savedTactics));
        return;
      }
      if (req.url?.split("?")[0] !== "/formation-fixture") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(
        await vite.transformIndexHtml(
          "/formation-fixture",
          '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>11Eleven · Formación</title></head><body><div id="root"></div><script type="module" src="/formation-fixture.tsx"></script></body></html>',
        ),
      );
    });
  },
};
const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tactics",
  plugins: [react(), tailwindcss(), fixture],
  resolve: {
    alias: { "@": path.resolve("src") },
    dedupe: ["react", "react-dom", "react-router"],
  },
  server: { host: "127.0.0.1", port: 5192, strictPort: true, hmr: false },
  optimizeDeps: { include: ["react", "react-dom/client", "react-router"] },
});
await server.listen();
console.log("Formation preview: http://127.0.0.1:5192/formation-fixture");
