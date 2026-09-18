import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import type { AppStateView } from "@/convex/appTypes";
import { TOURNAMENT_STATUS_META } from "@/convex/rulesEngine";
import { useAuth } from "@/hooks/use-auth";
import { BrandLockup, ElevenMark } from "./Brand";
import { Crest } from "./Crest";
import { Countdown, StatusPill, ToneDot } from "./SectionCard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  ClipboardList,
  Gauge,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Shirt,
  ShoppingBag,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  adminOnly?: boolean;
  badge?: string;
};

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Control",
    items: [
      { label: "Inicio", to: "/dashboard", icon: LayoutDashboard, end: true },
      { label: "Mi Club", to: "/dashboard/club", icon: Shield, end: true },
    ],
  },
  {
    title: "Plantilla",
    items: [
      { label: "Plantilla", to: "/dashboard/club/plantilla", icon: Users },
      { label: "Formación", to: "/dashboard/formacion", icon: Shirt },
      { label: "Estado de jugadores", to: "/dashboard/club/estado", icon: ClipboardList },
    ],
  },
  {
    title: "Mercado",
    items: [
      { label: "Mercado", to: "/dashboard/mercado", icon: ShoppingBag, end: true },
      {
        label: "Negociaciones",
        to: "/dashboard/mercado/negociaciones",
        icon: Handshake,
      },
    ],
  },
  {
    title: "Torneo",
    items: [
      { label: "Reglas del torneo", to: "/dashboard/reglas", icon: BookOpen },
      { label: "Administración", to: "/dashboard/admin", icon: Gauge, adminOnly: true },
      { label: "Perfil", to: "/dashboard/perfil", icon: User },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { label: "Inicio", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "Club", to: "/dashboard/club", icon: Shield, end: true },
  { label: "Mercado", to: "/dashboard/mercado", icon: ShoppingBag, end: true },
  { label: "Once", to: "/dashboard/formacion", icon: Shirt },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
    isActive
      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  );
}

function UserMenu({
  state,
  variant = "bar",
}: {
  state: AppStateView;
  variant?: "bar" | "inline";
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const initials = state.user.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-left transition-colors",
            variant === "bar"
              ? "hover:bg-accent"
              : "text-sidebar-foreground hover:bg-sidebar-accent",
          )}
        >
          <span className="display flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-navy text-sm font-bold text-white">
            {initials || "P"}
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="truncate text-sm font-semibold">{state.user.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {state.president?.nickname ?? state.user.nickname} ·{" "}
              {state.isAdmin ? "Administrador" : "Presidente"}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold">{state.user.name}</span>
          <span className="block text-xs font-normal text-muted-foreground">
            {state.user.email || "Cuenta sin correo"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/dashboard/perfil")}>
          <User className="mr-2 size-4" aria-hidden="true" />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/dashboard/reglas")}>
          <BookOpen className="mr-2 size-4" aria-hidden="true" />
          Reglas del torneo
        </DropdownMenuItem>
        {state.isAdmin ? (
          <DropdownMenuItem onClick={() => navigate("/dashboard/admin")}>
            <Gauge className="mr-2 size-4" aria-hidden="true" />
            Administración
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 size-4" aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreSheet({ state }: { state: AppStateView }) {
  const [open, setOpen] = useState(false);
  const items = NAV_GROUPS.flatMap((group) => group.items).filter(
    (item) => !item.adminOnly || state.isAdmin,
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-muted-foreground"
        >
          <Menu className="size-5" aria-hidden="true" />
          Más
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle className="display text-sm">Navegación</SheetTitle>
          <SheetDescription>
            {state.president?.clubName ?? state.tournament?.name ?? "Torneo"} ·{" "}
            {state.tournament?.season}
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 items-center gap-3 rounded-lg border px-3 text-sm font-semibold",
                  isActive ? "border-primary bg-primary/5 text-primary" : "border-border",
                )
              }
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
          <div className="mt-2 border-t pt-3">
            <UserMenu state={state} />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({
  state,
  children,
}: {
  state: AppStateView;
  children: ReactNode;
}) {
  const tournament = state.tournament;
  const statusMeta = tournament ? TOURNAMENT_STATUS_META[tournament.status] : null;
  const lockAt = state.nextEvent?.lockAt ?? null;

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop rail */}
      <aside className="rail-surface sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 px-3 py-5 lg:flex">
        <div className="px-1">
          <BrandLockup />
        </div>

        {state.club ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <Crest
              name={state.club.name}
              shortName={state.club.shortName}
              colors={[state.club.colorPrimary, state.club.colorSecondary]}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{state.club.name}</p>
              <p className="truncate text-[11px] text-white/60">
                {state.president?.nickname} · {state.club.league}
              </p>
            </div>
          </div>
        ) : null}

        <nav className="scroll-thin mt-5 flex-1 overflow-y-auto pr-1">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (item) => !item.adminOnly || state.isAdmin,
            );
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="mb-4">
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  {group.title}
                </p>
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-brand/30 via-transparent to-pitch/25 p-3.5">
          <p className="display text-sm leading-tight text-white">
            Más que un jugador,
            <br />
            una liga de Presidentes.
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
            11Eleven · {tournament?.season ?? "Temporada"}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 lg:px-6">
            <div className="flex items-center gap-2.5 lg:hidden">
              <ElevenMark className="size-8" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {state.club?.name ?? "11Eleven"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {state.president?.nickname ?? state.user.nickname}
                </p>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
              <div className="min-w-0">
                <p className="display truncate text-sm">{tournament?.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {tournament?.season} · Jornada {tournament?.currentMatchday} de{" "}
                  {tournament?.totalMatchdays}
                </p>
              </div>
              {statusMeta ? (
                <StatusPill className={statusMeta.className}>
                  <ToneDot tone={statusMeta.tone} />
                  {statusMeta.label}
                </StatusPill>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {lockAt ? (
                <span className="hidden items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-[11px] md:inline-flex">
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Cierre de alineación
                  </span>
                  <Countdown target={lockAt} label="" className="text-xs" compact />
                </span>
              ) : null}
              <UserMenu state={state} />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-4 lg:px-6 lg:pb-8">{children}</main>
      </div>

      {/* Mobile navigation */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden"
      >
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
        <MoreSheet state={state} />
      </nav>
    </div>
  );
}

export function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-deep">
      <div className="flex flex-col items-center gap-3 text-white/70">
        <ElevenMark className="size-12 animate-pulse" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">
          Cargando el centro de control
        </p>
      </div>
    </div>
  );
}

export function AppError({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="display text-lg">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
