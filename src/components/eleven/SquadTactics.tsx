import { useEffect, useState } from "react";
import { rpc } from "@/infrastructure/supabase/client";
import { SectionCard } from "./SectionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Shirt } from "lucide-react";
import { errorMessage } from "@/lib/errors";

type Tactics = { code: string; instructions: string };
export function SquadTactics({ clubId }: { clubId: string }) {
  const [saved, setSaved] = useState<Tactics | null>(null);
  const [draft, setDraft] = useState<Tactics>({ code: "", instructions: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    rpc<Tactics>("squad_tactics", { p_club: clubId })
      .then((value) => {
        if (current) {
          setSaved(value);
          setDraft(value);
        }
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [clubId, retry]);
  const dirty =
    saved !== null &&
    (draft.code.trim() !== saved.code ||
      draft.instructions !== saved.instructions);
  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await rpc<Tactics>("save_squad_tactics", {
        p_club: clubId,
        p_code: draft.code.trim(),
        p_instructions: draft.instructions,
      });
      setSaved(value);
      setDraft(value);
      setNotice("Código e instrucciones guardados para tu equipo.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard
      title="Código e instrucciones de FC 27"
      icon={Shirt}
      accent="pitch"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="fc-tactics-code"
            className="mb-1.5 block text-sm font-semibold"
          >
            Código de táctica FC 27
          </label>
          <div className="flex max-w-md items-center gap-2">
            <Input
              id="fc-tactics-code"
              value={draft.code}
              maxLength={64}
              disabled={loading || busy || !saved}
              onChange={(event) => {
                setDraft({ ...draft, code: event.target.value });
                setNotice("");
              }}
              placeholder="Pega el código del juego"
              aria-describedby="fc-tactics-help"
              className="min-w-0 flex-1 font-mono"
            />
            <Button
              type="button"
              disabled={!dirty || busy || loading}
              onClick={save}
              className="shrink-0"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
          <p
            id="fc-tactics-help"
            className="mt-1.5 text-xs text-muted-foreground"
          >
            Pega aquí el código que usarás para importar la táctica en FC 27. Se
            guarda para tu equipo y es independiente de la formación del
            tablero.
          </p>
        </div>
        <div>
          <label
            htmlFor="fc-tactics-instructions"
            className="mb-1.5 block text-sm font-semibold"
          >
            Instrucciones adicionales
          </label>
          <textarea
            id="fc-tactics-instructions"
            value={draft.instructions}
            maxLength={4000}
            disabled={loading || busy || !saved}
            onChange={(event) => {
              setDraft({ ...draft, instructions: event.target.value });
              setNotice("");
            }}
            rows={4}
            placeholder="Cambios, minutos y ajustes para tu equipo…"
            className="min-h-20 w-full max-w-xl resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-50"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Las instrucciones se guardan junto con el código mediante el botón
            Guardar.
          </p>
        </div>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando táctica guardada…
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="text-sm text-destructive">
            {error}
            {!saved && !loading ? (
              <Button
                type="button"
                variant="outline"
                className="ml-2"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setRetry(retry + 1);
                }}
              >
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-emerald-700">
            {notice}
          </p>
        ) : dirty ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cambios sin guardar.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
