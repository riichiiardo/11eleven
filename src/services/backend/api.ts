/** Explicit client operation references. Implementation: react.tsx → Supabase RPCs. */
export type ApiRef = { readonly __ref: string };

export const api = {
  adminOps: {
    changePresidentClub: { __ref: "adminOps.changePresidentClub" },
    fixtureReport: { __ref: "adminOps.fixtureReport" },
    grantBudget: { __ref: "adminOps.grantBudget" },
    removePresident: { __ref: "adminOps.removePresident" },
    reportFixture: { __ref: "adminOps.reportFixture" },
    resetLeague: { __ref: "adminOps.resetLeague" },
    setCompetition: { __ref: "adminOps.setCompetition" },
    setPrizes: { __ref: "adminOps.setPrizes" },
  },
  competition: {
    closeMatchday: { __ref: "competition.closeMatchday" },
    syncCompetition: { __ref: "competition.syncCompetition" },
  },
  draft: {
    check: { __ref: "draft.check" },
    close: { __ref: "draft.close" },
    control: { __ref: "draft.control" },
    open: { __ref: "draft.open" },
    pause: { __ref: "draft.pause" },
    pick: { __ref: "draft.pick" },
    pool: { __ref: "draft.pool" },
    prepare: { __ref: "draft.prepare" },
    resume: { __ref: "draft.resume" },
    skipTurn: { __ref: "draft.skipTurn" },
  },
  footballApi: {
    syncCatalog: { __ref: "footballApi.syncCatalog" },
  },
  footballSync: {
    catalogState: { __ref: "footballSync.catalogState" },
  },
  leagues: {
    activateLeague: { __ref: "leagues.activateLeague" },
    createLeague: { __ref: "leagues.createLeague" },
    joinLeague: { __ref: "leagues.joinLeague" },
  },
  market: {
    browse: { __ref: "market.browse" },
    cancelOffer: { __ref: "market.cancelOffer" },
    createOffer: { __ref: "market.createOffer" },
    executeReserved: { __ref: "market.executeReserved" },
    guidance: { __ref: "market.guidance" },
    overview: { __ref: "market.overview" },
    respondOffer: { __ref: "market.respondOffer" },
    validateOffer: { __ref: "market.validateOffer" },
  },
  squads: {
    autoFillLineup: { __ref: "squads.autoFillLineup" },
    saveLineup: { __ref: "squads.saveLineup" },
    setAvailability: { __ref: "squads.setAvailability" },
  },
  teams: {
    squadOf: { __ref: "teams.squadOf" },
  },
  tournament: {
    adminOverview: { __ref: "tournament.adminOverview" },
    chooseCatalogTeam: { __ref: "tournament.chooseCatalogTeam" },
    ensureSetup: { __ref: "tournament.ensureSetup" },
    ensureTeamCatalog: { __ref: "tournament.ensureTeamCatalog" },
    grantAdmin: { __ref: "tournament.grantAdmin" },
    revokeAdmin: { __ref: "tournament.revokeAdmin" },
    setTournamentStatus: { __ref: "tournament.setTournamentStatus" },
    state: { __ref: "tournament.state" },
    updateAvatar: { __ref: "tournament.updateAvatar" },
    updateProfile: { __ref: "tournament.updateProfile" },
    updateRules: { __ref: "tournament.updateRules" },
  },
  users: {
    currentUser: { __ref: "users.currentUser" },
  },
} as const;
