/**
 * 11Eleven — Tournament Rule Engine
 *
 * Single source of truth for every validation in the product. The backend
 * (Convex mutations) and the frontend (live feedback while the President
 * builds a lineup) import these pure functions, so the UI can never promise
 * something the server will reject.
 *
 * Core product chain: CLUB -> PLANTILLA -> MERCADO -> COMPETICIÓN.
 */
/* ------------------------------------------------------------------ *
 * Positions
 * ------------------------------------------------------------------ */
export const POSITIONS = [
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
];
export const POSITION_GROUP = {
    POR: "GK",
    LD: "DEF",
    DFC: "DEF",
    LI: "DEF",
    MCD: "MID",
    MC: "MID",
    MCO: "MID",
    ED: "FWD",
    EI: "FWD",
    DC: "FWD",
};
export const POSITION_LABEL = {
    POR: "Portero",
    LD: "Lateral derecho",
    DFC: "Defensa central",
    LI: "Lateral izquierdo",
    MCD: "Mediocentro defensivo",
    MC: "Mediocentro",
    MCO: "Mediapunta",
    ED: "Extremo derecho",
    EI: "Extremo izquierdo",
    DC: "Delantero centro",
};
export const GROUP_ORDER = ["GK", "DEF", "MID", "FWD"];
export const GROUP_LABEL = {
    GK: "Porteros",
    DEF: "Defensas",
    MID: "Medios",
    FWD: "Delanteros",
};
export const GROUP_SHORT = {
    GK: "POR",
    DEF: "DEF",
    MID: "MED",
    FWD: "ATA",
};
export const GROUP_ACCENT = {
    GK: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    DEF: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    MID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    FWD: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};
export function groupOf(position) {
    return POSITION_GROUP[position];
}
/* ------------------------------------------------------------------ *
 * Player availability inside a squad
 * ------------------------------------------------------------------ */
export const AVAILABILITIES = [
    "transferible",
    "negociacion",
    "neutro",
    "intransferible",
];
/** Icon + text + colour: availability is never communicated by colour alone. */
export const AVAILABILITY_META = {
    transferible: {
        label: "Transferible",
        symbol: "✓",
        tone: "positive",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        description: "Puede recibir ofertas de otros Presidentes de forma directa.",
    },
    negociacion: {
        label: "Posible negociación",
        symbol: "⚠",
        tone: "warning",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        description: "Abierto a conversaciones: el Presidente escucha propuestas por este jugador.",
    },
    neutro: {
        label: "Neutro",
        symbol: "○",
        tone: "neutral",
        className: "border-border bg-muted text-muted-foreground",
        description: "Sin intención declarada. Se puede iniciar conversación pero no hay apertura explícita.",
    },
    intransferible: {
        label: "Intransferible",
        symbol: "⊘",
        tone: "danger",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        description: "El Presidente bloqueó este jugador: no admite ofertas.",
    },
};
export const DEFAULT_RULES = {
    budget: 350000000,
    squadSize: 26,
    gkMin: 2,
    gkMax: 3,
    defMin: 5,
    defMax: 9,
    midMin: 5,
    midMax: 10,
    fwdMin: 5,
    fwdMax: 9,
    maxPerRealClub: 3,
    minOvr: 70,
    maxU21: 5,
    lineupLockHours: 2,
    fc27FormationCode: "4-2-3-1",
    formationInstructions: "Pendiente de completar por el presidente.",
    u20Min: 0,
    u20InStartingLineup: null,
    sameNationalityMin: 0,
    sameNationalityRule: null,
    sameNationalityMatchDurationMinutes: 0,
    clubNationalityMin: 0,
};
/**
 * Configuration shipped with the first seed of the tournament. Used once, on
 * bootstrap, to migrate an untouched early configuration to the current rules.
 */
