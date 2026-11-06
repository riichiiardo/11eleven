// Real broadcast component, no authentication, Supabase or synthetic results.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import os from "node:os";
import { readFile } from "node:fs/promises";
const port = Number(process.env.BROADCAST_PREVIEW_PORT ?? 5189);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Puerto de prueba inválido.");
const preview = {
  name: "broadcast-preview",
  configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.url?.split("?")[0] === "/broadcast-archive.json") {
        res.setHeader("Content-Type", "application/json");
        try {
          const content = process.env.BROADCAST_ARCHIVE_PREVIEW_FILE
            ? await readFile(process.env.BROADCAST_ARCHIVE_PREVIEW_FILE, "utf8")
            : "[]";
          const data = JSON.parse(content);
          if (!Array.isArray(data)) throw Error("Invalid preview data");
          res.end(JSON.stringify(data));
        } catch {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: "No se pudo leer el archivo de revisión local.",
            }),
          );
        }
        return;
      }
      if (req.url?.split("?")[0] !== "/broadcast-preview") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(
        await vite.transformIndexHtml(
          req.url,
          '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>11Eleven · Transmisión</title></head><body><div id="root"></div><script type="module" src="/scripts/broadcast-preview.tsx"></script></body></html>',
        ),
      );
    });
  },
};
const server = await createServer({
  configFile: false,
  cacheDir: path.join(os.tmpdir(), "11eleven-broadcast-vite-cache"),
  plugins: [preview, react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve("src") },
    dedupe: ["react", "react-dom"],
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": '""',
    "import.meta.env.VITE_SUPABASE_ANON_KEY": '""',
  },
  server: { host: "127.0.0.1", port, strictPort: true },
});
await server.listen();
console.log(`Broadcast preview: http://127.0.0.1:${port}/broadcast-preview`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
