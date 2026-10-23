// Real broadcast component, no authentication, Supabase or synthetic results.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
const preview = {
  name: "broadcast-preview",
  resolveId(id) {
    if (id === "/broadcast-preview.tsx") return "\0broadcast-preview";
  },
  load(id) {
    if (id === "\0broadcast-preview")
      return `import React from 'react';import{createRoot}from'react-dom/client';import{TwitchBroadcast}from'/src/components/eleven/TwitchBroadcast.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement('main',{className:'mx-auto max-w-5xl p-4 md:p-8'},React.createElement('p',{className:'mb-4 text-sm text-muted-foreground'},'Prueba local de transmisión · Sin cambios en resultados ni conexión a Supabase.'),React.createElement(TwitchBroadcast)));`;
  },
  configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.url?.split("?")[0] !== "/broadcast-preview") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(
        await vite.transformIndexHtml(
          req.url,
          '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>11Eleven · Transmisión</title></head><body><div id="root"></div><script type="module" src="/broadcast-preview.tsx"></script></body></html>',
        ),
      );
    });
  },
};
const server = await createServer({
  configFile: false,
  plugins: [preview, react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve("src") },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 5189, strictPort: true },
});
await server.listen();
console.log("Broadcast preview: http://127.0.0.1:5189/broadcast-preview");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
