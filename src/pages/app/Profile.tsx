import { useState } from "react";
import type { AppStateView } from "@/convex/appTypes";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage, formatDate } from "@/lib/errors";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { useNavigate, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Crest } from "@/components/eleven/Crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, LogOut, Shield, ShieldCheck, User } from "lucide-react";

const PERMISSION_LABELS: Record<string, string> = {
  configuracion: "Configuración",
  presidentes: "Presidentes",
  jugadores: "Jugadores",
  mercado: "Mercado",
  draft: "Draft",
  calendario: "Calendario",
  noticias: "Noticias",
  ia: "IA / publicaciones",
  auditoria: "Auditoría",
};

export default function Profile() {
  const state = useOutletContext<AppStateView>();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useMutation(api.tournament.updateProfile);

  const serverNickname = (state.president?.nickname ?? state.user.nickname).replace("@", "");
  const [nickname, setNickname] = useState(serverNickname);
  const [displayName, setDisplayName] = useState(state.user.name);
  const [saving, setSaving] = useState(false);

  // Adjust the form when the server profile changes, without an effect.
  const serverKey = `${serverNickname}|${state.user.name}`;
  const [draftKey, setDraftKey] = useState(serverKey);
  if (draftKey !== serverKey) {
    setDraftKey(serverKey);
    setNickname(serverNickname);
    setDisplayName(state.user.name);
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ nickname, displayName });
      toast.success("Perfil actualizado", {
        description: "Tu nombre público y tu nickname ya están visibles para el torneo.",
      });
    } catch (cause) {
      toast.error("No se pudo guardar el perfil", {
        description: errorMessage(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <header>
        <h1 className="display text-2xl">Perfil</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Tu cuenta es única; puedes presidir clubes distintos en torneos distintos con la misma
          cuenta y el mismo nickname.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Cuenta" icon={User} className="lg:col-span-2" bodyClassName="p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="displayName">Nombre real</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="h-11"
                  maxLength={60}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Se usa en la auditoría del torneo y en tu perfil de Presidente.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nickname">Nickname público</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">@</span>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    className="h-11"
                    minLength={3}
                    maxLength={20}
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Así te ven los demás Presidentes en el mercado y en las negociaciones.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="min-h-11" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Guardando…
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
              <span className="text-xs text-muted-foreground">{state.user.email}</span>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Rol en el torneo" icon={ShieldCheck}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-brand/30 bg-brand/10 text-primary">
                Presidente
              </Badge>
              {state.isAdmin ? (
                <Badge variant="outline" className="border-gold/40 bg-gold/15 text-amber-700 dark:text-amber-300">
                  <Crown className="size-3" aria-hidden="true" />
                  {state.adminRole === "principal"
                    ? "Administrador principal"
                    : "Co-Administrador"}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {state.isAdmin
                ? "Tu cuenta acumula ambos roles: presides un club y además administras el torneo. Las acciones administrativas quedan registradas con tu nombre."
                : "Los roles administrativos son un permiso dentro del torneo, no una cuenta distinta: puedes ser Presidente y Administrador a la vez."}
            </p>
            {state.isAdmin ? (
              <ul className="flex flex-wrap gap-1.5">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <li
                    key={key}
                    className="rounded-md border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        </SectionCard>
      </div>

      {state.club && state.president ? (
        <SectionCard title="Presidencia actual" icon={Shield}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Crest
              name={state.club.name}
              shortName={state.club.shortName}
              colors={[state.club.colorPrimary, state.club.colorSecondary]}
              size="lg"
            />
            <div className="flex-1">
              <p className="display text-lg">{state.club.name}</p>
              <p className="text-sm text-muted-foreground">
                {state.tournament?.name} · {state.tournament?.season}
              </p>
            </div>
            <dl className="num grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Desde
                </dt>
                <dd className="font-semibold">{formatDate(state.president.joinedAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Plantilla
                </dt>
                <dd className="font-semibold">{state.president.squadSize} jugadores</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Presupuesto
                </dt>
                <dd className="font-semibold">{formatMoney(state.budget.available)}</dd>
              </div>
            </dl>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
