import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from "react";
import { useOutletContext } from "react-router";
import { SectionCard, Countdown } from "@/components/eleven/SectionCard";
import { MatchCard, MatchdayChip, StandingsTable, } from "@/components/eleven/MatchBits";
import { Crest } from "@/components/eleven/Crest";
import { CalendarDays, History, Info, Swords, Trophy, } from "lucide-react";
import { cn } from "@/lib/utils";
const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
});
function roundDate(kickoffAt) {
    return DATE_FORMAT.format(new Date(kickoffAt));
}
/**
 * Resultados (prompt §25): marcador + puntos fantasy, tabla completa and the
 * Match Center (§58): my fixture, XI OVR, kickoff and the deadline anchor.
 */
export default function Competition() {
    const state = useOutletContext();
    const summary = state.competition;
    const myClubId = state.club?.id ?? null;
    const fixtureGroups = summary.matchdays;
    const [previous, current, upcoming] = useMemo(() => {
        const currentIdx = fixtureGroups.findIndex((group) => group.status === "en_curso");
        const idx = currentIdx >= 0 ? currentIdx : summary.currentMatchday - 1;
        return [
            fixtureGroups[idx - 1] ?? null,
            fixtureGroups[idx] ?? null,
            fixtureGroups[idx + 1] ?? null,
        ];
    }, [fixtureGroups, summary.currentMatchday]);
    if (!summary.available) {
        return (_jsx(SectionCard, { title: "Calendario", icon: CalendarDays, children: _jsx("p", { className: "text-sm text-muted-foreground", children: "El calendario todav\u00EDa no se ha generado. Se crea autom\u00E1ticamente con el torneo (ida y vuelta entre todos los clubes); recarga la p\u00E1gina en unos segundos." }) }));
    }
    const currentRows = current?.fixtures ?? [];
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(SectionCard, { title: "Match Center", icon: Swords, action: { label: "Ver alineación", to: "/dashboard/formacion" }, children: summary.myMatch ? (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-col items-center gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:flex-row sm:justify-between", children: [_jsx(MatchSide, { name: state.club?.name ?? "—", shortName: state.club?.shortName ?? "—", colors: [
                                        state.club?.colorPrimary ?? "#1d4ed8",
                                        state.club?.colorSecondary ?? "#0b1a30",
                                    ], points: summary.myMatch.mySide === "home"
                                        ? summary.myMatch.fixture.homePoints
                                        : summary.myMatch.fixture.awayPoints, xiOvr: summary.myMatch.myXiOvr, lineup: state.lineup?.formation }), _jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsxs("span", { className: "display text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground", children: ["Jornada ", summary.myMatch.matchday] }), summary.myMatch.status === "jugada" ? (_jsxs("span", { className: "num display text-2xl font-bold", children: [(summary.myMatch.mySide === "home"
                                                    ? summary.myMatch.fixture.homeGoals
                                                    : summary.myMatch.fixture.awayGoals) ?? "—", _jsx("span", { className: "mx-2 text-sm text-muted-foreground", children: "\u2013" }), (summary.myMatch.mySide === "away"
                                                    ? summary.myMatch.fixture.homeGoals
                                                    : summary.myMatch.fixture.awayGoals) ?? "—"] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "display text-xl font-bold text-primary", children: "VS" }), summary.myMatch.status === "en_curso" ? (_jsx(Countdown, { target: summary.myMatch.fixture.kickoffAt, label: "Arranca en" })) : (_jsx("span", { className: "text-xs text-muted-foreground", children: roundDate(summary.myMatch.fixture.kickoffAt) }))] })), _jsx("span", { className: "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground", children: summary.myMatch.status === "en_curso"
                                                ? "EN CURSO"
                                                : summary.myMatch.status === "jugada"
                                                    ? "FINAL"
                                                    : "PROGRAMADO" })] }), _jsx(MatchSide, { name: summary.myMatch.fixture.away.clubId === myClubId
                                        ? summary.myMatch.fixture.home.name
                                        : summary.myMatch.fixture.away.name, shortName: summary.myMatch.fixture.away.clubId === myClubId
                                        ? summary.myMatch.fixture.home.shortName
                                        : summary.myMatch.fixture.away.shortName, colors: summary.myMatch.fixture.away.clubId === myClubId
                                        ? summary.myMatch.fixture.home.colors
                                        : summary.myMatch.fixture.away.colors, points: summary.myMatch.mySide === "home"
                                        ? summary.myMatch.fixture.awayPoints
                                        : summary.myMatch.fixture.homePoints, xiOvr: summary.myMatch.mySide === "home"
                                        ? summary.myMatch.fixture.awayXiOvr
                                        : summary.myMatch.fixture.homeXiOvr, rival: summary.myMatch.rivalNickname, align: "right" })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: summary.myMatch.status === "jugada"
                                ? "Los 11 titulares guardados al cierre puntuaron en el marcador. Los fichajes posteriores no reescriben la historia."
                                : "Puntúan los 11 titulares guardados en Formación al momento del cierre de la jornada." })] })) : (_jsxs("div", { className: "flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4", children: [_jsx(Info, { className: "mt-0.5 size-4 shrink-0 text-muted-foreground" }), _jsx("p", { className: "text-sm text-muted-foreground", children: myClubId
                                ? "Tu club no tiene partido en la jornada en curso."
                                : "Elige un club para ver tu partido de la jornada." })] })) }), _jsx("div", { className: "grid gap-5 lg:grid-cols-2", children: [
                    { group: previous, title: "Jornada anterior", icon: History },
                    { group: upcoming, title: "Próxima jornada", icon: CalendarDays },
                ]
                    .filter((block) => block.group)
                    .map(({ group, title, icon: Icon }) => (_jsx(SectionCard, { title: title, icon: Icon, children: _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(MatchdayChip, { group: group }), group.fixtures.map((fixture) => (_jsx(MatchCard, { fixture: fixture, highlightClubId: myClubId }, fixture.id)))] }) }, title))) }), _jsx(SectionCard, { title: `Jornada ${current?.matchday ?? summary.currentMatchday}`, icon: Swords, children: _jsxs("div", { className: "flex flex-col gap-2", children: [current ? _jsx(MatchdayChip, { group: current }) : null, currentRows.length > 0 ? (currentRows.map((fixture) => (_jsx(MatchCard, { fixture: fixture, highlightClubId: myClubId }, fixture.id)))) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "Sin partidos programados." }))] }) }), _jsxs(SectionCard, { title: "Tabla del torneo", icon: Trophy, children: [_jsx(StandingsTable, { rows: summary.standings, highlightClubId: myClubId }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground", children: [_jsxs("span", { children: [_jsx("strong", { className: "text-foreground", children: "PJ" }), " jugados \u00B7", " ", _jsx("strong", { className: "text-foreground", children: "G" }), " victorias \u00B7", " ", _jsx("strong", { className: "text-foreground", children: "E" }), " empates \u00B7", " ", _jsx("strong", { className: "text-foreground", children: "P" }), " derrotas"] }), _jsxs("span", { children: [_jsx("strong", { className: "text-foreground", children: "GF/GC" }), " goles a favor y en contra \u00B7 ", _jsx("strong", { className: "text-foreground", children: "DIF" }), " diferencia"] }), _jsx("span", { children: "Orden: puntos, diferencia, goles, puntos fantasy" })] })] })] }));
}
function MatchSide({ name, shortName, colors, points, xiOvr, lineup, rival, align = "left", }) {
    return (_jsxs("div", { className: cn("flex min-w-0 flex-1 flex-col gap-1.5", align === "right" && "items-end text-right"), children: [_jsx(Crest, { name: name, shortName: shortName, colors: colors, size: "lg" }), _jsx("span", { className: "display truncate text-base font-bold", children: name }), rival ? (_jsx("span", { className: "text-xs text-muted-foreground", children: rival })) : lineup ? (_jsx("span", { className: "text-xs text-muted-foreground", children: lineup })) : null, _jsxs("div", { className: "flex items-center gap-2 text-xs", children: [xiOvr != null ? (_jsxs("span", { className: "rounded-md bg-muted px-1.5 py-0.5 font-semibold", children: ["OVR ", xiOvr] })) : null, points != null ? (_jsxs("span", { className: "num rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary", children: [points, " pts"] })) : null] })] }));
}
/** Matchday strip used by Home: previous / current / next at a glance. */
export function MatchdayStrip({ previous, current, upcoming, myClubId, }) {
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [[
                { label: "Jornada anterior", fixtures: previous },
                { label: "Jornada actual", fixtures: current },
                { label: "Próxima jornada", fixtures: upcoming },
            ].map(({ label, fixtures }) => fixtures.length > 0 ? (_jsxs("div", { children: [_jsx("p", { className: "mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: label }), _jsx("div", { className: "flex flex-col gap-1.5", children: fixtures.map((fixture) => (_jsx(MatchCard, { fixture: fixture, highlightClubId: myClubId, showMatchday: false }, fixture.id))) })] }, label)) : null), previous.length === 0 &&
                current.length === 0 &&
                upcoming.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Todav\u00EDa no hay partidos que mostrar." })) : null] }));
}
