import { DEFAULT_FC27_ID, FC27_COMPETITIONS, FC27_KIND_LABEL } from "@/convex/fc27Catalog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * The ONLY way to pick a competition: the official EA SPORTS FC 27 catalogue.
 * Both the league creation flow and Administration use this picker so
 * 11Eleven and FC 27 always stay in parity.
 */
export function CompetitionPicker({
  id,
  value,
  onChange,
  label = "Competición (EA SPORTS FC 27)",
  hint,
  dark = false,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (competitionId: string) => void;
  label?: string;
  hint?: string;
  /** Rail-style (dark) surfaces such as the create-league gate. */
  dark?: boolean;
  disabled?: boolean;
}) {
  const selected = FC27_COMPETITIONS.find((competition) => competition.id === value) ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn("text-xs", dark && "text-white/80")}>
        {label}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn(
            "min-h-11",
            dark && "border-white/15 bg-white/10 text-white data-[placeholder]:text-white/40",
          )}
        >
          <SelectValue placeholder="Elige una competición" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {FC27_COMPETITIONS.map((competition) => (
            <SelectItem key={competition.id} value={competition.id} className="min-h-10">
              {competition.name}
              <span className="text-muted-foreground"> · {competition.country}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className={cn("text-[11px]", dark ? "text-white/50" : "text-muted-foreground")}>
        {hint ??
          "Catálogo oficial de EA SPORTS FC 27: solo existen estas competiciones, así 11ELEVEN y FC 27 mantienen la paridad."}
        {selected
          ? ` Seleccionada: ${FC27_KIND_LABEL[selected.kind]}${selected.teams ? ` · ${selected.teams} equipos` : ""}.`
          : ""}
      </p>
    </div>
  );
}

export { DEFAULT_FC27_ID };
