import { useEffect, useState } from "react";
import { rpc } from "@/infrastructure/supabase/client";
export type DepartureBid = {
  playerId: string;
  ownerIsMe: boolean;
  closed: boolean;
  count: number;
  highestCash: number | null;
  myCash: number | null;
  offers: {
    id: string;
    club: string;
    cash: number;
    status: string;
    package: boolean;
    requested: string[];
    offered: string[];
  }[];
};
export const bidMoney = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
export function useDepartureBids(revision = 0) {
  const [bids, setBids] = useState<DepartureBid[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await rpc<DepartureBid[]>("departure_bids");
        if (!Array.isArray(data))
          throw new Error("No se pudo consultar el estado de las pujas.");
        if (active) {
          setBids(data);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar las pujas.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    window.addEventListener("eleven:departure-bids", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("eleven:departure-bids", load);
    };
  }, [revision]);
  return { bids, error, loading };
}
