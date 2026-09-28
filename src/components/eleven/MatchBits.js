import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Crest } from "./Crest";
/** Score chip: winner highlighted, numbers always legible (not colour-only). */
function ScoreChip({ goals, points, won, lost, }) {
    if (goals === null || points === null) {
        return (_jsx("span", { className: "num display min-w-16 rounded-md bg-muted px-2 py-1 text-center text-sm text-muted-foreground", children: "\u2014" }));
    }
    return (_jsxs("span", { className: "num display min-w-16 rounded-md px-2 py-1 text-center text-sm ring-1 ring-inset ring-border bg-card", children: [_jsx("span", { className: "font-bold", children: goals }), _jsxs("span", { className: cn("ml-1 text-[11px] font-semibold", won ? "text-brand-bright" : lost ? "text-muted-foreground" : "text-foreground/70"), children: ["\u00B7 ", points] })] }));
}
/**
 * One fixture row. The current matchday carries an "EN CURSO" marker; played
 * rows show goals + fantasy points; future rows show the kickoff date.
 */
export function MatchCard({ fixture, highlightClubId, showMatchday = true, }) {
    const played = fixture.status === "jugado";
    const homeWon = played && (fixture.homeGoals ?? 0) > (fixture.awayGoals ?? 0);
    const awayWon = played && (fixture.awayGoals ?? 0) > (fixture.homeGoals ?? 0);
    const mine = highlightClubId != null &&
        (fixture.home.clubId === highlightClubId ||
            fixture.away.clubId === highlightClubId);
    const sideClass = (clubId) => cn("flex min-w-0 flex-1 items-center gap-2", clubId === fixture.away.clubId && "flex-row-reverse text-right", highlightClubId != null &&
        clubId === highlightClubId &&
        "font-bold text-foreground");
    return (_jsx("div", { className: cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5", mine ? "border-primary/50 shadow-sm" : "border-border", fixture.status === "en_curso" && "border-primary/35 bg-primary/5"), children: _jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-3", children: [_jsxs("div", { className: sideClass(fixture.home.clubId), children: [_jsx("span", { className: "hidden min-w-9 text-[11px] font-semibold text-muted-foreground sm:block", children: fixture.home.shortName }), _jsx(Crest, { name: fixture.home.name, shortName: fixture.home.shortName, colors: fixture.home.colors, size: "sm" }), _jsx("span", { className: "truncate text-sm", children: fixture.home.name })] }), _jsxs("div", { className: "flex shrink-0 flex-col items-center gap-0.5", children: [showMatchday ? (_jsxs("span", { className: "text-[9px] font-semibold uppercase tracking-widest text-muted-foreground", children: ["J", fixture.matchday] })) : null, _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(ScoreChip, { goals: fixture.homeGoals, points: fixture.homePoints, won: homeWon, lost: awayWon }), _jsx("span", { className: "display text-[10px] text-muted-foreground", children: "VS" }), _jsx(ScoreChip, { goals: fixture.awayGoals, points: fixture.awayPoints, won: awayWon, lost: homeWon })] })] }), _jsx("div", { className: cn("flex min-w-0 flex-1 justify-end", "items-center"), children: _jsxs("div", { className: sideClass(fixture.away.clubId), children: [_jsx("span", { className: "truncate text-sm", children: fixture.away.name }), _jsx(Crest, { name: fixture.away.name, shortName: fixture.away.shortName, colors: fixture.away.colors, size: "sm" }), _jsx("span", { className: "hidden min-w-9 text-[11px] font-semibold text-muted-foreground sm:block", children: fixture.away.shortName })] }) })] }) }));
}
/** Matchday header chip: previous / current / next states at a glance. */
export function MatchdayChip({ group }) {
    const tone = group.status === "en_curso"
        ? "border-primary/50 bg-primary/10 text-primary"
        : group.status === "jugada"
            ? "border-border bg-muted text-muted-foreground"
            : "border-gold/40 bg-gold/10 text-amber-800 dark:text-amber-200";
    return (_jsxs("span", { className: cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", tone), children: [group.statusLabel, " \u00B7 J", group.matchday] }));
}
/** Compact standings table with champion highlight and clear pos numbers. */
export function StandingsTable({ rows, highlightClubId, maxRows, }) {
    const visible = maxRows ? rows.slice(0, maxRows) : rows;
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[560px] text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] uppercase tracking-wide text-muted-foreground", children: [_jsx("th", { scope: "col", className: "py-2 pr-2 font-semibold", children: "#" }), _jsx("th", { scope: "col", className: "py-2 pr-2 font-semibold", children: "Club" }), _jsx("th", { scope: "col", className: "py-2 text-center font-semibold", children: "PJ" }), _jsx("th", { scope: "col", className: "py-2 text-center font-semibold", children: "G" }), _jsx("th", { scope: "col", className: "py-2 text-center font-semibold", children: "E" }), _jsx("th", { scope: "col", className: "py-2 text-center font-semibold", children: "P" }), _jsx("th", { scope: "col", className: "py-2 text-center font-semibold", children: "GF" }), _jsx("th", { scope: "col", className: "py-2 text-center font-semibold", children: "GC" }), _jsx("th", { scope: "col", className: "py-2 text-center font-semibold", children: "DIF" }), _jsx("th", { scope: "col", className: "py-2 pl-2 text-right font-semibold", children: "Pts" })] }) }), _jsx("tbody", { children: visible.map((row) => (_jsxs("tr", { className: cn("border-t border-border/70", row.clubId === highlightClubId && "bg-primary/5 font-semibold", row.position === 1 && "bg-gold/5"), children: [_jsx("td", { className: "py-2 pr-2", children: _jsx("span", { className: cn("num display inline-flex size-6 items-center justify-center rounded-md text-xs font-bold", row.position === 1
                                        ? "bg-gold/20 text-amber-800 ring-1 ring-gold/40 dark:text-amber-200"
                                        : "bg-muted text-muted-foreground"), children: row.position }) }), _jsx("td", { className: "py-2 pr-2", children: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Crest, { name: row.clubName, shortName: row.clubShortName, colors: row.clubColors, size: "sm", className: "size-6 text-[8px]" }), _jsx("span", { className: "truncate", children: row.clubName }), row.position === 1 ? (_jsx(Trophy, { "aria-hidden": "true", className: "size-3.5 shrink-0 text-amber-500" })) : null] }) }), _jsx("td", { className: "num py-2 text-center text-muted-foreground", children: row.played }), _jsx("td", { className: "num py-2 text-center", children: row.won }), _jsx("td", { className: "num py-2 text-center", children: row.drawn }), _jsx("td", { className: "num py-2 text-center", children: row.lost }), _jsx("td", { className: "num py-2 text-center text-muted-foreground", children: row.goalsFor }), _jsx("td", { className: "num py-2 text-center text-muted-foreground", children: row.goalsAgainst }), _jsx("td", { className: cn("num py-2 text-center font-semibold", row.goalDiff > 0
                                    ? "text-brand-bright"
                                    : row.goalDiff < 0
                                        ? "text-destructive"
                                        : "text-muted-foreground"), children: row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff }), _jsx("td", { className: "num display py-2 pl-2 text-right text-base font-bold", children: row.points })] }, row.clubId))) })] }) }));
}
