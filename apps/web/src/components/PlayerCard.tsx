import type { Player } from "@wcf/shared";
import Image from "next/image";
import PositionBadge from "./PositionBadge";
import { Target, Zap, Shield } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export default function PlayerCard({
  player,
  selectable = false,
  selected = false,
  onClick,
}: PlayerCardProps) {
  const showCleanSheet =
    player.position === "GK" || player.position === "DEF";

  return (
    <div
      className={`
        relative bg-surface rounded-xl border transition-all duration-200 p-4
        ${selectable ? "cursor-pointer" : ""}
        ${
          selected
            ? "border-accent shadow-lg shadow-accent/20 scale-[1.02]"
            : selectable
              ? "border-muted/30 hover:border-accent/60 hover:shadow-md hover:shadow-accent/10"
              : "border-muted/30"
        }
      `}
      onClick={selectable ? onClick : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={
        selectable
          ? (e) => e.key === "Enter" && onClick?.()
          : undefined
      }
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
          <svg
            className="w-3 h-3 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Flag */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-primary/50 flex items-center justify-center">
          {player.team?.flag_url ? (
            <Image
              src={player.team.flag_url}
              alt={player.team.name}
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-xl">
              {player.team?.code ?? "??"}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PositionBadge position={player.position} />
            {player.team && (
              <span className="text-xs text-muted truncate">
                {player.team.name}
              </span>
            )}
          </div>
          <p className="font-semibold text-white text-sm leading-tight truncate">
            {player.name}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Target className="w-3 h-3 text-green-400" />
              <span>{player.goals}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Zap className="w-3 h-3 text-blue-400" />
              <span>{player.assists}</span>
            </div>
            {showCleanSheet && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Shield className="w-3 h-3 text-purple-400" />
                <span>{player.clean_sheets}</span>
              </div>
            )}
          </div>
        </div>

        {/* Points badge */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center bg-accent/10 border border-accent/30 rounded-lg px-2 py-1.5 min-w-[42px]">
          <span className="text-accent font-bold text-lg leading-none">
            {player.total_points}
          </span>
          <span className="text-accent/60 text-[10px] font-medium leading-none mt-0.5">
            pts
          </span>
        </div>
      </div>
    </div>
  );
}
