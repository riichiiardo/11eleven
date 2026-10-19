// Isolated browser fixture. Never connects to Supabase or uses real accounts.
import { createServer } from "vite";
import path from "node:path";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let saved = {
  revision: 0,
  status: "draft",
  canReview: true,
  limit: 6,
  entries: [],
  outgoing: [],
  clubs: [{ id: id(1), name: "Equipo vendedor de prueba" }],
  players: [
    {
      id: id(2),
      clubId: id(1),
      name: "Jugador Existente",
      nationality: "Colombia",
      position: "MC",
      ovr: 82,
    },
  ],
  ownPlayers: [
    {
      id: id(3),
      clubId: id(4),
      name: "Jugador de Mi Club",
      nationality: "España",
      position: "DFC",
      ovr: 80,
    },
  ],
};
const server = await createServer({
  server: { host: "127.0.0.1", port: 5186, strictPort: true, hmr: false },
  plugins: [
    {
      name: "draft-ui-fixture",
      enforce: "pre",
      resolveId(source) {
        if (source === "/draft-fixture.tsx") return "\0draft-fixture";
      },
      load(source) {
        if (source === "\0draft-fixture")
          return `import React from 'react'; import {createRoot} from 'react-dom/client'; import {DraftPrelist} from '/src/components/eleven/DraftPrelist.tsx'; import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement('main',{style:{maxWidth:1000,margin:'32px auto',padding:16}},React.createElement('h1',null,'Prueba local de Draft · Datos ficticios'),React.createElement(DraftPrelist)));`;
        if (source === path.resolve("src/lib/supabase/client.ts"))
          return `export const supabase={};export const supabaseUrl='local-fixture';export const supabaseConfigError=null;export async function rpc(fn,args={}){const response=await fetch('/__draft_fixture/'+fn,{method:'POST',body:JSON.stringify(args)});const data=await response.json();if(!response.ok)throw Error(data.error);return data;}`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url === "/draft-fixture") {
            res.setHeader("Content-Type", "text/html");
            res.end(
              await vite.transformIndexHtml(
                req.url,
                `<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/draft-fixture.tsx"></script></body></html>`,
              ),
            );
            return;
          }
          if (!req.url?.startsWith("/__draft_fixture/")) return next();
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const args = JSON.parse(raw || "{}");
          let result = null;
          const fn = req.url.split("/").pop();
          if (fn === "draft_prelist_state") result = saved;
          if (fn === "save_draft_prelist") {
            if (args.p_revision !== saved.revision) {
              res.statusCode = 409;
              result = { error: "La lista cambió" };
            } else {
              saved = {
                ...saved,
                entries: args.p_entries,
                outgoing: args.p_outgoing,
                revision: saved.revision + 1,
                status: args.p_submit ? "submitted" : "draft",
              };
              result = saved.revision;
            }
          }
          if (fn === "draft_review_state")
            result = {
              isAdmin: true,
              reviewers: [],
              presidents: [],
              lists:
                saved.status === "submitted"
                  ? [
                      {
                        presidentId: id(9),
                        president: "Presidente de prueba",
                        revision: saved.revision,
                        outgoing: saved.outgoing,
                        entries: saved.entries.map((e) =>
                          e.kind === "owned"
                            ? {
                                ...e,
                                ...saved.players.find(
                                  (p) => p.id === e.playerId,
                                ),
                                id: e.id,
                                seller: saved.clubs[0].name,
                                available: true,
                              }
                            : e,
                        ),
                      },
                    ]
                  : [],
            };
          if (fn === "review_draft_entry") {
            saved = {
              ...saved,
              revision: saved.revision + 1,
              entries: saved.entries.map((e) =>
                e.id === args.p_entry_id
                  ? {
                      ...e,
                      reviewStatus: args.p_approve ? "approved" : "rejected",
                      reviewNote: args.p_note,
                    }
                  : e,
              ),
            };
            if (!saved.entries.some((e) => e.reviewStatus === "pending"))
              saved.status = "reviewed";
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        });
      },
    },
  ],
});
await server.listen();
console.log(
  "Local isolated draft fixture: http://127.0.0.1:5186/draft-fixture",
);
