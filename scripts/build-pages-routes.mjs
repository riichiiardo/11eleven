import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// GitHub Pages needs a document for each direct React Router entry point.
const routes = [
  "auth",
  "dashboard",
  "dashboard/club",
  "dashboard/club/plantilla",
  "dashboard/club/estado",
  "dashboard/formacion",
  "dashboard/mercado",
  "dashboard/mercado/negociaciones",
  "dashboard/draft",
  "dashboard/competicion",
  "dashboard/transmision",
  "dashboard/equipos",
  "dashboard/reglas",
  "dashboard/perfil",
  "dashboard/chat",
  "dashboard/admin",
];

for (const route of routes) {
  const directory = join("dist", route);
  await mkdir(directory, { recursive: true });
  await copyFile("dist/index.html", join(directory, "index.html"));
}
