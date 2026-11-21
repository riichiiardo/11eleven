// Fake account endpoint only; never contacts Supabase or stores passwords.
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let last = null;
const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-account-preview",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "president-account-preview",
      enforce: "pre",
      resolveId(s) {
        if (s === "/account-fixture.tsx") return "\0account-fixture.tsx";
      },
      async load(s) {
        if (s === path.resolve("src/infrastructure/supabase/client.ts"))
          return `export const supabase={functions:{async invoke(name,{body}){const response=await fetch('/account-fixture-api',{method:'POST',body:JSON.stringify(body)});const data=await response.json();window.dispatchEvent(new Event('account-changed'));return {data,error:null};}}};`;
        if (s === "\0account-fixture.tsx")
          return (
            await transformWithEsbuild(
              `import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import{PresidentAccountDialog}from'/src/components/eleven/admin/PresidentAccountDialog.tsx';import{Toaster}from'sonner';import'/src/index.css';function Fixture(){const[last,setLast]=useState(null);useEffect(()=>{const load=()=>fetch('/account-fixture-api').then(r=>r.json()).then(setLast);load();window.addEventListener('account-changed',load);return()=>window.removeEventListener('account-changed',load);},[]);return <main className="mx-auto max-w-3xl space-y-4 p-8"><h1>Presidentes · Prueba local con datos ficticios</h1><p>No crea usuarios ni cambia contraseñas reales.</p><PresidentAccountDialog tournamentId="${id(10)}"/><PresidentAccountDialog tournamentId="${id(10)}" target={{userId:'${id(3)}',displayName:'Presidente de prueba',email:'prueba@example.invalid'}}/>{last&&<p role="status">Operación de prueba registrada: {last.action} · {last.email} · contraseña {last.passwordChanged?'asignada':'conservada'}</p>}<Toaster/></main>;}createRoot(document.getElementById('root')).render(<Fixture/>);`,
              "account-fixture.tsx",
              { loader: "tsx", jsx: "automatic" },
            )
          ).code;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url === "/account-fixture-api") {
            res.setHeader("Content-Type", "application/json");
            if (req.method === "POST") {
              let text = "";
              for await (const chunk of req) text += chunk;
              const body = JSON.parse(text);
              if (body.action === "check") {
                res.end(JSON.stringify({ ok: true }));
                return;
              }
              last = {
                action: body.action,
                email: body.email,
                passwordChanged: Boolean(body.password),
              };
              res.end(
                JSON.stringify({
                  ok: true,
                  userId: id(3),
                  message: "Operación ficticia guardada",
                }),
              );
            } else res.end(JSON.stringify(last));
            return;
          }
          if (req.url?.split("?")[0] !== "/account-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              "/account-fixture",
              '<!doctype html><html lang="es"><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/account-fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve("src") },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 5195, strictPort: true, hmr: false },
});
await server.listen();
console.log("Local fixture: http://127.0.0.1:5195/account-fixture");
