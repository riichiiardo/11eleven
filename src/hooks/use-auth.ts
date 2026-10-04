import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@/convex-compat/react";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const {
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    isRecovery,
    signOut,
  } = useAuthActions();

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    isRecovery,
    signOut,
  };
}
