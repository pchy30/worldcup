"use client";

import { useRouter } from "next/navigation";
import type { Player, SquadPlayer } from "@wcf/shared";
import PositionBadge from "@/components/PositionBadge";
import { Target, Zap, Shield } from "lucide-react";

interface SquadPitchProps {
  squadRows: (SquadPlayer & { player: Player })[];
}

export default function SquadPitch({ squadRows }: SquadPitchProps) {
  const router = useRouter();

  // Compute earned points = total_points - baseline_points for each player
  const players = squadRows.map((r) => ({
    ...r.player,
    earned_points: Math.max(0, (r.player.total_points ?? 0) - (r.baseline_points ?? 0)),
  }));

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #1a6b2f 0%, #1e7a35 25%, #1a6b2f 50%, #1e7a35 75%, #1a6b2f 100%)",
        minHeight: "clamp(320px, 60vw, 480px)",
      }}
    >
      {/* Pitch markings */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border border-white/20" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/20" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-40 h-16 border-b border-x border-white/20" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-40 h-16 border-t border-x border-white/20" />
      </div>

      <div className="relative z-10 flex flex-col justify-around h-full py-6 gap-4">
        {(["FWD", "MID", "DEF", "GK"] as const).map((pos) => {
          const posPlayers = players.filter((p) => p.position === pos);
          if (posPlayers.length === 0) return null;
          return (
            <div key={pos} className="flex justify-center gap-2 sm:gap-4 flex-wrap">
              {posPlayers.map((player) => (
                <div key={player.id} className="flex flex-col items-center gap-1 w-14 sm:w-20">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/60 flex items-center justify-center text-white font-bold text-sm shadow-lg backdrop-blur-sm">
                      {player.name.split(" ").pop()?.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -top-1.5 -right-1.5 bg-accent text-primary text-xs font-extrabold rounded-full w-5 h-5 flex items-center justify-center shadow">
                      {player.earned_points}
                    </div>
                  </div>
                  <p className="text-white text-xs font-semibold text-center leading-tight truncate w-full text-center drop-shadow">
                    {player.name.split(" ").pop()}
                  </p>
                  <div className="flex items-center gap-1">
                    <PositionBadge position={player.position} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {player.goals > 0 && (
                      <span className="flex items-center gap-0.5 text-green-300">
                        <Target className="w-2.5 h-2.5" />{player.goals}
                      </span>
                    )}
                    {player.assists > 0 && (
                      <span className="flex items-center gap-0.5 text-blue-300">
                        <Zap className="w-2.5 h-2.5" />{player.assists}
                      </span>
                    )}
                    {player.clean_sheets > 0 && (
                      <span className="flex items-center gap-0.5 text-purple-300">
                        <Shield className="w-2.5 h-2.5" />{player.clean_sheets}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}