import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { crestFor } from "@/lib/crests";
const SIZES = {
    sm: "size-8 text-[10px]",
    md: "size-11 text-xs",
    lg: "size-14 text-sm",
    xl: "size-20 text-lg",
};
/**
 * Escudo del club: PNG real del catálogo (`public/crests`) sobre un disco
 * blanco con el aro en los colores del club. Si el club no tiene escudo en el
 * mapa — o la imagen no carga — vuelve al fallback de iniciales sobre el
 * degradado de colores, así ningún club se queda sin identidad visual.
 */
export function Crest({ name, shortName, colors, size = "md", className, }) {
    const [primary, secondary] = colors;
    const src = crestFor(name);
    const [failedSrc, setFailedSrc] = useState(null);
    const showImage = src !== null && failedSrc !== src;
    return (_jsx("span", { role: "img", "aria-label": `Escudo de ${name}`, title: name, className: cn("display relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white", "ring-2 ring-white/80 dark:ring-white/20", SIZES[size], className), style: {
            backgroundImage: `linear-gradient(140deg, ${primary} 0%, ${secondary} 100%)`,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
        }, children: showImage ? (_jsx("span", { className: "flex h-[86%] w-[86%] items-center justify-center rounded-full bg-white", style: { boxShadow: "inset 0 1px 2px rgba(15,23,42,0.14)" }, children: _jsx("img", { src: src, alt: "", loading: "lazy", decoding: "async", onError: () => setFailedSrc(src), className: "h-[80%] w-[80%] object-contain" }) })) : (_jsx("span", { className: "drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]", children: shortName.slice(0, 3) })) }));
}
