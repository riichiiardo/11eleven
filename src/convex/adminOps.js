/**
 * 11Eleven — Administration operations over the league itself.
 *
 * Everything here mutates the competitive state of a tournament (presidencies,
 * club assignments, budgets, prizes, detailed match results and the full
 * league reset). Every action is permission-checked, validated and written to
 * the audit log with the actor's name.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { prizePhaseValidator } from "./schema";
import { fc27Competition, fc27Matchdays, isValidFc27Id } from "./fc27Catalog";
import { WEEK_MS, getTournament, logAudit } from "./context";
import { requireAdmin } from "./tournament";
import { averageOvr, loadSquadByClub, startersOf } from "./competition";
import { fantasyPointsForSide } from "./competitionEngine";
import { formatMoney } from "./rulesEngine";
function requireAuth(userId) {
    if (!userId) {
        throw new ConvexError("Necesitas iniciar sesión para administrar la liga.");
    }
    return userId;
}
function shortNameFor(name) {
    const initials = name
        .replace(/[().]/g, "")
        .split(/\s+/)
        .slice(0, 3)
        .map((word) => word[0])
        .join("")
        .toUpperCase();
    return initials || name.slice(0, 3).toUpperCase();
}
const entryValidator = v.object({
    clubId: v.id("clubs"),
    playerId: v.id("players"),
});
/* ------------------------------------------------------------------ *
 * Presidents: change club / remove from the league
 * ------------------------------------------------------------------ */
/**
 * Moves a president to another available team of the pool. Two safe paths:
 *  - the target is a league club that exists but has no president → the
 *    presidency moves there and the old club becomes free (no row is
 *    destroyed, so the calendar and the standings keep their integrity);
 *  - the target is a catalogue team not instantiated yet → the president's
 *    club row is re-branded to that team in place.
 */
