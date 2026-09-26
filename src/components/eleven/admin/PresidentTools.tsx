import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AvailableTeamView, PresidentView } from "@/convex/appTypes";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel, Tip } from "@/components/eleven/admin/AdminBits";
import {
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  Trash2,
  UserRoundCog,
  Wallet,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Shareable invitation link (not only by e-mail)
 * ------------------------------------------------------------------ */

export function InviteCard({ code }: { code: string }) {
  const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/dashboard?invitar=${code}`;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`, {
        description: "Compártelo con los posibles Presidentes de tu liga.",
      });
    } catch {
      toast.info(`${label}: ${value}`);
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Únete a mi liga en 11Eleven",
          text: `Entra a mi liga de fantasía con el código ${code}`,
          url: inviteUrl,
        });
        return;
      } catch {
        /* user cancelled or unsupported: fall back to copy */
      }
    }
    await copy(inviteUrl, "Link de invitación");
  };

  return (
    <section className="card-soft flex flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-brand" />
        <h3 className="display flex items-center gap-2 text-[13px]">
          <Share2 className="size-4 text-muted-foreground" aria-hidden="true" />
          Invitar Presidentes con un link
        </h3>
        <Tip
          side="left"
          text="Link compartible: cualquiera que lo abra entra directo a la pantalla de unión de tu liga (pide iniciar sesión si aún no lo hizo). Sirve para WhatsApp, redes o donde quieras; el correo de Administración sigue siendo otra vía, para invitar Co-Administradores."
        />
      </header>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Comparte este link en lugar del solo correo: quien lo abra se une a{" "}
        <strong className="text-foreground">{code}</strong> automáticamente y después elige su
        equipo.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          aria-label="Link de invitación"
          value={inviteUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="num h-11 min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 text-xs"
        />
        <div className="flex gap-2">
          <Button type="button" className="min-h-11 shrink-0" onClick={() => void share()}>
            <Link2 className="size-4" aria-hidden="true" />
            Compartir link
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => void copy(inviteUrl, "Link de invitación")}
          >
            <Copy className="size-4" aria-hidden="true" />
            Copiar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Código corto:</span>
        <Badge variant="outline" className="num">
          {code}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-8"
          onClick={() => void copy(code, "Código")}
        >
          <Copy className="size-3.5" aria-hidden="true" />
          Copiar código
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Change a president's club (from the available pool)
 * ------------------------------------------------------------------ */

export function ChangeClubDialog({
  president,
  teams,
}: {
  president: PresidentView;
  teams: AvailableTeamView[];
}) {
  const changeClub = useMutation(api.adminOps.changePresidentClub);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const [kind, id] = target.split(":");
      const result = await changeClub({
        presidentId: president.id,
        ...(kind === "lc" ? { leagueClubId: id as never } : { catalogTeamId: id as never }),
      });
      toast.success("Club cambiado", {
        description: `${president.displayName} ahora preside ${result.clubName}.`,
      });
      setOpen(false);
      setTarget("");
    } catch (cause) {
      toast.error("No se pudo cambiar el club", { description: errorMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Cambiar equipo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="display flex items-center gap-2">
              <UserRoundCog className="size-4" aria-hidden="true" />
              Cambiar equipo de {president.displayName}
            </DialogTitle>
            <DialogDescription>
              Mueve la presidencia a cualquier equipo disponible del pool. La plantilla, el
              presupuesto y el historial del Presidente se conservan; si el destino ya juega en el
              calendario, el club anterior queda libre.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel
                htmlFor="changeClubTarget"
                tip="Pool de equipos: clubes de la liga sin Presidente (ya están en el calendario) y equipos del catálogo mundial que aún no ha elegido nadie. Los ocupados no aparecen."
              >
                Equipo disponible
              </FieldLabel>
              <Select value={target} onValueChange={setTarget} disabled={teams.length === 0}>
                <SelectTrigger id="changeClubTarget" className="min-h-11">
                  <SelectValue placeholder="Elige un equipo libre" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {teams.map((team) => (
                    <SelectItem
                      key={team.leagueClubId ? `lc:${team.leagueClubId}` : `ct:${team.catalogTeamId}`}
                      value={team.leagueClubId ? `lc:${team.leagueClubId}` : `ct:${team.catalogTeamId}`}
                      className="min-h-10"
                    >
                      {team.name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {team.league}
                        {team.leagueClubId ? " · libre en la liga" : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {teams.length > 0
                  ? `${teams.length} equipo(s) disponible(s) ahora mismo.`
                  : "No hay equipos libres: elimina una presidencia o amplía el catálogo."}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>
                Actual: <strong className="text-foreground">{president.clubName}</strong> ·{" "}
                {president.squadSize} jugador(es) en plantilla ·{" "}
                {formatMoney(president.budget)} de presupuesto.
              </p>
            </div>

            <Button
              type="button"
              className="min-h-11 self-start"
              disabled={!target || busy}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Asignar este equipo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Extra budget for official extra events
 * ------------------------------------------------------------------ */

export function GrantBudgetDialog({ president }: { president: PresidentView }) {
  const grantBudget = useMutation(api.adminOps.grantBudget);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [concept, setConcept] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await grantBudget({
        presidentId: president.id,
        amount: Math.round(amount * 1_000_000),
        concept,
      });
      toast.success("Presupuesto extra asignado", {
        description: `${president.displayName}: +${formatMoney(result.granted)} · nuevo presupuesto ${formatMoney(result.budget)}.`,
      });
      setOpen(false);
      setConcept("");
    } catch (cause) {
      toast.error("No se pudo asignar el presupuesto", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9"
        onClick={() => setOpen(true)}
      >
        <Wallet className="size-3.5" aria-hidden="true" />
        Presupuesto extra
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="display flex items-center gap-2">
              <Wallet className="size-4" aria-hidden="true" />
              Presupuesto extra para {president.displayName}
            </DialogTitle>
            <DialogDescription>
              Se suma a la asignación principal del Presidente y queda registrado en la auditoría
              con el evento oficial que lo motiva.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <FieldLabel
                  htmlFor="grantAmount"
                  tip="Cantidad en millones de euros que se sumará al presupuesto actual. Ej.: 2 = 2.000.000 €. Debe ser un importe positivo."
                >
                  Importe (millones €)
                </FieldLabel>
                <Input
                  id="grantAmount"
                  type="number"
                  min={0.1}
                  step={0.5}
                  className="h-11"
                  value={amount}
                  onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Actual: {formatMoney(president.budget)}
                  {president.budgetExtra > 0
                    ? ` (incluye ${formatMoney(president.budgetExtra)} extra ya concedidos)`
                    : ""}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel
                  htmlFor="grantConcept"
                  tip="Motivo oficial del extra (evento, bonificación, sanción compensada…). Es obligatorio porque queda en la auditoría y lo ven los Presidentes en su historial."
                >
                  Evento oficial que lo motiva
                </FieldLabel>
                <Input
                  id="grantConcept"
                  className="h-11"
                  maxLength={140}
                  placeholder="Ej. Premio por campeonato de copa oficial"
                  value={concept}
                  onChange={(event) => setConcept(event.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="button"
              className="min-h-11 self-start"
              disabled={busy || amount <= 0 || concept.trim().length < 3}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Wallet className="size-4" aria-hidden="true" />
              )}
              Asignar {formatMoney(Math.round(amount * 1_000_000))}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Remove a president from the league
 * ------------------------------------------------------------------ */

export function RemovePresidentDialog({ president }: { president: PresidentView }) {
  const removePresident = useMutation(api.adminOps.removePresident);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await removePresident({ presidentId: president.id });
      toast.success("Presidente eliminado", {
        description: `${president.displayName} ya no forma parte de la liga${president.clubName ? ` · ${president.clubName} queda disponible` : ""}.`,
      });
      setOpen(false);
      setConfirm("");
      setAcknowledged(false);
    } catch (cause) {
      toast.error("No se pudo eliminar al Presidente", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        Eliminar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="display text-rose-700 dark:text-rose-300">
              Eliminar a {president.displayName} de la liga
            </DialogTitle>
            <DialogDescription>
              Se retira la presidencia, su plantilla y su presupuesto. Si el club todavía no tiene
              partidos programados, el equipo vuelve al pool; si ya juega en el calendario, queda
              libre en la liga.
            </DialogDescription>
          </DialogHeader>

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>
              Plantilla de {president.squadSize} jugador(es) y {formatMoney(president.budget)} de
              presupuesto se liberan.
            </li>
            <li>Deja de ser miembro de la liga (si también administra, conserva ese rol).</li>
            <li>La acción queda en la auditoría con tu nombre.</li>
          </ul>

          <label className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-3 text-xs">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(value) => setAcknowledged(value === true)}
            />
            <span>
              Entiendo que esta acción libera la presidencia de{" "}
              <strong>{president.clubName}</strong> y que sus jugadores quedan sin club.
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <FieldLabel
              htmlFor="removeConfirm"
              tip={`Escribe ELIMINAR en mayúsculas para confirmar. Es una doble salvaguarda contra clics accidentales.`}
            >
              Confirmación
            </FieldLabel>
            <Input
              id="removeConfirm"
              className="h-11"
              placeholder="ELIMINAR"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>

          <Button
            type="button"
            className="min-h-11 self-start border border-rose-500/40 bg-rose-600 text-white hover:bg-rose-700"
            disabled={busy || !acknowledged || confirm.trim().toUpperCase() !== "ELIMINAR"}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            Eliminar Presidente
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
