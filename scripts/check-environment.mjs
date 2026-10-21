/** Local startup diagnostics. Never print credentials or mutate a backend. */
import { loadEnv } from "vite";

if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error("11Eleven requiere Node.js 24. Ejecuta nvm use.");
  process.exit(1);
}
const loaded = loadEnv("development", process.cwd(), "VITE_");
const url = process.env.VITE_SUPABASE_URL || loaded.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || loaded.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local. Consulta .env.example. No pegues claves en el frontend.");
  process.exit(1);
}
const parsed = new URL(url);
if (!/^https?:$/.test(parsed.protocol)) throw new Error("Project URL inválida.");
if (key.startsWith("ey")) {
  let payload;
  try { payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url")); } catch { throw new Error("La clave pública no es válida."); }
  if (payload.role !== "anon") throw new Error("Solo se admite una clave anon o publishable en el navegador.");
} else if (!key.startsWith("sb_publishable_")) {
  throw new Error("Solo se admite una clave anon o publishable en el navegador.");
}
console.log(`Node.js 24 y configuración pública disponibles: ${parsed.origin}`);
if (process.argv.includes("--remote")) {
  const response = await fetch(`${parsed.origin}/auth/v1/health`, {
    headers: { apikey: key }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase Auth no disponible: HTTP ${response.status}`);
  console.log("Supabase Auth responde correctamente. No se han creado usuarios ni modificado datos.");
}
