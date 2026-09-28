import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DEFAULT_FC27_ID, FC27_COMPETITIONS, FC27_KIND_LABEL } from "@/convex/fc27Catalog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { cn } from "@/lib/utils";
/**
 * The ONLY way to pick a competition: the official EA SPORTS FC 27 catalogue.
 * Both the league creation flow and Administration use this picker so
 * 11Eleven and FC 27 always stay in parity.
 */
export function CompetitionPicker({ id, value, onChange, label = "Competición (EA SPORTS FC 27)", hint, dark = false, disabled = false, }) {
    const selected = FC27_COMPETITIONS.find((competition) => competition.id === value) ?? null;
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: id, className: cn("text-xs", dark && "text-white/80"), children: label }), _jsxs(Select, { value: value, onValueChange: onChange, disabled: disabled, children: [_jsx(SelectTrigger, { id: id, className: cn("min-h-11", dark && "border-white/15 bg-white/10 text-white data-[placeholder]:text-white/40"), children: _jsx(SelectValue, { placeholder: "Elige una competici\u00F3n" }) }), _jsx(SelectContent, { className: "max-h-80", children: FC27_COMPETITIONS.map((competition) => (_jsxs(SelectItem, { value: competition.id, className: "min-h-10", children: [competition.name, _jsxs("span", { className: "text-muted-foreground", children: [" \u00B7 ", competition.country] })] }, competition.id))) })] }), _jsxs("p", { className: cn("text-[11px]", dark ? "text-white/50" : "text-muted-foreground"), children: [hint ??
                        "Catálogo oficial de EA SPORTS FC 27: solo existen estas competiciones, así 11ELEVEN y FC 27 mantienen la paridad.", selected
                        ? ` Seleccionada: ${FC27_KIND_LABEL[selected.kind]}${selected.teams ? ` · ${selected.teams} equipos` : ""}.`
                        : ""] })] }));
}
export { DEFAULT_FC27_ID };
