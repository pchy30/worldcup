"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { League, ManagerStanding } from "@wcf/shared";
import { rankManagers } from "@wcf/shared";
import Link from "next/link";
import {
  Trophy,
  Target,
  Zap,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Star,
  Shield,
} from "lucide-react";
import PositionBadge from "@/components/PositionBadge";
import type { PlayerPosition } from "@wcf/shared";

export interface ManagerDetail {
  squad: {
    id: string;
    name: string;
    position: PlayerPosition;
    total_points: number;
    goals: number;
    assists: number;
    clean_sheets: number;
    team: { name: string } | null;
  }[];
  bonusTeams: {
    id: string;
    name: string;
    flag_url: string | null;
    code: string;
    round: number;
  }[];
}

interface LeaderboardClientProps {
  league: League;
  initialStandings: ManagerStanding[];
  currentUserId: string;
  managerDetails: Record<string, ManagerDetail>;
}

const RANK_STYLES = [
  { medal: "🥇", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
  { medal: "🥈", color: "text-gray-300",   bg: "bg-gray-300/10",   border: "border-gray-300/20"  },
  { medal: "🥉", color: "text-amber-600",  bg: "bg-amber-600/10",  border: "border-amber-600/20" },
];

export default function LeaderboardClient({
  league,
  initialStandings,
  currentUserId,
  managerDetails,
}: LeaderboardClientProps) {
  const supabase = createClient();
  const [standings, setStandings] = useState<ManagerStanding[]>(initialStandings);
  const [expandedManager, setExpandedManager] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`leaderboard:${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "league_members",
          filter: `league_id=eq.${league.id}`,
        },
        (payload) => {
          const updated = payload.new as {
            user_id: string;
            display_name: string;
            total_points: number;
            goals_scored: number;
            assists: number;
          };

          setStandings((prev) => {
            const next = prev.map((s) =>
              s.manager_id === updated.user_id
                ? {
                    ...s,
                    total_points: updated.total_points ?? s.total_points,
                    goals_scored: updated.goals_scored ?? s.goals_scored,
                    assists: updated.assists ?? s.assists,
                    display_name: updated.display_name ?? s.display_name,
                  }
                : s
            );
            return rankManagers(next);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [league.id, supabase]);

  const myRank = standings.findIndex((s) => s.manager_id === currentUserId) + 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{league.name}</h1>
          <p className="text-muted mt-1 text-sm">
            {standings.length} manager{standings.length !== 1 ? "s" : ""} · updates live
          </p>
        </div>
        <Link
          href={`/league/${league.id}/squad`}
          className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5 flex-shrink-0"
        >
          <ArrowRightLeft className="w-4 h-4" />
          My Squad
        </Link>
      </div>

      {/* Your position banner */}
      {myRank > 0 && (
        <div className="flex items-center justify-between bg-accent/10 border border-accent/25 rounded-xl px-4 py-3 mb-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-white">Your position</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              #{myRank} of {standings.length}
            </span>
            <span className="text-accent font-extrabold text-lg">
              {standings[myRank - 1]?.total_points ?? 0} pts
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {standings.length === 0 && (
        <div className="card text-center py-16">
          <Trophy className="w-8 h-8 mx-auto mb-3 text-muted opacity-40" />
          <p className="text-muted text-sm">No standings yet.</p>
        </div>
      )}

      {/* Rankings list */}
      <div className="space-y-2">
        {standings.map((standing, idx) => {
          const rank = idx + 1;
          const isMe = standing.manager_id === currentUserId;
          const isExpanded = expandedManager === standing.manager_id;
          const detail = managerDetails[standing.manager_id];
          const rankStyle = RANK_STYLES[rank - 1];
          const leader = standings[0];
          const gap = leader ? leader.total_points - standing.total_points : 0;

          return (
            <div
              key={standing.manager_id}
              className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                isMe
                  ? "border-accent/40 bg-accent/5"
                  : "border-white/8 bg-surface"
              }`}
            >
              {/* Main row */}
              <button
                onClick={() => setExpandedManager(isExpanded ? null : standing.manager_id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition-colors"
              >
                {/* Rank */}
                <div className="w-8 flex-shrink-0 text-center">
                  {rank <= 3 ? (
                    <span className="text-lg leading-none">{rankStyle.medal}</span>
                  ) : (
                    <span className="text-sm font-bold text-muted">{rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    isMe
                      ? "bg-accent text-primary"
                      : rank <= 3
                        ? `${rankStyle.bg} ${rankStyle.color} border ${rankStyle.border}`
                        : "bg-white/8 text-white border border-white/10"
                  }`}
                >
                  {standing.display_name.charAt(0).toUpperCase()}
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`font-semibold text-sm truncate ${isMe ? "text-accent" : "text-white"}`}>
                      {standing.display_name}
                    </p>
                    {isMe && (
                      <span className="text-[10px] text-muted font-normal flex-shrink-0">you</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted flex items-center gap-0.5">
                      <Target className="w-3 h-3" />{standing.goals_scored}g
                    </span>
                    <span className="text-xs text-muted flex items-center gap-0.5">
                      <Zap className="w-3 h-3" />{standing.assists}a
                    </span>
                    {rank > 1 && gap > 0 && (
                      <span className="text-xs text-muted">−{gap} pts</span>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className={`font-extrabold text-xl leading-none ${isMe ? "text-accent" : rank === 1 ? "text-yellow-400" : "text-white"}`}>
                      {standing.total_points}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">pts</p>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted" />
                    : <ChevronDown className="w-4 h-4 text-muted" />}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-white/8 px-4 py-4 space-y-4 bg-black/10">
                  {/* Bonus teams */}
                  {detail?.bonusTeams?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Star className="w-3 h-3 text-accent" /> Bonus Teams
                        <span className="font-normal normal-case">· Win +3, Draw +1</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {detail.bonusTeams.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
                            {t.flag_url && (
                              <img src={t.flag_url} alt={t.code} className="w-6 h-4 object-cover rounded" />
                            )}
                            <span className="text-sm text-white font-medium">{t.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Squad */}
                  {detail?.squad?.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Shield className="w-3 h-3" /> Squad · sorted by points
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {[...detail.squad]
                          .sort((a, b) => b.total_points - a.total_points)
                          .map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2"
                            >
                              <PositionBadge position={player.position} />
                              <span className="text-sm text-white font-medium flex-1 truncate">{player.name}</span>
                              <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted">
                                {player.goals > 0 && (
                                  <span className="flex items-center gap-0.5 text-green-400">
                                    <Target className="w-3 h-3" />{player.goals}
                                  </span>
                                )}
                                {player.assists > 0 && (
                                  <span className="flex items-center gap-0.5 text-blue-400">
                                    <Zap className="w-3 h-3" />{player.assists}
                                  </span>
                                )}
                                {player.clean_sheets > 0 && (player.position === "GK" || player.position === "DEF") && (
                                  <span className="flex items-center gap-0.5 text-purple-400">
                                    <Shield className="w-3 h-3" />{player.clean_sheets}
                                  </span>
                                )}
                              </div>
                              <span className="text-accent font-bold text-sm flex-shrink-0">
                                {player.total_points}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No squad data yet.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
