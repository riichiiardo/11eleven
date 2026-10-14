/**
 * 11Eleven — adaptadores de las RPCs de lectura.
 *
 * Las RPCs de supabase/views.sql ya devuelven jsonb con claves camelCase, así
 * que aquí solo se normalizan timestamps (timestamptz → ms) y se tipan las
 * respuestas para la capa de compatibilidad.
 */

import { autoLineup, evaluateLineup, evaluateSquadRules, isFormationCode, type Lineup } from "@/convex/rulesEngine";
import type { AppStateView } from "@/convex/appTypes";

type Json = Record<string, unknown>;

const ts = (v: unknown): number | null => (typeof v === "number" ? v : null);

export function adaptTournamentState(raw: Json | null): Json | null {
  if (!raw || raw.needsLeague || raw.needsClub) return raw;
  const state = raw as unknown as AppStateView;
  if (!state.rules || !state.club) return raw;
  const squad = state.squad ?? [];
  const saved = state.lineup;
  const formation = saved && isFormationCode(saved.formation)
    ? saved.formation
    : isFormationCode(state.rules.fc27FormationCode)
      ? state.rules.fc27FormationCode : "4-2-3-1";
  // Preserve a saved XI; propose one only when none has been saved yet.
  const lineup: Lineup = saved && Array.isArray(saved.slots) && saved.slots.length > 0
    ? { formation, slots: saved.slots }
    : autoLineup(squad, formation);
  const evaluation = evaluateSquadRules(state.rules, squad, state.budget?.available ?? 0, state.club.name);
  return {
    ...raw,
    squad,
    lineup,
    evaluation,
    lineupEvaluation: evaluateLineup(state.rules, squad, lineup, evaluation, state.club.country),
  };
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
