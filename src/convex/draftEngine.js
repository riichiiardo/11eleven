/**
 * 11Eleven — Draft Engine (pure helpers).
 *
 * The draft is not a screen: it is the window that turns agreements into
 * squads. Turn order, the per-turn clock and the availability of the pool are
 * all derived from the same primitives here, so the Control Center, the admin
 * panel and the server guards can never disagree.
 */
export const DRAFT_STATUSES = ["borrador", "en_curso", "pausado", "cerrado"];
export const DRAFT_STATUS_META = {
    borrador: {
        label: "Preparado",
        symbol: "✎",
        tone: "progress",
        className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
        dotClassName: "bg-slate-500",
        hint: "Administración ha preparado el orden de turnos. Todavía no se puede fichar.",
    },
    en_curso: {
        label: "En curso",
        symbol: "▶",
        tone: "open",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dotClassName: "bg-emerald-500 animate-pulse",
        hint: "Turnos activos: cada adquisición se refleja al instante para todo el torneo.",
    },
    pausado: {
        label: "En pausa",
        symbol: "⏸",
        tone: "progress",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        dotClassName: "bg-amber-500",
        hint: "El reloj está detenido y nadie puede fichar hasta que Administración reanude.",
    },
    cerrado: {
        label: "Cerrado",
        symbol: "✔",
        tone: "locked",
        className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
        dotClassName: "bg-slate-500",
        hint: "El draft terminó: las plantillas quedan fijadas y solo se puede ajustar el once.",
    },
};
/** Turn order for a shape: same direction each round, or snake. */
export function indexFor(params) {
    const { step, orderSize, snake } = params;
    if (orderSize <= 0)
        return { round: 1, position: 0 };
    const round = Math.floor(step / orderSize) + 1;
    const within = step % orderSize;
    // Snake: odd rounds (2nd, 4th…) run in reverse, like a real draft.
    const reversed = snake && round % 2 === 0;
    const position = reversed ? orderSize - 1 - within : within;
    return { round, position };
}
export function sliceTotalSteps(orderSize, totalRounds) {
    return orderSize * totalRounds;
}
/** "02:14:32" remaining in the current turn, or null when no clock is running. */
export function turnSecondsLeft(deadline, now) {
    if (deadline === null)
        return null;
    return Math.max(0, Math.ceil((deadline - now) / 1000));
}
/** Does the tournament currently allow picks? */
export function draftAcceptsPicks(status) {
    return status === "en_curso";
}
