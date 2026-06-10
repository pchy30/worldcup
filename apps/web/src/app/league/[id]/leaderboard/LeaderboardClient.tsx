"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { League, ManagerStanding } from "@wcf/shared";
import { rankManagers } from "@wcf/shared";
import Link from "next/link";
import { Trophy, Medal, Target, Zap, ArrowRightLeft } from "lucide-react";

interface LeaderboardClientProps {
  league: League;
  initialStandings: ManagerStanding[];
  currentUserId: string;
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
}: LeaderboardClientProps) {
  const supabase = createClient();
  const [standings, setStandings] = useState<ManagerStanding[]>(initialStandings);

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

              return (
                <tr
                  key={standing.manager_id}
                  className={`border-b border-muted/10 transition-colors ${
                    isMe
                      ? "bg-accent/5 border-accent/20"
                      : "hover:bg-primary/20"
                  }`}
                >
                  {/* Rank */}
                  <td className="px-4 py-3">
                    {rank <= 3 ? (
                      <Medal
                        className={`w-4 h-4 ${
                          medalColors[rank - 1] ?? "text-muted"
                        }`}
                      />
                    ) : (
                      <span className="text-muted text-sm font-medium">
                        {rank}
                      </span>
                    )}
                  </td>

                  {/* Manager */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isMe
                            ? "bg-accent text-primary"
                            : "bg-surface text-white border border-muted/30"
                        }`}
                      >
                        {standing.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`font-medium text-sm ${
                          isMe ? "text-accent" : "text-white"
                        }`}
                      >
                        {standing.display_name}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-muted">(you)</span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Points */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-accent font-bold text-base">
                      {standing.total_points}
                    </span>
                  </td>

                  {/* Goals */}
                  <td className="px-4 py-3 text-right text-sm text-gray-300 hidden sm:table-cell">
                    {standing.goals_scored}
                  </td>

                  {/* Assists */}
                  <td className="px-4 py-3 text-right text-sm text-gray-300 hidden sm:table-cell">
                    {standing.assists}
                  </td>

                  {/* Best player */}
                  <td className="px-4 py-3 text-right text-sm text-muted hidden md:table-cell">
                    {standing.highest_individual_player_points > 0
                      ? `${standing.highest_individual_player_points} pts`
                      : "—"}
                  </td>
                </tr>
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
