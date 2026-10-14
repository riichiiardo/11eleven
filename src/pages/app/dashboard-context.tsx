import { createContext, useContext, type ReactNode } from "react";
import { useOutletContext } from "react-router";
import type { AppStateView } from "@/convex/appTypes";

const DashboardStateContext = createContext<AppStateView | null>(null);
export function DashboardStateProvider({ state, children }: { state: AppStateView; children: ReactNode }) {
  return <DashboardStateContext.Provider value={state}>{children}</DashboardStateContext.Provider>;
}
export function useDashboardState() {
  const provided = useContext(DashboardStateContext);
  const outletState = useOutletContext<AppStateView>();
  return provided ?? outletState ?? null;
}
