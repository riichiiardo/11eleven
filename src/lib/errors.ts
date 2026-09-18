import { ConvexError } from "convex/values";

/**
 * The backend only ever throws human explanations, never raw status codes.
 * This surfaces that sentence to the President.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "string") return data;
  }
  if (error instanceof Error) {
    return error.message.replace(/^\[[^\]]*\]\s*/, "").trim() ||
      "No se pudo completar la operación.";
  }
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "hace unos segundos";
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  return new Date(timestamp).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
