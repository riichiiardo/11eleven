import { useState, useEffect } from "react";
import { toast } from "sonner";
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
type Match = {
  id: string;
  name: string;
  nationality: string;
  age: number;
  active: boolean;
  blocked: boolean;
  club: string | null;
  club_id: string | null;
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
  const [matches, setMatches] = useState<Match[]>([]);
  const [createInClub, setCreateInClub] = useState(Boolean(club));
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
        const target = createInClub ? club || null : null;
        const existing = await rpc<Match[]>("admin_player_matches", {
          p_name: draft.name,
          p_nation: draft.nationality,
          p_age: draft.age,
          p_link: link.trim() || null,
        });
        if (existing.length) {
          setMatches(existing);
          setNotice("Encontramos una ficha existente. Revisa la coincidencia.");
          return;
        }
        await rpc("admin_create_player", {
          p_profile: draft,
          p_sofifa_url: link.trim() || null,
          p_club: target,
        });
        setScope(target ? "club" : "pool");
        setPage(0);
        setSearch(draft.name.trim());
        const confirmation = target
          ? draft.name.trim() + " se creó y se añadió a " + name + "."
          : draft.name.trim() + " se creó como agente libre.";
        setNotice(confirmation);
        toast.success(confirmation);
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
      if (row) {
        const confirmation = add
          ? row.profile.name + " se añadió a " + name + "."
          : "Ficha guardada.";
        setNotice(confirmation);
        toast.success(confirmation);
      }

      if (add) {
        setSearch("");
        setPage(0);
        setScope("club");
      }
      onChanged();
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Error al guardar.";
      setError(detail);
      toast.error(detail);
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
          setMatches([]);
          setCreateInClub(Boolean(club));
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
          onChange={() => setMatches([])}
          onSubmit={(e) => {
            e.preventDefault();
            void submit(selected, false);
          }}
        >
          <p className="sm:col-span-2">
            {selected
              ? "Ficha compartida por el pool y los clubes · " +
                selected.profile.name
              : !createInClub
                ? "Nuevo agente libre"
                : "Nuevo jugador para " + name}
          </p>
          {!selected && club && (
            <label>
              Destino{" "}
              <select
                value={createInClub ? "club" : "pool"}
                onChange={(e) => setCreateInClub(e.target.value === "club")}
              >
                <option value="club">{name}</option>
                <option value="pool">Pool · agente libre</option>
              </select>
            </label>
          )}
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
          {!selected && matches.length > 0 && (
            <ul className="sm:col-span-2">
              {matches.map((match) => (
                <li
                  key={match.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {match.name} · {match.nationality} · {match.age} años ·{" "}
                    {match.club ?? "Libre"}
                    {!match.active ? " · Ficha inactiva" : ""}
                    {match.blocked ? " · Bloqueado" : ""}
                  </span>
                  {club &&
                    createInClub &&
                    !match.club_id &&
                    match.active &&
                    !match.blocked && (
                      <Button
                        type="button"
                        onClick={() =>
                          void submit(
                            {
                              id: match.id,
                              profile: { ...draft, name: match.name },
                              club: null,
                              blocked: false,
                            },
                            true,
                          )
                        }
                      >
                        Añadir ficha existente a {name}
                      </Button>
                    )}
                  {match.club_id === club && (
                    <span>Ya pertenece a este equipo</span>
                  )}
                </li>
              ))}
            </ul>
          )}
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
