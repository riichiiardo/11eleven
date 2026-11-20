/** The market status belongs to the squad assignment, not the catalog player. */
export function availabilityArgs(args: Record<string, unknown>) {
  const { squadPlayerId, availability } = args;
  if (
    typeof squadPlayerId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      squadPlayerId,
    )
  )
    throw new Error(
      "No se encontró la ficha del jugador en tu plantilla. Recarga la página y vuelve a intentarlo.",
    );
  if (
    typeof availability !== "string" ||
    !["transferible", "negociacion", "neutro", "intransferible"].includes(
      availability,
    )
  )
    throw new Error("Selecciona una situación de mercado válida.");
  return { p_squad_player_id: squadPlayerId, p_availability: availability };
}
