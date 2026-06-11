"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { League, LeagueMember } from "@wcf/shared";
import { Trophy, Crown, Loader2, CheckCircle, Clock } from "lucide-react";

interface OfferTeam {
  id: string;
  name: string;
  flag_url: string | null;
  code: string;
}

interface PickRecord {
  manager_id: string;
  round: number;
  team: OfferTeam | OfferTeam[] | null;
}

interface TeamPickClientProps {
  league: League & { team_pick_index: number; team_pick_offers: string[] };
  members: LeagueMember[];
  existingPicks: PickRecord[];
  offerTeams: OfferTeam[];
  currentUserId: string;
}

const ROUNDS = 2;

function getPickerId(draftOrder: string[], teamPickIndex: number): string {
  const round = Math.floor(teamPickIndex / draftOrder.length) + 1;
  const posInRound = teamPickIndex % draftOrder.length;
  return round === 1
    ? draftOrder[posInRound]
    : draftOrder[draftOrder.length - 1 - posInRound];
}

export default function TeamPickClient({
  league,
  members,
  existingPicks: initialPicks,
  offerTeams: initialOffers,
  currentUserId,
}: TeamPickClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const draftOrder: string[] = league.draft_order ?? [];
  const totalTeamPicks = draftOrder.length * ROUNDS;

  const [teamPickIndex, setTeamPickIndex] = useState(league.team_pick_index ?? 0);
  const [offers, setOffers] = useState<OfferTeam[]>(initialOffers);
  const [picks, setPicks] = useState<PickRecord[]>(initialPicks);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPickerId = teamPickIndex < totalTeamPicks
    ? getPickerId(draftOrder, teamPickIndex)
    : null;

  const isMyTurn = currentPickerId === currentUserId;
  const currentRound = Math.floor(teamPickIndex / draftOrder.length) + 1;

  const memberMap = new Map(members.map((m) => [m.user_id, m]));

  // Subscribe to league changes (realtime updates)
  useEffect(() => {
    const channel = supabase
      .channel(`team-pick:${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "manager_national_teams",
          filter: `league_id=eq.${league.id}`,
        },
        (payload) => {
          const newPick = payload.new as { manager_id: string; team_id: string; round: number };
          setPicks((prev) => [...prev, { manager_id: newPick.manager_id, round: newPick.round, team: { id: newPick.team_id, name: "", flag_url: null, code: "" } }]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leagues",
          filter: `id=eq.${league.id}`,
        },
        async (payload) => {
          const updated = payload.new as { team_pick_index: number; team_pick_offers: string[]; draft_status: string };

          if (updated.team_pick_index >= totalTeamPicks) {
            router.push(`/league/${league.id}/draft`);
            return;
          }

          setTeamPickIndex(updated.team_pick_index);
          setSelected(null);

          // Fetch updated offer teams
          if (updated.team_pick_offers?.length > 0) {
            const { data: teamData } = await supabase
              .from("national_teams")
              .select("id, name, flag_url, code")
              .in("id", updated.team_pick_offers);
            setOffers(teamData ?? []);
          } else {
            setOffers([]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [league.id, totalTeamPicks, supabase, router]);

  const handlePick = async () => {
    if (!selected) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/leagues/${league.id}/team-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: selected }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to submit pick.");
        return;
      }

      if (data.player_draft_started) {
        router.push(`/league/${league.id}/draft`);
      }
      // Otherwise realtime subscription handles the state update
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Build per-member picks summary
  const picksForMember = (userId: string) => {
    return picks
      .filter((p) => p.manager_id === userId)
      .sort((a, b) => a.round - b.round)
      .map((p) => {
        const team = Array.isArray(p.team) ? p.team[0] : p.team;
        return team;
      })
      .filter(Boolean);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-accent" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-white">{league.name}</h1>
        <p className="text-muted mt-1 text-sm">
          Team Pick — Round {Math.min(currentRound, ROUNDS)} of {ROUNDS}
        </p>
        <div className="mt-2 text-xs text-muted">
          Win bonus: <span className="text-green-400 font-semibold">+3 pts</span> · Draw bonus: <span className="text-yellow-400 font-semibold">+1 pt</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — current pick */}
        <div className="lg:col-span-2 space-y-4">
          {teamPickIndex < totalTeamPicks ? (
            <>
              {/* Who's picking */}
              <div className="card flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {memberMap.get(currentPickerId ?? "")?.display_name.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {isMyTurn ? "Your turn to pick!" : `${memberMap.get(currentPickerId ?? "")?.display_name ?? "…"} is picking`}
                  </p>
                  <p className="text-xs text-muted">Round {currentRound} · Pick {teamPickIndex + 1} of {totalTeamPicks}</p>
                </div>
                {!isMyTurn && <Clock className="w-4 h-4 text-muted ml-auto animate-pulse" />}
              </div>

              {/* Offer cards */}
              {isMyTurn ? (
                <>
                  <p className="text-sm text-muted">Choose one national team — the other three return to the pool.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {offers.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => setSelected(selected === team.id ? null : team.id)}
                        className={`card text-left transition-all duration-150 hover:border-accent/50 ${
                          selected === team.id
                            ? "border-accent shadow-glow-gold bg-accent/5"
                            : "border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {team.flag_url ? (
                            <img src={team.flag_url} alt={team.code} className="w-8 h-6 object-cover rounded" />
                          ) : (
                            <div className="w-8 h-6 rounded bg-muted/20 flex items-center justify-center text-xs text-muted font-bold">
                              {team.code}
                            </div>
                          )}
                          <span className="font-semibold text-white text-sm">{team.name}</span>
                          {selected === team.id && <CheckCircle className="w-4 h-4 text-accent ml-auto" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {error && (
                    <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handlePick}
                    disabled={!selected || loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
                    ) : (
                      "Confirm Pick"
                    )}
                  </button>
                </>
              ) : (
                <div className="card text-center py-8">
                  <Loader2 className="w-6 h-6 text-muted mx-auto mb-2 animate-spin" />
                  <p className="text-muted text-sm">
                    Waiting for {memberMap.get(currentPickerId ?? "")?.display_name ?? "other player"} to pick…
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-10">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <p className="text-white font-bold">Team picking complete!</p>
              <p className="text-muted text-sm mt-1">Moving to player draft…</p>
            </div>
          )}
        </div>

        {/* Right — picks summary */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Picked Teams</h2>
          {draftOrder.map((userId) => {
            const member = memberMap.get(userId);
            const memberPicks = picksForMember(userId);
            const isCurrentPicker = userId === currentPickerId;
            return (
              <div
                key={userId}
                className={`card py-3 px-4 ${isCurrentPicker ? "border-accent/40" : "border-white/10"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    userId === currentUserId ? "bg-accent text-primary" : "bg-surface text-white border border-muted/30"
                  }`}>
                    {member?.display_name.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <span className="text-sm font-medium text-white truncate">
                    {member?.display_name ?? userId}
                    {userId === currentUserId && <span className="text-xs text-muted ml-1">(you)</span>}
                  </span>
                  {isCurrentPicker && <Crown className="w-3.5 h-3.5 text-accent ml-auto flex-shrink-0" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {memberPicks.map((team, i) => (
                    <span
                      key={i}
                      className="text-xs bg-primary/60 border border-muted/20 text-gray-300 px-2 py-0.5 rounded-full"
                    >
                      {team?.name ?? "—"}
                    </span>
                  ))}
                  {Array.from({ length: ROUNDS - memberPicks.length }).map((_, i) => (
                    <span
                      key={`empty-${i}`}
                      className="text-xs border border-dashed border-muted/20 text-muted/40 px-2 py-0.5 rounded-full"
                    >
                      Pick {memberPicks.length + i + 1}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
