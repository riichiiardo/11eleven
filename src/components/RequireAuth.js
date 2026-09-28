import { jsx as _jsx } from "react/jsx-runtime";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router";
export function RequireAuth({ children }) {
    const { isLoading, isAuthenticated } = useAuth();
    const location = useLocation();
    if (isLoading) {
        return (_jsx("main", { className: "flex min-h-screen items-center justify-center bg-background", children: _jsx(Loader2, { className: "size-6 animate-spin text-muted-foreground" }) }));
    }
    if (!isAuthenticated) {
        const returnTo = `${location.pathname}${location.search}`;
        return (_jsx(Navigate, { to: `/auth?returnTo=${encodeURIComponent(returnTo)}`, replace: true }));
    }
    return children;
}
