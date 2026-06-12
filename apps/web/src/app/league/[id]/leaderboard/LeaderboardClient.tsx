"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { League, ManagerStanding } from "@wcf/shared";
import { rankManagers } from "@wcf/shared";
import Link from "next/link";
import { Trophy, Medal, Target, Zap, ArrowRightLeft, ChevronDown, ChevronUp, Star } from "lucide-react";
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

const medalColors = [
  "text-yellow-400",  // 1st
  "text-gray-300",    // 2nd
  "text-amber-600",   // 3rd
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [league.id, supabase]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">{league.name}</h1>
          <p className="text-muted mt-1">Leaderboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/league/${league.id}/squad`}
            className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            My Squad
          </Link>
        </div>
      </div>

      {/* Top 3 podium */}
      {standings.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[standings[1], standings[0], standings[2]].map((standing, visualIdx) => {
            const actualRank = standings.indexOf(standing) + 1;
            const heightClass =
              actualRank === 1
                ? "pt-8"
                : actualRank === 2
                  ? "pt-12"
                  : "pt-16";
            const isMe = standing.manager_id === currentUserId;

            return (
              <div
                key={standing.manager_id}
                className={`card text-center ${heightClass} ${
                  isMe ? "border-accent/50 shadow-accent/10 shadow-lg" : ""
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-bold border-2 ${
                    isMe
                      ? "bg-accent text-primary border-accent"
                      : "bg-surface text-white border-muted/40"
                  }`}
                >
                  {standing.display_name.charAt(0).toUpperCase()}
                </div>
                <p
                  className={`font-bold text-sm mb-1 truncate ${
                    medalColors[actualRank - 1] ?? "text-white"
                  }`}
                >
                  #{actualRank}
                </p>
                <p className="text-white font-semibold text-sm truncate mb-1">
                  {standing.display_name}
                </p>
                <p className="text-accent font-extrabold text-xl">
                  {standing.total_points}
                </p>
                <p className="text-muted text-xs">pts</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-muted/20">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider w-10">
                #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                Manager
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                Pts
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
                <span className="flex items-center justify-end gap-1">
                  <Target className="w-3 h-3" /> Goals
                </span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
                <span className="flex items-center justify-end gap-1">
                  <Zap className="w-3 h-3" /> Assists
                </span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">
                Best Player
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, idx) => {
              const rank = idx + 1;
              const isMe = standing.manager_id === currentUserId;
              const isExpanded = expandedManager === standing.manager_id;
              const detail = managerDetails[standing.manager_id];

              return (
                <React.Fragment key={standing.manager_id}>
                  <tr
                    onClick={() => setExpandedManager(isExpanded ? null : standing.manager_id)}
                    className={`border-b border-muted/10 transition-colors cursor-pointer ${
                      isMe
                        ? "bg-accent/5 border-accent/20"
                        : "hover:bg-primary/20"
                    } ${isExpanded ? "border-b-0" : ""}`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3">
                      {rank <= 3 ? (
                        <Medal className={`w-4 h-4 ${medalColors[rank - 1] ?? "text-muted"}`} />
                      ) : (
                        <span className="text-muted text-sm font-medium">{rank}</span>
                      )}
                    </td>

                    {/* Manager */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMe ? "bg-accent text-primary" : "bg-surface text-white border border-muted/30"}`}>
                          {standing.display_name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`font-medium text-sm ${isMe ? "text-accent" : "text-white"}`}>
                          {standing.display_name}
                          {isMe && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-muted ml-1 md:hidden" />
                          : <ChevronDown className="w-3.5 h-3.5 text-muted ml-1 md:hidden" />}
                      </div>
                    </td>

                    {/* Points */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-accent font-bold text-base">{standing.total_points}</span>
                    </td>

                    {/* Goals */}
                    <td className="px-4 py-3 text-right text-sm text-gray-300 hidden sm:table-cell">
                      {standing.goals_scored}
                    </td>

                    {/* Assists */}
                    <td className="px-4 py-3 text-right text-sm text-gray-300 hidden sm:table-cell">
                      {standing.assists}
                    </td>

                    {/* Best player / expand toggle */}
                    <td className="px-4 py-3 text-right text-sm text-muted hidden md:table-cell">
                      <div className="flex items-center justify-end gap-2">
                        <span>{standing.highest_individual_player_points > 0 ? `${standing.highest_individual_player_points} pts` : "—"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded squad + bonus teams */}
                  {isExpanded && detail && (
                    <tr key={`${standing.manager_id}-detail`} className={`border-b border-muted/10 ${isMe ? "bg-accent/5" : "bg-primary/30"}`}>
                      <td colSpan={6} className="px-4 py-4">
                        {/* Bonus teams */}
                        {detail.bonusTeams.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Star className="w-3.5 h-3.5 text-accent" />
                              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Bonus Teams</span>
                              <span className="text-xs text-muted ml-1">Win +3 · Draw +1</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {detail.bonusTeams.map((t, i) => (
                                <div key={i} className="flex items-center gap-1.5 bg-surface border border-muted/20 rounded-lg px-2.5 py-1.5">
                                  {t.flag_url && <img src={t.flag_url} alt={t.code} className="w-6 h-4 object-cover rounded" />}
                                  <span className="text-sm text-white font-medium">{t.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Squad */}
                        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Squad</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {detail.squad
                            .sort((a, b) => b.total_points - a.total_points)
                            .map((player) => (
                              <div key={player.id} className="flex items-center gap-2 bg-surface border border-muted/20 rounded-lg px-3 py-2">
                                <PositionBadge position={player.position} />
                                <span className="text-sm text-white font-medium flex-1 truncate">{player.name}</span>
                                <span className="text-accent font-bold text-sm flex-shrink-0">{player.total_points} pts</span>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {standings.length === 0 && (
          <div className="text-center text-muted py-12 text-sm">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No standings data yet.
          </div>
        )}
      </div>
    </div>
  );
}
