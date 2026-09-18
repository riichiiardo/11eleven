import { cn } from "@/lib/utils";
import { useId } from "react";

/** 11Eleven mark: two slanted strokes (the "11") inside a navy-to-blue tile. */
export function ElevenMark({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "light";
}) {
  // useId returns colons, which are unsafe inside `url(#id)` references.
  const gradientId = `eleven-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-9 shrink-0", className)}
      role="img"
      aria-label="11Eleven"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone === "brand" ? "#2f6bff" : "#ffffff"} />
          <stop offset="100%" stopColor={tone === "brand" ? "#0b1a30" : "#c7d7f5"} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill={`url(#${gradientId})`} />
      <path d="M14.5 34.5 L20.2 13.5 h5.1 L19.6 34.5 z" fill="#fff" />
      <path d="M26.2 34.5 L31.9 13.5 h5.1 L31.3 34.5 z" fill="#fff" opacity="0.82" />
    </svg>
  );
}

export function BrandLockup({
  className,
  subtitle = "Fantasy Football Manager",
  tone = "light",
}: {
  className?: string;
  subtitle?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <ElevenMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "display text-xl tracking-tight",
            tone === "light" ? "text-white" : "text-foreground",
          )}
        >
          11<span className="text-brand-bright">Eleven</span>
        </span>
        <span
          className={cn(
            "mt-1 text-[9px] font-semibold uppercase tracking-[0.22em]",
            tone === "light" ? "text-white/55" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </span>
      </span>
    </span>
  );
}
