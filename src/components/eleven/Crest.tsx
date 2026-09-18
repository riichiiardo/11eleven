import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-[10px]",
  md: "size-11 text-xs",
  lg: "size-14 text-sm",
  xl: "size-20 text-lg",
} as const;

export function Crest({
  name,
  shortName,
  colors,
  size = "md",
  className,
}: {
  name: string;
  shortName: string;
  colors: [string, string];
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [primary, secondary] = colors;
  return (
    <span
      role="img"
      aria-label={`Escudo de ${name}`}
      className={cn(
        "display relative inline-flex shrink-0 items-center justify-center rounded-full text-white",
        "ring-2 ring-white/80 dark:ring-white/20",
        SIZES[size],
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(140deg, ${primary} 0%, ${secondary} 100%)`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
      }}
    >
      <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
        {shortName.slice(0, 3)}
      </span>
    </span>
  );
}
