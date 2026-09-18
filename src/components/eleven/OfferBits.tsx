import { OFFER_STATUS_META, type OfferStatus } from "@/convex/marketEngine";
import { cn } from "@/lib/utils";

/**
 * Offer state is communicated with symbol + text + colour, never colour alone
 * (WCAG 2.2 AA, prompt §43).
 */
export function OfferStatusPill({
  status,
  className,
}: {
  status: OfferStatus;
  className?: string;
}) {
  const meta = OFFER_STATUS_META[status];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      <span aria-hidden="true" className="text-xs leading-none">
        {meta.symbol}
      </span>
      {meta.label}
    </span>
  );
}
