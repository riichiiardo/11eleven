/**
 * 11Eleven — Tournament Rule Engine
 *
 * Single source of truth for every validation in the product. The backend
 * (Convex mutations) and the frontend (live feedback while the President
 * builds a lineup) import these pure functions, so the UI can never promise
 * something the server will reject.
 *
 * Core product chain: CLUB -> PLANTILLA -> MERCADO -> COMPETICIÓN.
 */

import type { Id } from "./_generated/dataModel";

/* ------------------------------------------------------------------ *
 * Positions
 * ------------------------------------------------------------------ */

export const POSITIONS = [
  "POR",
  "LD",
  "DFC",
  "LI",
  "MCD",
  "MC",
  "MCO",
  "ED",
  "EI",
  "DC",
] as const;

export type Position = (typeof POSITIONS)[number];

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  POR: "GK",
  LD: "DEF",
  DFC: "DEF",
  LI: "DEF",
  MCD: "MID",
  MC: "MID",
  MCO: "MID",
  ED: "FWD",
  EI: "FWD",
  DC: "FWD",
};

export const POSITION_LABEL: Record<Position, string> = {
  POR: "Portero",
  LD: "Lateral derecho",
  DFC: "Defensa central",
  LI: "Lateral izquierdo",
  MCD: "Mediocentro defensivo",
  MC: "Mediocentro",
  MCO: "Mediapunta",
  ED: "Extremo derecho",
  EI: "Extremo izquierdo",
  DC: "Delantero centro",
};

export const GROUP_ORDER: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];

export const GROUP_LABEL: Record<PositionGroup, string> = {
  GK: "Porteros",
  DEF: "Defensas",
  MID: "Medios",
  FWD: "Delanteros",
};

export const GROUP_SHORT: Record<PositionGroup, string> = {
  GK: "POR",
  DEF: "DEF",
  MID: "MED",
  FWD: "ATA",
};