export const LEGACY_SEEDED_RULES = {
    budget: 350000000,
    squadSize: 20,
    gkMin: 2,
    gkMax: 3,
    defMin: 6,
    defMax: 9,
    midMin: 6,
    midMax: 9,
    fwdMin: 6,
    fwdMax: 8,
    maxPerRealClub: 3,
    minOvr: 70,
    maxU21: 5,
    lineupLockHours: 2,
    fc27FormationCode: "4-2-3-1",
    formationInstructions: "Pendiente de completar por el presidente.",
    u20Min: 0,
    u20InStartingLineup: null,
    sameNationalityMin: 0,
    sameNationalityRule: null,
    sameNationalityMatchDurationMinutes: 0,
    clubNationalityMin: 0,
};
export function groupLimits(rules, group) {
    switch (group) {
        case "GK":
            return { min: rules.gkMin, max: rules.gkMax };
        case "DEF":
            return { min: rules.defMin, max: rules.defMax };
        case "MID":
            return { min: rules.midMin, max: rules.midMax };
        case "FWD":
            return { min: rules.fwdMin, max: rules.fwdMax };
    }
}
export const RULE_DESCRIPTORS = [
    {
        code: "R-01",
        title: "Presupuesto del Presidente",
        description: "Saldo inicial para construir la plantilla. Cada operación descuenta del mismo presupuesto y ninguna puede dejarlo en negativo.",
        scope: "Club",
        value: (r) => formatMoney(r.budget),
        field: "budget",
        min: 0,
        max: 2000000000,
        step: 5000000,
        input: "money",
    },
    {
        code: "R-02",
        title: "Tamaño máximo de plantilla",
        description: "Número máximo de jugadores que un club puede registrar. El motor bloquea cualquier incorporación que lo supere.",
        scope: "Plantilla",
        value: (r) => `${r.squadSize} jugadores`,
        field: "squadSize",
        min: 11,
        max: 40,
        step: 1,
    },
    {
        code: "R-03",
        title: "Porteros en plantilla",
        description: "Rango obligatorio de porteros. Por debajo del mínimo la plantilla queda inválida; por encima del máximo no se admiten fichajes.",
        scope: "Plantilla",
        value: (r) => `${r.gkMin} - ${r.gkMax}`,
    },
    {
        code: "R-04",
        title: "Defensas en plantilla",
        description: "Rango obligatorio de defensas registrados en el club.",
        scope: "Plantilla",
        value: (r) => `${r.defMin} - ${r.defMax}`,
    },
    {
        code: "R-05",
        title: "Medios en plantilla",
        description: "Rango obligatorio de centrocampistas registrados en el club.",
        scope: "Plantilla",
        value: (r) => `${r.midMin} - ${r.midMax}`,
    },
    {
        code: "R-06",
        title: "Delanteros en plantilla",
        description: "Rango obligatorio de atacantes registrados en el club.",
        scope: "Plantilla",
        value: (r) => `${r.fwdMin} - ${r.fwdMax}`,
    },
    {
        code: "R-07",
        title: "Máximo de jugadores por club real",
        description: "Evita concentrar la plantilla en un solo club de origen y mantiene el mercado repartido entre Presidentes.",
        scope: "Mercado",
        value: (r) => `${r.maxPerRealClub} jugadores`,
        field: "maxPerRealClub",
        min: 1,
        max: 10,
        step: 1,
    },
    {
        code: "R-08",
        title: "OVR mínimo para fichar",
        description: "Ningún fichaje por debajo de este OVR entra en el torneo, salvo canteranos aprobados por Administración.",
        scope: "Mercado",
        value: (r) => `${r.minOvr} OVR`,
        field: "minOvr",
        min: 40,
        max: 95,
        step: 1,
    },
    {
        code: "R-09",
        title: "Máximo de jugadores sub-21",
        description: "Limita cuántos jugadores de 21 años o menos puede alinear un club a lo largo de la temporada.",
        scope: "Plantilla",
        value: (r) => `${r.maxU21} jugadores`,
        field: "maxU21",
        min: 0,
        max: 15,
        step: 1,
    },
    {
        code: "R-10",
        title: "Cierre de alineación",
        description: "Horas antes del inicio de la jornada en que la alineación titular queda bloqueada y no admite cambios.",
        scope: "Competición",
        value: (r) => `${r.lineupLockHours} h antes`,
        field: "lineupLockHours",
        min: 1,
        max: 72,
        step: 1,
    },
    {
        code: "R-11",
        title: "Jugadores sub-20 en el XI",
        description: "El torneo fija un mínimo de jugadores de 20 años o menos obligados a alinearse. Se toman desde el XI titular (obligatorio) o como reserva sustituible (cambiable en función del tiempo).",
        scope: "Plantilla",
        value: (r) => r.u20InStartingLineup === null
            ? `Sin regla · mínimo ${r.u20Min}`
            : `${r.u20Min} sub-20 · ${r.u20InStartingLineup === "obligatory" ? "desde el XI titular" : "como reserva sustituible"}`,
        field: "u20Min",
        min: 0,
        max: 11,
        step: 1,
    },
    {
        code: "R-12",
        title: "Mismas nacionalidades en el encuentro",
        description: "El torneo exige que, en todo el partido, el equipo cuente siempre con un número mínimo de jugadores de una misma nacionalidad, ya sea fijado en el XI o en el banco. El Presidente lo configura al crear el torneo.",
        scope: "Plantilla",
        value: (r) => r.sameNationalityRule === null
            ? `Sin regla · mínimo ${r.sameNationalityMin}`
            : `${r.sameNationalityMin} de una misma nacionalidad · ${r.sameNationalityRule === "obligatory" ? "siempre en campo" : "cambiable"} · ${r.sameNationalityMatchDurationMinutes} minutos de permanencia`,
        field: "sameNationalityMin",
        min: 0,
        max: 22,
        step: 1,
    },
    {
        code: "R-13",
        title: "Formación exportada del FC 27",
        description: "Código de formación seleccionado en el FC 27 y las instrucciones tácticas adicionales del presidente (cambios previstos, rango de minutos, bloqueos de posiciones…). El código se enlaza con los 22 esquemas del menú de tácticas del FC 27 para mantener un XI siempre legal.",
        scope: "Plantilla",
        value: (r) => `${r.fc27FormationCode} · ${r.formationInstructions.length > 60 ? r.formationInstructions.slice(0, 60) + "…" : r.formationInstructions}`,
        field: "fc27FormationCode",
    },
    {
        code: "R-14",
        title: "Jugadores de la nacionalidad del club en el XI",
        description: "El torneo exige que el XI inicial de cada partido de liga incluya un número mínimo de jugadores con la nacionalidad del club presidido (su país de origen). El motor lo valida al guardar la alineación.",
        scope: "Competición",
        value: (r) => (r.clubNationalityMin > 0 ? `${r.clubNationalityMin} del país del club` : "Sin regla"),
        field: "clubNationalityMin",
        min: 0,
        max: 11,
        step: 1,
    },
];
export function computeSquadStats(players) {
    const size = players.length;
    const groupCounts = {
        GK: 0,
        DEF: 0,
        MID: 0,
        FWD: 0,
    };
    let totalValue = 0;
    let ovrSum = 0;
    let ageSum = 0;
    let under21 = 0;
    for (const player of players) {
        groupCounts[player.group] += 1;
        totalValue += player.value;
        ovrSum += player.ovr;
        ageSum += player.age;
        if (player.age <= 21)
            under21 += 1;
    }
    const byOvr = [...players].sort((a, b) => b.ovr - a.ovr);
    const byValue = [...players].sort((a, b) => b.value - a.value);
    const byAge = [...players].sort((a, b) => b.age - a.age);
    return {
        size,
        totalValue,
        averageOvr: size ? Math.round((ovrSum / size) * 10) / 10 : 0,
        averageAge: size ? Math.round((ageSum / size) * 10) / 10 : 0,
        under21,
        groupCounts,
        topPlayers: byOvr.slice(0, 3),
        mostValuable: byValue[0],
        oldest: byAge[0],
    };
}
export function evaluateSquadRules(rules, squad, availableBudget, 
/** Your own club is the squad's home club: only external clubs count. */
ownClubName) {
    const stats = computeSquadStats(squad);
    const checks = [];
    checks.push({
        id: "squad-size",
        ruleRef: "R-02 · Tamaño de plantilla",
        label: "Tamaño de plantilla",
        value: `${stats.size} / ${rules.squadSize}`,
        passed: stats.size <= rules.squadSize,
        detail: stats.size <= rules.squadSize
            ? `Tu plantilla respeta el máximo de ${rules.squadSize} jugadores. Quedan ${rules.squadSize - stats.size} plazas disponibles para el mercado.`
            : `Tienes ${stats.size} jugadores y el torneo admite un máximo de ${rules.squadSize}. Debes liberar ${stats.size - rules.squadSize} antes de inscribir a nadie más.`,
        action: { label: "Ver plantilla", to: "/dashboard/club" },
    });
    for (const group of GROUP_ORDER) {
        const limits = groupLimits(rules, group);
        const count = stats.groupCounts[group];
        const passed = count >= limits.min && count <= limits.max;
        checks.push({
            id: `group-${group}`,
            ruleRef: `R-${group === "GK" ? "03" : group === "DEF" ? "04" : group === "MID" ? "05" : "06"} · ${GROUP_LABEL[group]}`,
            label: GROUP_LABEL[group],
            value: `${count} / ${limits.min}-${limits.max}`,
            passed,
            detail: passed
                ? `Cumples el rango de ${GROUP_LABEL[group].toLowerCase()} (${limits.min}-${limits.max}).`
                : count < limits.min
                    ? `Necesitas al menos ${limits.min} ${GROUP_LABEL[group].toLowerCase()} y tienes ${count}. La plantilla queda incompleta hasta que incorpores ${limits.min - count}.`
                    : `Tienes ${count} ${GROUP_LABEL[group].toLowerCase()} y el máximo permitido es ${limits.max}. No puedes incorporar más en este grupo.`,
            action: { label: "Ver plantilla", to: "/dashboard/club" },
        });
    }
    const perRealClub = new Map();
    for (const player of squad) {
        if (ownClubName && player.realClub === ownClubName)
            continue;
        if (player.realClub === FREE_AGENT_CLUB)
            continue; // free agents belong to no club
        perRealClub.set(player.realClub, (perRealClub.get(player.realClub) ?? 0) + 1);
    }
    const biggestGroup = [...perRealClub.entries()].sort((a, b) => b[1] - a[1])[0];
    const maxFromClub = biggestGroup?.[1] ?? 0;
    checks.push({
        id: "real-club",
        ruleRef: "R-07 · Jugadores por club real",
        label: "Jugadores por club real",
        value: `${maxFromClub} / ${rules.maxPerRealClub}`,
        passed: maxFromClub <= rules.maxPerRealClub,
        detail: maxFromClub <= rules.maxPerRealClub
            ? `Ningún club externo aporta más de ${rules.maxPerRealClub} jugadores a tu plantilla. Ni tu propio club ni los agentes libres cuentan para este límite.`
            : `${biggestGroup?.[0]} aporta ${maxFromClub} jugadores a tu plantilla y el máximo es ${rules.maxPerRealClub}.`,
    });
    checks.push({
        id: "u21",
        ruleRef: "R-09 · Jugadores sub-21",
        label: "Sub-21 en plantilla",
        value: `${stats.under21} / ${rules.maxU21}`,
        passed: stats.under21 <= rules.maxU21,
        detail: stats.under21 <= rules.maxU21
            ? `Proyecto con ${stats.under21} jugadores de 21 años o menos. Dentro del límite.`
            : `${stats.under21} jugadores de 21 años o menos superan el límite de ${rules.maxU21}.`,
    });
    checks.push({
        id: "budget",
        ruleRef: "R-01 · Presupuesto",
        label: "Presupuesto disponible",
        value: formatMoney(availableBudget),
        passed: availableBudget >= 0,
        detail: availableBudget >= 0
            ? `Puedes comprometer hasta ${formatMoney(availableBudget)} en el mercado sin romper ninguna regla.`
            : `Tu presupuesto está excedido en ${formatMoney(Math.abs(availableBudget))}. Administración debe revisar tus operaciones.`,
    });
    const violations = checks.filter((check) => !check.passed);
    return { checks, passed: violations.length === 0, violations };
}
/** Guards a single market operation against the same engine. */
export function evaluateSigning(rules, squad, candidate, availableBudget, ownClubName) {
    const stats = computeSquadStats(squad);
    const checks = [];
    const limits = groupLimits(rules, groupOf(candidate.position));
    const countInGroup = stats.groupCounts[groupOf(candidate.position)];
    const push = (id, ruleRef, label, value, passed, detail) => checks.push({ id, ruleRef, label, value, passed, detail });
    push("signing-budget", "R-01 · Presupuesto", "Presupuesto", `${formatMoney(candidate.value)} / ${formatMoney(availableBudget)}`, candidate.value <= availableBudget, candidate.value <= availableBudget
        ? `Tienes presupuesto suficiente: te quedarían ${formatMoney(availableBudget - candidate.value)}.`
        : `No puedes fichar a ${candidate.name} porque tu presupuesto disponible es ${formatMoney(availableBudget)} y su valoración es ${formatMoney(candidate.value)}.`);
    push("signing-size", "R-02 · Tamaño de plantilla", "Plazas libres", `${stats.size} / ${rules.squadSize}`, stats.size < rules.squadSize, stats.size < rules.squadSize
        ? `Quedan ${rules.squadSize - stats.size} plazas en la plantilla.`
        : `Tu plantilla está completa (${stats.size}/${rules.squadSize}). Debes vender o liberar un jugador antes de inscribir a otro.`);
    push("signing-group", "R-04/05/06 · Cupos por posición", GROUP_LABEL[groupOf(candidate.position)], `${countInGroup} / ${limits.min}-${limits.max}`, countInGroup < limits.max, countInGroup < limits.max
        ? `El grupo de ${GROUP_LABEL[groupOf(candidate.position)].toLowerCase()} admite ${limits.max - countInGroup} incorporaciones más.`
        : `Ya tienes ${countInGroup} en ese grupo y el máximo es ${limits.max}.`);
    push("signing-ovr", "R-08 · OVR mínimo", "OVR del jugador", `${candidate.ovr} / ${rules.minOvr}`, candidate.ovr >= rules.minOvr, candidate.ovr >= rules.minOvr
        ? `${candidate.name} supera el OVR mínimo exigido.`
        : `${candidate.name} tiene ${candidate.ovr} de OVR y el torneo exige al menos ${rules.minOvr}.`);
    const sameClub = squad.filter((p) => p.realClub === candidate.realClub &&
        p.realClub !== ownClubName &&
        p.realClub !== FREE_AGENT_CLUB).length;
    push("signing-club", "R-07 · Jugadores por club real", candidate.realClub, `${sameClub} / ${rules.maxPerRealClub}`, sameClub < rules.maxPerRealClub, sameClub < rules.maxPerRealClub
        ? `Puedes incorporar jugadores de ${candidate.realClub}.`
        : `Tu plantilla ya tiene ${sameClub} jugadores pertenecientes a este club.`);
    const violations = checks.filter((c) => !c.passed);
    return { checks, passed: violations.length === 0, violations };
}
const ACCEPTS = {
    POR: ["POR"],
    LI: ["LI"],
    LD: ["LD"],
    DFC: ["DFC", "LI", "LD", "MCD"],
    MCD: ["MCD", "MC", "DFC"],
    MC: ["MC", "MCD", "MCO"],
    MCO: ["MCO", "MC", "EI", "ED", "DC"],
    EI: ["EI", "ED", "MCO"],
    ED: ["ED", "EI", "MCO"],
    DC: ["DC", "EI", "ED", "MCO"],
};
function slot(id, label, x, y) {
    return {
        id,
        label,
        group: groupOf(label),
        accepts: ACCEPTS[label],
        x,
        y,
    };
}
export const FORMATIONS = {
    "3-2-2-3": {
        code: "3-2-2-3",
        label: "3-2-2-3",
        shape: "Alemana",
        description: "Doble contención y doble diez detrás del tridente: el 3-2-2-3 alemán que dominó la última década.",
        slots: [
            slot("ei1", "EI", 14, 16),
            slot("dc1", "DC", 50, 12),
            slot("ed1", "ED", 86, 16),
            slot("mco1", "MCO", 28, 32),
            slot("mco2", "MCO", 72, 32),
            slot("mcd1", "MCD", 38, 48),
            slot("mcd2", "MCD", 62, 48),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("por1", "POR", 50, 89),
        ],
    },
    "3-4-2-1": {
        code: "3-4-2-1",
        label: "3-4-2-1",
        shape: "Bloque medio",
        description: "Carrileros que dan el ancho, dos mediapuntas entre líneas y una referencia única arriba.",
        slots: [
            slot("mco1", "MCO", 30, 30),
            slot("mco2", "MCO", 70, 30),
            slot("li1", "LI", 10, 46),
            slot("mcd1", "MCD", 36, 50),
            slot("mc1", "MC", 64, 50),
            slot("ld1", "LD", 90, 46),
            slot("dc1", "DC", 50, 12),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("por1", "POR", 50, 89),
        ],
    },
    "3-4-3": {
        code: "3-4-3",
        label: "3-4-3",
        shape: "Atrevida",
        description: "Línea de tres atrás y medio campo abierto: máxima amplitud con carrileros largos.",
        slots: [
            slot("ei1", "EI", 16, 16),
            slot("dc1", "DC", 50, 12),
            slot("ed1", "ED", 84, 16),
            slot("li1", "LI", 10, 46),
            slot("mcd1", "MCD", 36, 50),
            slot("mc1", "MC", 64, 50),
            slot("ld1", "LD", 90, 46),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-1-2-1-2": {
        code: "4-1-2-1-2",
        label: "4-1-2-1-2",
        shape: "Rombo",
        description: "El rombo clásico: pivote único, interiores abiertos y una dupla letal en el área.",
        slots: [
            slot("dc1", "DC", 36, 14),
            slot("dc2", "DC", 64, 14),
            slot("mco1", "MCO", 50, 30),
            slot("mc1", "MC", 26, 38),
            slot("mc2", "MC", 74, 38),
            slot("mcd1", "MCD", 50, 52),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-1-3-2": {
        code: "4-1-3-2",
        label: "4-1-3-2",
        shape: "Progresión",
        description: "Pivote único que arma desde atrás, tres creativos entre líneas y dos puntas móviles.",
        slots: [
            slot("dc1", "DC", 36, 13),
            slot("dc2", "DC", 64, 13),
            slot("ei1", "EI", 16, 30),
            slot("mco1", "MCO", 50, 30),
            slot("ed1", "ED", 84, 30),
            slot("mcd1", "MCD", 50, 50),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-2-1-3": {
        code: "4-2-1-3",
        label: "4-2-1-3",
        shape: "Vertical",
        description: "Doble pivote que protege, un enganche que conecta y un tridente que ataca en vertical.",
        slots: [
            slot("ei1", "EI", 16, 15),
            slot("dc1", "DC", 50, 12),
            slot("ed1", "ED", 84, 15),
            slot("mco1", "MCO", 50, 32),
            slot("mcd1", "MCD", 36, 48),
            slot("mcd2", "MCD", 64, 48),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-2-2-2": {
        code: "4-2-2-2",
        label: "4-2-2-2",
        shape: "Ancha",
        description: "Doble pivote y dos interiores anchos que asisten a una dupla de ataque permanente.",
        slots: [
            slot("dc1", "DC", 36, 13),
            slot("dc2", "DC", 64, 13),
            slot("ei1", "EI", 24, 30),
            slot("ed1", "ED", 76, 30),
            slot("mcd1", "MCD", 36, 50),
            slot("mcd2", "MCD", 64, 50),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-2-4": {
        code: "4-2-4",
        label: "4-2-4",
        shape: "Locura ofensiva",
        description: "Cuatro delanteros sobre un doble pivote: la apuesta extrema para remontar eliminatorias.",
        slots: [
            slot("ei1", "EI", 14, 18),
            slot("dc1", "DC", 38, 12),
            slot("dc2", "DC", 62, 12),
            slot("ed1", "ED", 86, 18),
            slot("mcd1", "MCD", 36, 50),
            slot("mcd2", "MCD", 64, 50),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-3-1-2": {
        code: "4-3-1-2",
        label: "4-3-1-2",
        shape: "Compacta central",
        description: "Trivote, un enganche entre líneas y dos puntas: todo el juego pasa por el centro.",
        slots: [
            slot("dc1", "DC", 36, 14),
            slot("dc2", "DC", 64, 14),
            slot("mco1", "MCO", 50, 32),
            slot("mcd1", "MCD", 30, 48),
            slot("mc1", "MC", 50, 52),
            slot("mc2", "MC", 70, 48),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-3-2-1": {
        code: "4-3-2-1",
        label: "4-3-2-1",
        shape: "Navaja",
        description: "La navaja clásica: trivote sólido, dos enganches cerrados y un nueve solitario de referencia.",
        slots: [
            slot("dc1", "DC", 50, 12),
            slot("mco1", "MCO", 28, 28),
            slot("mco2", "MCO", 72, 28),
            slot("mcd1", "MCD", 30, 48),
            slot("mc1", "MC", 50, 52),
            slot("mc2", "MC", 70, 48),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-2-3-1": {
        code: "4-2-3-1",
        label: "4-2-3-1",
        shape: "Equilibrada",
        description: "Doble pivote, mediapunta creativo y dos extremos. La formación del control total.",
        slots: [
            slot("dc1", "DC", 50, 13),
            slot("ei1", "EI", 17, 28),
            slot("mco1", "MCO", 50, 29),
            slot("ed1", "ED", 83, 28),
            slot("mcd1", "MCD", 36, 46),
            slot("mcd2", "MCD", 64, 46),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-3-3": {
        code: "4-3-3",
        label: "4-3-3",
        shape: "Ofensiva",
        description: "Interiores en el medio y tridente arriba. Máxima presión sobre el rival.",
        slots: [
            slot("ei1", "EI", 17, 16),
            slot("dc1", "DC", 50, 12),
            slot("ed1", "ED", 83, 16),
            slot("mc1", "MC", 26, 44),
            slot("mcd1", "MCD", 50, 48),
            slot("mc2", "MC", 74, 44),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-3-3 (2)": {
        code: "4-3-3 (2)",
        label: "4-3-3 (2)",
        shape: "Falso 9",
        description: "La variante del falso nueve: el mediapunta se repliega y abre pasillos para los extremos.",
        slots: [
            slot("ei1", "EI", 16, 15),
            slot("ed1", "ED", 84, 15),
            slot("mco1", "MCO", 50, 34),
            slot("mcd1", "MCD", 28, 48),
            slot("mc1", "MC", 50, 54),
            slot("mc2", "MC", 72, 48),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-4-1-1": {
        code: "4-4-1-1",
        label: "4-4-1-1",
        shape: "Contraataque",
        description: "Bloque de cuatro en el medio, un diez de apoyo y una referencia: la formación del contraataque.",
        slots: [
            slot("dc1", "DC", 50, 12),
            slot("mco1", "MCO", 50, 26),
            slot("ei1", "EI", 13, 44),
            slot("mc1", "MC", 38, 50),
            slot("mc2", "MC", 62, 50),
            slot("ed1", "ED", 87, 44),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-4-2": {
        code: "4-4-2",
        label: "4-4-2",
        shape: "Clásica",
        description: "Bloque de cuatro en el medio y dos delanteros. Orden y segunda jugada.",
        slots: [
            slot("dc1", "DC", 36, 14),
            slot("dc2", "DC", 64, 14),
            slot("ei1", "EI", 13, 42),
            slot("mc1", "MC", 38, 44),
            slot("mc2", "MC", 62, 44),
            slot("ed1", "ED", 87, 42),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "3-5-2": {
        code: "3-5-2",
        label: "3-5-2",
        shape: "Carrileros",
        description: "Tres centrales, carrileros largos y dos puntas. Dominio del ancho del campo.",
        slots: [
            slot("dc1", "DC", 36, 14),
            slot("dc2", "DC", 64, 14),
            slot("mc1", "MC", 30, 40),
            slot("mcd1", "MCD", 50, 48),
            slot("mc2", "MC", 70, 40),
            slot("li1", "LI", 9, 52),
            slot("ld1", "LD", 91, 52),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("por1", "POR", 50, 89),
        ],
    },
    "4-5-1": {
        code: "4-5-1",
        label: "4-5-1",
        shape: "Muro de medio campo",
        description: "Cuatro defensas y cinco medios para ahogar el centro: la pared que enfrente le sobra espacio.",
        slots: [
            slot("dc1", "DC", 50, 13),
            slot("ei1", "EI", 13, 40),
            slot("mc1", "MC", 32, 46),
            slot("mco1", "MCO", 50, 38),
            slot("mc2", "MC", 68, 46),
            slot("ed1", "ED", 87, 40),
            slot("li1", "LI", 11, 66),
            slot("dfc1", "DFC", 34, 64),
            slot("dfc2", "DFC", 66, 64),
            slot("ld1", "LD", 89, 66),
            slot("por1", "POR", 50, 89),
        ],
    },
    "5-1-2-1-2": {
        code: "5-1-2-1-2",
        label: "5-1-2-1-2",
        shape: "Carrileros densos",
        description: "Cinco atrás con carrileros, pivote único, dos interiores y un enganche detrás de la dupla.",
        slots: [
            slot("dc1", "DC", 36, 12),
            slot("dc2", "DC", 64, 12),
            slot("mco1", "MCO", 50, 28),
            slot("mc1", "MC", 28, 38),
            slot("mc2", "MC", 72, 38),
            slot("mcd1", "MCD", 50, 54),
            slot("li1", "LI", 10, 58),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("ld1", "LD", 90, 58),
            slot("por1", "POR", 50, 89),
        ],
    },
    "5-2-1-2": {
        code: "5-2-1-2",
        label: "5-2-1-2",
        shape: "Bloque bajo",
        description: "Bloque bajo de cinco, doble pivote, un enganche y dos puntas para salir al contragolpe.",
        slots: [
            slot("dc1", "DC", 36, 13),
            slot("dc2", "DC", 64, 13),
            slot("mco1", "MCO", 50, 32),
            slot("mcd1", "MCD", 36, 50),
            slot("mcd2", "MCD", 64, 50),
            slot("li1", "LI", 10, 58),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("ld1", "LD", 90, 58),
            slot("por1", "POR", 50, 89),
        ],
    },
    "5-2-3": {
        code: "5-2-3",
        label: "5-2-3",
        shape: "Contragolpe",
        description: "Línea de cinco, doble pivote y tridente veloz para atacar en transición.",
        slots: [
            slot("ei1", "EI", 18, 18),
            slot("dc1", "DC", 50, 13),
            slot("ed1", "ED", 82, 18),
            slot("mcd1", "MCD", 36, 44),
            slot("mcd2", "MCD", 64, 44),
            slot("li1", "LI", 9, 62),
            slot("dfc1", "DFC", 28, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 72, 70),
            slot("ld1", "LD", 91, 62),
            slot("por1", "POR", 50, 89),
        ],
    },
    "5-3-2": {
        code: "5-3-2",
        label: "5-3-2",
        shape: "Cerrado",
        description: "Cinco atrás y un trivote que tapona el centro: la formación del resultado agónico.",
        slots: [
            slot("dc1", "DC", 36, 14),
            slot("dc2", "DC", 64, 14),
            slot("mcd1", "MCD", 28, 44),
            slot("mc1", "MC", 50, 48),
            slot("mc2", "MC", 72, 44),
            slot("li1", "LI", 10, 58),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("ld1", "LD", 90, 58),
            slot("por1", "POR", 50, 89),
        ],
    },
    "5-4-1": {
        code: "5-4-1",
        label: "5-4-1",
        shape: "Repliegue",
        description: "Cinco atrás, línea de cuatro y un nueve aislado: repliegue total para aguantar ventajas.",
        slots: [
            slot("dc1", "DC", 50, 12),
            slot("ei1", "EI", 14, 36),
            slot("mc1", "MC", 38, 44),
            slot("mc2", "MC", 62, 44),
            slot("ed1", "ED", 86, 36),
            slot("li1", "LI", 10, 58),
            slot("dfc1", "DFC", 26, 70),
            slot("dfc2", "DFC", 50, 72),
            slot("dfc3", "DFC", 74, 70),
            slot("ld1", "LD", 90, 58),
            slot("por1", "POR", 50, 89),
        ],
    },
};
/** Todas las formaciones del FC 27, en el orden del menú de tácticas del juego. */
export const FORMATION_CODES = [
    "3-2-2-3",
    "3-4-2-1",
    "3-4-3",
    "3-5-2",
    "4-1-2-1-2",
    "4-1-3-2",
    "4-2-1-3",
    "4-2-2-2",
    "4-2-3-1",
    "4-2-4",
    "4-3-1-2",
    "4-3-2-1",
    "4-3-3",
    "4-3-3 (2)",
    "4-4-1-1",
    "4-4-2",
    "4-5-1",
    "5-1-2-1-2",
    "5-2-1-2",
    "5-2-3",
    "5-3-2",
    "5-4-1",
];
/** Formation every new squad starts with. */
export const DEFAULT_FORMATION = "4-2-3-1";
export function isFormationCode(value) {
    return value in FORMATIONS;
}
export function emptyLineup(formation) {
    return {
        formation,
        slots: FORMATIONS[formation].slots.map((s) => ({
            slotId: s.id,
            playerId: null,
        })),
    };
}
/**
 * Greedy solver shared by "automatic XI" and formation switching.
 *
 * - Scarcest slot first, so a slot with two candidates is filled before one with
 *   six and never gets starved by a greedy decision elsewhere.
 * - Only position-accepted players are assigned: the engine never produces an
 *   illegal XI, it leaves the slot empty for the President to decide.
 * - `isIncumbent` keeps the current starters when the President changes shape.
 */
function greedyAssign(squad, slots, isIncumbent) {
    const used = new Set();
    const assignments = new Map();
    const score = (player) => (isIncumbent(player.playerId) ? 100 : 0) + player.ovr;
    const candidatesFor = (slot) => squad.filter((player) => !used.has(player.playerId) && slot.accepts.includes(player.position));
    const pending = [...slots];
    while (pending.length > 0) {
        let chosen = null;
        let bestScarcity = Number.POSITIVE_INFINITY;
        for (const slot of pending) {
            const candidates = candidatesFor(slot);
            if (candidates.length === 0 || candidates.length >= bestScarcity)
                continue;
            bestScarcity = candidates.length;
            chosen = {
                slot,
                player: [...candidates].sort((a, b) => score(b) - score(a))[0],
            };
        }
        if (!chosen)
            break;
        used.add(chosen.player.playerId);
        assignments.set(chosen.slot.id, chosen.player.playerId);
        pending.splice(pending.indexOf(chosen.slot), 1);
    }
    return assignments;
}
function buildLineup(formation, assignments) {
    return {
        formation,
        slots: FORMATIONS[formation].slots.map((slot) => ({
            slotId: slot.id,
            playerId: assignments.get(slot.id) ?? null,
        })),
    };
}
/** Best legal XI available in the squad. */
export function autoLineup(squad, formation) {
    return buildLineup(formation, greedyAssign(squad, FORMATIONS[formation].slots, () => false));
}
/** Keeps the current starters when the President switches formation. */
export function remapLineup(squad, formation, current) {
    const incumbents = new Set(current.slots.map((slot) => slot.playerId).filter((id) => Boolean(id)));
    return buildLineup(formation, greedyAssign(squad, FORMATIONS[formation].slots, (id) => incumbents.has(id)));
}
export function evaluateLineup(rules, squad, lineup, squadEvaluation, 
/** País del club presidido, para la regla de nacionalidad del club (R-14). */
clubCountry) {
    const def = FORMATIONS[lineup.formation];
    const bySlot = new Map(lineup.slots.map((s) => [s.slotId, s.playerId]));
    const starters = [];
    const errors = [];
    const checks = [];
    for (const s of def.slots) {
        const playerId = bySlot.get(s.id);
        if (!playerId)
            continue;
        const player = squad.find((p) => p.playerId === playerId);
        if (!player)
            continue;
        starters.push(player);
        if (!s.accepts.includes(player.position)) {
            errors.push(`${player.name} (${player.position}) no puede ocupar la posición ${s.label} de la formación ${def.label}.`);
        }
    }
    const ids = lineup.slots
        .map((s) => s.playerId)
        .filter((id) => Boolean(id));
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    checks.push({
        id: "lineup-count",
        ruleRef: "Alineación · Once titular",
        label: "Titulares",
        value: `${starters.length} / 11`,
        passed: starters.length === 11,
        detail: starters.length === 11
            ? "Tienes los 11 titulares asignados."
            : `Faltan ${11 - starters.length} jugadores para completar el once.`,
        action: { label: "Completar once", to: "/dashboard/formacion" },
    });
    checks.push({
        id: "lineup-duplicates",
        ruleRef: "Alineación · Sin duplicados",
        label: "Jugadores repetidos",
        value: `${duplicated.length}`,
        passed: duplicated.length === 0,
        detail: duplicated.length === 0
            ? "Ningún jugador aparece dos veces en el once."
            : "Un jugador no puede ocupar dos posiciones al mismo tiempo. Selecciona la posición y cámbialo.",
    });
    checks.push({
        id: "lineup-positions",
        ruleRef: "Alineación · Posición natural",
        label: "Posiciones compatibles",
        value: errors.length === 0 ? "OK" : `${errors.length} error(es)`,
        passed: errors.length === 0,
        detail: errors.length === 0
            ? `Cada jugador ocupa una posición válida dentro del ${def.label}.`
            : errors[0],
    });
    const squadEval = squadEvaluation ?? evaluateSquadRules(rules, squad, rules.budget);
    checks.push({
        id: "lineup-rules",
        ruleRef: "Reglas del torneo",
        label: "Reglas del torneo",
        value: squadEval.passed ? "Cumple" : `${squadEval.violations.length} alerta(s)`,
        passed: squadEval.passed,
        detail: squadEval.passed
            ? "La alineación respeta el reglamento del torneo."
            : squadEval.violations[0]?.detail ?? "",
        action: { label: "Ver reglas", to: "/dashboard/reglas" },
    });
    const starterIds = new Set(ids);
    const bench = squad.filter((p) => !starterIds.has(p.playerId));
    // Regla de sub-20 en el XI (R-11 aplicada a la alineación).
    const u20Starters = starters.filter((p) => p.age <= 20).length;
    checks.push({
        id: "lineup-u20",
        ruleRef: "R-11 · Sub-20 en el XI",
        label: "Sub-20 titulares",
        value: `${u20Starters} / ${rules.u20Min}`,
        passed: u20Starters >= rules.u20Min,
        detail: rules.u20Min === 0
            ? "El torneo no exige sub-20 en el once inicial."
            : u20Starters >= rules.u20Min
                ? `El once incluye ${u20Starters} jugador(es) de 20 años o menos: cumple el mínimo de ${rules.u20Min}.`
                : `El torneo exige ${rules.u20Min} sub-20 en el XI inicial y tienes ${u20Starters}. Necesitas alinear ${rules.u20Min - u20Starters} más para guardar.`,
        action: { label: "Ajustar once", to: "/dashboard/formacion" },
    });
    // Regla de nacionalidad del club en el XI (R-14): la nacionalidad debe
    // coincidir con el país del club presidido (club.country).
    const requiredNation = clubCountry?.trim() ?? "";
    if (requiredNation && rules.clubNationalityMin > 0) {
        const nationStarters = starters.filter((p) => p.nationality.trim().toLowerCase() === requiredNation.toLowerCase()).length;
        checks.push({
            id: "lineup-club-nation",
            ruleRef: "R-14 · Nacionalidad del club",
            label: `Jugadores de ${requiredNation}`,
            value: `${nationStarters} / ${rules.clubNationalityMin}`,
            passed: nationStarters >= rules.clubNationalityMin,
            detail: nationStarters >= rules.clubNationalityMin
                ? `El XI incluye ${nationStarters} jugador(es) de ${requiredNation}: cumple el mínimo de ${rules.clubNationalityMin}.`
                : `El torneo exige ${rules.clubNationalityMin} jugador(es) de ${requiredNation} (nacionalidad del club) en el XI inicial y tienes ${nationStarters}.`,
            action: { label: "Ajustar once", to: "/dashboard/formacion" },
        });
    }
    return {
        checks,
        errors,
        valid: checks.every((c) => c.passed),
        lineup,
        starters,
        bench,
    };
}
/** Order of a lineup as a readable string: "POR · LI DFC DFC LD · ..." */
export function lineupShape(formation) {
    return FORMATIONS[formation].label;
}
/* ------------------------------------------------------------------ *
 * Formatting helpers (shared by server and client)
 * ------------------------------------------------------------------ */
export function formatMoney(value) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1000000000)
        return `${sign}€${(abs / 1000000000).toFixed(2)}B`;
    if (abs >= 1000000)
        return `${sign}€${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000)
        return `${sign}€${Math.round(abs / 1000)}K`;
    return `${sign}€${Math.round(abs)}`;
}
export function formatNumber(value, digits = 1) {
    return value.toFixed(digits);
}
/** "02:14:32" — used in the deadline center. */
export function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return [hours, minutes, seconds]
        .map((n) => String(n).padStart(2, "0"))
        .join(":");
}
/** "12h 34m" — calmer, for secondary deadlines. */
export function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0)
        return `${days}d ${hours}h`;
    if (hours > 0)
        return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
export const FC_VERSION = "FC 27 · Snapshot 10/09/2026";
/** Players with no club in the snapshot: the free-agent pool of the tournament. */
export const FREE_AGENT_CLUB = "Agente libre";
/* ------------------------------------------------------------------ *
 * Tournament state machine
 * ------------------------------------------------------------------ */
export const TOURNAMENT_STATUSES = [
    "configuracion",
    "inscripciones",
    "seleccion_clubes",
    "pre_draft",
    "negociaciones",
    "draft_abierto",
    "draft_en_curso",
    "draft_cerrado",
    "plantillas_bloqueadas",
    "competicion",
    "cierre_jornada",
    "suspendido",
    "cancelado",
];
export const TOURNAMENT_STATUS_META = {
    configuracion: {
        label: "Configuración",
        tone: "progress",
        className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
        dotClassName: "bg-slate-500",
        hint: "Administración está definiendo reglas y calendario.",
    },
    inscripciones: {
        label: "Inscripciones",
        tone: "open",
        className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        dotClassName: "bg-sky-500",
        hint: "Los Presidentes pueden unirse al torneo.",
    },
    seleccion_clubes: {
        label: "Selección de clubes",
        tone: "open",
        className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        dotClassName: "bg-sky-500",
        hint: "Es el momento de elegir el club que vas a presidir.",
    },
    pre_draft: {
        label: "Pre-draft",
        tone: "progress",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        dotClassName: "bg-amber-500",
        hint: "Mercado en preparación. Aún no se ejecutan operaciones.",
    },
    negociaciones: {
        label: "Negociaciones",
        tone: "open",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dotClassName: "bg-emerald-500",
        hint: "Puedes negociar y dejar acuerdos reservados para el draft.",
    },
    draft_abierto: {
        label: "Draft abierto",
        tone: "open",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dotClassName: "bg-emerald-500",
        hint: "El draft está abierto: las operaciones aceptadas se ejecutan.",
    },
    draft_en_curso: {
        label: "Draft en curso",
        tone: "open",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dotClassName: "bg-emerald-500 animate-pulse",
        hint: "Turnos activos. Cada adquisición se refleja en tiempo real.",
    },
    draft_cerrado: {
        label: "Draft cerrado",
        tone: "locked",
        className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
        dotClassName: "bg-slate-500",
        hint: "No se admiten nuevas incorporaciones en esta fase.",
    },
    plantillas_bloqueadas: {
        label: "Plantillas bloqueadas",
        tone: "locked",
        className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
        dotClassName: "bg-slate-500",
        hint: "Solo puedes ajustar alineación y táctica.",
    },
    competicion: {
        label: "Competición",
        tone: "open",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dotClassName: "bg-emerald-500",
        hint: "La liga está en juego. Fija tu once antes del cierre.",
    },
    cierre_jornada: {
        label: "Cierre de jornada",
        tone: "progress",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        dotClassName: "bg-amber-500",
        hint: "Administración está validando resultados de la jornada.",
    },
    suspendido: {
        label: "Suspendido",
        tone: "blocked",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        dotClassName: "bg-rose-500",
        hint: "El torneo está en pausa. Ninguna operación se ejecuta.",
    },
    cancelado: {
        label: "Cancelado",
        tone: "blocked",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        dotClassName: "bg-rose-500",
        hint: "El torneo fue cancelado por Administración.",
    },
};