export const changePresidentClub = mutation({
    args: {
        presidentId: v.id("presidents"),
        catalogTeamId: v.optional(v.id("teamCatalog")),
        leagueClubId: v.optional(v.id("clubs")),
    },
    handler: async (ctx, { presidentId, catalogTeamId, leagueClubId }) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            throw new ConvexError("El torneo no está disponible.");
        await requireAdmin(ctx, tournament._id, userId, "presidentes");
        if (!catalogTeamId && !leagueClubId) {
            throw new ConvexError("Selecciona el equipo disponible al que mover la presidencia.");
        }
        const president = await ctx.db.get(presidentId);
        if (!president || president.tournamentId !== tournament._id) {
            throw new ConvexError("Ese Presidente no pertenece a esta liga.");
        }
        const currentClub = await ctx.db.get(president.clubId);
        const actor = await ctx.db.get(userId);
        const actorName = actor?.name ?? "Administración";
        if (leagueClubId) {
            const target = await ctx.db.get(leagueClubId);
            if (!target || target.tournamentId !== tournament._id) {
                throw new ConvexError("El club destino no pertenece a esta liga.");
            }
            if (target._id === president.clubId) {
                throw new ConvexError(`${target.name} ya es el club de ese Presidente.`);
            }
            const targetOwner = await ctx.db
                .query("presidents")
                .withIndex("by_club", (q) => q.eq("clubId", target._id))
                .first();
            if (targetOwner) {
                throw new ConvexError(`${target.name} ya tiene Presidente en esta liga. Elige otro equipo disponible.`);
            }
            await ctx.db.patch(presidentId, { clubId: target._id });
            // The squad (and its players) follows the presidency to the new club.
            const squad = await ctx.db
                .query("squads")
                .withIndex("by_president", (q) => q.eq("presidentId", presidentId))
                .first();
            if (squad) {
                await ctx.db.patch(squad._id, { clubId: target._id });
                const squadPlayers = await ctx.db
                    .query("squadPlayers")
                    .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
                    .collect();
                for (const row of squadPlayers) {
                    await ctx.db.patch(row._id, { clubId: target._id });
                }
            }
            await logAudit(ctx, {
                tournamentId: tournament._id,
                clubId: target._id,
                actorUserId: userId,
                actorName,
                action: "Club de Presidente cambiado",
                entity: "president",
                entityId: presidentId,
                detail: `${president.displayName} deja ${currentClub?.name ?? "su club"} por ${target.name} (${target.league}). El club anterior queda libre en la liga.`,
            });
            return { clubId: target._id, clubName: target.name };
        }
        const team = await ctx.db.get(catalogTeamId);
        if (!team) {
            throw new ConvexError("Ese equipo ya no está en el catálogo.");
        }
        const instantiated = await ctx.db
            .query("clubs")
            .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
            .collect();
        const alreadyUsed = instantiated.find((club) => club.catalogTeamId === team._id && club._id !== president.clubId);
        if (alreadyUsed) {
            throw new ConvexError(`${team.name} ya existe como club en esta liga. Elige otro equipo disponible.`);
        }
        if (!currentClub) {
            throw new ConvexError("Esa presidencia no tiene club asociado.");
        }
        await ctx.db.patch(currentClub._id, {
            name: team.name,
            shortName: shortNameFor(team.name),
            league: team.league,
            country: team.country,
            colorPrimary: team.colorPrimary,
            colorSecondary: team.colorSecondary,
            catalogTeamId: team._id,
        });
        await logAudit(ctx, {
            tournamentId: tournament._id,
            clubId: currentClub._id,
            actorUserId: userId,
            actorName,
            action: "Club de Presidente cambiado",
            entity: "club",
            entityId: currentClub._id,
            detail: `${president.displayName} ahora preside ${team.name} (${team.league}) en lugar de ${currentClub.name}.`,
        });
        return { clubId: currentClub._id, clubName: team.name };
    },
});
/** Removes a president from the league: presidency, squad and membership. */
export const removePresident = mutation({
    args: { presidentId: v.id("presidents") },
    handler: async (ctx, { presidentId }) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            throw new ConvexError("El torneo no está disponible.");
        await requireAdmin(ctx, tournament._id, userId, "presidentes");
        const president = await ctx.db.get(presidentId);
        if (!president || president.tournamentId !== tournament._id) {
            throw new ConvexError("Ese Presidente no pertenece a esta liga.");
        }
        if (tournament.ownerUserId === president.userId) {
            throw new ConvexError("No puedes eliminar al Administrador principal (creador de la liga). Retira primero sus permisos administrativos desde la lista de Administradores.");
        }
        const actor = await ctx.db.get(userId);
        const actorName = actor?.name ?? "Administración";
        // Squad + players of this presidency.
        const squad = await ctx.db
            .query("squads")
            .withIndex("by_president", (q) => q.eq("presidentId", presidentId))
            .first();
        if (squad) {
            const squadPlayers = await ctx.db
                .query("squadPlayers")
                .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
                .collect();
            for (const row of squadPlayers)
                await ctx.db.delete(row._id);
            await ctx.db.delete(squad._id);
        }
        // Extra budget grants follow the presidency.
        const grants = await ctx.db
            .query("budgetGrants")
            .withIndex("by_president", (q) => q.eq("presidentId", presidentId))
            .collect();
        for (const grant of grants)
            await ctx.db.delete(grant._id);
        // The club returns to the pool when no calendar references it; otherwise
        // it stays as a free club so the table and the fixtures keep their shape.
        const clubId = president.clubId;
        const referenced = (await ctx.db
            .query("fixtures")
            .withIndex("by_home_club", (q) => q.eq("homeClubId", clubId))
            .first()) ||
            (await ctx.db
                .query("fixtures")
                .withIndex("by_away_club", (q) => q.eq("awayClubId", clubId))
                .first());
        const club = await ctx.db.get(clubId);
        if (!referenced && club)
            await ctx.db.delete(clubId);
        // Membership: leaves the league unless it still administrates it.
        const admin = await ctx.db
            .query("tournamentAdmins")
            .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
            .collect();
        const stillAdmin = admin.some((row) => row.userId === president.userId);
        if (!stillAdmin) {
            const memberships = await ctx.db
                .query("leagueMembers")
                .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
                .collect();
            const membership = memberships.find((row) => row.userId === president.userId);
            if (membership)
                await ctx.db.delete(membership._id);
        }
        await ctx.db.delete(presidentId);
        await logAudit(ctx, {
            tournamentId: tournament._id,
            clubId: referenced ? clubId : undefined,
            actorUserId: userId,
            actorName,
            action: "Presidente eliminado de la liga",
            entity: "president",
            entityId: presidentId,
            detail: `${president.displayName} (${president.nickname}) deja de presidir ${club?.name ?? "su club"}${referenced ? " · el club queda libre en el calendario" : " · el equipo vuelve al pool"}${stillAdmin ? " · conserva sus permisos de Administración" : ""}.`,
        });
        return { removed: true, clubFreed: Boolean(club && !referenced) };
    },
});
/* ------------------------------------------------------------------ *
 * League reset
 * ------------------------------------------------------------------ */
