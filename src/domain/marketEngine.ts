/**
 * 11Eleven — Market Engine
 *
 * Every market operation is projected against the same rule engine as the rest
 * of the product: creating an offer, accepting it, and executing it (after the
 * reservation window) are three separate validations of the SAME rules on the
 * CURRENT state of both clubs. That is what makes a reserved agreement safe:
 * nothing executes unless it is legal at the exact moment of execution.
 */

import {
  FREE_AGENT_CLUB,
  GROUP_LABEL,
  GROUP_ORDER,
  formatMoney,
  groupLimits,
  type Position,
  type PositionGroup,
  type RuleCheck,
  type TournamentRules,
} from "./rulesEngine";

/* ------------------------------------------------------------------ *
 * Offer lifecycle
 * ------------------------------------------------------------------ */

export const OFFER_TYPES = ["cash", "trade"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];

export const OFFER_STATUSES = [
  "borrador",
  "enviada",
  "negociacion",
  "aceptada",
  "reservada",
  "ejecutada",
  "rechazada",
  "cancelada",
  "expirada",
  "invalidada",
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export type OfferStatusMeta = {
  label: string;
  symbol: string;
  tone: "progress" | "open" | "locked" | "blocked" | "done";
  className: string;
  description: string;
};

export const OFFER_STATUS_META: Record<OfferStatus, OfferStatusMeta> = {
  borrador: {
    label: "Borrador",
    symbol: "✎",
    tone: "locked",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    description: "Preparada pero aún no enviada al otro Presidente.",
  },
  enviada: {
    label: "Enviada",
    symbol: "➤",
    tone: "progress",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    description: "Esperando respuesta. El otro Presidente puede aceptar, rechazar o responder.",
  },
  negociacion: {
    label: "En negociación",
    symbol: "⇄",
    tone: "progress",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    description: "Hay una contraoferta sobre la mesa: revisa las condiciones.",
  },
  aceptada: {
    label: "Aceptada",
    symbol: "✓",
    tone: "open",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "Acuerdo alcanzado. Pasa a validación final antes de ejecutarse.",
  },
  reservada: {
    label: "Reservada",
    symbol: "⏳",
    tone: "progress",
    className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    description:
      "Acuerdo reservado: los jugadores implicados quedan comprometidos hasta la ejecución.",
  },
  ejecutada: {
    label: "Ejecutada",
    symbol: "✔",
    tone: "done",
    className: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
    description: "La operación se aplicó a las plantillas y quedó registrada en la auditoría.",
  },
  rechazada: {
    label: "Rechazada",
    symbol: "✕",
    tone: "blocked",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    description: "El otro Presidente declinó la propuesta.",
  },
  cancelada: {
    label: "Cancelada",
    symbol: "⊘",
    tone: "locked",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    description: "La operación se retiró antes de completarse.",
  },
  expirada: {
    label: "Expirada",
    symbol: "⏱",
    tone: "locked",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    description: "Se agotó el tiempo de respuesta de la propuesta.",
  },
  invalidada: {
    label: "Invalidada",
    symbol: "⚠",
    tone: "blocked",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    description:
      "La validación final falló: algo cambió entre el acuerdo y la ejecución. El motivo está registrado.",
  },
};

/** States that still hold a commitment over the players involved. */
export const COMMITTED_STATUSES: OfferStatus[] = [
  "enviada",
  "negociacion",
  "aceptada",
  "reservada",
];

export const OPEN_STATUSES: OfferStatus[] = ["enviada", "negociacion"];

export const MARKET_SCOPES = ["todos", "libre", "clubes"] as const;
export type MarketScope = (typeof MARKET_SCOPES)[number];

export const MARKET_SCOPE_LABEL: Record<MarketScope, string> = {
  todos: "Todos los jugadores",
  libre: "Agentes libres",
  clubes: "Jugadores de otros clubes",
};

/* ------------------------------------------------------------------ *
 * Squad projections
 * ------------------------------------------------------------------ */

/** Minimal shape shared by squad players and market listings. */
export type OfferPlayer = {
  playerId: string;
  name: string;
  position: Position;
  group: PositionGroup;
  ovr: number;
  age: number;
  value: number;
  realClub: string;
};

function groupCountsOf(players: OfferPlayer[]): Record<PositionGroup, number> {
  const counts: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const player of players) counts[player.group] += 1;
  return counts;
}

/**
 * Projects a squad after an operation and checks size, position ranges, sub-21
 * and per-club limits. Used on the buyer side, the seller side, at creation
 * time and again at execution time.
 */