export const GROUP_ACCENT: Record<PositionGroup, string> = {
  GK: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  DEF: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  MID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FWD: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function groupOf(position: Position): PositionGroup {
  return POSITION_GROUP[position];
}

/* ------------------------------------------------------------------ *
 * Player availability inside a squad
 * ------------------------------------------------------------------ */

export const AVAILABILITIES = [
  "transferible",
  "negociacion",
  "neutro",
  "intransferible",
] as const;

export type PlayerAvailability = (typeof AVAILABILITIES)[number];

export type AvailabilityMeta = {
  label: string;
  symbol: string;
  tone: "positive" | "warning" | "neutral" | "danger";
  className: string;
  description: string;
};

/** Icon + text + colour: availability is never communicated by colour alone. */
export const AVAILABILITY_META: Record<PlayerAvailability, AvailabilityMeta> = {
  transferible: {
    label: "Transferible",
    symbol: "✓",
    tone: "positive",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "Puede recibir ofertas de otros Presidentes de forma directa.",
  },
  negociacion: {
    label: "Posible negociación",
    symbol: "⚠",
    tone: "warning",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    description:
      "Abierto a conversaciones: el Presidente escucha propuestas por este jugador.",
  },
  neutro: {
    label: "Neutro",
    symbol: "○",
    tone: "neutral",
    className: "border-border bg-muted text-muted-foreground",
    description:
      "Sin intención declarada. Se puede iniciar conversación pero no hay apertura explícita.",
  },
  intransferible: {
    label: "Intransferible",
    symbol: "⊘",
    tone: "danger",
    className:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    description: "El Presidente bloqueó este jugador: no admite ofertas.",
  },
};

/* ------------------------------------------------------------------ *
 * Tournament rules
 * ------------------------------------------------------------------ */

export type TournamentRules = {
  budget: number;
  squadSize: number;
  gkMin: number;
  gkMax: number;
  defMin: number;
  defMax: number;
  midMin: number;
  midMax: number;
  fwdMin: number;
  fwdMax: number;
  maxPerRealClub: number;
  minOvr: number;
  maxU21: number;
  lineupLockHours: number;
};

export const DEFAULT_RULES: TournamentRules = {
  budget: 350_000_000,
  squadSize: 20,
  gkMin: 2,
  gkMax: 3,
  defMin: 6,
  defMax: 9,
  midMin: 6,
  midMax: 9,
  fwdMin: 6,
  fwdMax: 8,
  maxPerRealClub: 3,
  minOvr: 70,
  maxU21: 5,
  lineupLockHours: 2,
};

export type GroupLimits = { min: number; max: number };

export function groupLimits(
  rules: TournamentRules,
  group: PositionGroup,
): GroupLimits {
  switch (group) {
    case "GK":
      return { min: rules.gkMin, max: rules.gkMax };
    case "DEF":
      return { min: rules.defMin, max: rules.defMax };
    case "MID":
      return { min: rules.midMin, max: rules.midMax };
    case "FWD":
      return { min: rules.fwdMin, max: rules.fwdMax };
  }
}

/** Rule matrix used by the Rules screen and by the admin editor. */
export type RuleDescriptor = {
  code: string;
  title: string;
  description: string;
  /** Which of the four pillars this rule guards. */
  scope: "Club" | "Plantilla" | "Mercado" | "Competición";
  value: (rules: TournamentRules) => string;
  field?: keyof TournamentRules;
  min?: number;
  max?: number;
  step?: number;
  /** How the editor should show the value. */
  input?: "money" | "number";
};

export const RULE_DESCRIPTORS: RuleDescriptor[] = [
  {
    code: "R-01",
    title: "Presupuesto del Presidente",
    description:
      "Saldo inicial para construir la plantilla. Cada operación descuenta del mismo presupuesto y ninguna puede dejarlo en negativo.",
    scope: "Club",
    value: (r) => formatMoney(r.budget),
    field: "budget",
    min: 0,
    max: 2_000_000_000,
    step: 5_000_000,
    input: "money",
  },
  {
    code: "R-02",
    title: "Tamaño máximo de plantilla",
    description:
      "Número máximo de jugadores que un club puede registrar. El motor bloquea cualquier incorporación que lo supere.",
    scope: "Plantilla",
    value: (r) => `${r.squadSize} jugadores`,
    field: "squadSize",
    min: 11,
    max: 40,
    step: 1,
  },
  {
    code: "R-03",
    title: "Porteros en plantilla",
    description:
      "Rango obligatorio de porteros. Por debajo del mínimo la plantilla queda inválida; por encima del máximo no se admiten fichajes.",
    scope: "Plantilla",
    value: (r) => `${r.gkMin} - ${r.gkMax}`,
  },
  {
    code: "R-04",
    title: "Defensas en plantilla",
    description: "Rango obligatorio de defensas registrados en el club.",
    scope: "Plantilla",
    value: (r) => `${r.defMin} - ${r.defMax}`,
  },
  {
    code: "R-05",
    title: "Medios en plantilla",
    description: "Rango obligatorio de centrocampistas registrados en el club.",
    scope: "Plantilla",
    value: (r) => `${r.midMin} - ${r.midMax}`,
  },
  {
    code: "R-06",
    title: "Delanteros en plantilla",
    description: "Rango obligatorio de atacantes registrados en el club.",
    scope: "Plantilla",
    value: (r) => `${r.fwdMin} - ${r.fwdMax}`,
  },
  {
    code: "R-07",
    title: "Máximo de jugadores por club real",
    description:
      "Evita concentrar la plantilla en un solo club de origen y mantiene el mercado repartido entre Presidentes.",
    scope: "Mercado",
    value: (r) => `${r.maxPerRealClub} jugadores`,
    field: "maxPerRealClub",
    min: 1,
    max: 10,
    step: 1,
  },
  {
    code: "R-08",
    title: "OVR mínimo para fichar",
    description:
      "Ningún fichaje por debajo de este OVR entra en el torneo, salvo canteranos aprobados por Administración.",
    scope: "Mercado",
    value: (r) => `${r.minOvr} OVR`,
    field: "minOvr",
    min: 40,
    max: 95,
    step: 1,
  },
  {
    code: "R-09",
    title: "Máximo de jugadores sub-21",
    description:
      "Limita cuántos jugadores de 21 años o menos puede alinear un club a lo largo de la temporada.",
    scope: "Plantilla",
    value: (r) => `${r.maxU21} jugadores`,
    field: "maxU21",
    min: 0,
    max: 15,
    step: 1,
  },
  {
    code: "R-10",
    title: "Cierre de alineación",
    description:
      "Horas antes del inicio de la jornada en que la alineación titular queda bloqueada y no admite cambios.",
    scope: "Competición",
    value: (r) => `${r.lineupLockHours} h antes`,
    field: "lineupLockHours",
    min: 1,
    max: 72,
    step: 1,
  },
];

/* ------------------------------------------------------------------ *
 * Squad shape + stats
 * ------------------------------------------------------------------ */

export type SquadPlayerView = {
  squadPlayerId: Id<"squadPlayers">;
  playerId: Id<"players">;
  name: string;
  position: Position;
  group: PositionGroup;
  ovr: number;
  age: number;
  value: number;
  nationality: string;
  flag: string;
  availability: PlayerAvailability;
  realClub: string;
  realLeague: string;
  fcVersion: string;
};

export type SquadStats = {
  size: number;
  totalValue: number;
  averageOvr: number;
  averageAge: number;
  under21: number;
  groupCounts: Record<PositionGroup, number>;
  topPlayers: SquadPlayerView[];
  mostValuable?: SquadPlayerView;
  oldest?: SquadPlayerView;
};

export function computeSquadStats(players: SquadPlayerView[]): SquadStats {
  const size = players.length;
  const groupCounts: Record<PositionGroup, number> = {
    GK: 0,
    DEF: 0,
    MID: 0,
    FWD: 0,
  };
  let totalValue = 0;
  let ovrSum = 0;
  let ageSum = 0;
  let under21 = 0;

  for (const player of players) {
    groupCounts[player.group] += 1;
    totalValue += player.value;
    ovrSum += player.ovr;
    ageSum += player.age;
    if (player.age <= 21) under21 += 1;
  }

  const byOvr = [...players].sort((a, b) => b.ovr - a.ovr);
  const byValue = [...players].sort((a, b) => b.value - a.value);
  const byAge = [...players].sort((a, b) => b.age - a.age);

  return {
    size,
    totalValue,
    averageOvr: size ? Math.round((ovrSum / size) * 10) / 10 : 0,
    averageAge: size ? Math.round((ageSum / size) * 10) / 10 : 0,
    under21,
    groupCounts,
    topPlayers: byOvr.slice(0, 3),
    mostValuable: byValue[0],
    oldest: byAge[0],
  };
}

/* ------------------------------------------------------------------ *
 * Rule checks — "el árbitro invisible"
 * ------------------------------------------------------------------ */

export type RuleCheck = {
  id: string;
  /** Rule reference shown to the President, e.g. "R-02 · Tamaño de plantilla". */
  ruleRef: string;
  label: string;
  /** Measured value vs allowed value, e.g. "26 / 20". */
  value: string;
  passed: boolean;
  detail: string;
  /** Where the President can go to fix it. */
  action?: { label: string; to: string };
};

export type SquadEvaluation = {
  checks: RuleCheck[];
  passed: boolean;
  violations: RuleCheck[];
};

export function evaluateSquadRules(
  rules: TournamentRules,
  squad: SquadPlayerView[],
  availableBudget: number,
  /** Your own club is the squad's home club: only external clubs count. */
  ownClubName?: string,
): SquadEvaluation {
  const stats = computeSquadStats(squad);
  const checks: RuleCheck[] = [];

  checks.push({
    id: "squad-size",
    ruleRef: "R-02 · Tamaño de plantilla",
    label: "Tamaño de plantilla",
    value: `${stats.size} / ${rules.squadSize}`,
    passed: stats.size <= rules.squadSize,
    detail:
      stats.size <= rules.squadSize
        ? `Tu plantilla respeta el máximo de ${rules.squadSize} jugadores. Quedan ${
            rules.squadSize - stats.size
          } plazas disponibles para el mercado.`
        : `Tienes ${stats.size} jugadores y el torneo admite un máximo de ${rules.squadSize}. Debes liberar ${
            stats.size - rules.squadSize
          } antes de inscribir a nadie más.`,
    action: { label: "Ver plantilla", to: "/dashboard/club" },
  });

  for (const group of GROUP_ORDER) {
    const limits = groupLimits(rules, group);
    const count = stats.groupCounts[group];
    const passed = count >= limits.min && count <= limits.max;
    checks.push({
      id: `group-${group}`,
      ruleRef: `R-${group === "GK" ? "03" : group === "DEF" ? "04" : group === "MID" ? "05" : "06"} · ${GROUP_LABEL[group]}`,
      label: GROUP_LABEL[group],
      value: `${count} / ${limits.min}-${limits.max}`,
      passed,
      detail: passed
        ? `Cumples el rango de ${GROUP_LABEL[group].toLowerCase()} (${limits.min}-${limits.max}).`
        : count < limits.min
          ? `Necesitas al menos ${limits.min} ${GROUP_LABEL[group].toLowerCase()} y tienes ${count}. La plantilla queda incompleta hasta que incorpores ${
              limits.min - count
            }.`
          : `Tienes ${count} ${GROUP_LABEL[group].toLowerCase()} y el máximo permitido es ${limits.max}. No puedes incorporar más en este grupo.`,
      action: { label: "Ver plantilla", to: "/dashboard/club" },
    });
  }

  const perRealClub = new Map<string, number>();
  for (const player of squad) {
    if (ownClubName && player.realClub === ownClubName) continue;
    perRealClub.set(player.realClub, (perRealClub.get(player.realClub) ?? 0) + 1);
  }
  const biggestGroup = [...perRealClub.entries()].sort((a, b) => b[1] - a[1])[0];
  const maxFromClub = biggestGroup?.[1] ?? 0;
  checks.push({
    id: "real-club",
    ruleRef: "R-07 · Jugadores por club real",
    label: "Jugadores por club real",
    value: `${maxFromClub} / ${rules.maxPerRealClub}`,
    passed: maxFromClub <= rules.maxPerRealClub,
    detail:
      maxFromClub <= rules.maxPerRealClub
        ? `Ningún club externo aporta más de ${rules.maxPerRealClub} jugadores a tu plantilla. Tu propio club no cuenta para este límite.`
        : `${biggestGroup?.[0]} aporta ${maxFromClub} jugadores a tu plantilla y el máximo es ${rules.maxPerRealClub}.`,
  });

  checks.push({
    id: "u21",
    ruleRef: "R-09 · Jugadores sub-21",
    label: "Sub-21 en plantilla",
    value: `${stats.under21} / ${rules.maxU21}`,
    passed: stats.under21 <= rules.maxU21,
    detail:
      stats.under21 <= rules.maxU21
        ? `Proyecto con ${stats.under21} jugadores de 21 años o menos. Dentro del límite.`
        : `${stats.under21} jugadores de 21 años o menos superan el límite de ${rules.maxU21}.`,
  });

  checks.push({
    id: "budget",
    ruleRef: "R-01 · Presupuesto",
    label: "Presupuesto disponible",
    value: formatMoney(availableBudget),
    passed: availableBudget >= 0,
    detail:
      availableBudget >= 0
        ? `Puedes comprometer hasta ${formatMoney(availableBudget)} en el mercado sin romper ninguna regla.`
        : `Tu presupuesto está excedido en ${formatMoney(Math.abs(availableBudget))}. Administración debe revisar tus operaciones.`,
  });

  const violations = checks.filter((check) => !check.passed);
  return { checks, passed: violations.length === 0, violations };
}

/** Guards a single market operation against the same engine. */
export function evaluateSigning(
  rules: TournamentRules,
  squad: SquadPlayerView[],
  candidate: { name: string; position: Position; ovr: number; age: number; value: number; realClub: string },
  availableBudget: number,
  ownClubName?: string,
): SquadEvaluation {
  const stats = computeSquadStats(squad);
  const checks: RuleCheck[] = [];
  const limits = groupLimits(rules, groupOf(candidate.position));
  const countInGroup = stats.groupCounts[groupOf(candidate.position)];

  const push = (
    id: string,
    ruleRef: string,
    label: string,
    value: string,
    passed: boolean,
    detail: string,
  ) => checks.push({ id, ruleRef, label, value, passed, detail });

  push(
    "signing-budget",
    "R-01 · Presupuesto",
    "Presupuesto",
    `${formatMoney(candidate.value)} / ${formatMoney(availableBudget)}`,
    candidate.value <= availableBudget,
    candidate.value <= availableBudget
      ? `Tienes presupuesto suficiente: te quedarían ${formatMoney(availableBudget - candidate.value)}.`
      : `No puedes fichar a ${candidate.name} porque tu presupuesto disponible es ${formatMoney(availableBudget)} y su valoración es ${formatMoney(candidate.value)}.`,
  );
  push(
    "signing-size",
    "R-02 · Tamaño de plantilla",
    "Plazas libres",
    `${stats.size} / ${rules.squadSize}`,
    stats.size < rules.squadSize,
    stats.size < rules.squadSize
      ? `Quedan ${rules.squadSize - stats.size} plazas en la plantilla.`
      : `Tu plantilla está completa (${stats.size}/${rules.squadSize}). Debes vender o liberar un jugador antes de inscribir a otro.`,
  );
  push(
    "signing-group",
    "R-04/05/06 · Cupos por posición",
    GROUP_LABEL[groupOf(candidate.position)],
    `${countInGroup} / ${limits.min}-${limits.max}`,
    countInGroup < limits.max,
    countInGroup < limits.max
      ? `El grupo de ${GROUP_LABEL[groupOf(candidate.position)].toLowerCase()} admite ${
          limits.max - countInGroup
        } incorporaciones más.`
      : `Ya tienes ${countInGroup} en ese grupo y el máximo es ${limits.max}.`,
  );
  push(
    "signing-ovr",
    "R-08 · OVR mínimo",
    "OVR del jugador",
    `${candidate.ovr} / ${rules.minOvr}`,
    candidate.ovr >= rules.minOvr,
    candidate.ovr >= rules.minOvr
      ? `${candidate.name} supera el OVR mínimo exigido.`
      : `${candidate.name} tiene ${candidate.ovr} de OVR y el torneo exige al menos ${rules.minOvr}.`,
  );
  const sameClub = squad.filter(
    (p) => p.realClub === candidate.realClub && p.realClub !== ownClubName,
  ).length;
  push(
    "signing-club",
    "R-07 · Jugadores por club real",
    candidate.realClub,
    `${sameClub} / ${rules.maxPerRealClub}`,
    sameClub < rules.maxPerRealClub,
    sameClub < rules.maxPerRealClub
      ? `Puedes incorporar jugadores de ${candidate.realClub}.`
      : `Tu plantilla ya tiene ${sameClub} jugadores pertenecientes a este club.`,
  );

  const violations = checks.filter((c) => !c.passed);
  return { checks, passed: violations.length === 0, violations };
}

/* ------------------------------------------------------------------ *
 * Formations
 * ------------------------------------------------------------------ */

export type FormationSlot = {
  id: string;
  /** Short label shown on the pitch chip, e.g. "MCO". */
  label: Position;
  group: PositionGroup;
  /** Positions accepted in this slot. */
  accepts: Position[];
  /** Percentages inside the pitch box (attacking upwards). */
  x: number;
  y: number;
};

export type FormationCode =
  | "4-2-3-1"
  | "4-3-3"
  | "4-4-2"
  | "3-5-2"
  | "5-2-3";

export type FormationDefinition = {
  code: FormationCode;
  label: string;
  shape: string;
  description: string;
  slots: FormationSlot[];
};

const ACCEPTS: Record<Position, Position[]> = {
  POR: ["POR"],
  LI: ["LI"],
  LD: ["LD"],
  DFC: ["DFC", "LI", "LD", "MCD"],
  MCD: ["MCD", "MC", "DFC"],
  MC: ["MC", "MCD", "MCO"],
  MCO: ["MCO", "MC", "EI", "ED", "DC"],
  EI: ["EI", "ED", "MCO"],
  ED: ["ED", "EI", "MCO"],
  DC: ["DC", "EI", "ED", "MCO"],
};

function slot(
  id: string,
  label: Position,
  x: number,
  y: number,
): FormationSlot {
  return {
    id,
    label,
    group: groupOf(label),
    accepts: ACCEPTS[label],
    x,
    y,
  };
}

export const FORMATIONS: Record<FormationCode, FormationDefinition> = {
  "4-2-3-1": {
    code: "4-2-3-1",
    label: "4-2-3-1",
    shape: "Equilibrada",
    description:
      "Doble pivote, mediapunta creativo y dos extremos. La formación del control total.",
    slots: [
      slot("dc1", "DC", 50, 13),
      slot("ei1", "EI", 17, 28),
      slot("mco1", "MCO", 50, 29),
      slot("ed1", "ED", 83, 28),
      slot("mcd1", "MCD", 36, 46),
      slot("mcd2", "MCD", 64, 46),
      slot("li1", "LI", 11, 66),
      slot("dfc1", "DFC", 34, 64),
      slot("dfc2", "DFC", 66, 64),
      slot("ld1", "LD", 89, 66),
      slot("por1", "POR", 50, 89),
    ],
  },
  "4-3-3": {
    code: "4-3-3",
    label: "4-3-3",
    shape: "Ofensiva",
    description:
      "Interiores en el medio y tridente arriba. Máxima presión sobre el rival.",
    slots: [
      slot("ei1", "EI", 17, 16),
      slot("dc1", "DC", 50, 12),
      slot("ed1", "ED", 83, 16),
      slot("mc1", "MC", 26, 44),
      slot("mcd1", "MCD", 50, 48),
      slot("mc2", "MC", 74, 44),
      slot("li1", "LI", 11, 66),
      slot("dfc1", "DFC", 34, 64),
      slot("dfc2", "DFC", 66, 64),
      slot("ld1", "LD", 89, 66),
      slot("por1", "POR", 50, 89),
    ],
  },
  "4-4-2": {
    code: "4-4-2",
    label: "4-4-2",
    shape: "Clásica",
    description:
      "Bloque de cuatro en el medio y dos delanteros. Orden y segunda jugada.",
    slots: [
      slot("dc1", "DC", 36, 14),
      slot("dc2", "DC", 64, 14),
      slot("ei1", "EI", 13, 42),
      slot("mc1", "MC", 38, 44),
      slot("mc2", "MC", 62, 44),
      slot("ed1", "ED", 87, 42),
      slot("li1", "LI", 11, 66),
      slot("dfc1", "DFC", 34, 64),
      slot("dfc2", "DFC", 66, 64),
      slot("ld1", "LD", 89, 66),
      slot("por1", "POR", 50, 89),
    ],
  },
  "3-5-2": {
    code: "3-5-2",
    label: "3-5-2",
    shape: "Carrileros",
    description:
      "Tres centrales, carrileros largos y dos puntas. Dominio del ancho del campo.",
    slots: [
      slot("dc1", "DC", 36, 14),
      slot("dc2", "DC", 64, 14),
      slot("mc1", "MC", 30, 40),
      slot("mcd1", "MCD", 50, 48),
      slot("mc2", "MC", 70, 40),
      slot("li1", "LI", 9, 52),
      slot("ld1", "LD", 91, 52),
      slot("dfc1", "DFC", 26, 70),
      slot("dfc2", "DFC", 50, 72),
      slot("dfc3", "DFC", 74, 70),
      slot("por1", "POR", 50, 89),
    ],
  },
  "5-2-3": {
    code: "5-2-3",
    label: "5-2-3",
    shape: "Contragolpe",
    description:
      "Línea de cinco, doble pivote y tridente veloz para atacar en transición.",
    slots: [
      slot("ei1", "EI", 18, 18),
      slot("dc1", "DC", 50, 13),
      slot("ed1", "ED", 82, 18),
      slot("mcd1", "MCD", 36, 44),
      slot("mcd2", "MCD", 64, 44),
      slot("li1", "LI", 9, 62),
      slot("dfc1", "DFC", 28, 70),
      slot("dfc2", "DFC", 50, 72),
      slot("dfc3", "DFC", 72, 70),
      slot("ld1", "LD", 91, 62),
      slot("por1", "POR", 50, 89),
    ],
  },
};

export const FORMATION_CODES = Object.keys(FORMATIONS) as FormationCode[];

/** Formation every new squad starts with. */
export const DEFAULT_FORMATION: FormationCode = "4-2-3-1";

export function isFormationCode(value: string): value is FormationCode {
  return value in FORMATIONS;
}

export type LineupSlot = { slotId: string; playerId: string | null };

export type Lineup = {
  formation: FormationCode;
  slots: LineupSlot[];
};

export function emptyLineup(formation: FormationCode): Lineup {
  return {
    formation,
    slots: FORMATIONS[formation].slots.map((s) => ({
      slotId: s.id,
      playerId: null,
    })),
  };
}

/**
 * Greedy solver shared by "automatic XI" and formation switching.
 *
 * - Scarcest slot first, so a slot with two candidates is filled before one with
 *   six and never gets starved by a greedy decision elsewhere.
 * - Only position-accepted players are assigned: the engine never produces an
 *   illegal XI, it leaves the slot empty for the President to decide.
 * - `isIncumbent` keeps the current starters when the President changes shape.
 */
function greedyAssign(
  squad: SquadPlayerView[],
  slots: FormationSlot[],
  isIncumbent: (playerId: string) => boolean,
): Map<string, string> {
  const used = new Set<string>();
  const assignments = new Map<string, string>();
  const score = (player: SquadPlayerView) =>
    (isIncumbent(player.playerId) ? 100 : 0) + player.ovr;

  const candidatesFor = (slot: FormationSlot) =>
    squad.filter(
      (player) => !used.has(player.playerId) && slot.accepts.includes(player.position),
    );

  const pending = [...slots];
  while (pending.length > 0) {
    let chosen: { slot: FormationSlot; player: SquadPlayerView } | null = null;
    let bestScarcity = Number.POSITIVE_INFINITY;

    for (const slot of pending) {
      const candidates = candidatesFor(slot);
      if (candidates.length === 0 || candidates.length >= bestScarcity) continue;
      bestScarcity = candidates.length;
      chosen = {
        slot,
        player: [...candidates].sort((a, b) => score(b) - score(a))[0],
      };
    }

    if (!chosen) break;
    used.add(chosen.player.playerId);
    assignments.set(chosen.slot.id, chosen.player.playerId);
    pending.splice(pending.indexOf(chosen.slot), 1);
  }

  return assignments;
}

function buildLineup(
  formation: FormationCode,
  assignments: Map<string, string>,
): Lineup {
  return {
    formation,
    slots: FORMATIONS[formation].slots.map((slot) => ({
      slotId: slot.id,
      playerId: assignments.get(slot.id) ?? null,
    })),
  };
}

/** Best legal XI available in the squad. */
export function autoLineup(
  squad: SquadPlayerView[],
  formation: FormationCode,
): Lineup {
  return buildLineup(
    formation,
    greedyAssign(squad, FORMATIONS[formation].slots, () => false),
  );
}

/** Keeps the current starters when the President switches formation. */
export function remapLineup(
  squad: SquadPlayerView[],
  formation: FormationCode,
  current: Lineup,
): Lineup {
  const incumbents = new Set(
    current.slots.map((slot) => slot.playerId).filter((id): id is string => Boolean(id)),
  );
  return buildLineup(
    formation,
    greedyAssign(squad, FORMATIONS[formation].slots, (id) => incumbents.has(id)),
  );
}

export type LineupEvaluation = {
  checks: RuleCheck[];
  errors: string[];
  valid: boolean;
  lineup: Lineup;
  starters: SquadPlayerView[];
  bench: SquadPlayerView[];
};

export function evaluateLineup(
  rules: TournamentRules,
  squad: SquadPlayerView[],
  lineup: Lineup,
  squadEvaluation?: SquadEvaluation,
): LineupEvaluation {
  const def = FORMATIONS[lineup.formation];
  const bySlot = new Map(lineup.slots.map((s) => [s.slotId, s.playerId]));
  const starters: SquadPlayerView[] = [];
  const errors: string[] = [];
  const checks: RuleCheck[] = [];

  for (const s of def.slots) {
    const playerId = bySlot.get(s.id);
    if (!playerId) continue;
    const player = squad.find((p) => p.playerId === playerId);
    if (!player) continue;
    starters.push(player);
    if (!s.accepts.includes(player.position)) {
      errors.push(
        `${player.name} (${player.position}) no puede ocupar la posición ${s.label} de la formación ${def.label}.`,
      );
    }
  }

  const ids = lineup.slots
    .map((s) => s.playerId)
    .filter((id): id is string => Boolean(id));
  const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);

  checks.push({
    id: "lineup-count",
    ruleRef: "Alineación · Once titular",
    label: "Titulares",
    value: `${starters.length} / 11`,
    passed: starters.length === 11,
    detail:
      starters.length === 11
        ? "Tienes los 11 titulares asignados."
        : `Faltan ${11 - starters.length} jugadores para completar el once.`,
    action: { label: "Completar once", to: "/dashboard/formacion" },
  });

  checks.push({
    id: "lineup-duplicates",
    ruleRef: "Alineación · Sin duplicados",
    label: "Jugadores repetidos",
    value: `${duplicated.length}`,
    passed: duplicated.length === 0,
    detail:
      duplicated.length === 0
        ? "Ningún jugador aparece dos veces en el once."
        : "Un jugador no puede ocupar dos posiciones al mismo tiempo. Selecciona la posición y cámbialo.",
  });

  checks.push({
    id: "lineup-positions",
    ruleRef: "Alineación · Posición natural",
    label: "Posiciones compatibles",
    value: errors.length === 0 ? "OK" : `${errors.length} error(es)`,
    passed: errors.length === 0,
    detail:
      errors.length === 0
        ? `Cada jugador ocupa una posición válida dentro del ${def.label}.`
        : errors[0],
  });

  const squadEval = squadEvaluation ?? evaluateSquadRules(rules, squad, rules.budget);
  checks.push({
    id: "lineup-rules",
    ruleRef: "Reglas del torneo",
    label: "Reglas del torneo",
    value: squadEval.passed ? "Cumple" : `${squadEval.violations.length} alerta(s)`,
    passed: squadEval.passed,
    detail: squadEval.passed
      ? "La alineación respeta el reglamento del torneo."
      : squadEval.violations[0]?.detail ?? "",
    action: { label: "Ver reglas", to: "/dashboard/reglas" },
  });

  const starterIds = new Set(ids);
  const bench = squad.filter((p) => !starterIds.has(p.playerId));

  return {
    checks,
    errors,
    valid: checks.every((c) => c.passed),
    lineup,
    starters,
    bench,
  };
}

