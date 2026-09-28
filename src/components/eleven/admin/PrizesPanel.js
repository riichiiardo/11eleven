import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/eleven/admin/AdminBits";
import { Loader2, Plus, Trophy, X } from "lucide-react";
const PHASES = [
    {
        value: "todos_contra_todos",
        label: "Todos contra todos (la liga)",
        hint: "Posición final de la tabla al terminar la fase regular.",
    },
    {
        value: "cuadrangulares",
        label: "Cuadrangulares / liguillas",
        hint: "Premios de la ronda de grupos o cuadrangulares que sigue al todos contra todos.",
    },
    {
        value: "fase_siguiente",
        label: "Fase siguiente (semifinales, final…)",
        hint: "Premios de las fases finales posteriores a los cuadrangulares.",
    },
];
const PHASE_LABEL = Object.fromEntries(PHASES.map((phase) => [phase.value, phase.label]));
/**
 * Prizes assigned BEFORE the league starts: money per final position, split
 * between the round-robin, the groups/knockout rounds and the next phase.
 */
export function PrizesPanel({ overview }) {
    const setPrizes = useMutation(api.adminOps.setPrizes);
    const [rows, setRows] = useState(() => overview.prizes.map((prize) => ({
        phase: prize.phase,
        position: prize.position,
        label: prize.label,
        amount: prize.amount,
    })));
    const [busy, setBusy] = useState(false);
    // Re-sync the editor when the server table changes (adjusting state when a
    // prop changes, without an extra render from an effect).
    const serverKey = JSON.stringify(overview.prizes);
    const [draftKey, setDraftKey] = useState(serverKey);
    if (draftKey !== serverKey) {
        setDraftKey(serverKey);
        setRows(overview.prizes.map((prize) => ({
            phase: prize.phase,
            position: prize.position,
            label: prize.label,
            amount: prize.amount,
        })));
    }
    const errors = [];
    const seen = new Set();
    for (const row of rows) {
        const key = `${row.phase}:${row.position}`;
        if (seen.has(key)) {
            errors.push(`Premio duplicado: ${PHASE_LABEL[row.phase]} · posición ${row.position}.`);
        }
        seen.add(key);
        if (row.label.trim().length < 2) {
            errors.push("Cada premio necesita un nombre (ej. «Campeón», «Mejor diferencia»).");
        }
        if (row.amount < 0)
            errors.push("Los importes no pueden ser negativos.");
    }
    const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
    const dirty = JSON.stringify(rows) !== JSON.stringify(overview.prizes.map((prize) => ({
        phase: prize.phase,
        position: prize.position,
        label: prize.label,
        amount: prize.amount,
    })));
    const update = (index, patch) => {
        setRows((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    };
    const addRow = (phase) => {
        const nextPosition = rows.filter((row) => row.phase === phase).reduce((max, row) => Math.max(max, row.position), 0) + 1;
        setRows((previous) => [
            ...previous,
            { phase, position: nextPosition, label: "", amount: 500000 },
        ]);
    };
    const submit = async () => {
        if (errors.length > 0)
            return;
        setBusy(true);
        try {
            const result = await setPrizes({ prizes: rows });
            toast.success("Premios guardados", {
                description: `${result.configured} premio(s) · bolsa total ${formatMoney(result.total)}. Ya se muestran en tu liga.`,
            });
        }
        catch (cause) {
            toast.error("No se pudieron guardar los premios", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(SectionCard, { title: "Premios por posici\u00F3n", icon: Trophy, accent: "gold", bodyClassName: "flex flex-col gap-4", children: [_jsxs("p", { className: "max-w-3xl text-sm text-muted-foreground", children: ["Define ", _jsx("strong", { children: "antes del inicio" }), " lo que gana cada Presidente seg\u00FAn la posici\u00F3n en la que termine: la fase de todos contra todos, y si la liga contin\u00FAa con cuadrangulares o ligullas, tambi\u00E9n los premios de esa ronda y de la fase siguiente. El motor los aplica al clasificar, y todo queda registrado en la auditor\u00EDa."] }), _jsx("div", { className: "grid gap-3", children: PHASES.map((phase) => {
                    const phaseRows = rows
                        .map((row, index) => ({ row, index }))
                        .filter((entry) => entry.row.phase === phase.value)
                        .sort((a, b) => a.row.position - b.row.position);
                    return (_jsxs("fieldset", { className: "rounded-xl border p-3", children: [_jsxs("legend", { className: "mb-1 flex items-center gap-1 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground", children: [phase.label, _jsx(Tip, { text: phase.hint, side: "right" })] }), phaseRows.length === 0 ? (_jsx("p", { className: "px-1 text-[11px] text-muted-foreground", children: "Sin premios configurados para esta fase todav\u00EDa." })) : (_jsx("ul", { className: "flex flex-col gap-2", children: phaseRows.map(({ row, index }) => (_jsxs("li", { className: "grid gap-2 sm:grid-cols-[6rem_1fr_10rem_auto] sm:items-end", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Posici\u00F3n" }), _jsx(Input, { type: "number", min: 1, max: 100, className: "h-10", value: row.position, onChange: (event) => update(index, { position: Math.max(1, Number(event.target.value) || 1) }) })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Nombre del premio" }), _jsx(Input, { className: "h-10", maxLength: 60, placeholder: "Ej. Campe\u00F3n, Subcampe\u00F3n, Mejor diferencia de goles\u2026", value: row.label, onChange: (event) => update(index, { label: event.target.value }) })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Importe (\u20AC)" }), _jsx(Input, { type: "number", min: 0, step: 100000, className: "h-10", value: row.amount, onChange: (event) => update(index, { amount: Math.max(0, Number(event.target.value) || 0) }) })] }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-10 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700", onClick: () => setRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index)), children: [_jsx(X, { className: "size-4", "aria-hidden": "true" }), "Quitar"] })] }, `${row.phase}-${row.position}-${index}`))) })), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "mt-3 min-h-9", onClick: () => addRow(phase.value), children: [_jsx(Plus, { className: "size-3.5", "aria-hidden": "true" }), "A\u00F1adir premio a esta fase"] })] }, phase.value));
                }) }), errors.length > 0 ? (_jsx("ul", { className: "list-disc space-y-1 rounded-xl border border-rose-500/35 bg-rose-500/[0.06] pl-5 text-xs text-rose-700 dark:text-rose-300", children: errors.map((error) => (_jsx("li", { children: error }, error))) })) : null, _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs(Button, { type: "button", className: "min-h-11", disabled: busy || errors.length > 0 || !dirty, onClick: () => void submit(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Trophy, { className: "size-4", "aria-hidden": "true" })), "Guardar premios"] }), _jsx(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: !dirty || busy, onClick: () => setRows(overview.prizes.map((prize) => ({
                            phase: prize.phase,
                            position: prize.position,
                            label: prize.label,
                            amount: prize.amount,
                        }))), children: "Descartar cambios" }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [rows.length, " premio(s) \u00B7 bolsa total ", formatMoney(total)] })] }), _jsxs("div", { className: "rounded-xl border bg-muted/40 p-3", children: [_jsxs("p", { className: "flex items-center gap-1 text-xs font-semibold", children: ["C\u00F3mo configurarlo", _jsx(Tip, { side: "right", text: "1) A\u00F1ade los premios de la fase regular (posici\u00F3n 1, 2, 3\u2026). 2) Si tu formato incluye cuadrangulares o liguillas, a\u00F1ade tambi\u00E9n esos premios. 3) Repite para la fase siguiente (semifinales y final). 4) Guarda: los premios quedan visibles para todos los Presidentes y no pueden editarse una vez iniciada la competici\u00F3n sin que Administraci\u00F3n lo haga." })] }), _jsx("p", { className: "mt-1 text-[11px] leading-relaxed text-muted-foreground", children: "Cada fila es posici\u00F3n + nombre + importe. Usa el mismo criterio de nombres en todas las fases para que los Presidentes entiendan de un vistazo qu\u00E9 se llevan al finalizar." })] })] }));
}
