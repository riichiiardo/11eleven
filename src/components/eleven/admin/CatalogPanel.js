import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { errorMessage, relativeTime } from "@/lib/errors";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { AlertTriangle, Database, Loader2, RefreshCw, Trophy, Users, Zap, } from "lucide-react";
const SOURCE_META = {
    ea: {
        label: "EA SPORTS FC 27 · ratings oficiales (19.789)",
        hint: "Fuente recomendada: los ratings oficiales de EA, 100 jugadores por página y sin proxy. Se importa en lotes para no agotar el tiempo de una sola operación.",
    },
    sofifa: {
        label: "SoFIFA · API pública (requiere proxy)",
        hint: "SoFIFA responde 403 (Cloudflare) a las IPs de datacenter. Solo funciona si defines SOFIFA_PROXY_URL (http://usuario:clave@host:puerto) en Convex → Settings → Environment Variables.",
    },
    snapshot: {
        label: "Snapshot local versionado (respaldo)",
        hint: "Importa los agentes libres incluidos con la app. Es el respaldo automático cuando ninguna fuente externa responde.",
    },
};
/**
 * Catálogo de jugadores: fuentes, estado de la sincronización y progreso.
 * Administración define la base de datos con la que juega el torneo; las
 * plantillas y la propiedad de jugadores nunca se tocan aquí.
 */
