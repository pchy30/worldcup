import { createClient } from "@/lib/supabase/server";
import PositionBadge from "@/components/PositionBadge";
import { BarChart2, Target, Zap, Shield } from "lucide-react";

const PERIOD_DAYS = 3;

// WC 2026 group stage starts June 11 2026
const TOURNAMENT_START = new Date("2026-06-11");

interface Player {
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  total_points: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  team: { name: string; flag_url: string | null } | null;
}

interface Snapshot {
  player_id: string;
  snapshot_date: string;
  total_points: number;
}

interface Period {
  label: string;
  startDate: string;
  endDate: string;
  players: { player: Player; points: number }[];
}

function buildPeriods(
  allPlayers: Player[],
  snapshots: Snapshot[],
  today: Date
): Period[] {
  const playerMap = new Map<string, Player>();
  for (const p of allPlayers) playerMap.set(p.id, p);

  // Group snapshots by date
  const byDate = new Map<string, Map<string, number>>();
  for (const s of snapshots) {
    if (!byDate.has(s.snapshot_date)) byDate.set(s.snapshot_date, new Map());
    byDate.get(s.snapshot_date)!.set(s.player_id, s.total_points);
  }

  const periods: Period[] = [];
  let periodStart = new Date(TOURNAMENT_START);

  while (periodStart <= today) {
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS - 1);
    const clampedEnd = periodEnd > today ? today : periodEnd;

    const startStr = periodStart.toISOString().slice(0, 10);
    const endStr = clampedEnd.toISOString().slice(0, 10);

    // Find the snapshot just before this period starts (baseline)
    const dayBefore = new Date(periodStart);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

    const baselineSnap = byDate.get(dayBeforeStr);

    // Use the most recent snapshot within the period (not necessarily the last day)
    const availableDates = Array.from(byDate.keys())
      .filter((d) => d >= startStr && d <= endStr)
      .sort();
    const bestDateStr = availableDates[availableDates.length - 1];
    const endSnap = bestDateStr ? byDate.get(bestDateStr) : undefined;

    if (endSnap && endSnap.size > 0) {
      const playerPoints: { player: Player; points: number }[] = [];
      for (const [playerId, endPts] of endSnap.entries()) {
        const basePts = baselineSnap?.get(playerId) ?? 0;
        const delta = Math.max(0, endPts - basePts);
        if (delta > 0) {
          const player = playerMap.get(playerId);
          if (player) playerPoints.push({ player, points: delta });
        }
      }

      playerPoints.sort((a, b) => b.points - a.points);

      const startFormatted = new Date(startStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      const endFormatted = new Date(endStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });

      periods.push({
        label: `${startFormatted} – ${endFormatted}`,
        startDate: startStr,
        endDate: endStr,
        players: playerPoints.slice(0, 20),
      });
    }

    periodStart.setDate(periodStart.getDate() + PERIOD_DAYS);
  }

  return periods.reverse(); // most recent first
}

function PlayerTable({
  players,
  showPoints = true,
}: {
  players: { player: Player; points: number }[];
  showPoints?: boolean;
}) {
  if (players.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-8">
        No data yet for this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-muted/20">
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider w-8">#</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Player</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">Team</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
              {showPoints ? "Pts" : "Period Pts"}
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
              <span className="flex items-center justify-end gap-1"><Target className="w-3 h-3" /> G</span>
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
              <span className="flex items-center justify-end gap-1"><Zap className="w-3 h-3" /> A</span>
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">
              <span className="flex items-center justify-end gap-1"><Shield className="w-3 h-3" /> CS</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map(({ player, points }, idx) => (
            <tr
              key={player.id}
              className={`border-b border-muted/10 hover:bg-primary/20 transition-colors ${
                idx < 3 ? "bg-accent/5" : ""
              }`}
            >
              <td className="px-4 py-3 text-sm font-bold text-muted">{idx + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <PositionBadge position={player.position} />
                  <span className="text-white font-medium text-sm">{player.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">
                {player.team?.name ?? "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-accent font-bold text-base">{points}</span>
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-300 hidden sm:table-cell">
                {player.goals}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-300 hidden sm:table-cell">
                {player.assists}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-300 hidden md:table-cell">
                {player.clean_sheets}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PlayersPage() {
  const supabase = createClient();

  const { data: playersRaw } = await supabase
    .from("players")
    .select("id, name, position, total_points, goals, assists, clean_sheets, team:national_teams(name, flag_url)")
    .order("total_points", { ascending: false })
    .limit(200);

  const allPlayers = (playersRaw ?? []).map((p) => ({
    ...p,
    team: Array.isArray(p.team) ? (p.team[0] ?? null) : p.team,
  })) as Player[];

  // Overall top 20
  const overall = allPlayers.slice(0, 20).map((p) => ({ player: p, points: p.total_points }));

  // Snapshots for period breakdown
  const { data: snapshotsRaw } = await supabase
    .from("player_point_snapshots")
    .select("player_id, snapshot_date, total_points")
    .order("snapshot_date", { ascending: true });

  const snapshots = (snapshotsRaw ?? []) as Snapshot[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const periods = buildPeriods(allPlayers, snapshots, today);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Player Stats</h1>
          <p className="text-muted text-sm mt-0.5">Top 20 by points — overall and by 3-day period</p>
        </div>
      </div>

      {/* Overall */}
      <div className="card overflow-hidden p-0 mb-10">
        <div className="px-4 py-4 border-b border-muted/20 flex items-center gap-2">
          <span className="text-base font-bold text-white">Overall Top 20</span>
          <span className="text-xs text-muted ml-1">all tournament</span>
        </div>
        <PlayerTable players={overall} />
      </div>

      {/* Per-period */}
      <h2 className="text-xl font-bold text-white mb-4">3-Day Periods</h2>

      {periods.length === 0 ? (
        <div className="card text-center py-12">
          <BarChart2 className="w-8 h-8 mx-auto mb-3 text-muted opacity-40" />
          <p className="text-muted text-sm">
            Period breakdowns will appear once daily snapshots start accumulating.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {periods.map((period) => (
            <div key={period.startDate} className="card overflow-hidden p-0">
              <div className="px-4 py-4 border-b border-muted/20 flex items-center gap-2">
                <span className="text-base font-bold text-white">{period.label}</span>
              </div>
              <PlayerTable players={period.players} showPoints={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
