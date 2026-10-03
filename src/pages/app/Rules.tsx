import type { AppStateView } from "@/convex/appTypes";
import { RULE_DESCRIPTORS } from "@/convex/rulesEngine";
import { useOutletContext } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SectionCard } from "@/components/eleven/SectionCard";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router";
import { BookOpen, Gauge, Scale } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SCOPE_CLASS: Record<string, string> = {
  Club: "border-brand/30 bg-brand/10 text-primary",
  Plantilla: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Mercado: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Competición: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export default function Rules() {
  const state = useOutletContext<AppStateView>();
  const rules = state.rules;
  const updateRules = useMutation(api.tournament.updateRules);
  if (!rules || !state.tournament) return null;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-2xl">Reglas del torneo</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {state.tournament.name} · {state.tournament.season}. Estas reglas se aplican en cada
            operación del producto: el mismo motor valida en el navegador y en el servidor, así
            que ninguna pantalla puede prometer algo que el torneo no permita.
          </p>
        </div>
        {state.isAdmin ? (
          <Button asChild className="min-h-11">
            <Link to="/dashboard/admin">
              <Gauge className="size-4" aria-hidden="true" />
              Editar desde Administración
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="Matriz de reglas vigentes"
          icon={Scale}
          className="xl:col-span-2"
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {RULE_DESCRIPTORS.map((descriptor) => (
              <li key={descriptor.code} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="display rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {descriptor.code}
                  </span>
                  <p className="text-sm font-bold">{descriptor.title}</p>
                  <Badge
                    variant="outline"
                    className={SCOPE_CLASS[descriptor.scope] ?? ""}
                  >
                    {descriptor.scope}
                  </Badge>
                  <span className="num ml-auto text-sm font-bold text-primary">
                    {descriptor.value(rules)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {descriptor.description}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard title="Cómo te afectan ahora" icon={BookOpen}>
            <RuleCheckList checks={state.evaluation?.checks ?? []} variant="full" />
          </SectionCard>

          <SectionCard title="Reglas propias del torneo" icon={Scale}>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 rounded-full bg-primary/20" aria-hidden="true" />
                  Mínimo de sub-20 en el XI
                </label>
                <Input
                  type="number"
                  min={0}
                  max={11}
                  value={rules.u20Min}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateRules({
                      budget: rules.budget,
                      squadSize: rules.squadSize,
                      gkMin: rules.gkMin,
                      gkMax: rules.gkMax,
                      defMin: rules.defMin,
                      defMax: rules.defMax,
                      midMin: rules.midMin,
                      midMax: rules.midMax,
                      fwdMin: rules.fwdMin,
                      fwdMax: rules.fwdMax,
                      maxPerRealClub: rules.maxPerRealClub,
                      minOvr: rules.minOvr,
                      maxU21: rules.maxU21,
                      lineupLockHours: rules.lineupLockHours,
                      fc27FormationCode: rules.fc27FormationCode,
                      formationInstructions: rules.formationInstructions,
                      u20Min: value,
                      u20InStartingLineup: rules.u20InStartingLineup,
                      sameNationalityMin: rules.sameNationalityMin,
                      sameNationalityRule: rules.sameNationalityRule,
                      sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                      clubNationalityMin: rules.clubNationalityMin,
                    });
                  }}
                  aria-label="Mínimo de sub-20 en el XI"
                  className="font-mono"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Nº de jugadores de 20 años o menos que el torneo exige alinear en cada encuentro.
                </p>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 rounded-full bg-primary/20" aria-hidden="true" />
                  ¿De dónde sale el sub-20?
                </label>
                <Select
                  value={rules.u20InStartingLineup ?? "ninguno"}
                  onValueChange={(value) => {
                    updateRules({
                      budget: rules.budget,
                      squadSize: rules.squadSize,
                      gkMin: rules.gkMin,
                      gkMax: rules.gkMax,
                      defMin: rules.defMin,
                      defMax: rules.defMax,
                      midMin: rules.midMin,
                      midMax: rules.midMax,
                      fwdMin: rules.fwdMin,
                      fwdMax: rules.fwdMax,
                      maxPerRealClub: rules.maxPerRealClub,
                      minOvr: rules.minOvr,
                      maxU21: rules.maxU21,
                      lineupLockHours: rules.lineupLockHours,
                      fc27FormationCode: rules.fc27FormationCode,
                      formationInstructions: rules.formationInstructions,
                      u20Min: rules.u20Min,
                      u20InStartingLineup:
                        value === "ninguno"
                          ? null
                          : (value as "obligatory" | "substitute"),
                      sameNationalityMin: rules.sameNationalityMin,
                      sameNationalityRule: rules.sameNationalityRule,
                      sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                      clubNationalityMin: rules.clubNationalityMin,
                    });
                  }}
                >
                  <SelectTrigger aria-label="Régimen de sub-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin regla</SelectItem>
                    <SelectItem value="obligatory">Obligatorio desde el XI titular</SelectItem>
                    <SelectItem value="substitute">Sustituible como reserva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 rounded-full bg-primary/20" aria-hidden="true" />
                  Mínimo de jugadores de una misma nacionalidad
                </label>
                <Input
                  type="number"
                  min={0}
                  max={22}
                  value={rules.sameNationalityMin}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateRules({
                      budget: rules.budget,
                      squadSize: rules.squadSize,
                      gkMin: rules.gkMin,
                      gkMax: rules.gkMax,
                      defMin: rules.defMin,
                      defMax: rules.defMax,
                      midMin: rules.midMin,
                      midMax: rules.midMax,
                      fwdMin: rules.fwdMin,
                      fwdMax: rules.fwdMax,
                      maxPerRealClub: rules.maxPerRealClub,
                      minOvr: rules.minOvr,
                      maxU21: rules.maxU21,
                      lineupLockHours: rules.lineupLockHours,
                      fc27FormationCode: rules.fc27FormationCode,
                      formationInstructions: rules.formationInstructions,
                      u20Min: rules.u20Min,
                      u20InStartingLineup: rules.u20InStartingLineup,
                      sameNationalityMin: value,
                      sameNationalityRule: rules.sameNationalityRule,
                      sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                      clubNationalityMin: rules.clubNationalityMin,
                    });
                  }}
                  aria-label="Mínimo de jugadores de una misma nacionalidad"
                  className="font-mono"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Nº de jugadores de una misma nacionalidad que debe estar en campo en todo el
golpe, sin importar quién sea el que juega.
                </p>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 rounded-full bg-primary/20" aria-hidden="true" />
                  Regla de nacionalidad
                </label>
                <Select
                  value={rules.sameNationalityRule ?? "ninguna"}
                  onValueChange={(value) => {
                    updateRules({
                      budget: rules.budget,
                      squadSize: rules.squadSize,
                      gkMin: rules.gkMin,
                      gkMax: rules.gkMax,
                      defMin: rules.defMin,
                      defMax: rules.defMax,
                      midMin: rules.midMin,
                      midMax: rules.midMax,
                      fwdMin: rules.fwdMin,
                      fwdMax: rules.fwdMax,
                      maxPerRealClub: rules.maxPerRealClub,
                      minOvr: rules.minOvr,
                      maxU21: rules.maxU21,
                      lineupLockHours: rules.lineupLockHours,
                      fc27FormationCode: rules.fc27FormationCode,
                      formationInstructions: rules.formationInstructions,
                      u20Min: rules.u20Min,
                      u20InStartingLineup: rules.u20InStartingLineup,
                      sameNationalityMin: rules.sameNationalityMin,
                      sameNationalityRule:
                        value === "ninguna"
                          ? null
                          : (value as "obligatory" | "changeable"),
                      sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                      clubNationalityMin: rules.clubNationalityMin,
                    });
                  }}
                >
                  <SelectTrigger aria-label="Regla de nacionalidad">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguna">Sin regla</SelectItem>
                    <SelectItem value="obligatory">Siempre en campo (sin cambio)</SelectItem>
                    <SelectItem value="changeable">Cambiable (puede alejarse)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 rounded-full bg-primary/20" aria-hidden="true" />
                  Minutos de permanencia
                </label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={rules.sameNationalityMatchDurationMinutes}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateRules({
                      budget: rules.budget,
                      squadSize: rules.squadSize,
                      gkMin: rules.gkMin,
                      gkMax: rules.gkMax,
                      defMin: rules.defMin,
                      defMax: rules.defMax,
                      midMin: rules.midMin,
                      midMax: rules.midMax,
                      fwdMin: rules.fwdMin,
                      fwdMax: rules.fwdMax,
                      maxPerRealClub: rules.maxPerRealClub,
                      minOvr: rules.minOvr,
                      maxU21: rules.maxU21,
                      lineupLockHours: rules.lineupLockHours,
                      fc27FormationCode: rules.fc27FormationCode,
                      formationInstructions: rules.formationInstructions,
                      u20Min: rules.u20Min,
                      u20InStartingLineup: rules.u20InStartingLineup,
                      sameNationalityMin: rules.sameNationalityMin,
                      sameNationalityRule: rules.sameNationalityRule,
                      sameNationalityMatchDurationMinutes: value,
                      clubNationalityMin: rules.clubNationalityMin,
                    });
                  }}
                  aria-label="Minutos de permanencia de la regla de nacionalidad"
                  className="font-mono"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Si la regla de nacionalidad es "cambiable", el jugador puede alejarse este número
                  de minutos de permanencia en el encuentro.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
