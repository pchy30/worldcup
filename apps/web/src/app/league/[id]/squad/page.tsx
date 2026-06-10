import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, Player, SquadPlayer, Transfer } from "@wcf/shared";
import PlayerCard from "@/components/PlayerCard";
import PositionBadge from "@/components/PositionBadge";
import TransferPanel from "./TransferPanel";
import NextWindowCard from "./NextWindowCard";
import { Target, Zap, Shield } from "lucide-react";

interface PageProps {
  params: { id: string };
}

export default async function SquadPage({ params }: PageProps) {
  const supabase = createClient();
  const { id } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (leagueError || !league) {
    notFound();
  }

  if (league.draft_status !== "completed") {
    redirect(`/league/${id}/lobby`);
  }

  // Fetch my squad
  const { data: squadRows } = await supabase
    .from("squad_players")
    .select("*, player:players(*, team:national_teams(*))")
    .eq("league_id", id)
    .eq("manager_id", user.id);

  const mySquad = ((squadRows as SquadPlayer[]) ?? []).map(
    (r) => r.player as Player
  ).filter(Boolean);

  // Check for open transfer window
  const now = new Date().toISOString();
  const { data: openWindow } = await supabase
    .from("transfer_windows")
    .select("*")
    .eq("league_id", id)
    .eq("status", "open")
    .lte("opens_at", now)
    .gte("closes_at", now)
    .maybeSingle();

  // Transfer history
  const { data: transferHistory } = await supabase
    .from("transfers")
    .select(
      "*, player_out:players!player_out_id(*, team:national_teams(*)), player_in:players!player_in_id(*, team:national_teams(*))"
    )
    .eq("league_id", id)
    .eq("manager_id", user.id)
    .order("confirmed_at", { ascending: false });

  // Fetch next upcoming window if none is open
  let nextWindowOpensAt: string | null = null;
  if (!openWindow) {
    const { data: nextWindow } = await supabase
      .from("transfer_windows")
      .select("opens_at")
      .eq("league_id", id)
      .eq("status", "closed")
      .gt("opens_at", now)
      .order("opens_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    nextWindowOpensAt = nextWindow?.opens_at ?? null;
  }

  // Count transfers used this window
  let transfersUsed = 0;
  if (openWindow) {
    const { count } = await supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("league_id", id)
      .eq("manager_id", user.id)
      .eq("transfer_window_id", openWindow.id);
    transfersUsed = count ?? 0;
  }

  // All available (undrafted) players if window is open
  let availablePlayers: Player[] = [];
  if (openWindow) {
    const { data: allSquads } = await supabase
      .from("squad_players")
      .select("player_id")
      .eq("league_id", id);

    const draftedIds = new Set((allSquads ?? []).map((r: { player_id: string }) => r.player_id));

    const { data: undrfted } = await supabase
      .from("players")
      .select("*, team:national_teams(*)")
      .order("total_points", { ascending: false });

    availablePlayers = ((undrfted as Player[]) ?? []).filter(
      (p) => !draftedIds.has(p.id)
    );
  }

  const totalPoints = mySquad.reduce((sum, p) => sum + p.total_points, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">{league.name}</h1>
          <p className="text-muted mt-1">My Squad</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-accent">{totalPoints}</p>
          <p className="text-xs text-muted uppercase tracking-wider">Total Points</p>
        </div>
      </div>

      {/* Pitch view */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-white mb-4">Squad ({mySquad.length}/7)</h2>
        {mySquad.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted">Your squad is empty. Something may have gone wrong.</p>
          </div>
        ) : (
          <div
            className="relative w-full rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #1a6b2f 0%, #1e7a35 25%, #1a6b2f 50%, #1e7a35 75%, #1a6b2f 100%)",
              minHeight: "clamp(320px, 60vw, 480px)",
            }}
          >
            {/* Pitch markings */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Centre circle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border border-white/20" />
              {/* Centre line */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-white/20" />
              {/* Penalty areas */}
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-40 h-16 border-b border-x border-white/20" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-40 h-16 border-t border-x border-white/20" />
            </div>

            {/* Players laid out by position row — FWD top, GK bottom */}
            <div className="relative z-10 flex flex-col justify-around h-full py-6 gap-4">
              {(["FWD", "MID", "DEF", "GK"] as const).map((pos) => {
                const posPlayers = mySquad.filter((p) => p.position === pos);
                if (posPlayers.length === 0) return null;
                return (
                  <div key={pos} className="flex justify-center gap-2 sm:gap-4 flex-wrap">
                    {posPlayers.map((player) => (
                      <div key={player.id} className="flex flex-col items-center gap-1 w-14 sm:w-20">
                        {/* Player token */}
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/60 flex items-center justify-center text-white font-bold text-sm shadow-lg backdrop-blur-sm">
                            {player.name.split(" ").pop()?.charAt(0).toUpperCase()}
                          </div>
                          {/* Points badge */}
                          <div className="absolute -top-1.5 -right-1.5 bg-accent text-primary text-xs font-extrabold rounded-full w-5 h-5 flex items-center justify-center shadow">
                            {player.total_points}
                          </div>
                        </div>
                        {/* Name */}
                        <p className="text-white text-xs font-semibold text-center leading-tight truncate w-full text-center drop-shadow">
                          {player.name.split(" ").pop()}
                        </p>
                        {/* Flag + position */}
                        <div className="flex items-center gap-1">
                          <PositionBadge position={player.position} />
                        </div>
                        {/* Stats */}
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
        )}
      </div>

      {/* Transfer section */}
      {openWindow && (
        <TransferPanel
          leagueId={id}
          mySquad={mySquad}
          availablePlayers={availablePlayers}
          windowId={openWindow.id}
          windowClosesAt={openWindow.closes_at}
          transfersUsed={transfersUsed}
          maxTransfers={2}
        />
      )}

      {!openWindow && (
        <NextWindowCard opensAt={nextWindowOpensAt} />
      )}

      {/* Transfer history */}
      {transferHistory && transferHistory.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Transfer History</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Out
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    In
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {(transferHistory as Transfer[]).map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-muted/10 hover:bg-primary/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.player_out && (
                          <PositionBadge position={t.player_out.position} />
                        )}
                        <span className="text-sm text-gray-300">
                          {t.player_out?.name ?? t.player_out_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.player_in && (
                          <PositionBadge position={t.player_in.position} />
                        )}
                        <span className="text-sm text-white font-medium">
                          {t.player_in?.name ?? t.player_in_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-muted">
                      {new Date(t.confirmed_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
