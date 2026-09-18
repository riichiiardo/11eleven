import type { AppStateView } from "@/convex/appTypes";
import { RULE_DESCRIPTORS } from "@/convex/rulesEngine";
import { useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { BookOpen, Gauge, Info, Scale } from "lucide-react";

const SCOPE_CLASS: Record<string, string> = {
  Club: "border-brand/30 bg-brand/10 text-primary",
  Plantilla: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Mercado: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Competición: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export default function Rules() {
  const state = useOutletContext<AppStateView>();
  const rules = state.rules;
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

          <div className="card-soft flex gap-3 p-4 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p>
              Si una operación no es posible, el sistema explica qué regla se incumple, con qué
              cifras y qué alternativa tienes. Nunca verás un error sin explicación humana, y
              cada cambio de reglas queda registrado en la auditoría del torneo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
