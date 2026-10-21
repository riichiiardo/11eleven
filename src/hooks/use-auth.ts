import { api } from "@/services/backend/api";
import { useAuthActions } from "@/services/backend/react";
import { useBackendAuth, useQuery } from "@/services/backend/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useBackendAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signUp, signOut } = useAuthActions();

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signUp,
    signOut,
  };
}