export function CatalogPanel() {
    const catalog = useQuery(api.footballSync.catalogState);
    const syncAction = useAction(api.footballApi.syncCatalog);
    const [source, setSource] = useState("ea");
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(null);
    const handleSync = async () => {
        setBusy(true);
        setProgress(null);
        try {
            if (source === "snapshot") {
                const result = await syncAction({ source });
                toast.success("Snapshot local aplicado", {
                    description: `${result.inserted} agentes libres incorporados · ${result.unchanged} ya estaban en el catálogo`,
                });
                return;
            }
            // EA pages are 1-based; SoFIFA cursors count full pages from 0.
            let page = source === "sofifa" ? 0 : 1;
            let totalPages = 0;
            let fetched = 0;
            let inserted = 0;
            let updated = 0;
            let unchanged = 0;
            let done = false;
            let guard = 0;
            let note = null;
            while (!done && guard < 80) {
                guard += 1;
                const result = await syncAction({ source, page });
                page = result.page;
                totalPages = result.totalPages || totalPages;
                fetched += result.fetched;
                inserted += result.inserted;
                updated += result.updated;
                unchanged += result.unchanged;
                done = result.done;
                if (result.note)
                    note = result.note;
                setProgress({ page, totalPages, fetched, inserted, updated });
                if (result.fallback) {
                    toast.warning(source === "sofifa" ? "SoFIFA no accesible" : "Fuente no accesible", {
                        description: result.note ?? undefined,
                    });
                    return;
                }
                if (result.fetched === 0)
                    break;
            }
            const summary = `${fetched} jugadores descargados · ${inserted} nuevos · ${updated} actualizados · ${unchanged} sin cambios`;
            if (note) {
                toast.warning("Sincronización parcial", {
                    description: `${summary} · ${note}`,
                });
            }
            else {
                toast.success("Catálogo sincronizado", { description: summary });
            }
        }
        catch (cause) {
            toast.error("No se pudo sincronizar el catálogo", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
            setProgress(null);
        }
    };
    return (_jsxs(SectionCard, { title: "Cat\u00E1logo de jugadores", icon: Database, accent: "gold", bodyClassName: "flex flex-col gap-5", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "El cat\u00E1logo es la base de jugadores de la que beben el draft y el mercado. Sincroniza los ratings oficiales de EA SPORTS FC 27 (m\u00E1s de 19.000 jugadores) o, si prefieres, la API de SoFIFA con proxy. La importaci\u00F3n avanza por lotes y nunca toca las plantillas ni la propiedad de los jugadores: solo se actualiza la tabla de jugadores." }), _jsx("div", { className: "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end", children: _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "catalog-source", children: "Fuente de datos" }), _jsxs(Select, { value: source, onValueChange: (value) => setSource(value), disabled: busy, children: [_jsx(SelectTrigger, { id: "catalog-source", className: "min-h-11 w-full", children: _jsx(SelectValue, { placeholder: "Selecciona una fuente" }) }), _jsx(SelectContent, { children: Object.keys(SOURCE_META).map((key) => (_jsx(SelectItem, { value: key, children: SOURCE_META[key].label }, key))) })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: SOURCE_META[source].hint })] }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-4", children: [_jsx(StatTile, { icon: Database, label: "Jugadores en cat\u00E1logo", value: catalog === undefined ? "…" : String(catalog?.total ?? 0) }), _jsx(StatTile, { icon: Zap, label: "Agentes libres", value: catalog === undefined ? "…" : String(catalog?.freeAgents ?? 0), tone: "pitch" }), _jsx(StatTile, { icon: Users, label: "En plantillas", value: catalog === undefined ? "…" : String(catalog?.owned ?? 0), tone: "slate" }), _jsx(StatTile, { icon: Trophy, label: "Versi\u00F3n", value: catalog?.version ?? "—", tone: "gold" })] }), catalog?.lastSync && (_jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm", children: [_jsx(RefreshCw, { className: "size-4 text-muted-foreground", "aria-hidden": "true" }), _jsx("span", { className: "text-muted-foreground", children: "\u00DAltima sincronizaci\u00F3n:" }), _jsx("span", { className: "font-medium", children: relativeTime(catalog.lastSync.at) }), _jsx(Badge, { variant: "outline", children: catalog.lastSync.source }), _jsxs("span", { className: "text-muted-foreground", children: [catalog.lastSync.inserted, " nuevos \u00B7 ", catalog.lastSync.updated, " actualizados \u00B7", " ", catalog.lastSync.unchanged, " sin cambios"] })] })), catalog?.lastError && (_jsxs("div", { className: "flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm", children: [_jsx(AlertTriangle, { className: "mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400", "aria-hidden": "true" }), _jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "font-medium", children: "\u00DAltimo intento de sincronizaci\u00F3n fall\u00F3" }), _jsxs("span", { className: "text-muted-foreground", children: [catalog.lastError.message, " \u00B7 ", relativeTime(catalog.lastError.at)] })] })] })), _jsxs("div", { className: "flex flex-col gap-3", children: [busy && progress ? (_jsxs("div", { className: "rounded-lg border bg-muted/40 p-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 text-xs", children: [_jsxs("span", { className: "font-semibold", children: ["Descargando p\u00E1gina ", progress.page, progress.totalPages > 0 ? ` de ${progress.totalPages}` : "…"] }), _jsxs("span", { className: "text-muted-foreground", children: [progress.fetched, " descargados \u00B7 ", progress.inserted, " nuevos \u00B7 ", progress.updated, " ", "actualizados"] })] }), _jsx(Progress, { className: "mt-2 h-2", value: progress.totalPages > 0
                                    ? Math.min(100, Math.round(((progress.page - 1) / progress.totalPages) * 100))
                                    : 10 })] })) : null, _jsxs("div", { children: [_jsxs(Button, { onClick: handleSync, disabled: busy, className: "min-h-11", children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(RefreshCw, { className: "size-4", "aria-hidden": "true" })), busy
                                        ? "Sincronizando…"
                                        : source === "snapshot"
                                            ? "Aplicar snapshot local"
                                            : "Sincronizar catálogo completo"] }), _jsx("p", { className: "mt-2 text-xs text-muted-foreground", children: "La descarga completa puede tardar unos minutos: se ejecuta por lotes y cada lote queda registrado en la auditor\u00EDa con tu nombre." })] })] })] }));
}
