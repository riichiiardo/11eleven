import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage, formatDate } from "@/lib/errors";
import { COACH_AVATARS } from "@/lib/coachAvatars";
import { fileToAvatarDataUrl } from "@/lib/images";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { useNavigate, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Crest } from "@/components/eleven/Crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, Crown, Loader2, LogOut, Shield, ShieldCheck, Upload, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
const PERMISSION_LABELS = {
    configuracion: "Configuración",
    presidentes: "Presidentes",
    jugadores: "Jugadores",
    mercado: "Mercado",
    draft: "Draft",
    calendario: "Calendario",
    noticias: "Noticias",
    ia: "IA / publicaciones",
    auditoria: "Auditoría",
};
export default function Profile() {
    const state = useOutletContext();
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const updateProfile = useMutation(api.tournament.updateProfile);
    const updateAvatar = useMutation(api.tournament.updateAvatar);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [brokenPhoto, setBrokenPhoto] = useState(null);
    const serverNickname = (state.president?.nickname ?? state.user.nickname).replace("@", "");
    const [nickname, setNickname] = useState(serverNickname);
    const [displayName, setDisplayName] = useState(state.user.name);
    const [saving, setSaving] = useState(false);
    // Adjust the form when the server profile changes, without an effect.
    const serverKey = `${serverNickname}|${state.user.name}`;
    const [draftKey, setDraftKey] = useState(serverKey);
    if (draftKey !== serverKey) {
        setDraftKey(serverKey);
        setNickname(serverNickname);
        setDisplayName(state.user.name);
    }
    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            await updateProfile({ nickname, displayName });
            toast.success("Perfil actualizado", {
                description: "Tu nombre público y tu nickname ya están visibles para el torneo.",
            });
        }
        catch (cause) {
            toast.error("No se pudo guardar el perfil", {
                description: errorMessage(cause),
            });
        }
        finally {
            setSaving(false);
        }
    };
    const handleSignOut = async () => {
        await signOut();
        navigate("/");
    };
    const photo = state.user.image;
    const initials = state.user.name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "P";
    const saveAvatar = async (image, description) => {
        setAvatarBusy(true);
        try {
            await updateAvatar({ image });
            setBrokenPhoto(null);
            toast.success("Foto de perfil actualizada", { description });
        }
        catch (cause) {
            toast.error("No se pudo actualizar la foto", {
                description: errorMessage(cause),
            });
        }
        finally {
            setAvatarBusy(false);
        }
    };
    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file)
            return;
        setAvatarBusy(true);
        try {
            const dataUrl = await fileToAvatarDataUrl(file);
            await saveAvatar(dataUrl, "Recortada a 320 px en tu dispositivo y guardada en tu cuenta.");
        }
        catch (cause) {
            toast.error("No se pudo usar esa imagen", {
                description: errorMessage(cause),
            });
            setAvatarBusy(false);
        }
    };
    const clearAvatar = async () => {
        setAvatarBusy(true);
        try {
            await updateAvatar({ image: undefined });
            setBrokenPhoto(null);
            toast.success("Foto eliminada", {
                description: "Vuelves a mostrar tus iniciales.",
            });
        }
        catch (cause) {
            toast.error("No se pudo quitar la foto", {
                description: errorMessage(cause),
            });
        }
        finally {
            setAvatarBusy(false);
        }
    };
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1100px] flex-col gap-5", children: [_jsxs("header", { children: [_jsx("h1", { className: "display text-2xl", children: "Perfil" }), _jsx("p", { className: "mt-1 max-w-3xl text-sm text-muted-foreground", children: "Tu cuenta es \u00FAnica; puedes presidir clubes distintos en torneos distintos con la misma cuenta y el mismo nickname." })] }), _jsxs("div", { className: "grid gap-5 lg:grid-cols-3", children: [_jsx(SectionCard, { title: "Cuenta", icon: User, className: "lg:col-span-2", bodyClassName: "p-4", children: _jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "displayName", children: "Nombre real" }), _jsx(Input, { id: "displayName", value: displayName, onChange: (event) => setDisplayName(event.target.value), className: "h-11", maxLength: 60, required: true }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: "Se usa en la auditor\u00EDa del torneo y en tu perfil de Presidente." })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "nickname", children: "Nickname p\u00FAblico" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-semibold text-muted-foreground", children: "@" }), _jsx(Input, { id: "nickname", value: nickname, onChange: (event) => setNickname(event.target.value), className: "h-11", minLength: 3, maxLength: 20, required: true })] }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: "As\u00ED te ven los dem\u00E1s Presidentes en el mercado y en las negociaciones." })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx(Button, { type: "submit", className: "min-h-11", disabled: saving, children: saving ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Guardando\u2026"] })) : ("Guardar cambios") }), _jsx("span", { className: "text-xs text-muted-foreground", children: state.user.email })] })] }) }), _jsx(SectionCard, { title: "Rol en el torneo", icon: ShieldCheck, children: _jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: "outline", className: "border-brand/30 bg-brand/10 text-primary", children: "Presidente" }), state.isAdmin ? (_jsxs(Badge, { variant: "outline", className: "border-gold/40 bg-gold/15 text-amber-700 dark:text-amber-300", children: [_jsx(Crown, { className: "size-3", "aria-hidden": "true" }), state.adminRole === "principal"
                                                    ? "Administrador principal"
                                                    : "Co-Administrador"] })) : null] }), _jsx("p", { className: "text-xs leading-relaxed text-muted-foreground", children: state.isAdmin
                                        ? "Tu cuenta acumula ambos roles: presides un club y además administras el torneo. Las acciones administrativas quedan registradas con tu nombre."
                                        : "Los roles administrativos son un permiso dentro del torneo, no una cuenta distinta: puedes ser Presidente y Administrador a la vez." }), state.isAdmin ? (_jsx("ul", { className: "flex flex-wrap gap-1.5", children: Object.entries(PERMISSION_LABELS).map(([key, label]) => (_jsx("li", { className: "rounded-md border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground", children: label }, key))) })) : null, _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: handleSignOut, children: [_jsx(LogOut, { className: "size-4", "aria-hidden": "true" }), "Cerrar sesi\u00F3n"] })] }) })] }), _jsxs(SectionCard, { title: "Foto de perfil", icon: Camera, bodyClassName: "flex flex-col gap-4", children: [_jsx("p", { className: "max-w-3xl text-sm text-muted-foreground", children: "Sube una foto desde tu dispositivo (se recorta sola a un c\u00EDrculo) o elige una de la galer\u00EDa de t\u00E9cnicos de f\u00FAtbol reales. La ver\u00E1s en tu perfil y en el men\u00FA de usuario." }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [photo && brokenPhoto !== photo ? (_jsx("img", { src: photo, alt: `Foto de ${state.user.name}`, onError: () => setBrokenPhoto(photo), className: "size-20 rounded-full object-cover ring-2 ring-gold/50" }, photo)) : (_jsx("span", { className: "display flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-brand to-navy text-xl font-bold text-white ring-2 ring-gold/50", children: initials })), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-2", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Formatos admitidos: JPG, PNG o WEBP. Las im\u00E1genes se procesan en tu navegador y solo se env\u00EDa la versi\u00F3n ya recortada de 320 px." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("label", { className: cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90", avatarBusy && "pointer-events-none opacity-60"), children: [_jsx(Upload, { className: "size-4", "aria-hidden": "true" }), "Subir desde mi dispositivo", _jsx("input", { type: "file", accept: "image/*", className: "sr-only", onChange: (event) => void handleFile(event), disabled: avatarBusy })] }), photo ? (_jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: avatarBusy, onClick: () => void clearAvatar(), children: [_jsx(X, { className: "size-4", "aria-hidden": "true" }), "Quitar foto"] })) : null, avatarBusy ? (_jsxs("span", { className: "inline-flex min-h-11 items-center gap-2 px-2 text-xs text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Guardando\u2026"] })) : null] })] })] }), _jsxs("fieldset", { className: "rounded-xl border p-3", children: [_jsx("legend", { className: "mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground", children: "Galer\u00EDa de t\u00E9cnicos reales" }), _jsx("ul", { className: "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6", children: COACH_AVATARS.map((coach) => {
                                    const selected = photo === coach.photo;
                                    const broken = brokenPhoto === coach.photo;
                                    return (_jsx("li", { children: _jsxs("button", { type: "button", disabled: avatarBusy, "aria-pressed": selected, title: `Usar la foto de ${coach.name}`, onClick: () => void saveAvatar(coach.photo, `Ahora usas la foto de ${coach.name} (Wikimedia Commons).`), className: cn("flex w-full flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors", selected
                                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                                : "hover:bg-accent"), children: [broken ? (_jsx("span", { className: "display flex size-12 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground", children: coach.name
                                                        .split(/\s+/)
                                                        .map((part) => part[0])
                                                        .slice(0, 2)
                                                        .join("") })) : (_jsx("img", { src: coach.photo, alt: coach.name, loading: "lazy", onError: () => setBrokenPhoto(coach.photo), className: "size-12 rounded-full bg-muted object-cover" })), _jsx("span", { className: "w-full truncate text-center text-[10px] font-semibold", children: coach.name })] }) }, coach.id));
                                }) }), _jsx("p", { className: "mt-2 text-[11px] leading-relaxed text-muted-foreground", children: "Fotos de Wikimedia Commons bajo licencias abiertas (CC BY / CC BY-SA / dominio p\u00FAblico). Si una imagen no carga, se muestran tus iniciales." })] })] }), state.club && state.president ? (_jsx(SectionCard, { title: "Presidencia actual", icon: Shield, children: _jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center", children: [_jsx(Crest, { name: state.club.name, shortName: state.club.shortName, colors: [state.club.colorPrimary, state.club.colorSecondary], size: "lg" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "display text-lg", children: state.club.name }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [state.tournament?.name, " \u00B7 ", state.tournament?.season] })] }), _jsxs("dl", { className: "num grid grid-cols-2 gap-4 text-sm sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Desde" }), _jsx("dd", { className: "font-semibold", children: formatDate(state.president.joinedAt) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Plantilla" }), _jsxs("dd", { className: "font-semibold", children: [state.president.squadSize, " jugadores"] })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Presupuesto" }), _jsx("dd", { className: "font-semibold", children: formatMoney(state.budget.available) })] })] })] }) })) : null] }));
}