/**
 * Wipes the competitive state back to zero: club selections, budgets,
 * squads, offers, draft, calendar and detailed results. Rules, prizes,
 * memberships, administrators and the audit trail are preserved.
 */
export const resetLeague = mutation({
    args: { confirmation: v.string() },
    handler: async (ctx, { confirmation }) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            throw new ConvexError("El torneo no está disponible.");
        await requireAdmin(ctx, tournament._id, userId, "configuracion");
        if (confirmation.trim().toUpperCase() !== "REINICIAR") {
            throw new ConvexError('Escribe exactamente "REINICIAR" para confirmar el reinicio de la liga.');
        }
        const counts = {
            presidents: 0,
            clubs: 0,
            squads: 0,
            squadPlayers: 0,
            offers: 0,
            draftPicks: 0,
            drafts: 0,
            fixtures: 0,
            reports: 0,
            grants: 0,
        };
        const wipe = async (table, key) => {
            const rows = await ctx.db
                .query(table)
                .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
                .collect();
            for (const row of rows)
                await ctx.db.delete(row._id);
            counts[key] = rows.length;
        };
        await wipe("squadPlayers", "squadPlayers");
        await wipe("squads", "squads");
        await wipe("offers", "offers");
        await wipe("draftPicks", "draftPicks");
        await wipe("drafts", "drafts");
        await wipe("fixtureReports", "reports");
        await wipe("fixtures", "fixtures");
        await wipe("budgetGrants", "grants");
        await wipe("presidents", "presidents");
        await wipe("clubs", "clubs");
        const competition = fc27Competition(tournament.competitionId);
        const now = Date.now();
        await ctx.db.patch(tournament._id, {
            status: "seleccion_clubes",
            currentMatchday: 1,
            marketOpen: false,
            nextMatchdayAt: now + WEEK_MS,
            ...(competition
                ? { totalMatchdays: fc27Matchdays(competition) }
                : {}),
        });
        const actor = await ctx.db.get(userId);
        await logAudit(ctx, {
            tournamentId: tournament._id,
            actorUserId: userId,
            actorName: actor?.name ?? "Administración",
            action: "Liga reiniciada desde cero",
            entity: "tournament",
            entityId: tournament._id,
            detail: `Se borraron ${counts.presidents} presidencias, ${counts.clubs} clubes, ${counts.squads} plantillas con ${counts.squadPlayers} jugadores, ${counts.offers} operaciones, ${counts.drafts} draft(s) con ${counts.draftPicks} adquisiciones, ${counts.fixtures} partidos y ${counts.grants} presupuestos extra. Se conservan reglas, premios, miembros, administradores y auditoría. Fase: selección de clubes.`,
        });
        return { reset: true, counts };
    },
});
/* ------------------------------------------------------------------ *
 * Extra budget for official extra events
 * ------------------------------------------------------------------ */
