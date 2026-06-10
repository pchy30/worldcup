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

    // 2. Fetch finished matches to calculate clean sheets
    const matchesData = await apiFetch("/competitions/WC/matches?status=FINISHED");
    const matches = matchesData.matches ?? [];

    // Build map of api_football_id (team) -> clean sheet count
    const cleanSheetMap = new Map<number, number>();
    for (const match of matches) {
      const homeGoals = match.score?.fullTime?.home ?? 0;
      const awayGoals = match.score?.fullTime?.away ?? 0;
      const homeTeamId = match.homeTeam?.id;
      const awayTeamId = match.awayTeam?.id;

      if (awayGoals === 0 && homeTeamId) {
        cleanSheetMap.set(homeTeamId, (cleanSheetMap.get(homeTeamId) ?? 0) + 1);
      }
      if (homeGoals === 0 && awayTeamId) {
        cleanSheetMap.set(awayTeamId, (cleanSheetMap.get(awayTeamId) ?? 0) + 1);
      }
    }

    // 3. Fetch all GK/DEF players with their team's api_football_id
    const { data: players } = await supabase
      .from("players")
      .select("id, api_football_id, position, team:national_teams(api_football_id)")
      .in("position", ["GK", "DEF"]);

    // Update GK/DEF clean sheets
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

    return new Response(
      JSON.stringify({ ok: true, scorers: scorers.length, matches: matches.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});