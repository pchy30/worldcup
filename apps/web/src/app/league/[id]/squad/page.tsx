import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, Player, SquadPlayer, Transfer } from "@wcf/shared";
import PlayerCard from "@/components/PlayerCard";
import PositionBadge from "@/components/PositionBadge";
import TransferPanel from "./TransferPanel";
import NextWindowCard from "./NextWindowCard";
import SquadPitch from "./SquadPitch";
import { Star, ArrowLeft } from "lucide-react";
import Link from "next/link";

export interface NextFixture {
  opponent: string;
  date: string;
}

async function fetchNextFixtures(): Promise<Record<string, NextFixture>> {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return {};
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?status=SCHEDULED",
      { headers: { "X-Auth-Token": key }, next: { revalidate: 1800 } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const matches: {
      utcDate: string;
      homeTeam: { id: number; name: string };
      awayTeam: { id: number; name: string };
    }[] = data.matches ?? [];

    // Sort ascending and take first match per team — keyed by team name
    matches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
    const map: Record<string, NextFixture> = {};
    for (const m of matches) {
      const dateStr = new Date(m.utcDate).toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London",
      });
      const timeStr = new Date(m.utcDate).toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
      });
      const formatted = `${dateStr}, ${timeStr}`;
      if (!map[m.homeTeam.name]) map[m.homeTeam.name] = { opponent: m.awayTeam.name, date: formatted };
      if (!map[m.awayTeam.name]) map[m.awayTeam.name] = { opponent: m.homeTeam.name, date: formatted };
    }
    return map;
  } catch {
    return {};
  }
}

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

  // Keep full rows (with baseline_points) so pitch can show earned-since-joining points
  const mySquadRows = (squadRows as SquadPlayer[]) ?? [];
  const mySquad = mySquadRows.map((r) => {
    const p = Array.isArray(r.player) ? r.player[0] : r.player;
    return p as Player;
  }).filter(Boolean);

  // Fetch my picked national teams (bonus teams)
  const { data: myBonusTeams } = await supabase
    .from("manager_national_teams")
    .select("round, team:national_teams(id, name, flag_url, code, bonus_points)")
    .eq("league_id", id)
    .eq("manager_id", user.id)
    .order("round", { ascending: true });

  // Check for open transfer window — use time range only, status is unreliable
  const now = new Date().toISOString();
  const { data: openWindow } = await supabase
    .from("transfer_windows")
    .select("*")
    .eq("league_id", id)
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

  // Fetch manager's free transfer balance and cooldown
  const { data: memberRow } = await supabase
    .from("league_members")
    .select("free_transfers, free_transfer_available_at, total_points")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .single();
  const freeTransfers = memberRow?.free_transfers ?? 0;
  const freeTransferAvailableAt: string | null = memberRow?.free_transfer_available_at ?? null;

  const showTransferPanel = !!openWindow || freeTransfers > 0;

  // All available players if window is open OR free transfer available
  let availablePlayers: Player[] = [];
  let nextFixtures: Record<string, NextFixture> = {};
  if (showTransferPanel) {
    const { data: allPlayersRaw } = await supabase
      .from("players")
      .select("*, team:national_teams(*)")
      .order("total_points", { ascending: false });

    const allPlayers = (allPlayersRaw as Player[]) ?? [];

    if (league.knockout_mode) {
      const myPlayerIds = new Set(mySquad.map((p) => p.id));
      availablePlayers = allPlayers.filter((p) => {
        if (myPlayerIds.has(p.id)) return false;
        const team = Array.isArray(p.team) ? p.team[0] : p.team;
        return !team?.is_eliminated;
      });
    } else {
      const { data: allSquads } = await supabase
        .from("squad_players")
        .select("player_id")
        .eq("league_id", id);

      const draftedIds = new Set((allSquads ?? []).map((r: { player_id: string }) => r.player_id));
      availablePlayers = allPlayers.filter((p) => !draftedIds.has(p.id));
    }

    nextFixtures = await fetchNextFixtures();
  }

  const totalPoints = memberRow?.total_points ?? 0;

  // baseline_points keyed by player_id — used by TransferPanel to show earned pts
  const baselineMap: Record<string, number> = {};
  for (const r of mySquadRows) {
    baselineMap[r.player_id] = r.baseline_points ?? 0;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href={`/league/${id}/leaderboard`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Leaderboard
          </Link>
          <h1 className="text-3xl font-bold text-white">{league.name}</h1>
          <p className="text-muted mt-1">My Squad</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-accent">{totalPoints}</p>
          <p className="text-xs text-muted uppercase tracking-wider">Total Points</p>
        </div>
      </div>

      {/* Bonus national teams */}
      {myBonusTeams && myBonusTeams.length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Your Bonus Teams</h2>
            <span className="text-xs text-muted ml-1">Win +3 pts · Draw +1 pt</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {myBonusTeams.map((pick, i) => {
              const team = Array.isArray(pick.team) ? pick.team[0] : pick.team;
              if (!team) return null;
              const teamAny = team as typeof team & { bonus_points?: number };
              return (
                <div key={i} className="flex items-center gap-2 bg-primary/60 border border-muted/20 rounded-lg px-3 py-2">
                  {team.flag_url ? (
                    <img src={team.flag_url} alt={team.code} className="w-7 h-5 object-cover rounded" />
                  ) : (
                    <span className="text-xs text-muted font-bold">{team.code}</span>
                  )}
                  <span className="text-sm text-white font-medium">{team.name}</span>
                  {(teamAny.bonus_points ?? 0) > 0 && (
                    <span className="text-xs font-bold text-accent">+{teamAny.bonus_points}</span>
                  )}
                  <span className="text-xs text-muted">R{pick.round}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pitch view */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-white mb-4">Squad ({mySquad.length}/11)</h2>
        {mySquadRows.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted">Your squad is empty. Something may have gone wrong.</p>
          </div>
        ) : (
          <SquadPitch squadRows={mySquadRows as (SquadPlayer & { player: Player })[]} />
        )}
      </div>

      {/* Transfer section */}
      {showTransferPanel && (
        <TransferPanel
          leagueId={id}
          mySquad={mySquad}
          baselineMap={baselineMap}
          availablePlayers={availablePlayers}
          windowId={openWindow?.id ?? null}
          windowClosesAt={openWindow?.closes_at ?? null}
          transfersUsed={transfersUsed}
          maxTransfers={2}
          freeTransfers={freeTransfers}
          freeTransferAvailableAt={freeTransferAvailableAt}
          nextFixtures={nextFixtures}
        />
      )}

      {!showTransferPanel && (
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
