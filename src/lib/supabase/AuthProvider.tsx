import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, type DbProfile } from "@/lib/supabase/client";

/**
 * 11Eleven — Auth con Supabase (reemplaza Convex Auth).
 *
 * Mantiene la misma superficie que el hook anterior (`useAuth`): isLoading,
 * isAuthenticated, user, signIn, signUp, signOut. La autenticación usa
 * exclusivamente correo y contraseña; la recuperación usa el enlace seguro
 * de Supabase para que un usuario existente pueda definir su contraseña.
 */

export type AppUser = {
  id: string;
  name: string;
  email: string;
  nickname: string;
  image: string | null;
};

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AppUser | null;
  profile: DbProfile | null;
  signIn: (credentials: { email: string; password?: string }) => Promise<void>;
  signUp: (credentials: { email: string; password: string }) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  isRecovery: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] =
    useState<
      Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    >(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setIsRecovery(event === "PASSWORD_RECOVERY");
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Perfil: una sola lectura por sesión (el perfil no cambia con frecuencia).
  useEffect(() => {
    let active = true;
    if (!session?.user) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile((data as DbProfile) ?? null);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(() => {
    const u = session?.user;
    return {
      isLoading,
      isAuthenticated: Boolean(session),
      user: u
        ? {
            id: u.id,
            name: profile?.name ?? u.email?.split("@")[0] ?? "Usuario",
            email: u.email ?? "",
            nickname:
              profile?.nickname ??
              profile?.name ??
              u.email?.split("@")[0] ??
              "Presidente",
            image: profile?.image ?? null,
          }
        : null,
      profile,
      signIn: async ({ email, password }) => {
        if (!password) throw new Error("Escribe tu contraseña para continuar.");
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(error.message);
      },
      signUp: async ({ email, password }) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw new Error(error.message);
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(error.message);
      },
      isRecovery,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [session, profile, isLoading, isRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error(
      "useAuthContext debe usarse dentro de <SupabaseAuthProvider>.",
    );
  return ctx;
}

/** Firma idéntica al useAuth anterior para minimizar el diff en las páginas. */
export function useAuth() {
  return useAuthContext();
}
