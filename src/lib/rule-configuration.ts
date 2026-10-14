import { z } from "zod";
import type {
  TournamentRules,
  SquadPlayerView,
  RuleCheck,
} from "@/convex/rulesEngine";

const count = z.number().int().min(0).max(1000);
const range = z
  .object({ enabled: z.boolean(), min: count, max: count })
  .refine((v) => v.min <= v.max, "El mínimo no puede superar el máximo.");
export const customRuleSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(100),
    enabled: z.boolean(),
    scope: z.enum(["squad", "xi"]),
    metric: z.enum([
      "players",
      "underAge",
      "nationality",
      "position",
      "averageOvr",
      "totalValue",
    ]),
    parameter: z.string().max(100),
    min: z.number().min(0),
    max: z.number().min(0),
  })
  .refine((v) => v.min <= v.max, "El mínimo no puede superar el máximo.");
export const competitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["league", "cup", "league_playoffs"]),
  rounds: z.number().int().min(1).max(10),
  playoffTeams: count,
  promotions: count,
  relegations: count,
  promotionTarget: z.string(),
  relegationTarget: z.string(),
  u20: range,
  nationals: range,
  nationality: z.string().trim().max(80),
  customRules: z.array(customRuleSchema),
});
export const ruleConfigurationSchema = z
  .object({
    budget: z.number().min(0).max(2000000000),
    squadSize: z.number().int().min(11).max(1000),
    groups: z.object({ GK: range, DEF: range, MID: range, FWD: range }),
    realClub: range,
    lineupLockHours: z.number().int().min(0).max(72),
    activeCompetitionId: z.string(),
    competitions: z.array(competitionSchema),
    customRules: z.array(customRuleSchema),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.competitions.map((c) => c.id)).size !== v.competitions.length)
      ctx.addIssue({ code: "custom", message: "Hay competiciones repetidas." });
    if (
      v.activeCompetitionId &&
      !v.competitions.some((c) => c.id === v.activeCompetitionId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Selecciona una competición existente.",
      });
    for (const c of v.competitions) {
      if (c.u20.max > 11 || c.nationals.max > 11)
        ctx.addIssue({
          code: "custom",
          message: "Los límites del XI no pueden superar 11.",
        });
      if (c.nationals.enabled && !c.nationality)
        ctx.addIssue({
          code: "custom",
          message: `Indica la nacionalidad para ${c.name}.`,
        });
      for (const target of [c.promotionTarget, c.relegationTarget])
        if (
          target &&
          (target === c.id ||
            !v.competitions.some(
              (other) => other.id === target && other.kind !== "cup",
            ))
        )
          ctx.addIssue({
            code: "custom",
            message:
              "El destino de ascenso/descenso debe ser otra liga del Universo.",
          });
    }
  });
export type RuleConfiguration = z.infer<typeof ruleConfigurationSchema>;
export type CompetitionConfiguration = z.infer<typeof competitionSchema>;
export type CustomRule = z.infer<typeof customRuleSchema>;
export type ConfiguredRules = TournamentRules & {
  configuration?: RuleConfiguration;
};

export function configurationFor(rules: ConfiguredRules): RuleConfiguration {
  if (rules.configuration) return rules.configuration;
  return {
    budget: rules.budget,
    squadSize: rules.squadSize,
    lineupLockHours: rules.lineupLockHours,
    groups: {
      GK: { enabled: true, min: rules.gkMin, max: rules.gkMax },
      DEF: { enabled: true, min: rules.defMin, max: rules.defMax },
      MID: { enabled: true, min: rules.midMin, max: rules.midMax },
      FWD: { enabled: true, min: rules.fwdMin, max: rules.fwdMax },
    },
    realClub: { enabled: true, min: 0, max: rules.maxPerRealClub },
    activeCompetitionId: "",
    competitions: [],
    customRules: [],
  };
}

