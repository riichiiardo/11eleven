import { FORMATIONS, type FormationCode } from "@/domain/rulesEngine";
import { cn } from "@/lib/utils";

/** Uses the exact same slot coordinates as PitchView. */
export function FormationMiniPitch({
  formation,
  className,
}: {
  formation: FormationCode;
  className?: string;
}) {
  const definition = FORMATIONS[formation];
  return (
    <svg
      viewBox="0 0 100 125"
      role="img"
      aria-label={`Dibujo ${definition.label} · ${definition.shape}`}
      className={cn("w-auto rounded-lg", className)}
    >
      <rect x="1" y="1" width="98" height="123" rx="5" fill="#0c5138" />
      <path d="M3 23h94v22H3zm0 44h94v22H3z" fill="#ffffff" opacity=".035" />
      <rect
        x="4"
        y="4"
        width="92"
        height="117"
        rx="2"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".4"
        strokeWidth=".6"
      />
      <path
        d="M4 62.5h92M25 4v16h50V4M25 121V105h50v16M38 4v6h24V4M38 121v-6h24v6"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".35"
        strokeWidth=".6"
      />
      <circle
        cx="50"
        cy="62.5"
        r="11"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".35"
        strokeWidth=".6"
      />
      {definition.slots.map((slot) => (
        <g
          key={slot.id}
          data-slot={slot.id}
          data-x={slot.x}
          data-y={slot.y}
          transform={`translate(${slot.x} ${slot.y * 1.12})`}
        >
          <circle
            r="4.5"
            fill={slot.label === "POR" ? "#f6cd64" : "#dbeafe"}
            stroke="#ffffff"
            strokeWidth=".5"
          />
          <text
            y="1.25"
            textAnchor="middle"
            fontSize="4"
            fontWeight="800"
            fill="#0d233e"
          >
            {slot.role ?? slot.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
