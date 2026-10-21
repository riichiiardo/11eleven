import { useState } from "react";
import { useDashboardState } from "./dashboard-context";
import { DashboardUnavailable } from "./DashboardUnavailable";
import {
  configurationFor,
  ruleConfigurationSchema,
  type ConfiguredRules,
  type RuleConfiguration,
  type CustomRule,
} from "@/lib/rule-configuration";
import { useMutation } from "@/services/backend/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Scale } from "lucide-react";
import { FORMATION_CODES } from "@/domain/rulesEngine";
import { ClubBudgets } from "@/components/eleven/admin/ClubBudgets";

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 1000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={`Disminuir ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </Button>
        <Input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) =>
            onChange(Math.max(min, Math.min(max, Number(e.target.value))))
          }
          className="w-24 text-center"
        />
        <Button
          type="button"
          variant="outline"
          aria-label={`Aumentar ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </Button>
      </span>
    </label>
  );
}
type Range = { enabled: boolean; min: number; max: number };
function RangeEditor({
  label,
  value,
  onChange,
  max = 1000,
}: {
  label: string;
  value: Range;
  onChange: (v: Range) => void;
  max?: number;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        {label}: {value.enabled ? "Habilitada" : "Deshabilitada"}
      </label>
      <fieldset
        disabled={!value.enabled}
        className="flex flex-wrap gap-4 disabled:opacity-50"
      >
        <Stepper
          label={`Mínimo ${label}`}
          value={value.min}
          max={value.max}
          onChange={(min) => onChange({ ...value, min })}
        />
        <Stepper
          label={`Máximo ${label}`}
          value={value.max}
          min={value.min}
          max={max}
          onChange={(max) => onChange({ ...value, max })}
        />
      </fieldset>
    </div>
  );
}
function CustomRules({
  rules,
  onChange,
}: {
  rules: CustomRule[];
  onChange: (v: CustomRule[]) => void;
}) {
  const change = (id: string, patch: Partial<CustomRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-4">
      {rules.map((r, i) => (
        <div key={r.id} className="rounded-lg border p-3 space-y-3">
          <div className="flex gap-2 items-center">
            <span>R-{14 + i}</span>
            <Input
              aria-label="Nombre de regla"
              value={r.title}
              onChange={(e) => change(r.id, { title: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
            >
              Eliminar regla
            </Button>
          </div>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => change(r.id, { enabled: e.target.checked })}
            />
            Habilitada
          </label>
          <div className="flex flex-wrap gap-3">
            <label>
              Ámbito{" "}
              <select
                className="rounded border p-2 bg-background"
                value={r.scope}
                onChange={(e) =>
                  change(r.id, { scope: e.target.value as CustomRule["scope"] })
                }
              >
                <option value="squad">Plantilla</option>
                <option value="xi">XI inicial</option>
              </select>
            </label>
            <label>
              Métrica{" "}
              <select
                className="rounded border p-2 bg-background"
                value={r.metric}
                onChange={(e) =>
                  change(r.id, {
                    metric: e.target.value as CustomRule["metric"],
                  })
                }
              >
                {Object.entries({
                  players: "Número de jugadores",
                  underAge: "Menores de una edad",
                  nationality: "Nacionalidad",
                  position: "Posición",
                  averageOvr: "OVR medio",
                  totalValue: "Valor total (€)",
                }).map(([value, title]) => (
                  <option key={value} value={value}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Parámetro{" "}
              <Input
                value={r.parameter}
                aria-label="Parámetro de regla"
                placeholder="Edad, país o posición"
                onChange={(e) => change(r.id, { parameter: e.target.value })}
              />
            </label>
            <Stepper
              label="Mínimo de regla"
              value={r.min}
              max={r.max}
              onChange={(min) => change(r.id, { min })}
            />
            <Stepper
              label="Máximo de regla"
              value={r.max}
              min={r.min}
              max={2000000000}
              onChange={(max) => change(r.id, { max })}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...rules,
            {
              id: crypto.randomUUID(),
              title: "Nueva regla",
              enabled: true,
              scope: "xi",
              metric: "players",
              parameter: "",
              min: 0,
              max: 11,
            },
          ])
        }
      >
        Crear regla parametrizable
      </Button>
    </div>
  );
}
export function RulesEditor({
  rules,
  isAdmin,
  universe,
}: {
  rules: ConfiguredRules;
  isAdmin: boolean;
  universe: string;
}) {
  const [draft, setDraft] = useState(() => configurationFor(rules));
  const [formation, setFormation] = useState(rules.fc27FormationCode);
  const [savedDraft, setSavedDraft] = useState(() => configurationFor(rules));
  const [savedFormation, setSavedFormation] = useState(rules.fc27FormationCode);
  const [editing, setEditing] = useState(false);
  const [clubDrafts, setClubDrafts] = useState<Record<string, string | null>>(
    {},
  );
  const [budgetRevision, setBudgetRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const mutate = useMutation();
  const set = (patch: Partial<RuleConfiguration>) =>
    setDraft((v) => ({ ...v, ...patch }));
  const save = async () => {
    setMessage("");
    const parsed = ruleConfigurationSchema.safeParse(draft);
    if (!parsed.success) {
      setMessage(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    const budgets: Record<string, number | null> = {};
    for (const [id, value] of Object.entries(clubDrafts)) {
      if (
        value !== null &&
        (!/^\d+(?:\.\d{1,2})?$/.test(value.trim()) ||
          !Number.isFinite(Number(value)) ||
          Number(value) > 2000000000)
      ) {
        setMessage(
          "Revisa los presupuestos de los equipos: introduce importes válidos en euros, con hasta dos decimales.",
        );
        return;
      }
      budgets[id] = value === null ? null : Number(value);
    }
    setBusy(true);
    try {
      await mutate("tournament.saveRuleChanges", {
        configuration: parsed.data,
        formation,
        budgets,
      });
      setSavedDraft(parsed.data);
      setSavedFormation(formation);
      setEditing(false);
      setClubDrafts({});
      setBudgetRevision((v) => v + 1);
      setMessage("Reglas guardadas.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudieron guardar las reglas.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header>
        <h1 className="display text-2xl">Reglas del Universo</h1>
        <p>{universe}. Las reglas del XI se configuran por competición.</p>
        {!isAdmin && <p>Solo el administrador puede modificar estas reglas.</p>}
      </header>
      <div className="flex items-center gap-3" aria-label="Acciones de reglas">
        {editing ? (
          <>
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDraft(savedDraft);
                setFormation(savedFormation);
                setClubDrafts({});
                setMessage("");
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={!isAdmin}
            onClick={() => {
              setMessage("");
              setEditing(true);
            }}
          >
            Editar reglas
          </Button>
        )}
      </div>
      <fieldset
        disabled={!isAdmin || !editing || busy}
        className="space-y-5 disabled:opacity-80"
      >
        <SectionCard title="R-01 · Presupuesto inicial" icon={Scale}>
          <label className="flex items-center gap-2">
            €{" "}
            <Input
              aria-label="Presupuesto inicial en euros"
              type="number"
              min={0}
              max={2000000000}
              step="0.01"
              value={draft.budget}
              onChange={(e) => set({ budget: Number(e.target.value) })}
            />
          </label>
          <p className="mt-2 text-sm text-muted-foreground">
            El presupuesto general se aplica a los equipos que lo heredan. Los
            importes individuales se conservan cuando cambia el general.
          </p>
          <ClubBudgets
            generalBudget={savedDraft.budget}
            drafts={clubDrafts}
            revision={budgetRevision}
            onChange={(id, value) =>
              setClubDrafts((previous) => ({ ...previous, [id]: value }))
            }
          />
        </SectionCard>
        <SectionCard title="R-02 · Tamaño de plantilla" icon={Scale}>
          <Stepper
            label="Jugadores en plantilla"
            min={11}
            value={draft.squadSize}
            onChange={(squadSize) => set({ squadSize })}
          />
        </SectionCard>
        {(
          [
            ["GK", "R-03 · Porteros"],
            ["DEF", "R-04 · Defensas"],
            ["MID", "R-05 · Medios"],
            ["FWD", "R-06 · Delanteros"],
          ] as const
        ).map(([group, label]) => (
          <SectionCard key={group} title={label} icon={Scale}>
            <RangeEditor
              label={label}
              value={draft.groups[group]}
              onChange={(range) =>
                set({ groups: { ...draft.groups, [group]: range } })
              }
            />
          </SectionCard>
        ))}
        <SectionCard title="R-07 · Jugadores por club de origen" icon={Scale}>
          <RangeEditor
            label="Club de origen"
            value={draft.realClub}
            onChange={(realClub) => set({ realClub })}
          />
          <p className="mt-2 text-sm">
            Rango por cada club externo representado. Se excluyen el propio club
            y los agentes libres.
          </p>
        </SectionCard>
        <SectionCard title="R-10 · Cierre de alineación" icon={Scale}>
          <Stepper
            label="Horas antes del partido"
            max={72}
            value={draft.lineupLockHours}
            onChange={(lineupLockHours) => set({ lineupLockHours })}
          />
        </SectionCard>
        <SectionCard
          title="Competiciones del Universo · R-11 y R-12"
          icon={Scale}
        >
          <div className="space-y-5">
            {draft.competitions.map((c) => {
              const update = (patch: Partial<typeof c>) =>
                set({
                  competitions: draft.competitions.map((x) =>
                    x.id === c.id ? { ...x, ...patch } : x,
                  ),
                });
              return (
                <div key={c.id} className="rounded-xl border p-4 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Input
                      aria-label="Nombre de competición"
                      value={c.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                    <label>
                      Formato{" "}
                      <select
                        className="bg-background border rounded p-2"
                        value={c.kind}
                        onChange={(e) =>
                          update({ kind: e.target.value as typeof c.kind })
                        }
                      >
                        <option value="league">Liga (Premier League)</option>
                        <option value="cup">Copa (FA Cup)</option>
                        <option value="league_playoffs">
                          Liga con liguilla (Liga MX)
                        </option>
                      </select>
                    </label>
                  </div>
                  <label className="flex gap-2">
                    <input
                      type="radio"
                      name="activeCompetition"
                      checked={draft.activeCompetitionId === c.id}
                      onChange={() => set({ activeCompetitionId: c.id })}
                    />
                    Aplicar reglas de esta competición al XI actual
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <Stepper
                      label={
                        c.kind === "cup"
                          ? "Partidos por eliminatoria"
                          : "Vueltas de la liga"
                      }
                      min={1}
                      max={10}
                      value={c.rounds}
                      onChange={(rounds) => update({ rounds })}
                    />
                    {c.kind === "league_playoffs" && (
                      <Stepper
                        label="Equipos en liguilla"
                        value={c.playoffTeams}
                        onChange={(playoffTeams) => update({ playoffTeams })}
                      />
                    )}
                  </div>
                  {c.kind !== "cup" && (
                    <div className="flex flex-wrap gap-4">
                      <Stepper
                        label="Ascensos"
                        value={c.promotions}
                        onChange={(promotions) => update({ promotions })}
                      />
                      <Stepper
                        label="Descensos"
                        value={c.relegations}
                        onChange={(relegations) => update({ relegations })}
                      />
                      {(
                        [
                          ["promotionTarget", "Destino de ascenso"],
                          ["relegationTarget", "Destino de descenso"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}{" "}
                          <select
                            className="bg-background border rounded p-2"
                            value={c[key]}
                            onChange={(e) => update({ [key]: e.target.value })}
                          >
                            <option value="">Sin destino</option>
                            {draft.competitions
                              .filter((x) => x.id !== c.id && x.kind !== "cup")
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                  <RangeEditor
                    label="R-11 · Sub-20 en el XI (menores de 20 años)"
                    value={c.u20}
                    max={11}
                    onChange={(u20) => update({ u20 })}
                  />
                  <RangeEditor
                    label="R-12 · Nacionales en el XI"
                    value={c.nationals}
                    max={11}
                    onChange={(nationals) => update({ nationals })}
                  />
                  <label>
                    Nacionalidad de la competición{" "}
                    <Input
                      aria-label="Nacionalidad de la competición"
                      value={c.nationality}
                      onChange={(e) => update({ nationality: e.target.value })}
                      placeholder="Ej.: México, Inglaterra"
                    />
                  </label>
                  <CustomRules
                    rules={c.customRules}
                    onChange={(customRules) => update({ customRules })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      set({
                        competitions: draft.competitions
                          .filter((x) => x.id !== c.id)
                          .map((x) => ({
                            ...x,
                            promotionTarget:
                              x.promotionTarget === c.id
                                ? ""
                                : x.promotionTarget,
                            relegationTarget:
                              x.relegationTarget === c.id
                                ? ""
                                : x.relegationTarget,
                          })),
                        activeCompetitionId:
                          draft.activeCompetitionId === c.id
                            ? ""
                            : draft.activeCompetitionId,
                      })
                    }
                  >
                    Eliminar competición
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const id = crypto.randomUUID();
                set({
                  competitions: [
                    ...draft.competitions,
                    {
                      id,
                      name: "Nueva competición",
                      kind: "league",
                      rounds: 2,
                      playoffTeams: 8,
                      promotions: 0,
                      relegations: 0,
                      promotionTarget: "",
                      relegationTarget: "",
                      u20: { enabled: false, min: 0, max: 11 },
                      nationals: { enabled: false, min: 0, max: 11 },
                      nationality: "",
                      customRules: [],
                    },
                  ],
                  activeCompetitionId: draft.activeCompetitionId || id,
                });
              }}
            >
              Crear competición
            </Button>
          </div>
        </SectionCard>
        <SectionCard title="R-13 · Formación" icon={Scale}>
          <label>
            Esquema predeterminado{" "}
            <select
              className="bg-background border rounded p-2"
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
            >
              {FORMATION_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        </SectionCard>
        <SectionCard title="Draft · Altas y bajas" icon={Scale}>
          <div className="space-y-4">
            <Stepper
              label="Máximo de altas y bajas por presidente"
              value={draft.draft.maxTransfers}
              max={100}
              onChange={(maxTransfers) =>
                set({ draft: { ...draft.draft, maxTransfers } })
              }
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.draft.extraPlayer}
                onChange={(e) =>
                  set({
                    draft: { ...draft.draft, extraPlayer: e.target.checked },
                  })
                }
              />
              Autorizar una plaza adicional de alta y baja
            </label>
            <p className="text-sm text-muted-foreground">
              Máximo vigente:{" "}
              {draft.draft.maxTransfers + Number(draft.draft.extraPlayer)} altas
              y otras tantas bajas. La prelista es privada y no ejecuta
              fichajes.
            </p>
          </div>
        </SectionCard>
        <SectionCard
          title="R-14 en adelante · Reglas del administrador"
          icon={Scale}
        >
          <CustomRules
            rules={draft.customRules}
            onChange={(customRules) => set({ customRules })}
          />
        </SectionCard>
      </fieldset>
      {message && (
        <p role="status" className="rounded border p-3">
          {message}
        </p>
      )}
    </div>
  );
}
export default function Rules() {
  const state = useDashboardState();
  if (!state?.rules || !state.tournament)
    return <DashboardUnavailable title="Reglas" />;
  return (
    <RulesEditor
      key={`${state.tournament.id}:${JSON.stringify((state.rules as ConfiguredRules).configuration ?? null)}`}
      rules={state.rules}
      isAdmin={state.isAdmin}
      universe={state.tournament.name}
    />
  );
}