export function effectiveRules(rules: ConfiguredRules): ConfiguredRules {
  const c = rules.configuration;
  if (!c) return { ...rules, minOvr: 0, maxU21: 1000 };
  const active = c.competitions.find((x) => x.id === c.activeCompetitionId);
  const bounds = (group: keyof RuleConfiguration["groups"]) =>
    c.groups[group].enabled ? c.groups[group] : { min: 0, max: c.squadSize };
  return {
    ...rules,
    budget: c.budget,
    squadSize: c.squadSize,
    gkMin: bounds("GK").min,
    gkMax: bounds("GK").max,
    defMin: bounds("DEF").min,
    defMax: bounds("DEF").max,
    midMin: bounds("MID").min,
    midMax: bounds("MID").max,
    fwdMin: bounds("FWD").min,
    fwdMax: bounds("FWD").max,
    maxPerRealClub: c.realClub.enabled ? c.realClub.max : c.squadSize,
    minOvr: 0,
    maxU21: 1000,
    lineupLockHours: c.lineupLockHours,
    u20Min: active?.u20.enabled ? active.u20.min : 0,
    clubNationalityMin: 0,
    sameNationalityMin: active?.nationals.enabled ? active.nationals.min : 0,
  };
}

export function additionalChecks(
  rules: ConfiguredRules,
  squad: SquadPlayerView[],
  xi: SquadPlayerView[],
  scope: "squad" | "xi",
  ownClubName?: string,
): RuleCheck[] {
  const c = rules.configuration;
  if (!c) return [];
  const active = c.competitions.find((x) => x.id === c.activeCompetitionId);
  const checks: RuleCheck[] = [];
  const check = (
    id: string,
    title: string,
    value: number,
    min: number,
    max: number,
    ref: string,
  ) =>
    checks.push({
      id,
      ruleRef: ref,
      label: title,
      value: `${value} / ${min}–${max}`,
      passed: value >= min && value <= max,
      detail: `${title}: ${value}. Rango permitido: ${min}–${max}.`,
      action: { label: "Ver reglas", to: "/dashboard/reglas" },
    });
  if (scope === "squad" && c.realClub.enabled) {
    const groups = new Map<string, number>();
    for (const p of squad)
      if (p.realClub !== ownClubName && p.realClub !== "Agente libre")
        groups.set(p.realClub, (groups.get(p.realClub) ?? 0) + 1);
    for (const [name, total] of groups)
      check(
        `origin-${name}`,
        `Jugadores de ${name}`,
        total,
        c.realClub.min,
        c.realClub.max,
        "R-07 · Club de origen",
      );
  }
  if (scope === "xi" && active) {
    if (active.u20.enabled)
      check(
        "competition-u20",
        "Sub-20 en el XI",
        xi.filter((p) => p.age < 20).length,
        active.u20.min,
        active.u20.max,
        "R-11 · Sub-20 por competición",
      );
    if (active.nationals.enabled)
      check(
        "competition-nationals",
        `Nacionales (${active.nationality})`,
        xi.filter(
          (p) =>
            p.nationality
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase() ===
            active.nationality
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase(),
        ).length,
        active.nationals.min,
        active.nationals.max,
        "R-12 · Nacionales por competición",
      );
  }
  for (const r of [...c.customRules, ...(active?.customRules ?? [])].filter(
    (r) => r.enabled && r.scope === scope,
  )) {
    const players = scope === "xi" ? xi : squad;
    const value =
      r.metric === "players"
        ? players.length
        : r.metric === "underAge"
          ? players.filter((p) => p.age < Number(r.parameter)).length
          : r.metric === "nationality"
            ? players.filter(
                (p) =>
                  p.nationality.toLowerCase() === r.parameter.toLowerCase(),
              ).length
            : r.metric === "position"
              ? players.filter((p) => p.position === r.parameter).length
              : r.metric === "totalValue"
                ? players.reduce((sum, p) => sum + p.value, 0)
                : players.length
                  ? players.reduce((sum, p) => sum + p.ovr, 0) / players.length
                  : 0;
    check(r.id, r.title, value, r.min, r.max, "Regla personalizada");
  }
  return checks;
}
