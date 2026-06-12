"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Player, PlayerPosition } from "@wcf/shared";
import PlayerCard from "@/components/PlayerCard";
import CountdownTimer from "@/components/CountdownTimer";
import { ArrowRightLeft, Search, X, Loader2, Calendar } from "lucide-react";
import type { NextFixture } from "./page";

const POSITIONS: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

interface TransferPanelProps {
  leagueId: string;
  mySquad: Player[];
  availablePlayers: Player[];
  windowId: string;
  windowClosesAt: string;
  transfersUsed: number;
  maxTransfers: number;
  nextFixtures?: Record<string, NextFixture>;
}

export default function TransferPanel({
  leagueId,
  mySquad: initialSquad,
  availablePlayers: initialAvailable,
  windowClosesAt,
  transfersUsed: initialTransfersUsed,
  maxTransfers,
  nextFixtures = {},
}: TransferPanelProps) {
  const router = useRouter();
  const [squad, setSquad] = useState<Player[]>(initialSquad);
  const [available, setAvailable] = useState<Player[]>(initialAvailable);
  const [transfersUsed, setTransfersUsed] = useState(initialTransfersUsed);
  const transfersRemaining = maxTransfers - transfersUsed;
  const [playerOut, setPlayerOut] = useState<Player | null>(null);
  const [playerIn, setPlayerIn] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const filteredAvailable = useMemo(() => {
    let list = available;
    // If a player out is selected, restrict to same position
    const effectivePositionFilter = playerOut ? playerOut.position : positionFilter;
    if (effectivePositionFilter !== "ALL") {
      list = list.filter((p) => p.position === effectivePositionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [available, positionFilter, searchQuery, playerOut]);

  const handleSubmit = async () => {
    if (!playerOut || !playerIn) {
      setError("Please select both a player to transfer out and one to bring in.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_out_id: playerOut.id,
          player_in_id: playerIn.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Transfer failed.");
        return;
      }

      // Update squad and available lists locally — no full page refresh needed
      setSquad((prev) => {
        const next = prev.filter((p) => p.id !== playerOut!.id);
        // player_in comes back in data.squad with full player details
        const newPlayer = (data.squad ?? [])
          .map((r: { player: Player }) => r.player)
          .find((p: Player) => p.id === playerIn!.id);
        return newPlayer ? [...next, newPlayer] : next;
      });
      setAvailable((prev) => [
        ...prev.filter((p) => p.id !== playerIn!.id),
        playerOut!,
      ]);
      setTransfersUsed((n) => n + 1);
      setSuccess(true);
      setPlayerOut(null);
      setPlayerIn(null);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent" />
            Transfer Window
          </h2>
          <div className="flex items-center gap-2 mt-1">
            {Array.from({ length: maxTransfers }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < transfersUsed ? "bg-muted" : "bg-accent"}`}
              />
            ))}
            <span className="text-xs text-muted ml-1">
              {transfersRemaining === 0
                ? "No transfers remaining"
                : `${transfersRemaining} transfer${transfersRemaining !== 1 ? "s" : ""} remaining`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="text-xs">Closes in:</span>
          <CountdownTimer
            deadline={windowClosesAt}
            onExpired={() => router.refresh()}
          />
        </div>
      </div>

      {transfersRemaining === 0 && (
        <div className="bg-muted/10 border border-muted/30 text-muted rounded-lg px-4 py-3 text-sm mb-4">
          You have used all {maxTransfers} transfers for this window. Come back next window.
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-700/50 text-green-400 rounded-lg px-4 py-3 text-sm mb-4">
          Transfer completed successfully! Your squad has been updated.
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${transfersRemaining === 0 ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Select player out */}
        <div className="card">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Transfer Out
          </h3>
          <div className="space-y-2">
            {squad.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                selectable
                selected={playerOut?.id === player.id}
                onClick={() => {
                  const next = playerOut?.id === player.id ? null : player;
                  setPlayerOut(next);
                  setPlayerIn(null);
                }}
              />
            ))}
          </div>
        </div>

        {/* Select player in */}
        <div className="card">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Transfer In
          </h3>

          {/* Filters */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input py-2 pl-9 pr-9 text-sm"
                placeholder="Search available players…"
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
                    setPositionFilter(positionFilter === pos ? "ALL" : pos)
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
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {filteredAvailable.length === 0 && (
              <p className="text-muted text-sm text-center py-8">
                No available players match your filters.
              </p>
            )}
            {filteredAvailable.map((player) => {
              const fixture = player.team?.name ? nextFixtures[player.team.name] : undefined;
              return (
                <div key={player.id}>
                  <PlayerCard
                    player={player}
                    selectable
                    selected={playerIn?.id === player.id}
                    onClick={() =>
                      setPlayerIn(playerIn?.id === player.id ? null : player)
                    }
                  />
                  {fixture && (
                    <div className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>Next: vs {fixture.opponent} · {fixture.date}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transfer summary + confirm */}
      {(playerOut || playerIn) && (
        <div className="mt-4 card">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1">
              <p className="text-xs text-muted mb-1">OUT</p>
              <p className={`font-semibold ${playerOut ? "text-red-400" : "text-muted"}`}>
                {playerOut?.name ?? "Not selected"}
              </p>
            </div>
            <ArrowRightLeft className="w-5 h-5 text-muted flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted mb-1">IN</p>
              <p className={`font-semibold ${playerIn ? "text-green-400" : "text-muted"}`}>
                {playerIn?.name ?? "Not selected"}
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!playerOut || !playerIn || loading}
              className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirming…
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Confirm Transfer
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
