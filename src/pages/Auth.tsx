import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  supabaseConfigError,
  testSupabaseConnection,
} from "@/lib/supabase/client";
import { BrandLockup } from "@/components/eleven/Brand";
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const {
    isLoading: authLoading,
    isAuthenticated,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    isRecovery,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [mode, setMode] = useState<
    "signIn" | "signUp" | "reset" | "setPassword"
  >(isRecovery ? "setPassword" : "signIn");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    if (isRecovery) setMode("setPassword");
  }, [isRecovery]);

  useEffect(() => {
    let active = true;
    void testSupabaseConnection().then((result) => {
      if (active) setConnectionError(!result.ok);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && mode !== "setPassword") {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, mode, navigate, redirect]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      if (mode === "reset") {
        await requestPasswordReset(email);
        setMessage(
          "Si existe una cuenta con ese correo, recibirás un enlace para definir tu contraseña.",
        );
      } else if (mode === "setPassword") {
        if (password.length < 8)
          throw new Error("La contraseña debe tener al menos 8 caracteres.");
        await updatePassword(password);
        navigate(redirect);
      } else if (mode === "signUp") {
        if (password.length < 8)
          throw new Error("La contraseña debe tener al menos 8 caracteres.");
        await signUp({ email, password });
        setMessage(
          "Cuenta creada. Ya puedes entrar con tu correo y contraseña.",
        );
        setMode("signIn");
      } else {
        await signIn({ email, password });
        navigate(redirect);
      }
    } catch (cause) {
      const raw =
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la operación.";
      if (/invalid login credentials|invalid password/i.test(raw)) {
        setError(
          "El correo o la contraseña no son correctos. Si aún no tienes contraseña, usa «Definir contraseña».",
        );
      } else if (/already registered|already exists|user already/i.test(raw)) {
        setError(
          "Ya existe una cuenta con ese correo. Usa «Definir contraseña» si todavía no tienes una.",
        );
      } else {
        setError(raw);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isPasswordSetup = mode === "setPassword";
  const title = isPasswordSetup
    ? "Define tu contraseña"
    : mode === "reset"
      ? "Recupera tu acceso"
      : mode === "signUp"
        ? "Crea tu cuenta"
        : "Entra al centro de control";
  const description = isPasswordSetup
    ? "Crea una contraseña de al menos 8 caracteres para tus siguientes accesos."
    : mode === "reset"
      ? "Te enviaremos un enlace seguro para definir o cambiar tu contraseña."
      : mode === "signUp"
        ? "Registra tu correo y una contraseña para entrar al torneo."
        : "Ingresa con tu correo y contraseña.";

  return (
    <div className="rail-surface relative flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(50% 45% at 20% 5%, rgba(47,107,255,0.35) 0%, transparent 62%), radial-gradient(40% 40% at 85% 15%, rgba(31,157,85,0.28) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-xl"
          aria-label="Volver al inicio"
        >
          <BrandLockup />
        </button>

        {(supabaseConfigError || connectionError) && (
          <p
            role="status"
            className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-200"
          >
            El servicio de acceso no está disponible en este momento. Inténtalo
            de nuevo más tarde.
          </p>
        )}

        <Card className="w-full border-white/10 bg-card pb-0 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="display text-xl">
              {mode === "setPassword"
                ? "Define tu contraseña"
                : mode === "reset"
                  ? "Recupera tu acceso"
                  : mode === "signUp"
                    ? "Crea tu cuenta"
                    : "Entra al centro de control"}
            </CardTitle>
            <CardDescription>
              {mode === "setPassword"
                ? "Crea una contraseña de al menos 8 caracteres para tus siguientes accesos."
                : mode === "reset"
                  ? "Te enviaremos un enlace seguro para definir o cambiar tu contraseña."
                  : mode === "signUp"
                    ? "Registra tu correo y una contraseña para entrar al torneo."
                    : "Ingresa con tu correo y contraseña."}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {mode !== "setPassword" && (
                <Input
                  name="email"
                  placeholder="presidente@correo.com"
                  type="email"
                  aria-label="Correo electrónico"
                  autoComplete="email"
                  disabled={isLoading}
                  required
                />
              )}
              {mode !== "reset" && (
                <div className="relative">
                  <KeyRound
                    className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    name="password"
                    placeholder="Contraseña (mínimo 8 caracteres)"
                    type="password"
                    aria-label="Contraseña"
                    autoComplete={
                      mode === "signUp" || mode === "setPassword"
                        ? "new-password"
                        : "current-password"
                    }
                    className="h-11 pl-9"
                    disabled={isLoading}
                    minLength={8}
                    required
                  />
                </div>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="text-sm text-emerald-600">
                  {message}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {mode === "setPassword"
                  ? "Guardar contraseña"
                  : mode === "reset"
                    ? "Enviar enlace"
                    : mode === "signUp"
                      ? "Crear cuenta"
                      : "Entrar"}
              </Button>
              {mode === "signIn" && (
                <>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                    }}
                  >
                    Definir contraseña / recuperar acceso
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10 w-full"
                    onClick={() => {
                      setMode("signUp");
                      setError(null);
                    }}
                  >
                    Crear una cuenta nueva
                  </Button>
                </>
              )}
              {mode !== "signIn" && mode !== "setPassword" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 w-full"
                  onClick={() => {
                    setMode("signIn");
                    setError(null);
                  }}
                >
                  Volver a iniciar sesión
                </Button>
              )}
            </CardFooter>
          </form>

          <div className="flex items-center justify-center gap-1.5 rounded-b-lg border-t bg-muted px-6 py-4 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Sesión protegida por{" "}
            <a
              href="https://freebuff.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-primary"
            >
              freebuff.com
            </a>
          </div>
        </Card>

        <p className="max-w-sm text-center text-[11px] leading-relaxed text-white/55">
          Al entrar aceptas el reglamento del torneo. Tus operaciones quedan
          registradas en la auditoría con tu nombre y tu nickname.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
