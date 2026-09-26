import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small "?" affordance used across Administration: it explains what a field
 * means and how to configure it, so no label is ever ambiguous.
 */
export function Tip({ text, side = "right" }: { text: string; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Más información sobre este campo"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Label + inline tooltip: the label states WHAT, the tooltip explains HOW. */
export function FieldLabel({
  htmlFor,
  children,
  tip,
  side,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  tip: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {children}
      </Label>
      <Tip text={tip} side={side} />
    </span>
  );
}
