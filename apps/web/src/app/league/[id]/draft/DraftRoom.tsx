"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { League, LeagueMember, Player, DraftPick, PlayerPosition } from "@wcf/shared";
import PlayerCard from "@/components/PlayerCard";
import CountdownTimer from "@/components/CountdownTimer";
import PositionBadge from "@/components/PositionBadge";
import { Search, X, Loader2, CheckCircle2 } from "lucide-react";

interface DraftRoomProps {
  league: League;
  currentUserId: string;
  members: LeagueMember[];
  allPlayers: Player[];
  initialPicks: DraftPick[];
}

const POSITIONS: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

export default function DraftRoom({
  league,
  currentUserId,
  members,
  allPlayers,
  initialPicks,
}: DraftRoomProps) {
  const router = useRouter();
  const supabase = createClient();

  const [picks, setPicks] = useState<DraftPick[]>(initialPicks);
  const [currentLeague, setCurrentLeague] = useState<League>(league);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | "ALL">("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);

  // Derived state
  const pickedPlayerIds = useMemo(
    () => new Set(picks.map((p) => p.player_id)),
    [picks]
  );

  const availablePlayers = useMemo(
    () => allPlayers.filter((p) => !pickedPlayerIds.has(p.id)),
    [allPlayers, pickedPlayerIds]
  );

  const mySquad = useMemo(
    () =>
      picks
        .filter((p) => p.manager_id === currentUserId)
        .map((p) => p.player)
        .filter(Boolean) as Player[],
    [picks, currentUserId]
  );

  // Who's picking now
  const currentPickerUserId =
    currentLeague.draft_order?.[currentLeague.current_pick_index] ?? null;
  const isMyTurn = currentPickerUserId === currentUserId;

  const currentPickerMember = members.find(
    (m) => m.user_id === currentPickerUserId
  );

  // National teams available for filtering
  const nationalTeams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of allPlayers) {
      if (p.team && !seen.has(p.team_id)) {
        seen.set(p.team_id, p.team.name);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allPlayers]);

  // Filtered available players
  const filteredPlayers = useMemo(() => {
    let list = availablePlayers;
    if (positionFilter !== "ALL") {
      list = list.filter((p) => p.position === positionFilter);
    }
    if (teamFilter !== "ALL") {
      list = list.filter((p) => p.team_id === teamFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [availablePlayers, positionFilter, teamFilter, searchQuery]);

  // Squad grouped by position
  const squadByPosition = useMemo(() => {
    const groups: Record<PlayerPosition, Player[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const p of mySquad) {
      groups[p.position].push(p);
    }
    return groups;
  }, [mySquad]);

  // Subscribe to draft_picks inserts
  useEffect(() => {
    const channel = supabase
      .channel(`draft:${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "draft_picks",
          filter: `league_id=eq.${league.id}`,
        },
        async (payload) => {
          const rawPick = payload.new as DraftPick;
          // Fetch with player details
          const { data } = await supabase
            .from("draft_picks")
            .select("*, player:players(*, team:national_teams(*))")
            .eq("id", rawPick.id)
            .single();
          if (data) {
            setPicks((prev) => {
              if (prev.some((p) => p.id === data.id)) return prev;
              return [...prev, data as DraftPick];
            });
          }
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
        (payload) => {
          const updated = payload.new as League;
          setCurrentLeague(updated);
          if (updated.draft_status === "completed") {
            router.push(`/league/${league.id}/leaderboard`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [league.id, router, supabase]);

  const handlePickPlayer = useCallback(
    (player: Player) => {
      if (!isMyTurn || submitting) return;
      setSelectedPlayer(player);
      setConfirmModal(true);
      setSubmitError(null);
    },
    [isMyTurn, submitting]
  );

  const handleConfirmPick = async () => {
    if (!selectedPlayer) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(
        `/api/leagues/${league.id}/draft-pick`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: selectedPlayer.id }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to make pick.");
        return;
      }
      setConfirmModal(false);
      setSelectedPlayer(null);
    } catch {
      setSubmitError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-surface border-b border-muted/30 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-bold text-white text-lg leading-tight">
            {league.name}
          </h1>
          <p className="text-xs text-muted">
            Pick {Math.min(currentLeague.current_pick_index + 1, picks.length + 1)} of{" "}
            {members.length * 7}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Current picker */}
          <div className="text-right">
            <p className="text-xs text-muted">Now picking</p>
            <p
              className={`text-sm font-bold ${isMyTurn ? "text-accent" : "text-white"}`}
            >
              {isMyTurn ? "Your turn!" : (currentPickerMember?.display_name ?? "…")}
            </p>
          </div>

          {/* Timer (live mode only) */}
          {league.draft_mode === "live" &&
            currentLeague.current_pick_deadline && (
              <CountdownTimer
                deadline={currentLeague.current_pick_deadline}
                onExpired={() => {
                  // Auto-advance handled server-side; just refresh state
                }}
              />
            )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Player search panel */}
        <div className="w-full md:w-[55%] lg:w-[60%] flex flex-col border-r border-muted/20 overflow-hidden">
          {/* Filters */}
          <div className="p-3 border-b border-muted/20 space-y-2 flex-shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input py-2 pl-9 pr-9 text-sm"
                placeholder="Search players…"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Position filter */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setPositionFilter("ALL")}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  positionFilter === "ALL"
                    ? "bg-accent text-primary border-accent"
                    : "border-muted/40 text-muted hover:border-muted"
                }`}
              >
                All
              </button>
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() =>
                    setPositionFilter(
                      positionFilter === pos ? "ALL" : pos
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    positionFilter === pos
                      ? "bg-accent text-primary border-accent"
                      : "border-muted/40 text-muted hover:border-muted"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Team filter */}
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="ALL">All national teams</option>
              {nationalTeams.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Player list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {filteredPlayers.length === 0 && (
              <div className="text-center text-muted py-12 text-sm">
                No players match your filters.
              </div>
            )}
            {filteredPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                selectable={isMyTurn}
                selected={selectedPlayer?.id === player.id}
                onClick={() => handlePickPlayer(player)}
              />
            ))}
          </div>
        </div>

        {/* Right panel: Pick history + My squad */}
        <div className="hidden md:flex flex-col flex-1 overflow-hidden">
          {/* Pick history */}
          <div className="flex-1 overflow-hidden flex flex-col border-b border-muted/20">
            <div className="px-4 py-3 border-b border-muted/20 flex-shrink-0">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Pick History
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1.5">
              {[...picks].reverse().map((pick, idx) => {
                const picker = members.find(
                  (m) => m.user_id === pick.manager_id
                );
                return (
                  <div
                    key={pick.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface hover:bg-surface/80 transition-colors"
                  >
                    <span className="text-xs text-muted w-6 text-right">
                      #{pick.pick_number}
                    </span>
                    {pick.player && (
                      <PositionBadge position={pick.player.position} />
                    )}
                    <span className="flex-1 text-sm text-white font-medium truncate">
                      {pick.player?.name ?? pick.player_id}
                    </span>
                    <span className="text-xs text-muted truncate max-w-[80px]">
                      {picker?.display_name ?? "?"}
                    </span>
                  </div>
                );
              })}
              {picks.length === 0 && (
                <p className="text-muted text-sm text-center py-8">
                  No picks yet.
                </p>
              )}
            </div>
          </div>

          {/* My Squad */}
          <div className="flex-shrink-0 max-h-64 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-muted/20 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                My Squad
              </h2>
              <span className="text-xs text-accent font-bold">
                {mySquad.length}/7
              </span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
              {POSITIONS.map((pos) => {
                const posPlayers = squadByPosition[pos];
                if (posPlayers.length === 0) return null;
                return (
                  <div key={pos}>
                    <p className="text-xs text-muted mb-1 font-semibold">
                      {pos}
                    </p>
                    {posPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 text-sm text-white py-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {mySquad.length === 0 && (
                <p className="text-muted text-xs text-center py-4">
                  No players drafted yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !submitting && setConfirmModal(false)}
          />
          <div className="relative bg-surface border border-muted/40 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-1">
              Confirm Pick
            </h2>
            <p className="text-muted text-sm mb-5">
              You&apos;re about to draft this player into your squad.
            </p>

            <PlayerCard player={selectedPlayer} />

            {/* Squad validation preview */}
            <div className="mt-4 bg-primary/50 rounded-lg p-3 text-sm">
              <p className="text-gray-400">
                Squad after pick:{" "}
                <span className="text-white font-bold">
                  {mySquad.length + 1}/7
                </span>
              </p>
            </div>

            {submitError && (
              <div className="mt-3 bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-4 py-2 text-sm">
                {submitError}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmModal(false)}
                disabled={submitting}
                className="btn-secondary flex-1 py-2.5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPick}
                disabled={submitting}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Picking…
                  </>
                ) : (
                  "Confirm Pick"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
