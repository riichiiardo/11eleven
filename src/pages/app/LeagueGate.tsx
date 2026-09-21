import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { NeedsLeagueState } from "@/convex/appTypes";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { BrandLockup } from "@/components/eleven/Brand";
import { Crest } from "@/components/eleven/Crest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The create/join gate. A user without a league sees ONLY this screen: create
 * a league (walks into the rules step) or join one with its invitation code.
 * Existing memberships can be re-activated from here too.
 */
export default function LeagueGate({ state }: { state: NeedsLeagueState }) {
  const navigate = useNavigate();
  const createLeague = useMutation(api.leagues.createLeague);
  const joinLeague = useMutation(api.leagues.joinLeague);
  const activateLeague = useMutation(api.leagues.activateLeague);

  const [mode, setMode] = useState<"crear" | "unirse">(
    state.leagues.length > 0 ? "unirse" : "crear",
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createLeague({ name });
      toast.success(`Liga ${result.name} creada`, {
        description:
          "Eres el Administrador principal. Siguiente paso: configura las reglas de tu liga.",
      });
      navigate("/dashboard/admin");
    } catch (cause) {
      toast.error("No se pudo crear la liga", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await joinLeague({ code });
      toast.success(`Te uniste a ${result.name}`, {
        description: "Ahora elige el equipo que vas a presidir.",
      });
    } catch (cause) {
      toast.error("No se pudo unir a la liga", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const activate = async (tournamentId: string) => {
    setBusy(true);
    try {
      const result = await activateLeague({
        tournamentId: tournamentId as never,
      });
      toast.success(`Liga activa: ${result.name}`);
    } catch (cause) {
      toast.error("No se pudo cambiar de liga", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.info(`Código ${code} copiado`, {
        description: "Compártelo para que otros Presidentes se unan.",
      });
    } catch {
      toast.info(`Código de invitación: ${code}`);
    }
  };

  return (
    <div className="rail-surface min-h-screen px-4 py-8 text-white sm:px-6 lg:py-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <BrandLockup />
          <h1 className="display mt-4 text-3xl leading-tight sm:text-4xl">
            Bienvenido, {state.user.name}
          </h1>
          <p className="max-w-2xl text-sm text-white/70">
            En 11Eleven eres el <strong className="text-white">Presidente</strong>{" "}
            de tu propio club de fantasía. Crea tu liga y configura sus reglas,
            o únete a la de un amigo con su código de invitación.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("crear")}
            aria-pressed={mode === "crear"}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-5 text-left transition-colors",
              mode === "crear"
                ? "border-brand-bright bg-brand/20"
                : "border-white/12 bg-white/[0.05] hover:bg-white/10",
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-gold/20">
              <Plus className="size-5 text-amber-300" aria-hidden="true" />
            </span>
            <span className="display text-lg">Crear mi liga</span>
            <span className="text-xs leading-relaxed text-white/65">
              Tú eres el Administrador principal: defines presupuesto, tamaño de
              plantilla, cupos, draft y calendario. Invitas a quien quieras con
              tu código.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("unirse")}
            aria-pressed={mode === "unirse"}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-5 text-left transition-colors",
              mode === "unirse"
                ? "border-brand-bright bg-brand/20"
                : "border-white/12 bg-white/[0.05] hover:bg-white/10",
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand/25">
              <Users className="size-5 text-sky-300" aria-hidden="true" />
            </span>
            <span className="display text-lg">Unirme a una liga</span>
            <span className="text-xs leading-relaxed text-white/65">
              Tienes un código de invitación? Entra a una liga existente,
              elige cualquier equipo del catálogo mundial y compite en el draft.
            </span>
          </button>
        </div>

        {mode === "crear" ? (
          <form
            onSubmit={create}
            className="flex flex-col gap-4 rounded-2xl border border-white/12 bg-white/[0.05] p-5"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leagueName" className="text-xs text-white/80">
                Nombre de tu liga
              </Label>
              <Input
                id="leagueName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Liga Colombiana Fantasy 2026"
                className="h-11 border-white/15 bg-white/10 text-white placeholder:text-white/40"
                required
                minLength={3}
                maxLength={60}
              />
              <p className="text-[11px] text-white/50">
                Después de crearla te llevamos directo a configurar sus reglas:
                presupuesto, plantilla, cupos por posición y draft.
              </p>
            </div>
            <Button
              type="submit"
              className="min-h-11 self-start"
              disabled={busy || name.trim().length < 3}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creando…
                </>
              ) : (
                <>
                  <Trophy className="size-4" aria-hidden="true" />
                  Crear liga y configurar reglas
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={join}
            className="flex flex-col gap-4 rounded-2xl border border-white/12 bg-white/[0.05] p-5"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leagueCode" className="text-xs text-white/80">
                Código de invitación
              </Label>
              <Input
                id="leagueCode"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Ej. LIGCOL-K7QX"
                className="num h-11 border-white/15 bg-white/10 text-white placeholder:text-white/40"
                required
                minLength={4}
              />
              <p className="text-[11px] text-white/50">
                El Administrador de la liga comparte este código. Al entrar
                eliges un equipo libre del catálogo mundial.
              </p>
            </div>
            <Button
              type="submit"
              className="min-h-11 self-start"
              disabled={busy || code.trim().length < 4}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Entrando…
                </>
              ) : (
                <>
                  <Swords className="size-4" aria-hidden="true" />
                  Unirme a la liga
                </>
              )}
            </Button>
          </form>
        )}

        {state.leagues.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="display text-sm uppercase tracking-[0.18em] text-white/60">
              Tus ligas
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {state.leagues.map((league) => (
                <li
                  key={league.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-4",
                    league.active
                      ? "border-brand-bright/60 bg-brand/15"
                      : "border-white/12 bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="display truncate text-sm">{league.name}</p>
                      <p className="truncate text-[11px] text-white/55">
                        {league.season} · {league.memberCount} miembro(s)
                      </p>
                    </div>
                    {league.active ? (
                      <Badge className="shrink-0 border-0 bg-emerald-500/20 text-emerald-200">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Activa
                      </Badge>
                    ) : null}
                  </div>

                  {league.myClubName ? (
                    <div className="flex items-center gap-2 text-[11px] text-white/70">
                      <Crest
                        name={league.myClubName}
                        shortName={league.myClubName.slice(0, 3).toUpperCase()}
                        colors={["#1d4ed8", "#0b1a30"]}
                        size="sm"
                      />
                      Presides {league.myClubName}
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/55">
                      Sin equipo todavía: elige uno del catálogo al entrar.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyCode(league.code)}
                      className="num inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/10"
                      title="Copiar código de invitación"
                    >
                      {league.code}
                      <Copy className="size-3" aria-hidden="true" />
                    </button>
                    {league.isAdmin ? (
                      <Badge
                        variant="outline"
                        className="border-gold/40 bg-gold/10 text-[10px] text-amber-200"
                      >
                        Administrador
                      </Badge>
                    ) : null}
                    {!league.active ? (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9"
                        disabled={busy}
                        onClick={() => activate(league.id)}
                      >
                        Entrar
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
