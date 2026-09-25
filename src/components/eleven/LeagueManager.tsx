import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LeagueSummaryView } from "@/convex/appTypes";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2, Loader2, Plus, Swords } from "lucide-react";

/**
 * League manager reachable from the user menu: switch the active league,
 * start a brand-new one (a clean slate for testing without wiping the
 * database) or join an existing league with its invitation code.
 */
export function LeagueManagerDialog({
  open,
  onOpenChange,
  leagues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagues: LeagueSummaryView[];
}) {
  const navigate = useNavigate();
  const activateLeague = useMutation(api.leagues.activateLeague);
  const createLeague = useMutation(api.leagues.createLeague);
  const joinLeague = useMutation(api.leagues.joinLeague);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const busy = busyKey !== null;

  const activate = async (tournamentId: Id<"tournaments">) => {
    setBusyKey(`activar-${tournamentId}`);
    try {
      const result = await activateLeague({ tournamentId });
      toast.success(`Liga activa: ${result.name}`, {
        description: "Todo el panel ya apunta a esa liga.",
      });
      onOpenChange(false);
      navigate("/dashboard");
    } catch (cause) {
      toast.error("No se pudo cambiar de liga", {
        description: errorMessage(cause),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyKey("crear");
    try {
      const result = await createLeague({ name });
      toast.success(`Liga ${result.name} creada`, {
        description:
          "Eres el Administrador principal. Siguiente paso: configura las reglas de tu liga.",
      });
      setName("");
      onOpenChange(false);
      navigate("/dashboard/admin");
    } catch (cause) {
      toast.error("No se pudo crear la liga", {
        description: errorMessage(cause),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyKey("unirse");
    try {
      const result = await joinLeague({ code });
      toast.success(`Te uniste a ${result.name}`, {
        description: "Ahora elige el equipo que vas a presidir.",
      });
      setCode("");
      onOpenChange(false);
      navigate("/dashboard");
    } catch (cause) {
      toast.error("No se pudo unir a la liga", {
        description: errorMessage(cause),
      });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="display">Mis ligas</DialogTitle>
          <DialogDescription>
            Cambia de liga, crea una nueva para empezar una prueba limpia o
            únete a otra con su código. Tus ligas anteriores conservan sus
            datos: nada se borra.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Tus ligas
          </h3>
          {leagues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no perteneces a ninguna liga.
            </p>
          ) : (
            <ul className="divide-y">
              {leagues.map((league) => (
                <li
                  key={league.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {league.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {league.season} · {league.memberCount} miembro(s) ·{" "}
                      {league.myClubName
                        ? `Presides ${league.myClubName}`
                        : "Sin equipo todavía"}
                    </p>
                  </div>
                  {league.active ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Activa
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 shrink-0"
                      disabled={busy}
                      onClick={() => void activate(league.id)}
                    >
                      {busyKey === `activar-${league.id}` ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      Activar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={create} className="flex flex-col gap-2">
          <Label htmlFor="newLeagueName" className="text-xs">
            Crear una liga nueva (prueba limpia)
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="newLeagueName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Liga de Pruebas 2026"
              className="h-11"
              required
              minLength={3}
              maxLength={60}
            />
            <Button
              type="submit"
              className="min-h-11 shrink-0"
              disabled={busy || name.trim().length < 3}
            >
              {busyKey === "crear" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Crear y configurar reglas
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Se crea con datos en cero y quedas como Administrador principal:
            directo al paso de reglas.
          </p>
        </form>

        <form onSubmit={join} className="flex flex-col gap-2">
          <Label htmlFor="joinLeagueCode" className="text-xs">
            Unirme a una liga con código
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="joinLeagueCode"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Ej. LIGCOL-K7QX"
              className="num h-11"
              required
              minLength={4}
            />
            <Button
              type="submit"
              variant="outline"
              className="min-h-11 shrink-0"
              disabled={busy || code.trim().length < 4}
            >
              {busyKey === "unirse" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Swords className="size-4" aria-hidden="true" />
              )}
              Unirme
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Al entrar, la liga pasa a ser tu liga activa y eliges tu equipo del
            catálogo mundial.
            <ArrowRight className="ml-1 inline size-3" aria-hidden="true" />
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
