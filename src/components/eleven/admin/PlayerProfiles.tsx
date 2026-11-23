import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { rpc } from "@/infrastructure/supabase/client";
type Profile = {
  name: string;
  nationality: string;
  positions: string[];
  ovr: number;
  potential: number | null;
  age: number;
  value: number;
};
type Row = {
  id: string;
  profile: Profile;
  club: string | null;
  blocked: boolean;
  sofifaUrl?: string;
};
const positions = [
  "POR",
  "LD",
  "DFC",
  "LI",
  "CAD",
  "CAI",
  "MCD",
  "MC",
  "MD",
  "MI",
  "MCO",
  "ED",
  "EI",
  "SD",
  "DC",
];
export function PlayerProfiles({
  club,
  name,
  rev,
  onChanged,
}: {
  club: string;
  name: string;
  rev: number;
  onChanged: () => void;
}) {
  const [scope, setScope] = useState(club ? "club" : "pool"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>(),
    [selected, select] = useState<Row>(),
    [draft, setDraft] = useState<Profile>();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setRows(undefined);
      setError("");
      rpc<Row[]>("admin_player_profiles", {
        p_search: search,
        p_page: page,
        p_club: scope === "club" ? club : null,
        p_free: scope === "free",
      })
        .then((result) => {
          if (active) setRows(result);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [club, scope, search, page, rev]);
  async function submit(row: Row | undefined, add: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!row && draft) {
        const target = scope === "pool" ? null : club || null;
        await rpc("admin_create_player", {
          p_profile: draft,
          p_sofifa_url: link.trim() || null,
          p_club: target,
        });
        setScope(target ? "club" : "pool");
        setPage(0);
        setSearch(draft.name.trim());
        setNotice(
          target
            ? "Jugador creado y añadido a " + name + "."
            : "Jugador creado como agente libre.",
        );
      } else if (row && add)
        await rpc("admin_roster_change", {
          p_action: "add",
          p_player: row.id,
          p_source: null,
          p_destination: club,
        });
      else if (row)
        await rpc("admin_edit_player_profile", {
          p_id: row.id,
          p_before: row.profile,
          p_profile: draft,
        });
      select(undefined);
      setDraft(undefined);
      if (row)
        setNotice(
          add
            ? row.profile.name + " se añadió a " + name + "."
            : "Ficha guardada.",
        );

      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-semibold">Fichas de jugadores</legend>
      <div className="flex flex-wrap gap-2">
        {(club
          ? [
              ["club", "Plantilla"],
              ["free", "Añadir jugadores"],
              ["pool", "Pool completo"],
            ]
          : [["pool", "Pool completo"]]
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={scope === key ? "default" : "outline"}
            aria-pressed={scope === key}
            onClick={() => {
              setScope(key);
              setPage(0);
              setSearch("");
              select(undefined);
              setDraft(undefined);
              setNotice("");
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <label>
        Buscar por nombre o ID de SoFIFA
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
            select(undefined);
            setDraft(undefined);
          }}
        />
      </label>
      <Button
        variant="outline"
        onClick={() => {
          select(undefined);
          setLink("");
          setError("");
          setNotice("");
          setDraft({
            name: search.trim(),
            nationality: "",
            positions: [],
            age: NaN,
            ovr: NaN,
            value: NaN,
            potential: null,
          });
        }}
      >
        Crear jugador
      </Button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {draft && (
        <form
          className="grid gap-3 rounded border p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(selected, false);
          }}
        >
          <p className="sm:col-span-2">
            {selected
              ? "Ficha compartida por el pool y los clubes · " +
                selected.profile.name
              : scope === "pool"
                ? "Nuevo agente libre"
                : "Nuevo jugador para " + name}
          </p>
          {!selected && (
            <label>
              Enlace de SoFIFA (opcional)
              <Input
                type="url"
                value={link}
                placeholder="https://sofifa.com/player/…"
                onChange={(e) => setLink(e.target.value)}
              />
            </label>
          )}
          {(["name", "nationality"] as const).map((k, i) => (
            <label key={k}>
              {["Nombre", "Nacionalidad"][i]}
              <Input
                required
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
          {(["age", "ovr", "potential", "value"] as const).map((k, i) => (
            <label key={k}>
              {["Edad", "Media actual", "Potencial", "Valor actual (€)"][i]}
              <Input
                required={k !== "potential"}
                type="number"
                min={k === "age" ? 1 : 0}
                max={k === "value" ? undefined : 100}
                value={Number.isFinite(draft[k]) ? (draft[k] ?? "") : ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [k]: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
          <label>
            Posición principal{" "}
            <select
              required
              value={draft.positions[0] ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  positions: [
                    e.target.value,
                    ...draft.positions.filter((p) => p !== e.target.value),
                  ],
                })
              }
            >
              <option value="" disabled>
                Selecciona una posición
              </option>
              {positions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Posiciones secundarias</legend>
            <div className="flex flex-wrap gap-2">
              {positions
                .filter((p) => p !== draft.positions[0])
                .map((p) => (
                  <label key={p}>
                    <input
                      type="checkbox"
                      checked={draft.positions.includes(p)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          positions: e.target.checked
                            ? [...draft.positions, p]
                            : draft.positions.filter((x) => x !== p),
                        })
                      }
                    />{" "}
                    {p}
                  </label>
                ))}
            </div>
          </fieldset>
          <Button type="submit">
            {selected ? "Guardar ficha" : "Crear jugador"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              select(undefined);
              setDraft(undefined);
            }}
          >
            Cancelar
          </Button>
        </form>
      )}
      {!rows && !error && <p>Cargando jugadores…</p>}
      {rows?.length === 0 && <p>Sin jugadores para esta búsqueda.</p>}
      <ul className="divide-y">
        {rows?.slice(0, 25).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="mr-auto">
              {r.profile.name} · {r.profile.positions.join(", ")} ·{" "}
              {r.profile.ovr} · {r.club ?? "Agente libre"}
            </span>
            {r.sofifaUrl && (
              <a href={r.sofifaUrl} target="_blank" rel="noreferrer">
                SoFIFA
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => {
                select(r);
                setDraft(r.profile);
                setNotice("");
              }}
            >
              Editar ficha
            </Button>
            {club && !r.club && (
              <Button disabled={r.blocked} onClick={() => submit(r, true)}>
                {r.blocked ? "Bloqueado" : "Añadir a " + name}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!page}
          onClick={() => {
            setPage(page - 1);
            select(undefined);
            setDraft(undefined);
          }}
        >
          Anterior
        </Button>
        <span>Página {page + 1}</span>
        <Button
          variant="outline"
          disabled={!rows || rows.length <= 25}
          onClick={() => {
            setPage(page + 1);
            select(undefined);
            setDraft(undefined);
          }}
        >
          Siguiente
        </Button>
      </div>
    </fieldset>
  );
}
