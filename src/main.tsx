import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const DashboardLayout = lazy(() => import("./pages/app/DashboardLayout.tsx"));
const HomePage = lazy(() => import("./pages/app/Home.tsx"));
const ClubPage = lazy(() => import("./pages/app/Club.tsx"));
const SquadPage = lazy(() => import("./pages/app/Squad.tsx"));
const PlayerStatusPage = lazy(() => import("./pages/app/PlayerStatus.tsx"));
const FormationPage = lazy(() => import("./pages/app/Formation.tsx"));
const MarketPage = lazy(() => import("./pages/app/Market.tsx"));
const NegotiationsPage = lazy(() => import("./pages/app/Negotiations.tsx"));
const DraftPage = lazy(() => import("./pages/app/Draft.tsx"));
const CompetitionPage = lazy(() => import("./pages/app/Competition.tsx"));
const TeamsPage = lazy(() => import("./pages/app/Teams.tsx"));
const RulesPage = lazy(() => import("./pages/app/Rules.tsx"));
const ProfilePage = lazy(() => import("./pages/app/Profile.tsx"));
const AdminPage = lazy(() => import("./pages/app/Admin.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-deep">
      <div className="animate-pulse text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
        Cargando 11Eleven…
      </div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<HomePage />} />
                <Route path="club" element={<ClubPage />} />
                <Route path="club/plantilla" element={<SquadPage />} />
                <Route path="club/estado" element={<PlayerStatusPage />} />
                <Route path="formacion" element={<FormationPage />} />
                <Route path="mercado" element={<MarketPage />} />
                <Route
                  path="mercado/negociaciones"
                  element={<NegotiationsPage />}
                />
                <Route path="draft" element={<DraftPage />} />
                <Route path="competicion" element={<CompetitionPage />} />
                <Route path="equipos" element={<TeamsPage />} />
                <Route path="reglas" element={<RulesPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
