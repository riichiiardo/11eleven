/**
 * 11Eleven — capa de compatibilidad: tipos `Id`.
 *
 * En la era Convex los ids eran strings opacos; en Postgres son UUID, que
 * también son strings. El tipo existe para que los imports de las páginas
 * (`Id<"players">` etc.) sigan resolviendo sin cambios.
 */

export type TableName =
  | "users"
  | "tournaments"
  | "tournamentRules"
  | "tournamentAdmins"
  | "leagueMembers"
  | "presidents"
  | "teamCatalog"
  | "clubs"
  | "players"
  | "catalogStats"
  | "squads"
  | "squadPlayers"
  | "offers"
  | "drafts"
  | "draftPicks"
  | "fixtures"
  | "prizes"
  | "budgetGrants"
  | "fixtureReports"
  | "auditLog";

export type Id<T extends TableName = TableName> = string & { __brand: T };

/** Cast utilitario cuando un adaptador sabe la tabla de origen. */
export function idOf<T extends TableName>(value: string): Id<T> {
  return value as Id<T>;
}
