/**
 * 11Eleven — adaptadores de las RPCs de lectura.
 *
 * Las RPCs de supabase/views.sql ya devuelven jsonb con claves camelCase, así
 * que aquí solo se normalizan timestamps (timestamptz → ms) y se tipan las
 * respuestas para la capa de compatibilidad.
 */

type Json = Record<string, unknown>;

const ts = (v: unknown): number | null => (typeof v === "number" ? v : null);

export function adaptTournamentState(raw: Json | null): Json | null {
  return raw;
}

export function adaptOffer(o: Json): Json {
  return {
    ...o,
    createdAt: ts(o.createdAt),
    updatedAt: ts(o.updatedAt),
    agreedAt: ts(o.agreedAt),
    executedAt: ts(o.executedAt),
  };
}

export function adaptOfferList(rows: Json[] | null): Json[] {
  return (rows ?? []).map(adaptOffer);
}

export function adaptMarketOverview(raw: Json | null) {
  if (!raw) return null;
  return {
    ...raw,
    received: adaptOfferList(raw.received as Json[] | null),
    sent: adaptOfferList(raw.sent as Json[] | null),
    reserved: adaptOfferList(raw.reserved as Json[] | null),
    history: adaptOfferList(raw.history as Json[] | null),
  };
}

export function adaptDraft(raw: Json | null) {
  return raw;
}
