import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-navy-deep", children: _jsx("div", { className: "animate-pulse text-xs font-semibold uppercase tracking-[0.2em] text-white/70", children: "Cargando 11Eleven\u2026" }) }));
}
/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { hasError: false }
        });
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(err) {
        console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
    }
    render() {
        return this.state.hasError ? null : this.props.children;
    }
}
/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { hasError: false, message: "", stack: "" }
        });
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            message: error.message || "Unknown runtime error",
            stack: error.stack || "",
        };
    }
    componentDidCatch(err) {
        console.error("[WebContainer preview] Root crash:", err);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background text-foreground p-6", children: _jsxs("div", { className: "max-w-lg text-center", children: [_jsx("p", { className: "text-sm font-semibold", children: "Preview runtime error" }), _jsx("p", { className: "mt-2 text-xs text-muted-foreground break-words", children: this.state.message }), this.state.stack && (_jsx("pre", { className: "mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2", children: this.state.stack }))] }) }));
        }
        return this.props.children;
    }
}
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
// GitHub Pages serves the build under /eleven11/ (vite --base), dev serves it
// at /. BASE_URL covers both without branching on environment.
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
function RouteSyncer() {
    const location = useLocation();
    useEffect(() => {
        window.parent.postMessage({ type: "iframe-route-change", path: location.pathname }, "*");
    }, [location.pathname]);
    useEffect(() => {
        function handleMessage(event) {
            if (event.data?.type === "navigate") {
                if (event.data.direction === "back")
                    window.history.back();
                if (event.data.direction === "forward")
                    window.history.forward();
            }
        }
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);
    return null;
}
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsxs(RootErrorBoundary, { children: [_jsx(ToolbarErrorBoundary, { children: _jsx(VlyToolbar, {}) }), _jsxs(ConvexAuthProvider, { client: convex, children: [_jsxs(BrowserRouter, { basename: routerBasename, children: [_jsx(RouteSyncer, {}), _jsx(Suspense, { fallback: _jsx(RouteLoading, {}), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Landing, {}) }), _jsx(Route, { path: "/auth", element: _jsx(AuthPage, { redirectAfterAuth: "/dashboard" }) }), _jsxs(Route, { path: "/dashboard", element: _jsx(RequireAuth, { children: _jsx(DashboardLayout, {}) }), children: [_jsx(Route, { index: true, element: _jsx(HomePage, {}) }), _jsx(Route, { path: "club", element: _jsx(ClubPage, {}) }), _jsx(Route, { path: "club/plantilla", element: _jsx(SquadPage, {}) }), _jsx(Route, { path: "club/estado", element: _jsx(PlayerStatusPage, {}) }), _jsx(Route, { path: "formacion", element: _jsx(FormationPage, {}) }), _jsx(Route, { path: "mercado", element: _jsx(MarketPage, {}) }), _jsx(Route, { path: "mercado/negociaciones", element: _jsx(NegotiationsPage, {}) }), _jsx(Route, { path: "draft", element: _jsx(DraftPage, {}) }), _jsx(Route, { path: "competicion", element: _jsx(CompetitionPage, {}) }), _jsx(Route, { path: "equipos", element: _jsx(TeamsPage, {}) }), _jsx(Route, { path: "reglas", element: _jsx(RulesPage, {}) }), _jsx(Route, { path: "perfil", element: _jsx(ProfilePage, {}) }), _jsx(Route, { path: "admin", element: _jsx(AdminPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }) })] }), _jsx(Toaster, {})] })] }) }));