export const grantBudget = mutation({
    args: {
        presidentId: v.id("presidents"),
        amount: v.number(),
        concept: v.string(),
    },
    handler: async (ctx, { presidentId, amount, concept }) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            throw new ConvexError("El torneo no está disponible.");
        await requireAdmin(ctx, tournament._id, userId, "configuracion");
        const cleanConcept = concept.trim();
        if (cleanConcept.length < 3 || cleanConcept.length > 140) {
            throw new ConvexError("Describe el evento oficial que motiva el presupuesto extra (entre 3 y 140 caracteres).");
        }
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
            throw new ConvexError("El presupuesto extra debe ser un importe positivo.");
        }
        const president = await ctx.db.get(presidentId);
        if (!president || president.tournamentId !== tournament._id) {
            throw new ConvexError("Ese Presidente no pertenece a esta liga.");
        }
        const rounded = Math.round(amount);
        await ctx.db.patch(presidentId, { budget: president.budget + rounded });
        await ctx.db.insert("budgetGrants", {
            tournamentId: tournament._id,
            presidentId,
            concept: cleanConcept,
            amount: rounded,
            grantedBy: userId,
            createdAt: Date.now(),
        });
        const club = await ctx.db.get(president.clubId);
        const actor = await ctx.db.get(userId);
        await logAudit(ctx, {
            tournamentId: tournament._id,
            clubId: president.clubId,
            actorUserId: userId,
            actorName: actor?.name ?? "Administración",
            action: "Presupuesto extra asignado",
            entity: "president",
            entityId: presidentId,
            detail: `+${formatMoney(rounded)} para ${president.displayName} (${club?.name ?? "su club"}) · ${cleanConcept} · nuevo presupuesto ${formatMoney(president.budget + rounded)}`,
        });
        return { budget: president.budget + rounded, granted: rounded };
    },
});
/* ------------------------------------------------------------------ *
 * Prizes by final position (assigned before the league starts)
 * ------------------------------------------------------------------ */
export const setPrizes = mutation({
    args: {
        prizes: v.array(v.object({
            phase: prizePhaseValidator,
            position: v.number(),
            label: v.string(),
            amount: v.number(),
        })),
    },
    handler: async (ctx, { prizes }) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            throw new ConvexError("El torneo no está disponible.");
        await requireAdmin(ctx, tournament._id, userId, "configuracion");
        if (prizes.length > 60) {
            throw new ConvexError("Máximo 60 premios por liga.");
        }
        const seen = new Set();
        for (const prize of prizes) {
            if (!Number.isInteger(prize.position) || prize.position < 1 || prize.position > 100) {
                throw new ConvexError("La posición de cada premio debe estar entre 1 y 100.");
            }
            if (!Number.isFinite(prize.amount) || prize.amount < 0) {
                throw new ConvexError("El importe de un premio no puede ser negativo.");
            }
            const label = prize.label.trim();
            if (label.length < 2 || label.length > 60) {
                throw new ConvexError("Cada premio necesita un nombre de 2 a 60 caracteres.");
            }
            const key = `${prize.phase}:${prize.position}`;
            if (seen.has(key)) {
                throw new ConvexError("Hay dos premios para la misma posición de la misma fase. Combínalos en uno.");
            }
            seen.add(key);
        }
        const existing = await ctx.db
            .query("prizes")
            .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
            .collect();
        for (const row of existing)
            await ctx.db.delete(row._id);
        for (const prize of prizes) {
            await ctx.db.insert("prizes", {
                tournamentId: tournament._id,
                phase: prize.phase,
                position: prize.position,
                label: prize.label.trim(),
                amount: Math.round(prize.amount),
                updatedAt: Date.now(),
                updatedBy: userId,
            });
        }
        const total = prizes.reduce((sum, prize) => sum + prize.amount, 0);
        const actor = await ctx.db.get(userId);
        await logAudit(ctx, {
            tournamentId: tournament._id,
            actorUserId: userId,
            actorName: actor?.name ?? "Administración",
            action: "Premios del torneo actualizados",
            entity: "prizes",
            detail: `${prizes.length} premio(s) · bolsa total ${formatMoney(total)} · fases: ${[...new Set(prizes.map((p) => p.phase))].join(", ") || "ninguna"}`,
        });
        return { configured: prizes.length, total };
    },
});
/* ------------------------------------------------------------------ *
 * FC 27 parity: the competition the league mirrors
 * ------------------------------------------------------------------ */