export function projectSquad(params: {
  rules: TournamentRules;
  label: string;
  before: OfferPlayer[];
  incoming: OfferPlayer[];
  outgoing: OfferPlayer[];
  ownClubName?: string;
  /** Money flowing IN (seller) is not a cost; money flowing OUT (buyer) is. */
  cashDelta?: number;
  availableBudget?: number;
}): RuleCheck[] {
  const {
    rules,
    label,
    before,
    incoming,
    outgoing,
    ownClubName,
    cashDelta = 0,
    availableBudget,
  } = params;

  const outgoingIds = new Set(outgoing.map((player) => player.playerId));
  const remaining = before.filter((player) => !outgoingIds.has(player.playerId));
  const after = [...remaining, ...incoming];
  const countsAfter = groupCountsOf(after);
  const checks: RuleCheck[] = [];

  const sizeOk = after.length <= rules.squadSize;
  checks.push({
    id: "size",
    ruleRef: "R-02 · Tamaño de plantilla",
    label: `${label}: plazas tras la operación`,
    value: `${after.length} / ${rules.squadSize}`,
    passed: sizeOk,
    detail: sizeOk
      ? `La plantilla quedaría en ${after.length} jugadores de ${rules.squadSize} permitidos.`
      : `Tras la operación ${label.toLowerCase()} tendría ${after.length} jugadores y el máximo es ${rules.squadSize}. Debes liberar ${
          after.length - rules.squadSize
        } plaza(s) antes de cerrar la operación.`,
  });

  for (const group of GROUP_ORDER) {
    const limits = groupLimits(rules, group);
    const beforeCount = groupCountsOf(remaining)[group];
    const afterCount = countsAfter[group];
    const losesPlayers = outgoing.filter((player) => player.group === group).length;
    const gainsPlayers = incoming.filter((player) => player.group === group).length;

    if (losesPlayers > 0) {
      const ok = afterCount >= limits.min;
      checks.push({
        id: `group-min-${group}`,
        ruleRef: `R-0${group === "GK" ? 3 : group === "DEF" ? 4 : group === "MID" ? 5 : 6} · Cupos por posición`,
        label: `${label}: ${GROUP_LABEL[group]} mínimos`,
        value: `${afterCount} / ${limits.min}`,
        passed: ok,
        detail: ok
          ? `Te quedarían ${afterCount} ${GROUP_LABEL[group].toLowerCase()}, dentro del rango ${limits.min}-${limits.max}.`
          : `No puedes dejar el grupo de ${GROUP_LABEL[group].toLowerCase()} en ${afterCount}: el mínimo del torneo es ${limits.min} (ahora tienes ${beforeCount} y salen ${losesPlayers}).`,
      });
    }
    if (gainsPlayers > 0) {
      const ok = afterCount <= limits.max;
      checks.push({
        id: `group-max-${group}`,
        ruleRef: `R-0${group === "GK" ? 3 : group === "DEF" ? 4 : group === "MID" ? 5 : 6} · Cupos por posición`,
        label: `${label}: ${GROUP_LABEL[group]} máximos`,
        value: `${afterCount} / ${limits.max}`,
        passed: ok,
        detail: ok
          ? `El grupo de ${GROUP_LABEL[group].toLowerCase()} quedaría en ${afterCount}, dentro del rango ${limits.min}-${limits.max}.`
          : `El grupo de ${GROUP_LABEL[group].toLowerCase()} quedaría en ${afterCount} y el máximo es ${limits.max}.`,
      });
    }
  }

  const perClub = new Map<string, number>();
  for (const player of after) {
    if (ownClubName && player.realClub === ownClubName) continue;
    if (player.realClub === FREE_AGENT_CLUB) continue;
    perClub.set(player.realClub, (perClub.get(player.realClub) ?? 0) + 1);
  }
  for (const player of incoming) {
    if (player.realClub === FREE_AGENT_CLUB) continue;
    if (ownClubName && player.realClub === ownClubName) continue;
    const count = perClub.get(player.realClub) ?? 0;
    checks.push({
      id: `club-${player.realClub}`,
      ruleRef: "R-07 · Jugadores por club real",
      label: `${label}: origen ${player.realClub}`,
      value: `${count} / ${rules.maxPerRealClub}`,
      passed: count <= rules.maxPerRealClub,
      detail:
        count <= rules.maxPerRealClub
          ? `${player.name} mantiene ${player.realClub} dentro del límite de ${rules.maxPerRealClub} jugadores.`
          : `Tu plantilla ya tiene ${count} jugadores pertenecientes a ${player.realClub} y el máximo es ${rules.maxPerRealClub}.`,
    });
  }

  const u21After = after.filter((player) => player.age <= 21).length;
  if (incoming.some((player) => player.age <= 21)) {
    checks.push({
      id: "u21",
      ruleRef: "R-09 · Jugadores sub-21",
      label: `${label}: sub-21`,
      value: `${u21After} / ${rules.maxU21}`,
      passed: u21After <= rules.maxU21,
      detail:
        u21After <= rules.maxU21
          ? `Quedarían ${u21After} jugadores de 21 años o menos, dentro del límite.`
          : `Quedarían ${u21After} jugadores de 21 años o menos y el máximo es ${rules.maxU21}.`,
    });
  }

  if (cashDelta !== 0 && typeof availableBudget === "number") {
    const after_ = availableBudget - cashDelta;
    checks.push({
      id: "budget",
      ruleRef: "R-01 · Presupuesto",
      label: `${label}: presupuesto`,
      value: formatMoney(after_),
      passed: after_ >= 0,
      detail:
        after_ >= 0
          ? `Presupuesto suficiente: quedarían ${formatMoney(after_)} disponibles.`
          : `No hay presupuesto suficiente: la operación exige ${formatMoney(cashDelta)} y solo dispones de ${formatMoney(availableBudget)}.`,
    });
  }

  return checks;
}

