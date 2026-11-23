import { useEffect, useState } from "react";
import { PlayerProfiles } from "./PlayerProfiles";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { rpc } from "@/infrastructure/supabase/client";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; name: string };
type Member = Item & { value: number; rating: number };
type State = {
  clubs: Item[];
  players: Member[];
  free: (Item & { nationality: string; ovr: number })[];
};
export function ClubRosters() {
  const [club, setClub] = useState(""),
    [state, setState] = useState<State>(),
    [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [editing, edit] = useState<Member>(),
    [destination, setDestination] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      rpc<State>("admin_roster_state", { p_club: club || null, p_search: "" })
        .then((result) => {
          if (active) {
            setState(result);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [club, revision]);
  async function save(
    action: "add" | "move" | "edit" | "release",
    player: Item,
  ) {
    const dest =
      action === "release" ? null : action === "move" ? destination : club;
    if (
      action === "move" &&
      !window.confirm(
        "¿Mover a " +
          player.name +
          " a " +
          state?.clubs.find((c) => c.id === dest)?.name +
          "?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "release")
        await rpc("admin_release_roster_player", {
          p_player: player.id,
          p_club: club,
        });
      else
        await rpc("admin_roster_change", {
          p_action: action,
          p_player: player.id,
          p_source: action === "add" ? null : club,
          p_destination: dest,
          p_value: action === "edit" ? editing?.value : null,
          p_rating: action === "edit" ? editing?.rating : null,
        });
      edit(undefined);
      setDestination("");
      setState((old) => old && { ...old, players: [], free: [] });
      refresh((n) => n + 1);
      const confirmation =
        action === "release"
          ? player.name +
            " salió de " +
            state?.clubs.find((c) => c.id === club)?.name +
            " y quedó libre."
          : "Cambio guardado para " + player.name + ".";
      setMessage(confirmation);
      toast.success(confirmation);
      setConfirmRelease(false);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Error al guardar.";
      setError(detail);
      toast.error(detail);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SectionCard title="Plantillas de clubes" icon={Users}>
      <fieldset disabled={busy} className="space-y-4">
        <label>
          Club{" "}
          <select
            className="rounded border p-2"
            value={club}
            onChange={(e) => {
              setClub(e.target.value);
              edit(undefined);
              setDestination("");
              setMessage("");
              setState((old) => old && { ...old, players: [], free: [] });
            }}
          >
            <option value="">Selecciona un club</option>
            {state?.clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <PlayerProfiles
          key={club}
          rev={revision}
          club={club}
          name={state?.clubs.find((c) => c.id === club)?.name ?? ""}
          onChanged={() => refresh((n) => n + 1)}
        />
        {club && (
          <>
            <h3 className="font-semibold">Incorporaciones y cambios de club</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Media al ingresar</th>
                    <th>Valor al ingresar</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {state?.players.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td>{p.name}</td>
                      <td>{p.rating}</td>
                      <td>{p.value.toLocaleString("es-ES")} €</td>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => {
                            edit(p);
                            setConfirmRelease(false);
                            setDestination("");
                          }}
                        >
                          Gestionar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editing && (
              <section className="space-y-3 rounded border p-3">
                <h4 className="font-semibold">{editing.name}</h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save("edit", editing);
                  }}
                  className="flex flex-wrap items-end gap-2"
                >
                  <label>
                    Media al ingresar
                    <Input
                      required
                      type="number"
                      min="0"
                      max="99"
                      value={editing.rating}
                      onChange={(e) =>
                        edit({ ...editing, rating: e.target.valueAsNumber })
                      }
                    />
                  </label>
                  <label>
                    Valor al ingresar (€)
                    <Input
                      required
                      type="number"
                      min="0"
                      value={editing.value}
                      onChange={(e) =>
                        edit({ ...editing, value: e.target.valueAsNumber })
                      }
                    />
                  </label>
                  <Button type="submit">Guardar edición</Button>
                </form>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Club de destino"
                    className="rounded border p-2"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    <option value="">Club de destino</option>
                    {state?.clubs
                      .filter((c) => c.id !== club)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <Button
                    disabled={!destination}
                    onClick={() => save("move", editing)}
                  >
                    Cambiar de club
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmRelease(true)}
                  >
                    Dejar libre
                  </Button>
                  <Button variant="outline" onClick={() => edit(undefined)}>
                    Cerrar
                  </Button>
                </div>
                {confirmRelease && (
                  <div className="space-y-2 rounded border p-3">
                    <p>
                      ¿Dejar libre a {editing.name}? Se retirará su baja
                      prevista y se invalidarán sus ofertas abiertas. Los
                      acuerdos aceptados o reservados deben resolverse en
                      Negociaciones.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => void save("release", editing)}
                    >
                      Confirmar baja
                    </Button>{" "}
                    <Button
                      variant="outline"
                      onClick={() => setConfirmRelease(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </fieldset>
    </SectionCard>
  );
}