export const setCompetition = mutation({
    args: { competitionId: v.string() },
    handler: async (ctx, { competitionId }) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            throw new ConvexError("El torneo no está disponible.");
        await requireAdmin(ctx, tournament._id, userId, "configuracion");
        if (!isValidFc27Id(competitionId)) {
            throw new ConvexError("Solo existen las competiciones de EA SPORTS FC 27: elige una del catálogo oficial.");
        }
        const competition = fc27Competition(competitionId);
        const matchdays = fc27Matchdays(competition);
        await ctx.db.patch(tournament._id, {
            competitionId,
            totalMatchdays: matchdays,
        });
        const actor = await ctx.db.get(userId);
        await logAudit(ctx, {
            tournamentId: tournament._id,
            actorUserId: userId,
            actorName: actor?.name ?? "Administración",
            action: "Competición del torneo configurada",
            entity: "tournament",
            entityId: tournament._id,
            detail: `${tournament.name} ahora replica «${competition.name}» (${competition.country}) de EA SPORTS FC 27 · ${matchdays} jornadas · paridad FC27 ↔ 11ELEVEN garantizada`,
        });
        return { competitionId, matchdays, name: competition.name };
    },
});
/* ------------------------------------------------------------------ *
 * Detailed match report (result, goals, cards, injuries)
 * ------------------------------------------------------------------ */
