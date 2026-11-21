import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/infrastructure/supabase/client";
import { queryStore } from "@/services/backend/query-store";
import {
  ACCOUNT_PASSWORD_HINT,
  parseAccountInput,
} from "@/domain/account-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { KeyRound, UserPlus } from "lucide-react";
type Target = { userId: string; displayName: string; email: string };
export function PresidentAccountDialog({
  tournamentId,
  target,
}: {
  tournamentId: string;
  target?: Target;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={target ? "outline" : "default"}
        onClick={() => setOpen(true)}
      >
        {target ? (
          <KeyRound className="size-4" />
        ) : (
          <UserPlus className="size-4" />
        )}
        {target ? "Editar acceso" : "Crear presidente"}
      </Button>
      {open ? (
        <AccountForm
          tournamentId={tournamentId}
          target={target}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
function AccountForm({
  tournamentId,
  target,
  onClose,
}: {
  tournamentId: string;
  target?: Target;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(target?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [error, setError] = useState("");
  const targetId = target?.userId;
  useEffect(() => {
    let active = true;
    supabase.functions
      .invoke<{ ok?: boolean; error?: string }>("president-accounts", {
        body: {
          action: "check",
          tournamentId,
          ...(targetId ? { userId: targetId } : {}),
        },
      })
      .then(async (result) => {
        if (!active) return;
        if (result.error || !result.data?.ok) {
          let message = result.data?.error;
          if (result.error?.context instanceof Response) {
            try {
              const body = await result.error.context.json();
              if (typeof body.error === "string") message = body.error;
              if (body.message === "Invalid JWT")
                message =
                  "No se pudo validar la sesión en el servicio de cuentas. Vuelve a iniciar sesión; si persiste, contacta con soporte.";
            } catch {
              /* Keep a safe generic message. */
            }
          }
          if (active)
            setError(
              message ??
                "No se pudo verificar el servicio de cuentas. Reintenta antes de introducir credenciales.",
            );
        } else setReady(true);
      })
      .catch(() => {
        if (active) setError("No se pudo conectar con el servicio de cuentas.");
      });
    return () => {
      active = false;
    };
  }, [tournamentId, targetId, checkAttempt]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setError("");
    let input;
    try {
      input = parseAccountInput({
        action: target ? "update" : "create",
        tournamentId,
        ...(target ? { userId: target.userId } : {}),
        email,
        ...(password ? { password } : {}),
      });
      if (password !== confirm) throw Error("Las contraseñas no coinciden.");
      if (target && input.email === target.email.toLowerCase() && !password)
        throw Error("No hay cambios para guardar.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revisa los datos.");
      return;
    }
    setBusy(true);
    try {
      const result = await supabase.functions.invoke<{
        ok?: boolean;
        message?: string;
        error?: string;
      }>("president-accounts", { body: input });
      let message = result.data?.error;
      if (result.error) {
        const context = result.error.context;
        if (context instanceof Response) {
          try {
            const body = await context.json();
            if (typeof body.error === "string") message = body.error;
          } catch {
            /* Use a generic error, never raw response content. */
          }
        }
        throw Error(
          message ??
            "No se pudo guardar la cuenta. Comprueba la sesión y vuelve a intentarlo.",
        );
      }
      if (!result.data?.ok)
        throw Error(
          message ?? "No se pudo confirmar el guardado de la cuenta.",
        );
      setPassword("");
      setConfirm("");
      toast.success(target ? "Acceso actualizado" : "Presidente creado", {
        description: result.data.message,
      });
      onClose();
      queryStore.invalidateAll();
    } catch (cause) {
      setPassword("");
      setConfirm("");
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar la cuenta.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {target
              ? `Editar acceso de ${target.displayName}`
              : "Crear cuenta de presidente"}
          </DialogTitle>
          <DialogDescription>
            {target
              ? "Puedes cambiar el correo, la contraseña o ambos. Los cambios de acceso afectan a esta cuenta en todos sus universos; su equipo y presupuesto se conservan."
              : "La cuenta se crea con acceso por correo y contraseña, sin confirmación por correo. Se incorpora a este universo sin equipo; el presidente podrá elegirlo al ingresar."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <fieldset disabled={busy || !ready} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="president-account-email">
                Correo electrónico
              </label>
              <Input
                id="president-account-email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="president-account-password">
                {target ? "Nueva contraseña (opcional)" : "Contraseña"}
              </label>
              <Input
                id="president-account-password"
                type="password"
                required={!target}
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="president-password-hint"
              />
              <p
                id="president-password-hint"
                className="text-xs text-muted-foreground"
              >
                {ACCOUNT_PASSWORD_HINT}
                {target ? " Déjala vacía para conservar la actual." : ""} La
                contraseña actual nunca se muestra.
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="president-account-confirm">
                Repetir nueva contraseña
              </label>
              <Input
                id="president-account-confirm"
                type="password"
                required={Boolean(password)}
                maxLength={128}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </fieldset>
          {!ready && !error ? (
            <p role="status">Verificando acceso al servicio de cuentas…</p>
          ) : null}
          {error && !ready ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => { setError(""); setReady(false); setCheckAttempt((a) => a + 1); }}
            >
              Reintentar conexión
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !ready}>
              {busy
                ? "Guardando…"
                : target
                  ? "Guardar acceso"
                  : "Crear presidente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
