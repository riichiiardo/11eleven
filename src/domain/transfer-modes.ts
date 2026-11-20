export const TRANSFER_MODES = {
  free: "Jugador libre",
  purchase: "Compra a otro equipo",
  exchange: "Intercambio 1 a 1",
  exchange_cash: "Intercambio 1 a 1 + dinero",
} as const;
export type TransferMode = keyof typeof TRANSFER_MODES;
export function transferMode(offer: {
  type: string;
  cash: number;
  sellerNickname: string | null;
}): TransferMode {
  return offer.type === "trade"
    ? offer.cash > 0
      ? "exchange_cash"
      : "exchange"
    : offer.sellerNickname === null
      ? "free"
      : "purchase";
}
