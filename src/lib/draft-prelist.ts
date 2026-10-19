import { z } from "zod";

export const DRAFT_POSITIONS = [
  "POR",
  "LD",
  "DFC",
  "LI",
  "MCD",
  "MC",
  "MCO",
  "MD",
  "MI",
  "ED",
  "EI",
  "DC",
] as const;
const money = z
  .number()
  .finite()
  .positive()
  .max(2000000000)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001,
    "Usa como máximo dos decimales.",
  );
export function validSofifaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "sofifa.com" &&
      !url.username &&
      !url.password &&
      /^\/player\/[1-9][0-9]*(?:\/[^\s]*)?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
const url = z
  .string()
  .trim()
  .max(500)
  .refine(
    validSofifaUrl,
    "Introduce un enlace HTTPS a una ficha de jugador de sofifa.com.",
  );
export const prelistEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("owned"),
    playerId: z.string().uuid(),
    clubId: z.string().uuid(),
    price: money,
    sofifaUrl: url,
  }),
  z.object({
    kind: z.literal("new"),
    name: z
      .string()
      .trim()
      .min(2)
      .max(150)
      .refine((v) => v.split(/\s+/).length >= 2, "Indica nombre y apellido."),
    price: money,
    ovr: z.number().int().min(1).max(99),
    positions: z
      .array(z.enum(DRAFT_POSITIONS))
      .min(1)
      .max(12)
      .refine((v) => new Set(v).size === v.length, "Hay posiciones repetidas."),
    nationality: z.string().trim().min(2).max(80),
    sofifaUrl: url,
  }),
]);
export type PrelistEntry = z.infer<typeof prelistEntrySchema>;
export type PrelistPlayer = {
  id: string;
  clubId: string;
  name: string;
  nationality: string;
  position: string;
  ovr: number;
};
export type PrelistData = {
  status: "draft" | "submitted" | "reviewed";
  canReview: boolean;
  revision: number;
  limit: number;
  clubs: { id: string; name: string }[];
  players: PrelistPlayer[];
  ownPlayers: PrelistPlayer[];
  entries: ReviewedEntry[];
  outgoing: string[];
};
export type ReviewedEntry = PrelistEntry & {
  id: string;
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewNote?: string;
};
export function validatePrelist(
  entries: PrelistEntry[],
  outgoing: string[],
  limit: number,
) {
  if (entries.length > limit || outgoing.length > limit)
    throw new Error(`El máximo es ${limit} altas y ${limit} bajas.`);
  entries.forEach((entry) => prelistEntrySchema.parse(entry));
  const keys = entries.map((entry) =>
    entry.kind === "owned"
      ? entry.playerId
      : entry.name.trim().toLocaleLowerCase(),
  );
  if (
    new Set(keys).size !== keys.length ||
    new Set(outgoing).size !== outgoing.length
  )
    throw new Error("No puedes repetir jugadores en la prelista.");
}