/** Squads + existing report needed to fill the result form. */
export const fixtureReport = query({
    args: { fixtureId: v.id("fixtures") },
    handler: async (ctx, { fixtureId }) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            return null;
        await requireAdmin(ctx, tournament._id, userId, "calendario");
        const fixture = await ctx.db.get(fixtureId);
        if (!fixture || fixture.tournamentId !== tournament._id)
            return null;
        const buildSide = async (clubId) => {
            const club = await ctx.db.get(clubId);
            const { players } = await loadSquadByClub(ctx, clubId);
            return {
                clubId,
                name: club?.name ?? "Club sin asignar",
                players: players.map((player) => ({
                    playerId: player.playerId,
                    name: player.name,
                    position: player.position,
                    group: player.group,
                    ovr: player.ovr,
                })),
            };
        };
        const home = await buildSide(fixture.homeClubId);
        const away = await buildSide(fixture.awayClubId);
        const reportRow = await ctx.db
            .query("fixtureReports")
            .withIndex("by_fixture", (q) => q.eq("fixtureId", fixtureId))
            .first();
        if (!reportRow)
            return { home, away, report: null };
        const nameOf = async (playerId) => (await ctx.db.get(playerId))?.name ?? "Jugador";
        const goals = [];
        for (const entry of reportRow.goals) {
            goals.push({
                clubId: entry.clubId,
                playerId: entry.playerId,
                name: await nameOf(entry.playerId),
                count: entry.count,
            });
        }
        const yellows = [];
        for (const entry of reportRow.yellowCards) {
            yellows.push({
                clubId: entry.clubId,
                playerId: entry.playerId,
                name: await nameOf(entry.playerId),
            });
        }
        const reds = [];
        for (const entry of reportRow.redCards) {
            reds.push({
                clubId: entry.clubId,
                playerId: entry.playerId,
                name: await nameOf(entry.playerId),
            });
        }
        const injuries = [];
        for (const entry of reportRow.injuries) {
            injuries.push({
                clubId: entry.clubId,
                playerId: entry.playerId,
                name: await nameOf(entry.playerId),
                matchdays: entry.matchdays,
            });
        }
        return {
            home,
            away,
            report: {
                homeGoals: reportRow.homeGoals,
                awayGoals: reportRow.awayGoals,
                goals,
                yellowCards: yellows,
                redCards: reds,
                injuries,
                reporterName: reportRow.reporterName,
                updatedAt: reportRow.updatedAt,
            },
        };
    },
});
/** Fallback fantasy score when a side has no saved XI to rate. */
function manualFantasyPoints(goalsFor, goalsAgainst) {
    const bonus = goalsFor > goalsAgainst ? 2 : goalsFor === goalsAgainst ? 1 : 0;
    return Math.min(6, goalsFor * 2 + bonus);
}
export const reportFixture = mutation({
    args: {
        fixtureId: v.id("fixtures"),
        homeGoals: v.number(),
        awayGoals: v.number(),
        goals: v.array(v.object({ clubId: v.id("clubs"), playerId: v.id("players"), count: v.number() })),
        yellowCards: v.array(entryValidator),
        redCards: v.array(entryValidator),
        injuries: v.array(v.object({
            clubId: v.id("clubs"),
            playerId: v.id("players"),
            matchdays: v.number(),
        })),
    },
    handler: async (ctx, args) => {
        const userId = requireAuth(await getAuthUserId(ctx));
        const tournament = await getTournament(ctx);
        if (!tournament)
            throw new ConvexError("El torneo no está disponible.");
        await requireAdmin(ctx, tournament._id, userId, "calendario");
        if (tournament.status === "cancelado" || tournament.status === "suspendido") {
            throw new ConvexError("El torneo está suspendido o cancelado: no se admiten resultados hasta que se reactive.");
        }
        const fixture = await ctx.db.get(args.fixtureId);
        if (!fixture || fixture.tournamentId !== tournament._id) {
            throw new ConvexError("Ese partido no pertenece a esta liga.");
        }
        const isValidInt = (value) => Number.isInteger(value) && value >= 0 && value <= 30;
        if (!isValidInt(args.homeGoals) || !isValidInt(args.awayGoals)) {
            throw new ConvexError("El resultado debe ser un marcador entero entre 0 y 30.");
        }
        const sideOf = new Map([
            [fixture.homeClubId, "home"],
            [fixture.awayClubId, "away"],
        ]);
        const checkEntry = (entry, context) => {
            if (!sideOf.has(entry.clubId)) {
                throw new ConvexError(`${context}: el club no juega este partido.`);
            }
        };
        for (const goal of args.goals) {
            checkEntry(goal, "Gol por jugador");
            if (!Number.isInteger(goal.count) || goal.count < 1 || goal.count > 30) {
                throw new ConvexError("Cada goleador necesita al menos un gol anotado.");
            }
        }
        for (const card of args.yellowCards)
            checkEntry(card, "Tarjeta amarilla");
        for (const card of args.redCards)
            checkEntry(card, "Tarjeta roja");
        for (const injury of args.injuries) {
            checkEntry(injury, "Lesión");
            if (!Number.isInteger(injury.matchdays) || injury.matchdays < 1 || injury.matchdays > 60) {
                throw new ConvexError("La lesión debe durar entre 1 y 60 jornadas.");
            }
        }
        // Every referenced player must exist.
        const playerIds = new Set();
        for (const entry of [
            ...args.goals.map((g) => g.playerId),
            ...args.yellowCards.map((c) => c.playerId),
            ...args.redCards.map((c) => c.playerId),
            ...args.injuries.map((i) => i.playerId),
        ]) {
            playerIds.add(entry);
        }
        for (const playerId of playerIds) {
            const player = await ctx.db.get(playerId);
            if (!player)
                throw new ConvexError("Uno de los jugadores seleccionado ya no existe.");
        }
        // Goals per player must add up to the score (for clubs that have a squad).
        const homeSquad = await loadSquadByClub(ctx, fixture.homeClubId);
        const awaySquad = await loadSquadByClub(ctx, fixture.awayClubId);
        const sumFor = (clubId) => args.goals
            .filter((goal) => goal.clubId === clubId)
            .reduce((sum, goal) => sum + goal.count, 0);
        if (homeSquad.players.length > 0 && sumFor(fixture.homeClubId) !== args.homeGoals) {
            throw new ConvexError(`Los goles por jugador del local suman ${sumFor(fixture.homeClubId)} y el marcador es ${args.homeGoals}: asigna los ${args.homeGoals} goles.`);
        }
        if (awaySquad.players.length > 0 && sumFor(fixture.awayClubId) !== args.awayGoals) {
            throw new ConvexError(`Los goles por jugador del visitante suman ${sumFor(fixture.awayClubId)} y el marcador es ${args.awayGoals}: asigna los ${args.awayGoals} goles.`);
        }
        const now = Date.now();
        const existing = await ctx.db
            .query("fixtureReports")
            .withIndex("by_fixture", (q) => q.eq("fixtureId", fixture._id))
            .first();
        const actor = await ctx.db.get(userId);
        const reporterName = actor?.name ?? "Administración";
        if (existing) {
            await ctx.db.patch(existing._id, {
                homeGoals: args.homeGoals,
                awayGoals: args.awayGoals,
                goals: args.goals,
                yellowCards: args.yellowCards,
                redCards: args.redCards,
                injuries: args.injuries,
                reportedBy: userId,
                reporterName,
                updatedAt: now,
            });
        }
        else {
            await ctx.db.insert("fixtureReports", {
                tournamentId: tournament._id,
                fixtureId: fixture._id,
                homeGoals: args.homeGoals,
                awayGoals: args.awayGoals,
                goals: args.goals,
                yellowCards: args.yellowCards,
                redCards: args.redCards,
                injuries: args.injuries,
                reportedBy: userId,
                reporterName,
                createdAt: now,
                updatedAt: now,
            });
        }
        // Fantasy points: rated XI when it exists, otherwise a score-based guess.
        const matchKey = `${tournament.code}:j${fixture.matchday}:${fixture.homeClubId}:${fixture.awayClubId}`;
        const homeXi = fixture.homeXiOvr ?? (averageOvr(startersOf(homeSquad.players, homeSquad.lineup)) || null);
        const awayXi = fixture.awayXiOvr ?? (averageOvr(startersOf(awaySquad.players, awaySquad.lineup)) || null);
        const homePoints = homeXi !== null
            ? fantasyPointsForSide({ matchKey, clubId: "home", xiOvr: homeXi })
            : manualFantasyPoints(args.homeGoals, args.awayGoals);
        const awayPoints = awayXi !== null
            ? fantasyPointsForSide({ matchKey, clubId: "away", xiOvr: awayXi })
            : manualFantasyPoints(args.awayGoals, args.homeGoals);
        await ctx.db.patch(fixture._id, {
            status: "jugado",
            homeGoals: args.homeGoals,
            awayGoals: args.awayGoals,
            homePoints,
            awayPoints,
            playedAt: fixture.playedAt ?? now,
            ...(homeXi !== null && fixture.homeXiOvr === undefined ? { homeXiOvr: homeXi } : {}),
            ...(awayXi !== null && fixture.awayXiOvr === undefined ? { awayXiOvr: awayXi } : {}),
        });
        // Injuries: park the player for the reported number of matchdays.
        let injuredApplied = 0;
        for (const injury of args.injuries) {
            const squad = await ctx.db
                .query("squads")
                .withIndex("by_club", (q) => q.eq("clubId", injury.clubId))
                .first();
            if (!squad)
                continue;
            const rows = await ctx.db
                .query("squadPlayers")
                .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
                .collect();
            const row = rows.find((item) => item.playerId === injury.playerId);
            if (!row)
                continue;
            await ctx.db.patch(row._id, {
                injuredUntilMatchday: tournament.currentMatchday + injury.matchdays,
            });
            injuredApplied += 1;
        }
        const homeClub = await ctx.db.get(fixture.homeClubId);
        const awayClub = await ctx.db.get(fixture.awayClubId);
        const scorers = args.goals.map((goal) => `${goal.count}×`).join(" ");
        await logAudit(ctx, {
            tournamentId: tournament._id,
            clubId: fixture.homeClubId,
            actorUserId: userId,
            actorName: reporterName,
            action: existing ? "Resultado detallado corregido" : "Resultado detallado registrado",
            entity: "fixture",
            entityId: fixture._id,
            detail: `${homeClub?.name ?? "Local"} ${args.homeGoals}–${args.awayGoals} ${awayClub?.name ?? "Visitante"} · ${args.goals.length} goleador(es) ${scorers} · ${args.yellowCards.length} amarilla(s) · ${args.redCards.length} roja(s) · ${args.injuries.length} lesión(es)${injuredApplied ? ` (${injuredApplied} jugador(es) apartados)` : ""}`,
        });
        return {
            fixtureId: fixture._id,
            homeGoals: args.homeGoals,
            awayGoals: args.awayGoals,
            injured: injuredApplied,
        };
    },
});
