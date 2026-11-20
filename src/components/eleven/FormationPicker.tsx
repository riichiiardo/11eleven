import { useState } from "react";
import { FORMATION_GROUPS } from "@/domain/formation-catalog";
import { FORMATIONS, type FormationCode } from "@/domain/rulesEngine";
import { FormationMiniPitch } from "./FormationMiniPitch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search, LayoutGrid } from "lucide-react";

const OPTIONS = FORMATION_GROUPS.flatMap((group) =>
  group.families.flatMap((family) =>
    family.variants.map((option) => ({
      ...option,
      defenders: group.defenders,
      family: family.name,
    })),
  ),
);
const PAGE_SIZE = 6;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[()\s·]/g, "");
export function FormationPicker({
  formation,
  onChange,
  disabled = false,
  onRestore,
  canRestore = false,
}: {
  formation: FormationCode;
  onChange: (code: FormationCode) => void;
  disabled?: boolean;
  onRestore?: () => void;
  canRestore?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [defenders, setDefenders] = useState("all"),
    [family, setFamily] = useState("all"),
    [page, setPage] = useState(0),
    [pending, setPending] = useState<FormationCode>(formation);
  const families = [
    ...new Set(
      OPTIONS.filter(
        (o) => defenders === "all" || String(o.defenders) === defenders,
      ).map((o) => o.family),
    ),
  ];
  const filtered = OPTIONS.filter(
    (o) =>
      (defenders === "all" || String(o.defenders) === defenders) &&
      (family === "all" || o.family === family) &&
      normalize(`${o.label} ${o.variant} ${o.code}`).includes(normalize(query)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = FORMATIONS[formation];
  const start = () => {
    setQuery("");
    setDefenders(String(formation[0]));
    setFamily("all");
    setPage(0);
    setPending(formation);
    setOpen(true);
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <FormationMiniPitch formation={formation} className="h-28 shrink-0" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold">
            {current.label} · {current.shape}
          </p>
          <p className="max-w-lg text-sm text-muted-foreground">
            Elige el dibujo de tu equipo. Las posiciones de la vista previa se
            aplican a la pizarra.
          </p>
          <Button type="button" disabled={disabled} onClick={start}>
            <LayoutGrid className="size-4" aria-hidden="true" />
            Cambiar formación
          </Button>
          {onRestore && (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || !canRestore}
              onClick={onRestore}
            >
              Restaurar formación guardada
            </Button>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92dvh] flex-col gap-3 overflow-hidden p-4 sm:max-w-4xl sm:p-5">
          <DialogHeader className="pr-6">
            <DialogTitle>Elige tu formación</DialogTitle>
            <DialogDescription>
              Filtra y compara los dibujos. Aplicar recoloca el once; Guardar
              confirma la alineación.
            </DialogDescription>
          </DialogHeader>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Línea defensiva"
          >
            {["all", "4", "3", "5"].map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={defenders === value ? "default" : "outline"}
                aria-pressed={defenders === value}
                onClick={() => {
                  setDefenders(value);
                  setFamily("all");
                  setPage(0);
                }}
              >
                {value === "all" ? "Todas" : `${value} defensas`}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Buscar formación"
                placeholder="Buscar: 4-3-3, rombo, contención…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDefenders("all");
                  setFamily("all");
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <select
              aria-label="Familia de formación"
              value={family}
              onChange={(e) => {
                setFamily(e.target.value);
                setPage(0);
              }}
              className="min-h-10 rounded-md border bg-background px-3 pr-10 text-sm"
            >
              <option value="all">Todos los esquemas</option>
              {families.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            aria-label="Resultados de formaciones"
          >
            <p role="status" className="mb-2 text-xs text-muted-foreground">
              {filtered.length} formaciones · Página {Math.min(page + 1, pages)}{" "}
              de {pages}
            </p>
            <div
              role="radiogroup"
              aria-label="Formaciones disponibles"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {filtered
                .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                .map((option) => (
                  <label
                    key={option.code}
                    className={cn(
                      "relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
                      pending === option.code
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    <input
                      type="radio"
                      name="formation-preview"
                      value={option.code}
                      aria-label={`${option.label} · ${option.variant}`}
                      checked={pending === option.code}
                      onChange={() => setPending(option.code)}
                      className="absolute left-3 top-3 accent-primary"
                    />
                    <FormationMiniPitch
                      formation={option.code}
                      className="h-20 sm:h-28"
                    />
                    <span className="text-sm font-bold">{option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {option.variant}
                    </span>
                  </label>
                ))}
            </div>
            {!filtered.length && (
              <p className="rounded-lg border p-4 text-sm">
                No hay coincidencias. Prueba otro esquema o nombre.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Página siguiente"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <p className="order-first w-full text-xs text-muted-foreground sm:order-none sm:w-auto">
              Seleccionada: {FORMATIONS[pending].label} ·{" "}
              {FORMATIONS[pending].shape}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={disabled || pending === formation}
                onClick={() => {
                  onChange(pending);
                  setOpen(false);
                }}
              >
                Aplicar formación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
