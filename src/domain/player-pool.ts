export type PoolImportRow = {
  sourceId: string;
  poolId?: string;
  name: string;
  nationality: string;
  position: string;
  group: string;
  positions: string[];
  age: number;
  ovr: number;
  potential: number;
  club: string;
  value: number;
  original: Record<string, string>;
};

/** Parse quoted CSV, including commas, escaped quotes, BOM and multiline cells. */
export function parsePoolCsv(text: string): PoolImportRow[] {
  const matrix: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || field === "") quoted = !quoted;
      else throw Error("CSV con comillas inválidas.");
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field);
      if (row.some((v) => v.trim())) matrix.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("CSV con comillas sin cerrar.");
  row.push(field);
  if (row.some((v) => v.trim())) matrix.push(row);
  const headers = matrix.shift()?.map((v) => v.trim()) ?? [];
  const required = [
    "ID",
    "Nombre y Apellido",
    "Nacionalidad",
    "Posiciones",
    "Edad",
    "Valoración General",
    "Potencial",
    "Equipo",
    "Valor",
  ];
  if (
    required.some((h) => !headers.includes(h)) ||
    new Set(headers).size !== headers.length
  )
    throw Error(
      "El CSV debe incluir ID, Nombre y Apellido, Nacionalidad, Posiciones, Edad, Valoración General, Potencial, Equipo y Valor.",
    );
  if (matrix.length < 1 || matrix.length > 30000)
    throw Error("El archivo debe tener entre 1 y 30.000 jugadores.");
  const ids = new Set<string>();
  const primary: Record<string, string> = {
    MD: "MC",
    MI: "MC",
    CAD: "LD",
    CAI: "LI",
    SD: "DC",
  };
  const valid = [
    "POR",
    "LD",
    "DFC",
    "LI",
    "MCD",
    "MC",
    "MCO",
    "ED",
    "EI",
    "DC",
    ...Object.keys(primary),
  ];
  return matrix.map((cells, index) => {
    if (cells.length !== headers.length)
      throw Error(`Revisa las columnas de la fila ${index + 2}.`);
    const original = Object.fromEntries(
      headers.map((h, i) => [h, cells[i].trim()]),
    );
    const sourceId = original.ID;
    if (!/^[1-9]\d{0,11}$/.test(sourceId) || ids.has(sourceId))
      throw Error(`ID inválido o repetido en fila ${index + 2}.`);
    ids.add(sourceId);
    const rating = (s: string) => {
      if (!/^\d+(?:[+-]\d+)?$/.test(s))
        throw Error(`Valoración inválida en fila ${index + 2}.`);
      return parseInt(s, 10);
    };
    const positions = original.Posiciones.split(",").map((p) => p.trim());
    const position = primary[positions[0]] ?? positions[0];
    const amount = original.Valor.replace(/[€\s]/g, "").match(
      /^(\d+(?:\.\d+)?)([KM]?)$/i,
    );
    const value = amount
      ? Math.round(
          Number(amount[1]) *
            ({ K: 1000, M: 1000000 }[amount[2].toUpperCase()] ?? 1),
        )
      : NaN;
    const age = Number(original.Edad),
      ovr = rating(original["Valoración General"]),
      potential = rating(original.Potencial);
    if (
      !original["Nombre y Apellido"] ||
      !original.Nacionalidad ||
      positions.some((p) => !valid.includes(p)) ||
      !Number.isInteger(age) ||
      age < 10 ||
      age > 70 ||
      ovr > 100 ||
      potential > 100 ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > 100000000000
    )
      throw Error(`Revisa los datos de la fila ${index + 2}.`);
    const poolId = original["ID Pool"] || undefined;
    if (
      poolId &&
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(poolId)
    )
      throw Error(`ID Pool inválido en fila ${index + 2}.`);
    return {
      sourceId,
      poolId,
      name: original["Nombre y Apellido"],
      nationality: original.Nacionalidad,
      position,
      positions,
      group:
        position === "POR"
          ? "GK"
          : ["LD", "LI", "DFC"].includes(position)
            ? "DEF"
            : ["MC", "MCO", "MCD"].includes(position)
              ? "MID"
              : "FWD",
      age,
      ovr,
      potential,
      club: original.Equipo,
      value,
      original,
    };
  });
}