/** Order of a lineup as a readable string: "POR · LI DFC DFC LD · ..." */
export function lineupShape(formation: FormationCode): string {
  return FORMATIONS[formation].label;
}

/* ------------------------------------------------------------------ *
 * Formatting helpers (shared by server and client)
 * ------------------------------------------------------------------ */

export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}€${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${Math.round(abs)}`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits);
}

/** "02:14:32" — used in the deadline center. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/** "12h 34m" — calmer, for secondary deadlines. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export const FC_VERSION = "FC 27 · Snapshot 10/09/2026";

/* ------------------------------------------------------------------ *
 * Tournament state machine
 * ------------------------------------------------------------------ */

export const TOURNAMENT_STATUSES = [
  "configuracion",
  "inscripciones",
  "seleccion_clubes",
  "pre_draft",
  "negociaciones",
  "draft_abierto",
  "draft_en_curso",
  "draft_cerrado",
  "plantillas_bloqueadas",
  "competicion",
  "cierre_jornada",
  "suspendido",
  "cancelado",
] as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export type TournamentStatusMeta = {
  label: string;
  tone: "open" | "progress" | "locked" | "blocked";
  className: string;
  dotClassName: string;
  /** What the President can do in this state. */
  hint: string;
};

export const TOURNAMENT_STATUS_META: Record<
  TournamentStatus,
  TournamentStatusMeta
> = {
  configuracion: {
    label: "Configuración",
    tone: "progress",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dotClassName: "bg-slate-500",
    hint: "Administración está definiendo reglas y calendario.",
  },
  inscripciones: {
    label: "Inscripciones",
    tone: "open",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dotClassName: "bg-sky-500",
    hint: "Los Presidentes pueden unirse al torneo.",
  },
  seleccion_clubes: {
    label: "Selección de clubes",
    tone: "open",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dotClassName: "bg-sky-500",
    hint: "Es el momento de elegir el club que vas a presidir.",
  },
  pre_draft: {
    label: "Pre-draft",
    tone: "progress",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotClassName: "bg-amber-500",
    hint: "Mercado en preparación. Aún no se ejecutan operaciones.",
  },
  negociaciones: {
    label: "Negociaciones",
    tone: "open",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
    hint: "Puedes negociar y dejar acuerdos reservados para el draft.",
  },
  draft_abierto: {
    label: "Draft abierto",
    tone: "open",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
    hint: "El draft está abierto: las operaciones aceptadas se ejecutan.",
  },
  draft_en_curso: {
    label: "Draft en curso",
    tone: "open",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClassName: "bg-emerald-500 animate-pulse",
    hint: "Turnos activos. Cada adquisición se refleja en tiempo real.",
  },
  draft_cerrado: {
    label: "Draft cerrado",
    tone: "locked",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dotClassName: "bg-slate-500",
    hint: "No se admiten nuevas incorporaciones en esta fase.",
  },
  plantillas_bloqueadas: {
    label: "Plantillas bloqueadas",
    tone: "locked",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dotClassName: "bg-slate-500",
    hint: "Solo puedes ajustar alineación y táctica.",
  },
  competicion: {
    label: "Competición",
    tone: "open",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
    hint: "La liga está en juego. Fija tu once antes del cierre.",
  },
  cierre_jornada: {
    label: "Cierre de jornada",
    tone: "progress",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotClassName: "bg-amber-500",
    hint: "Administración está validando resultados de la jornada.",
  },
  suspendido: {
    label: "Suspendido",
    tone: "blocked",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dotClassName: "bg-rose-500",
    hint: "El torneo está en pausa. Ninguna operación se ejecuta.",
  },
  cancelado: {
    label: "Cancelado",
    tone: "blocked",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dotClassName: "bg-rose-500",
    hint: "El torneo fue cancelado por Administración.",
  },
};
