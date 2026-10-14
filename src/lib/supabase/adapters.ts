/**
 * 11Eleven — adaptadores de las RPCs de lectura.
 *
 * Las RPCs de supabase/views.sql ya devuelven jsonb con claves camelCase, así
 * que aquí solo se normalizan timestamps (timestamptz → ms) y se tipan las
 * respuestas para la capa de compatibilidad.
 */

import {
  autoLineup,
  evaluateLineup,
  evaluateSquadRules,
  isFormationCode,
  type Lineup,
} from "@/convex/rulesEngine";
import type { AppStateView } from "@/convex/appTypes";
import {
  effectiveRules,
  additionalChecks,
  type ConfiguredRules,
} from "@/lib/rule-configuration";

type Json = Record<string, unknown>;

const ts = (v: unknown): number | null => (typeof v === "number" ? v : null);

export function adaptTournamentState(raw: Json | null): Json | null {
  if (!raw || raw.needsLeague || raw.needsClub) return raw;
  const state = raw as unknown as AppStateView;
  if (!state.rules || !state.club) return raw;
  const rules = effectiveRules(state.rules as ConfiguredRules);
  const squad = state.squad ?? [];
  const saved = state.lineup;
  const formation =
    saved && isFormationCode(saved.formation)
      ? saved.formation
      : isFormationCode(state.rules.fc27FormationCode)
        ? state.rules.fc27FormationCode
        : "4-2-3-1";
  // Preserve a saved XI; propose one only when none has been saved yet.
  const lineup: Lineup =
    saved && Array.isArray(saved.slots) && saved.slots.length > 0
      ? { formation, slots: saved.slots }
      : autoLineup(squad, formation);
  const evaluation = evaluateSquadRules(
    rules,
    squad,
    state.budget?.available ?? 0,
    state.club.name,
  );
  evaluation.checks.push(
    ...additionalChecks(rules, squad, [], "squad", state.club.name),
  );
  evaluation.violations = evaluation.checks.filter((check) => !check.passed);
  evaluation.passed = evaluation.violations.length === 0;
  const lineupEvaluation = evaluateLineup(
    rules,
    squad,
    lineup,
    evaluation,
    state.club.country,
  );
  if (rules.configuration)
    lineupEvaluation.checks = lineupEvaluation.checks.filter(
      (check) => check.id !== "lineup-u20" && check.id !== "lineup-club-nation",
    );
  lineupEvaluation.checks.push(
    ...additionalChecks(rules, squad, lineupEvaluation.starters, "xi"),
  );
  lineupEvaluation.valid = lineupEvaluation.checks.every(
    (check) => check.passed,
  );
  return {
    ...raw,
    rules,
    squad,
    lineup,
    evaluation,
    actions:
      state.actions ??
      (evaluation.passed
        ? []
        : [
            {
              id: "squad-rules",
              tone: "warning",
              title: "Revisa tu plantilla",
              description:
                "Hay requisitos del reglamento pendientes de cumplir.",
              action: {
                label: "Ver plantilla",
                to: "/dashboard/club/plantilla",
              },
            },
          ]),
    lineupEvaluation,
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