export type MarketIntent = {
  type: OfferType;
  cash: number;
  requested: OfferPlayer[];
  offered: OfferPlayer[];
};

export type OfferEvaluation = {
  bidderChecks: RuleCheck[];
  sellerChecks: RuleCheck[];
  checks: RuleCheck[];
  passed: boolean;
  blockers: RuleCheck[];
};

/**
 * Validates a complete operation from both sides. The same function powers the
 * live preview in the offer dialog and the server-side guard.
 */
export function evaluateOffer(params: {
  rules: TournamentRules;
  intent: MarketIntent;
  bidderSquad: OfferPlayer[];
  bidderBudget: number;
  bidderClubName?: string;
  sellerSquad: OfferPlayer[] | null;
  sellerBudget: number;
  sellerClubName?: string;
  sellerLabel?: string;
}): OfferEvaluation {
  const {
    rules,
    intent,
    bidderSquad,
    bidderBudget,
    bidderClubName,
    sellerSquad,
    sellerBudget,
    sellerClubName,
    sellerLabel = "Club vendedor",
  } = params;

  const uniqueBidderChecks: RuleCheck[] = projectSquad({
    rules,
    label: "Tu plantilla",
    before: bidderSquad,
    incoming: intent.requested,
    outgoing: intent.offered,
    ownClubName: bidderClubName,
    cashDelta: intent.cash,
    availableBudget: bidderBudget,
  });

  for (const player of intent.requested) {
    const ok = player.ovr >= rules.minOvr;
    uniqueBidderChecks.push({
      id: `ovr-${player.playerId}`,
      ruleRef: "R-08 · OVR mínimo",
      label: `OVR de ${player.name}`,
      value: `${player.ovr} / ${rules.minOvr}`,
      passed: ok,
      detail: ok
        ? `${player.name} supera el OVR mínimo exigido por el torneo.`
        : `${player.name} tiene ${player.ovr} de OVR y el torneo exige al menos ${rules.minOvr}.`,
    });
  }

  const sellerChecks =
    sellerSquad === null
      ? []
      : projectSquad({
          rules,
          label: sellerLabel,
          before: sellerSquad,
          incoming: intent.offered,
          outgoing: intent.requested,
          ownClubName: sellerClubName,
          cashDelta: -intent.cash,
          availableBudget: sellerBudget,
        });

  const checks = [...uniqueBidderChecks, ...sellerChecks];
  const blockers = checks.filter((check) => !check.passed);

  return {
    bidderChecks: uniqueBidderChecks,
    sellerChecks,
    checks,
    passed: blockers.length === 0,
    blockers,
  };
}

/* ------------------------------------------------------------------ *
 * Final validation before execution
 * ------------------------------------------------------------------ */

export type OwnershipState = "mine" | "seller" | "free" | "other" | "missing";

export type ExecutionValidation = {
  checks: RuleCheck[];
  passed: boolean;
  reasons: string[];
};

/**
 * "Validación final del Trade" (prompt §15): everything is re-checked against
 * the current state right before the operation is applied.
 */
