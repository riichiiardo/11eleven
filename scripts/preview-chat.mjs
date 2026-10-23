// Local-only fixture: imports the real UI with a mock backend, never Supabase.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const self = id(31),
  contact = id(32),
  offer = id(501);
let sequence = 10;
const read = new Map(),
  retries = new Map();
const at = () => new Date().toISOString();
const message = (n, body, sender = "bot", metadata = {}) => ({
  id: String(n),
  body,
  sender,
  authorId: sender === "bot" ? null : contact,
  authorName: sender === "bot" ? "Bot 11Eleven" : "Presidente visitante",
  createdAt: at(),
  metadata,
});
const rooms = new Map([
  ["general:", [message(1, "¿Cómo vieron la última jornada?", "president")]],
  [
    `direct:${contact}`,
    [message(2, "Hola, podemos conversar por aquí.", "president")],
  ],
  [
    `offer:${offer}`,
    [
      message(
        3,
        "Club visitante → Mi club · Jugador de prueba · 1000000 € · Estado: enviada",
        "bot",
        { event: "offer", offerId: offer },
      ),
      message(4, "¿Te interesa negociar el precio?", "president"),
    ],
  ],
  [
    "bot:",
    [
      message(
        5,
        "Tienes partido: Jornada 2 · Mi club vs Club visitante · Fecha UTC: 2026-10-25 18:00",
        "bot",
        { event: "fixture", fixtureId: id(601) },
      ),
      message(
        6,
        "Resultado registrado: Jornada 1 · Mi club vs Club de prueba · 2–1\nGoles registrados: Jugador de prueba ×2",
        "bot",
        { event: "result", fixtureId: id(602) },
      ),
    ],
  ],
]);
const roomKey = (args) => `${args.p_kind}:${args.p_target ?? ""}`;
const titles = {
  general: "Sala general",
  bot: "Bot 11Eleven",
  direct: "Presidente visitante",
  offer: "Oferta · Jugador de prueba",
};
const fixture = {
  name: "chat-ui-fixture",
  enforce: "pre",
  resolveId(source) {
    if (source === "/chat-fixture.tsx") return "\0chat-fixture";
  },
  load(source) {
    if (source === path.resolve("src/services/backend/chat.ts"))
      return `async function call(fn,args={}){if(new URLSearchParams(window.location.search).has('error'))throw Error('Error de conexión simulado para esta prueba');const r=await fetch('/__chat_fixture/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}const params=s=>({p_kind:s.kind,p_target:s.targetId});export const chatBackend={inbox:()=>call('inbox'),history:(s,before=null,after=null)=>call('history',{...params(s),p_before:before,p_after:after}),send:(s,body,clientId)=>call('send',{...params(s),p_body:body,p_client_id:clientId}),read:(s,id)=>call('read',{...params(s),p_message_id:id})};`;
    if (source === "\0chat-fixture")
      return `import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router';import ChatPage from '/src/pages/app/Chat.tsx';import{DashboardStateProvider}from'/src/pages/app/dashboard-context.tsx';import '/src/index.css';const state={user:{id:'${id(1)}'},president:{id:'${self}'},tournament:{id:'${id(10)}'}};createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(DashboardStateProvider,{state},React.createElement('main',{className:'mx-auto max-w-6xl p-4 md:p-8'},React.createElement('p',{className:'mb-5 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950'},'Demostración local · Datos ficticios · Sin conexión a Supabase ni cambios en el torneo.'),React.createElement(ChatPage)))));`;
  },
  configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const route = req.url?.split("?")[0];
      if (route === "/chat-fixture" || route === "/dashboard/chat") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          await vite.transformIndexHtml(
            req.url,
            `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>11Eleven · Prueba de chat</title></head><body><div id="root"></div><script type="module" src="/chat-fixture.tsx"></script></body></html>`,
          ),
        );
        return;
      }
      if (!route?.startsWith("/__chat_fixture/")) return next();
      try {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const args = JSON.parse(raw || "{}"),
          fn = route.split("/").pop(),
          key = roomKey(args);
        const messages = rooms.get(key) ?? [];
        let result;
        if (fn === "inbox") {
          const threads = [...rooms.entries()].map(([k, rows]) => {
            const [kind, targetId] = k.split(":");
            return {
              id: k,
              kind,
              targetId: targetId || null,
              title: titles[kind],
              preview: rows[rows.length - 1]?.body ?? "",
              updatedAt: rows[rows.length - 1]?.createdAt ?? at(),
              unread: rows.filter(
                (m) =>
                  m.authorId !== self &&
                  BigInt(m.id) > BigInt(read.get(k) ?? "0"),
              ).length,
            };
          });
          result = {
            presidentId: self,
            unread: threads.reduce((n, t) => n + t.unread, 0),
            contacts: [
              {
                id: contact,
                name: "Presidente visitante",
                club: "Club visitante",
              },
            ],
            threads,
          };
        } else if (fn === "history") {
          const eligible = messages.filter(
            (m) =>
              (!args.p_before || BigInt(m.id) < BigInt(args.p_before)) &&
              (!args.p_after || BigInt(m.id) > BigInt(args.p_after)),
          );
          const slice = args.p_after
            ? eligible.slice(0, 50)
            : eligible.slice(-50);
          result = {
            messages: slice,
            hasMore: messages.some(
              (m) => slice[0] && BigInt(m.id) < BigInt(slice[0].id),
            ),
            hasNewer: !!args.p_after && eligible.length > 50,
            offer:
              args.p_kind === "offer"
                ? { id: offer, status: "enviada", cash: 1000000 }
                : null,
          };
        } else if (fn === "send") {
          if (args.p_kind === "bot")
            throw Error("Solo el servidor publica avisos del bot.");
          if (!args.p_body?.trim() || [...args.p_body.trim()].length > 2000)
            throw Error("Escribe un mensaje de 1 a 2000 caracteres.");
          result = retries.get(args.p_client_id);
          if (!result) {
            result = String(++sequence);
            messages.push({
              ...message(result, args.p_body.trim(), "president"),
              authorId: self,
              authorName: "Mi presidente",
            });
            rooms.set(key, messages);
            retries.set(args.p_client_id, result);
          }
        } else if (fn === "read") {
          read.set(key, args.p_message_id);
          result = null;
        } else throw Error("Operación de prueba desconocida");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      } catch (e) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  },
};
const server = await createServer({
  configFile: false,
  plugins: [react(), tailwindcss(), fixture],
  resolve: {
    alias: { "@": path.resolve("src") },
    dedupe: ["react", "react-dom", "react-router"],
  },
  server: { host: "127.0.0.1", port: 5187, strictPort: true, hmr: false },
  optimizeDeps: { include: ["react", "react-dom/client", "react-router"] },
});
await server.listen();
console.log(
  "Chat fixture: http://127.0.0.1:5187/chat-fixture · only fictitious local data",
);
