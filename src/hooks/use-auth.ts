import { useAuthActions, useBackendAuth } from "@/services/backend/react";

export function useAuth() {
  return { ...useBackendAuth(), ...useAuthActions() };
}