export function evaluateExecution(params: {
  rules: TournamentRules;
  intent: MarketIntent;
  bidderSquad: OfferPlayer[];
  bidderBudget: number;
  bidderClubName?: string;
  sellerSquad: OfferPlayer[] | null;
  sellerBudget: number;
  sellerClubName?: string;
  requestedOwnership: OwnershipState[];
  offeredOwnership: OwnershipState[];
  tournamentAllowsOperations: boolean;
  sellerActive: boolean;
}): ExecutionValidation {
  const {
    rules,
    intent,
    bidderSquad,
    bidderBudget,
    bidderClubName,
    sellerSquad,
    sellerBudget,
    sellerClubName,
    requestedOwnership,
    offeredOwnership,
    tournamentAllowsOperations,
    sellerActive,
  } = params;

  const checks: RuleCheck[] = [];
  const push = (
    id: string,
    ruleRef: string,
    label: string,
    value: string,
    passed: boolean,
    detail: string,
  ) => checks.push({ id, ruleRef, label, value, passed, detail });

  push(
    "tournament-state",
    "Estado del torneo",
    "El torneo admite operaciones",
    tournamentAllowsOperations ? "Sí" : "No",
    tournamentAllowsOperations,
    tournamentAllowsOperations
      ? "El torneo está en una fase que permite ejecutar operaciones."
      : "El torneo está suspendido o cancelado: ninguna operación se ejecuta hasta que Administración lo reactive.",
  );

  if (sellerSquad) {
    push(
      "seller-active",
      "Presidencias activas",
      "El club vendedor sigue activo",
      sellerActive ? "Sí" : "No",
      sellerActive,
      sellerActive
        ? "Ambas presidencias siguen activas en el torneo."
        : "La presidencia del club vendedor ya no está activa: la operación no puede ejecutarse.",
    );
  }

  intent.requested.forEach((player, index) => {
    const state = requestedOwnership[index] ?? "missing";
    const ok = state === "seller" || state === "free";
    push(
      `requested-${player.playerId}`,
      "Pertenencia del jugador",
      `${player.name} sigue disponible`,
      ok ? "Sí" : "No",
      ok,
      ok
        ? `${player.name} sigue perteneciendo a ${
            state === "free" ? "la lista de agentes libres" : "el club vendedor"
          }.`
        : `${player.name} ya no puede ser transferido porque cambió de club después del acuerdo (lo adquirió otro Presidente o la operación previa ya se ejecutó).`,
    );
  });

  intent.offered.forEach((player, index) => {
    const state = offeredOwnership[index] ?? "missing";
    const ok = state === "mine";
    push(
      `offered-${player.playerId}`,
      "Pertenencia del jugador",
      `${player.name} sigue en tu plantilla`,
      ok ? "Sí" : "No",
      ok,
      ok
        ? `${player.name} sigue disponible para salir en la operación.`
        : `${player.name} ya no está en tu plantilla: la operación quedó sin efecto y debe renegociarse.`,
    );
  });

  const projections = [
    ...projectSquad({
      rules,
      label: "Tu plantilla",
      before: bidderSquad,
      incoming: intent.requested,
      outgoing: intent.offered,
      ownClubName: bidderClubName,
      cashDelta: intent.cash,
      availableBudget: bidderBudget,
    }),
  ];
  if (sellerSquad) {
    projections.push(
      ...projectSquad({
        rules,
        label: "Club vendedor",
        before: sellerSquad,
        incoming: intent.offered,
        outgoing: intent.requested,
        ownClubName: sellerClubName,
        cashDelta: -intent.cash,
        availableBudget: sellerBudget,
      }),
    );
  }
  checks.push(...projections);

  const failed = checks.filter((check) => !check.passed);
  return { checks, passed: failed.length === 0, reasons: failed.map((check) => check.detail) };
}

/* ------------------------------------------------------------------ *
 * Offer guidance
 * ------------------------------------------------------------------ */

export type OfferGuidance = {
  availableBudget: number;
  maxOffer: number;
  suggested: number;
  walkAway: number;
};

/** The app works out the numbers so the President only decides intent. */
export function offerGuidance(
  playerValue: number,
  availableBudget: number,
  cashLockedByOtherOffers = 0,
): OfferGuidance {
  const spendable = Math.max(0, availableBudget - cashLockedByOtherOffers);
  return {
    availableBudget,
    maxOffer: spendable,
    suggested: Math.min(spendable, Math.round(playerValue * 1.1)),
    walkAway: Math.min(spendable, Math.round(playerValue * 1.35)),
  };
}

export function describeIntent(intent: MarketIntent): string {
  const requested = intent.requested.map((player) => player.name).join(", ");
  const offered = intent.offered.map((player) => player.name).join(", ");
  const parts: string[] = [];
  if (offered) parts.push(`ofrece ${offered}`);
  if (intent.cash > 0) parts.push(`${formatMoney(intent.cash)}`);
  const left = parts.length ? parts.join(" + ") : "sin contrapartida";
  return `${left} por ${requested || "sin jugadores solicitados"}`;
}
