import type { PlayerPosition } from "@wcf/shared";

interface PositionBadgeProps {
  position: PlayerPosition;
  size?: "sm" | "md";
}

const positionConfig: Record<
  PlayerPosition,
  { label: string; className: string }
> = {
  GK: { label: "GK", className: "badge-gk" },
  DEF: { label: "DEF", className: "badge-def" },
  MID: { label: "MID", className: "badge-mid" },
  FWD: { label: "FWD", className: "badge-fwd" },
};

export default function PositionBadge({
  position,
  size = "sm",
}: PositionBadgeProps) {
  const config = positionConfig[position];
  const sizeClass = size === "md" ? "text-sm px-2.5 py-1" : "";

  return (
    <span className={`${config.className} ${sizeClass} inline-block`}>
      {config.label}
    </span>
  );
}
