"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Player, PlayerPosition } from "@wcf/shared";
import PlayerCard from "@/components/PlayerCard";
import CountdownTimer from "@/components/CountdownTimer";
import { ArrowRightLeft, Search, X, Loader2, Calendar, Gift, Clock } from "lucide-react";
import type { NextFixture } from "./page";

const POSITIONS: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

interface TransferPanelProps {
  leagueId: string;
  mySquad: Player[];
  baselineMap: Record<string, number>;
  availablePlayers: Player[];
  windowId: string | null;
  windowClosesAt: string | null;
  transfersUsed: number;
  maxTransfers: number;
  freeTransfers?: number;
  freeTransferAvailableAt?: string | null;
  nextWindowOpensAt?: string | null;
  nextFixtures?: Record<string, NextFixture>;
}

function isEliminated(player: Player): boolean {
  const team = Array.isArray(player.team) ? player.team[0] : player.team;
  return (team as { is_eliminated?: boolean } | null)?.is_eliminated === true;
}

export default function TransferPanel({
  leagueId,
  mySquad: initialSquad,
  baselineMap,
  availablePlayers: initialAvailable,
  windowId,
  windowClosesAt,
  transfersUsed: initialTransfersUsed,
  maxTransfers,
  freeTransfers: initialFreeTransfers = 0,
  freeTransferAvailableAt: initialFreeTransferAvailableAt = null,
  nextWindowOpensAt = null,
  nextFixtures = {},
}: TransferPanelProps) {
  const router = useRouter();
  const [squad, setSquad] = useState<Player[]>(initialSquad);
  const [available, setAvailable] = useState<Player[]>(initialAvailable);
  const [transfersUsed, setTransfersUsed] = useState(initialTransfersUsed);
  const [freeTransfers, setFreeTransfers] = useState(initialFreeTransfers);
  const [freeTransferAvailableAt, setFreeTransferAvailableAt] = useState<string | null>(initialFreeTransferAvailableAt);

  const isWindowOpen = !!windowId && !!windowClosesAt;
  const transfersRemaining = isWindowOpen ? maxTransfers - transfersUsed : 0;
  const cooldownActive = freeTransferAvailableAt !== null && new Date(freeTransferAvailableAt) > new Date();
  const hasFreeTransfer = freeTransfers > 0 && !cooldownActive;

  // Show tabs only when both modes are simultaneously available
  const showTabs = hasFreeTransfer && isWindowOpen;
  const [activeTab, setActiveTab] = useState<"free" | "window">(
    hasFreeTransfer ? "free" : "window"
  );
  const isFreeTab = !showTabs ? hasFreeTransfer : activeTab === "free";

  const [playerOut, setPlayerOut] = useState<Player | null>(null);
  const [playerIn, setPlayerIn] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const filteredAvailable = useMemo(() => {
    let list = available;
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
        body: JSON.stringify({ player_out_id: playerOut.id, player_in_id: playerIn.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transfer failed.");
        return;
      }
      const transferredOut = playerOut!;
      const transferredIn = playerIn!;
      setSquad((prev) => [...prev.filter((p) => p.id !== transferredOut.id), transferredIn]);
      setAvailable((prev) => [...prev.filter((p) => p.id !== transferredIn.id), transferredOut]);
      if (isWindowOpen && !isFreeTab) setTransfersUsed((n) => n + 1);
      if (data.free_transfers_remaining !== undefined) setFreeTransfers(data.free_transfers_remaining);
      if ("free_transfer_available_at" in data) setFreeTransferAvailableAt(data.free_transfer_available_at ?? null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      setPlayerOut(null);
      setPlayerIn(null);
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const canTransfer = isFreeTab ? hasFreeTransfer : (isWindowOpen && transfersRemaining > 0);

  function handleTabSwitch(tab: "free" | "window") {
    setActiveTab(tab);
    setPlayerOut(null);
    setPlayerIn(null);
    setError(null);
  }

  return (
    <div className="mb-10">
      {/* Cooldown banner */}
      {freeTransfers > 0 && cooldownActive && freeTransferAvailableAt && (
        <div className="flex items-start gap-3 bg-white/5 border border-muted/30 text-muted rounded-xl px-4 py-3 mb-4">
          <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">
              Free transfer{freeTransfers !== 1 ? "s" : ""} unlocking in
            </p>
            <CountdownTimer deadline={freeTransferAvailableAt} onExpired={() => router.refresh()} />
            <p className="text-xs text-muted/70 mt-1">
              A 12-hour wait applies after an elimination before you can swap players out.
            </p>
          </div>
        </div>
      )}

      {/* Tabs — only when both modes are available */}
      {showTabs && (
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-4 w-fit">
          <button
            onClick={() => handleTabSwitch("free")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "free" ? "bg-accent text-primary" : "text-muted hover:text-white"
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            Free Transfer
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === "free" ? "bg-primary/30" : "bg-white/10"}`}>
              {freeTransfers}
            </span>
          </button>
          <button
            onClick={() => handleTabSwitch("window")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "window" ? "bg-accent text-primary" : "text-muted hover:text-white"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Transfer Window
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === "window" ? "bg-primary/30" : "bg-white/10"}`}>
              {transfersRemaining}
            </span>
          </button>
        </div>
      )}

      {/* Free transfer info bar */}
      {isFreeTab && hasFreeTransfer && (
        <div className="flex items-start gap-3 bg-accent/10 border border-accent/30 text-accent rounded-xl px-4 py-3 mb-4">
          <Gift className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">
              {freeTransfers === 1 ? "You have 1 free transfer available" : `You have ${freeTransfers} free transfers available`}
            </p>
            <p className="text-xs text-accent/70 mt-0.5">
              Only players from eliminated nations can be swapped out — they are highlighted below.
            </p>
          </div>
        </div>
      )}

      {/* Window header — only when a window is actually open */}
      {!isFreeTab && isWindowOpen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-accent" />
              Transfer Window
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {Array.from({ length: maxTransfers }).map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < transfersUsed ? "bg-muted" : "bg-accent"}`} />
              ))}
              <span className="text-xs text-muted ml-1">
                {transfersRemaining === 0 ? "No transfers remaining" : `${transfersRemaining} transfer${transfersRemaining !== 1 ? "s" : ""} remaining`}
              </span>
            </div>
          </div>
          {windowClosesAt && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="text-xs">Closes in:</span>
              <CountdownTimer deadline={windowClosesAt} onExpired={() => router.refresh()} />
            </div>
          )}
        </div>
      )}

      {/* Window exhausted */}
      {!isFreeTab && isWindowOpen && transfersRemaining === 0 && (
        <div className="bg-muted/10 border border-muted/30 text-muted rounded-lg px-4 py-3 text-sm mb-4">
          You have used all {maxTransfers} transfers for this window. Come back next window.
        </div>
      )}

      {/* Next window countdown — shown in free tab when no window is open */}
      {isFreeTab && !isWindowOpen && nextWindowOpensAt && (
        <div className="card mb-4 border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Next transfer window</p>
                <p className="text-xs text-muted mt-0.5">
                  Opens {new Date(nextWindowOpensAt).toLocaleDateString("en-GB", {
                    weekday: "short", day: "numeric", month: "short",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="text-xs">Opens in</span>
              <CountdownTimer deadline={nextWindowOpensAt} onExpired={() => router.refresh()} />
            </div>
          </div>
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

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${!canTransfer ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Transfer Out */}
        <div className="card">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Transfer Out
          </h3>
          {isFreeTab && (
            <p className="text-xs text-muted mb-3">Eliminated players are highlighted — only these can use a free transfer.</p>
          )}
          <div className="space-y-2">
            {squad.map((player) => {
              const eliminated = isEliminated(player);
              const dimmed = isFreeTab && !eliminated;
              return (
                <div key={player.id} className={dimmed ? "opacity-30 pointer-events-none" : ""}>
                  {eliminated && isFreeTab && (
                    <div className="flex items-center gap-1 px-2 pb-0.5">
                      <span className="text-[10px] font-bold text-wc-red uppercase tracking-wide">Eliminated</span>
                    </div>
                  )}
                  <PlayerCard
                    player={player}
                    selectable={!dimmed}
                    selected={playerOut?.id === player.id}
                    displayPoints={player.total_points - (baselineMap[player.id] ?? 0)}
                    onClick={() => {
                      if (dimmed) return;
                      const next = playerOut?.id === player.id ? null : player;
                      setPlayerOut(next);
                      setPlayerIn(null);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Transfer In */}
        <div className="card">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Transfer In
          </h3>
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
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setPositionFilter("ALL")}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  positionFilter === "ALL" ? "bg-accent text-primary border-accent" : "border-muted/40 text-muted hover:border-muted"
                }`}
              >
                All
              </button>
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(positionFilter === pos ? "ALL" : pos)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    positionFilter === pos ? "bg-accent text-primary border-accent" : "border-muted/40 text-muted hover:border-muted"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {filteredAvailable.length === 0 && (
              <p className="text-muted text-sm text-center py-8">No available players match your filters.</p>
            )}
            {filteredAvailable.map((player) => {
              const teamName = Array.isArray(player.team) ? player.team[0]?.name : player.team?.name;
              const fixture = teamName ? nextFixtures[teamName] : undefined;
              return (
                <div key={player.id}>
                  <PlayerCard
                    player={player}
                    selectable
                    selected={playerIn?.id === player.id}
                    onClick={() => setPlayerIn(playerIn?.id === player.id ? null : player)}
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

      {/* Confirm */}
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
                <><Loader2 className="w-4 h-4 animate-spin" />Confirming…</>
              ) : (
                <><ArrowRightLeft className="w-4 h-4" />Confirm Transfer</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}