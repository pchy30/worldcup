import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, Player, SquadPlayer, Transfer } from "@wcf/shared";
import PlayerCard from "@/components/PlayerCard";
import PositionBadge from "@/components/PositionBadge";
import TransferPanel from "./TransferPanel";
import { Target, Zap, Shield, ArrowRightLeft } from "lucide-react";

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

      {/* Squad grid */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-white mb-4">
          Squad ({mySquad.length}/7)
        </h2>
        {mySquad.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted">Your squad is empty. Something may have gone wrong.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySquad.map((player) => (
              <div key={player.id} className="card group">
                <div className="flex items-start justify-between mb-3">
                  <PositionBadge position={player.position} size="md" />
                  <div className="text-right">
                    <span className="text-accent font-bold text-xl">
                      {player.total_points}
                    </span>
                    <span className="text-muted text-xs ml-1">pts</span>
                  </div>
                </div>
                <p className="font-bold text-white text-lg leading-tight mb-1">
                  {player.name}
                </p>
                {player.team && (
                  <p className="text-muted text-sm mb-3">{player.team.name}</p>
                )}
                <div className="flex items-center gap-4 pt-3 border-t border-muted/20">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Target className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-white font-semibold">{player.goals}</span>
                    <span className="text-muted text-xs">goals</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-white font-semibold">{player.assists}</span>
                    <span className="text-muted text-xs">assists</span>
                  </div>
                  {(player.position === "GK" || player.position === "DEF") && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-white font-semibold">{player.clean_sheets}</span>
                      <span className="text-muted text-xs">CS</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
        />
      )}

      {!openWindow && (
        <div className="card mb-8">
          <div className="flex items-center gap-3 text-muted">
            <ArrowRightLeft className="w-5 h-5" />
            <p className="text-sm">
              No transfer window is currently open. Check back when the next window opens.
            </p>
          </div>
        </div>
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
