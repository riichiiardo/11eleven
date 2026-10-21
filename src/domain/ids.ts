/**
 * Identificadores de entidades del dominio. El backend utiliza UUID y esta
 * marca distingue entidades durante la compilación; no valida formato en runtime.
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
