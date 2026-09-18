import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AppStateView, ClubView } from "@/convex/appTypes";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Crest } from "@/components/eleven/Crest";
import { BrandLockup } from "@/components/eleven/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Info, Loader2, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ClubSelection({ state }: { state: AppStateView }) {
  const chooseClub = useMutation(api.tournament.chooseClub);
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState<string>("Todas");
  const [candidate, setCandidate] = useState<ClubView | null>(null);
  const [saving, setSaving] = useState(false);

  const leagues = useMemo(
    () => ["Todas", ...new Set(state.clubs.map((club) => club.league))],
    [state.clubs],
  );

  const visible = state.clubs.filter((club) => {
    const matchesLeague = league === "Todas" || club.league === league;
    const term = query.trim().toLowerCase();
    const matchesQuery =
      !term ||
      club.name.toLowerCase().includes(term) ||
      club.league.toLowerCase().includes(term) ||
      club.country.toLowerCase().includes(term);
    return matchesLeague && matchesQuery;
  });

  const rules = state.rules;

  const confirm = async () => {
    if (!candidate) return;
    setSaving(true);
    try {
      await chooseClub({ clubId: candidate.id });
      toast.success(`¡Bienvenido a ${candidate.name}!`, {
        description: "Tu plantilla arranca vacía: todo se decide en el primer draft.",
      });
      setCandidate(null);
    } catch (cause) {
      toast.error("No se pudo confirmar el club", {
        description: errorMessage(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rail-surface min-h-screen px-4 py-8 text-white sm:px-6 lg:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <BrandLockup />
            <h1 className="display mt-6 text-3xl leading-tight sm:text-4xl">
              Elige el club que vas a presidir
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Hola {state.user.name}, cada Presidente representa un club dentro de{" "}
              <strong className="font-semibold text-white">{state.tournament?.name}</strong>{" "}
              ({state.tournament?.season}). La elección es definitiva durante la temporada: tu
              club arranca con la plantilla vacía y la construirás en el primer draft.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {state.isAdmin ? (
              <Badge className="border-0 bg-gold/20 text-amber-100">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Administrador principal del torneo
              </Badge>
            ) : null}
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {state.clubs.length} clubes habilitados ·{" "}
              {state.clubs.filter((club) => !club.presidentNickname).length} disponibles
            </p>
          </div>
        </header>

        {rules ? (
          <section
            aria-label="Reglas clave del torneo"
            className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <RuleChip label="Presupuesto" value={formatMoney(rules.budget)} />
            <RuleChip
              label="Plantilla"
              value={`${rules.squadSize} jugadores`}
              hint={`POR ${rules.gkMin}-${rules.gkMax} · DEF ${rules.defMin}-${rules.defMax}`}
            />
            <RuleChip
              label="OVR mínimo"
              value={`${rules.minOvr}`}
              hint={`Máx. sub-21 · ${rules.maxU21}`}
            />
            <RuleChip
              label="Cierre de alineación"
              value={`${rules.lineupLockHours} h antes`}
              hint="Se fija en cada jornada"
            />
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar club, liga o país…"
                aria-label="Buscar club"
                className="h-11 border-white/15 bg-white/10 pl-9 text-white placeholder:text-white/45"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {leagues.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLeague(option)}
                  aria-pressed={league === option}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 text-xs font-semibold transition-colors",
                    league === option
                      ? "border-brand-bright bg-brand/25 text-white"
                      : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((club) => {
              const taken = Boolean(club.presidentNickname);
              return (
                <li
                  key={club.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
                    taken
                      ? "border-white/10 bg-white/[0.03] opacity-70"
                      : "border-white/12 bg-white/[0.06] hover:border-brand-bright/60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Crest
                      name={club.name}
                      shortName={club.shortName}
                      colors={[club.colorPrimary, club.colorSecondary]}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="display truncate text-sm text-white">{club.name}</p>
                      <p className="truncate text-[11px] text-white/60">
                        {club.league} · {club.country}
                      </p>
                    </div>
                  </div>

                  <dl className="num grid grid-cols-2 gap-2 text-[11px] text-white/70">
                    <div>
                      <dt className="uppercase tracking-wide text-white/45">Presupuesto</dt>
                      <dd className="text-sm font-semibold text-white">
                        {formatMoney(rules?.budget ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide text-white/45">Plantilla</dt>
                      <dd className="text-sm font-semibold text-white">
                        {club.rosterSize} / {rules?.squadSize ?? "—"}
                      </dd>
                    </div>
                  </dl>

                  {taken ? (
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
                      <Info className="size-3.5" aria-hidden="true" />
                      Presidido por {club.presidentNickname}
                    </p>
                  ) : (
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Disponible
                    </p>
                  )}

                  <Button
                    type="button"
                    disabled={taken}
                    onClick={() => setCandidate(club)}
                    className="min-h-11"
                    variant={taken ? "secondary" : "default"}
                  >
                    {taken ? "No disponible" : "Seleccionar club"}
                  </Button>
                </li>
              );
            })}
          </ul>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
              No hay clubes que coincidan con «{query}». Prueba con otro nombre o cambia de liga.
            </p>
          ) : null}
        </section>
      </div>

      <Dialog open={Boolean(candidate)} onOpenChange={(open) => !open && setCandidate(null)}>
        <DialogContent className="sm:max-w-md">
          {candidate ? (
            <>
              <DialogHeader>
                <DialogTitle className="display">¿Quieres representar este club?</DialogTitle>
                <DialogDescription>
                  Esta decisión te asigna la presidencia dentro de {state.tournament?.name}.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                <Crest
                  name={candidate.name}
                  shortName={candidate.shortName}
                  colors={[candidate.colorPrimary, candidate.colorSecondary]}
                  size="lg"
                />
                <div>
                  <p className="display text-sm">{candidate.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {candidate.league} · {candidate.country}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Presupuesto
                  </dt>
                  <dd className="num mt-0.5 font-bold">
                    {formatMoney(rules?.budget ?? 0)}
                  </dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Plantilla inicial
                  </dt>
                  <dd className="num mt-0.5 font-bold">
                    {candidate.rosterSize} / {rules?.squadSize ?? candidate.rosterSize}
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Arrancas con la plantilla vacía: construirás tu equipo en el primer draft fichando
                del catálogo FC 27 con este presupuesto. El motor de reglas validará cada ficha
                contra el reglamento del torneo (cupos por posición, OVR y sub-21).
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setCandidate(null)}
                  disabled={saving}
                >
                  Elegir otro
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={confirm}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Confirmando…
                    </>
                  ) : (
                    "Confirmar club"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </span>
      <span className="num display text-base text-white">{value}</span>
      {hint ? <span className="text-[11px] text-white/55">{hint}</span> : null}
    </div>
  );
}
