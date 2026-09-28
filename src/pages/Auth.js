import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot, } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { BrandLockup } from "@/components/eleven/Brand";
import { ArrowRight, Loader2, Mail, ShieldCheck, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
function resolveRedirectAfterAuth(returnTo, fallback = "/dashboard") {
    if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
        return returnTo;
    }
    return fallback;
}
function Auth({ redirectAfterAuth } = {}) {
    const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
    const [step, setStep] = useState("signIn");
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            navigate(redirect);
        }
    }, [authLoading, isAuthenticated, navigate, redirect]);
    const handleEmailSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const formData = new FormData(event.currentTarget);
            await signIn("email-otp", formData);
            setStep({ email: formData.get("email") });
            setIsLoading(false);
        }
        catch (error) {
            console.error("Email sign-in error:", error);
            setError(error instanceof Error
                ? error.message
                : "No se pudo enviar el código de verificación. Inténtalo de nuevo.");
            setIsLoading(false);
        }
    };
    const handleOtpSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const formData = new FormData(event.currentTarget);
            await signIn("email-otp", formData);
            navigate(redirect);
        }
        catch (error) {
            console.error("OTP verification error:", error);
            setError("El código de verificación no es correcto. Vuelve a intentarlo.");
            setIsLoading(false);
            setOtp("");
        }
    };
    const handleGuestLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signIn("anonymous");
            navigate(redirect);
        }
        catch (error) {
            console.error("Guest login error:", error);
            setError(`No se pudo entrar como invitado: ${error instanceof Error ? error.message : "error desconocido"}`);
            setIsLoading(false);
        }
    };
    return (_jsxs("div", { className: "rail-surface relative flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white", children: [_jsx("div", { "aria-hidden": "true", className: "pointer-events-none absolute inset-0 opacity-60", style: {
                    backgroundImage: "radial-gradient(50% 45% at 20% 5%, rgba(47,107,255,0.35) 0%, transparent 62%), radial-gradient(40% 40% at 85% 15%, rgba(31,157,85,0.28) 0%, transparent 65%)",
                } }), _jsxs("div", { className: "relative flex w-full max-w-md flex-col items-center gap-6", children: [_jsx("button", { type: "button", onClick: () => navigate("/"), className: "rounded-xl", "aria-label": "Volver al inicio", children: _jsx(BrandLockup, {}) }), _jsxs(Card, { className: "w-full border-white/10 bg-card pb-0 shadow-2xl", children: [step === "signIn" ? (_jsxs(_Fragment, { children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx(CardTitle, { className: "display text-xl", children: "Entra al centro de control" }), _jsx(CardDescription, { children: "Escribe tu correo: te enviamos un c\u00F3digo para entrar o crear tu cuenta." })] }), _jsx("form", { onSubmit: handleEmailSubmit, children: _jsxs(CardContent, { children: [_jsxs("div", { className: "relative flex items-center gap-2", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Mail, { className: "absolute left-3 top-3.5 h-4 w-4 text-muted-foreground", "aria-hidden": "true" }), _jsx(Input, { name: "email", placeholder: "presidente@correo.com", type: "email", "aria-label": "Correo electr\u00F3nico", className: "h-11 pl-9", disabled: isLoading, required: true })] }), _jsx(Button, { type: "submit", variant: "outline", size: "icon", className: "size-11", disabled: isLoading, "aria-label": "Enviar c\u00F3digo de acceso", children: isLoading ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : (_jsx(ArrowRight, { className: "h-4 w-4" })) })] }), error && (_jsx("p", { role: "alert", className: "mt-3 text-sm text-destructive", children: error })), _jsxs("div", { className: "mt-5", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("span", { className: "w-full border-t" }) }), _jsx("div", { className: "relative flex justify-center text-xs uppercase", children: _jsx("span", { className: "bg-card px-2 text-muted-foreground", children: "o" }) })] }), _jsxs(Button, { type: "button", variant: "outline", className: "mt-4 min-h-11 w-full", onClick: handleGuestLogin, disabled: isLoading, children: [_jsx(UserX, { className: "mr-2 h-4 w-4", "aria-hidden": "true" }), "Entrar como invitado"] }), _jsx("p", { className: "mt-2 text-center text-[11px] leading-relaxed text-muted-foreground", children: "El acceso como invitado crea una cuenta temporal para explorar el torneo." })] })] }) })] })) : (_jsxs(_Fragment, { children: [_jsxs(CardHeader, { className: "mt-2 text-center", children: [_jsx(CardTitle, { className: "display text-lg", children: "Revisa tu correo" }), _jsxs(CardDescription, { children: ["Hemos enviado un c\u00F3digo a ", step.email] })] }), _jsxs("form", { onSubmit: handleOtpSubmit, children: [_jsxs(CardContent, { className: "pb-4", children: [_jsx("input", { type: "hidden", name: "email", value: step.email }), _jsx("input", { type: "hidden", name: "code", value: otp }), _jsx("div", { className: "flex justify-center", children: _jsx(InputOTP, { value: otp, onChange: setOtp, maxLength: 6, disabled: isLoading, onKeyDown: (e) => {
                                                                if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                                                                    const form = e.target.closest("form");
                                                                    if (form)
                                                                        form.requestSubmit();
                                                                }
                                                            }, children: _jsx(InputOTPGroup, { children: Array.from({ length: 6 }).map((_, index) => (_jsx(InputOTPSlot, { index: index }, index))) }) }) }), error && (_jsx("p", { role: "alert", className: "mt-3 text-center text-sm text-destructive", children: error })), _jsxs("p", { className: "mt-4 text-center text-sm text-muted-foreground", children: ["\u00BFNo recibiste el c\u00F3digo?", " ", _jsx(Button, { variant: "link", className: "h-auto p-0", onClick: () => setStep("signIn"), children: "Probar con otro correo" })] })] }), _jsxs(CardFooter, { className: "flex-col gap-2", children: [_jsx(Button, { type: "submit", className: "min-h-11 w-full", disabled: isLoading || otp.length !== 6, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Verificando\u2026"] })) : (_jsxs(_Fragment, { children: ["Verificar c\u00F3digo", _jsx(ArrowRight, { className: "ml-2 h-4 w-4", "aria-hidden": "true" })] })) }), _jsx(Button, { type: "button", variant: "ghost", onClick: () => setStep("signIn"), disabled: isLoading, className: "min-h-11 w-full", children: "Usar otro correo" })] })] })] })), _jsxs("div", { className: "flex items-center justify-center gap-1.5 rounded-b-lg border-t bg-muted px-6 py-4 text-xs text-muted-foreground", children: [_jsx(ShieldCheck, { className: "size-3.5", "aria-hidden": "true" }), "Sesi\u00F3n protegida por", " ", _jsx("a", { href: "https://freebuff.com", target: "_blank", rel: "noopener noreferrer", className: "underline transition-colors hover:text-primary", children: "freebuff.com" })] })] }), _jsx("p", { className: "max-w-sm text-center text-[11px] leading-relaxed text-white/55", children: "Al entrar aceptas el reglamento del torneo. Tus operaciones quedan registradas en la auditor\u00EDa con tu nombre y tu nickname." })] })] }));
}
export default function AuthPage(props) {
    return (_jsx(Suspense, { children: _jsx(Auth, { ...props }) }));
}
