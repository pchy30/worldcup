// Supabase Edge Function — runs every 30 minutes via cron.
// Fetches WC 2026 scorers + match results from football-data.org,
// calculates goals/assists/clean_sheets, updates players and manager points.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const FOOTBALL_DATA_KEY = Deno.env.get("FOOTBALL_DATA_KEY")!;

async function apiFetch(path: string) {
  const res = await fetch(`https://api.football-data.org/v4${path}`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
  });
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  return res.json();
}

Deno.serve(async (_req) => {
  try {
    // 1. Fetch scorers (goals + assists)
    const scorersData = await apiFetch("/competitions/WC/scorers?limit=100");
    const scorers = scorersData.scorers ?? [];

    // Build map of playerId -> { goals, assists }
    const statsMap = new Map<number, { goals: number; assists: number }>();
    for (const entry of scorers) {
      statsMap.set(entry.player.id, {
        goals: entry.goals ?? 0,
        assists: entry.assists ?? 0,
      });
    }

    // 2. Fetch finished matches
    const matchesData = await apiFetch("/competitions/WC/matches?status=FINISHED");
    const matches = matchesData.matches ?? [];

    // Build per-player clean sheet count — only for players who actually played
    // cleanSheetMap: player api_football_id -> number of clean sheets
    const cleanSheetMap = new Map<number, number>();

    for (const match of matches) {
      const homeGoals = match.score?.fullTime?.home ?? 0;
      const awayGoals = match.score?.fullTime?.away ?? 0;
      const homeKeptCleanSheet = awayGoals === 0;
      const awayKeptCleanSheet = homeGoals === 0;
      if (!homeKeptCleanSheet && !awayKeptCleanSheet) continue;

      const homeTeamId = match.homeTeam?.id;
      const awayTeamId = match.awayTeam?.id;

      if (homeKeptCleanSheet && homeTeamId) {
        cleanSheetMap.set(homeTeamId, (cleanSheetMap.get(homeTeamId) ?? 0) + 1);
      }
      if (awayKeptCleanSheet && awayTeamId) {
        cleanSheetMap.set(awayTeamId, (cleanSheetMap.get(awayTeamId) ?? 0) + 1);
      }
    }

    // 3. Fetch all GK/DEF players with their team's api_football_id
    const { data: players } = await supabase
      .from("players")
      .select("id, api_football_id, position, team:national_teams(api_football_id)")
      .in("position", ["GK", "DEF"]);

    // Update GK/DEF — clean sheets by team
    for (const player of players ?? []) {
      const team = Array.isArray(player.team) ? player.team[0] : player.team;
      const teamApiId = (team as { api_football_id: number } | null)?.api_football_id;
      if (!teamApiId) continue;

      const cleanSheets = cleanSheetMap.get(teamApiId) ?? 0;
      const goals = statsMap.get(player.api_football_id)?.goals ?? 0;
      const assists = statsMap.get(player.api_football_id)?.assists ?? 0;
      const totalPoints = goals * 4 + assists * 3 + cleanSheets * 3;

      await supabase
        .from("players")
        .update({ goals, assists, clean_sheets: cleanSheets, total_points: totalPoints })
        .eq("id", player.id);

      statsMap.delete(player.api_football_id);
    }

    // 4. Update remaining players (MID/FWD) from scorers map
    for (const [apiId, stats] of statsMap.entries()) {
      const totalPoints = stats.goals * 4 + stats.assists * 3;
      await supabase
        .from("players")
        .update({ goals: stats.goals, assists: stats.assists, clean_sheets: 0, total_points: totalPoints })
        .eq("api_football_id", apiId);
    }

    // 5a. Calculate national team bonus points per manager per league
    // Win = +3, Draw = +1 for each team the manager picked
    const { data: allManagerTeams } = await supabase
      .from("manager_national_teams")
      .select("manager_id, league_id, team_id");

    // Build map of team api_football_id -> {wins, draws}
    const teamResultMap = new Map<number, { wins: number; draws: number }>();
    for (const match of matches) {
      const homeGoals = match.score?.fullTime?.home ?? 0;
      const awayGoals = match.score?.fullTime?.away ?? 0;
      const homeTeamId = match.homeTeam?.id;
      const awayTeamId = match.awayTeam?.id;
      if (!homeTeamId || !awayTeamId) continue;

      if (homeGoals > awayGoals) {
        const prev = teamResultMap.get(homeTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(homeTeamId, { ...prev, wins: prev.wins + 1 });
      } else if (awayGoals > homeGoals) {
        const prev = teamResultMap.get(awayTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(awayTeamId, { ...prev, wins: prev.wins + 1 });
      } else {
        const prevH = teamResultMap.get(homeTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(homeTeamId, { ...prevH, draws: prevH.draws + 1 });
        const prevA = teamResultMap.get(awayTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(awayTeamId, { ...prevA, draws: prevA.draws + 1 });
      }
    }

    // Fetch national_teams api_football_id map
    const { data: allNationalTeams } = await supabase
      .from("national_teams")
      .select("id, api_football_id");

    const teamApiIdMap = new Map<string, number>();
    for (const t of allNationalTeams ?? []) {
      if (t.api_football_id) teamApiIdMap.set(t.id, t.api_football_id);
    }

    // Build bonus per (manager_id, league_id)
    const bonusMap = new Map<string, number>();
    for (const row of allManagerTeams ?? []) {
      const apiId = teamApiIdMap.get(row.team_id);
      if (!apiId) continue;
      const result = teamResultMap.get(apiId);
      if (!result) continue;
      const bonus = result.wins * 3 + result.draws * 1;
      const key = `${row.manager_id}::${row.league_id}`;
      bonusMap.set(key, (bonusMap.get(key) ?? 0) + bonus);
    }

    // 5. Recalculate league_members totals from squad_players
    // Only count points scored after the player joined the squad (baseline_points)
    const { data: squadRows } = await supabase
      .from("squad_players")
      .select("manager_id, league_id, baseline_points, player:players(total_points, goals, assists)");

    // Aggregate per (manager_id, league_id)
    const memberMap = new Map<string, { total_points: number; goals_scored: number; assists: number; highest: number }>();
    for (const row of squadRows ?? []) {
      const player = Array.isArray(row.player) ? row.player[0] : row.player;
      if (!player) continue;
      const key = `${row.manager_id}::${row.league_id}`;
      const existing = memberMap.get(key) ?? { total_points: 0, goals_scored: 0, assists: 0, highest: 0 };
      const earnedPoints = Math.max(0, (player.total_points ?? 0) - (row.baseline_points ?? 0));
      existing.total_points += earnedPoints;
      existing.goals_scored += player.goals ?? 0;
      existing.assists += player.assists ?? 0;
      existing.highest = Math.max(existing.highest, earnedPoints);
      memberMap.set(key, existing);
    }

    for (const [key, totals] of memberMap.entries()) {
      const [manager_id, league_id] = key.split("::");
      const bonus = bonusMap.get(key) ?? 0;
      await supabase
        .from("league_members")
        .update({
          total_points: totals.total_points + bonus,
          bonus_points: bonus,
          goals_scored: totals.goals_scored,
          assists: totals.assists,
          highest_individual_player_points: totals.highest,
        })
        .eq("user_id", manager_id)
        .eq("league_id", league_id);
    }

    // 6. Snapshot all player points for today (upsert so only one row per player per day)
    const today = new Date().toISOString().slice(0, 10);
    const { data: allPlayers } = await supabase
      .from("players")
      .select("id, total_points");

    if (allPlayers && allPlayers.length > 0) {
      const snapshots = allPlayers.map((p: { id: string; total_points: number }) => ({
        player_id: p.id,
        snapshot_date: today,
        total_points: p.total_points,
      }));
      await supabase
        .from("player_point_snapshots")
        .upsert(snapshots, { onConflict: "player_id,snapshot_date" });
    }

    return new Response(
      JSON.stringify({ ok: true, scorers: scorers.length, matches: matches.length, managers_updated: memberMap.size }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});