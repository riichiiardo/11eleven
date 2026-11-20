/** Legacy clients receive a known availability; new clients understand the sale marker. */
export function withSaleStatus<T>(value: T): T {
  if (
    value &&
    typeof value === "object" &&
    "saleStatus" in value &&
    value.saleStatus === "vendido" &&
    "soldToClubId" in value &&
    typeof value.soldToClubId === "string"
  )
    return { ...value, availability: "vendido" };
  return value;
}
export function withSaleSquad<T>(value: T): T {
  if (
    value &&
    typeof value === "object" &&
    "squad" in value &&
    Array.isArray(value.squad)
  )
    return { ...value, squad: value.squad.map(withSaleStatus) };
  return value;
}
export function withSaleMarket<T extends { players?: unknown }>(value: T): T {
  return Array.isArray(value.players)
    ? { ...value, players: value.players.map(withSaleStatus) }
    : value;
}
