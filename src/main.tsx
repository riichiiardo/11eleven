import "@vly-ai/integrations";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor principal de 11Eleven.");
createRoot(root).render(<App />);
