// Supabase Edge Function — called by a scheduled cron job every 30 minutes
// during the World Cup. Fetches live fixture results from API-Football and
// updates player goals/assists/clean_sheets/total_points, then recalculates
// all affected managers' points.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const WC_2026_SEASON = 2026;
const WC_LEAGUE_ID = 1; // API-Football league ID for FIFA World Cup

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ApiPlayerStats {
  player: { id: number };
  statistics: {
    goals: { total: number | null; assists: number | null };
    games: { position: string };
    cleansheets?: number | null;
  }[];
}

async function fetchTournamentStats(): Promise<ApiPlayerStats[]> {
  const url = `https://v3.football.api-sports.io/players?league=${WC_LEAGUE_ID}&season=${WC_2026_SEASON}&page=1`;
  const resp = await fetch(url, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!resp.ok) throw new Error(`API-Football error: ${resp.status}`);
  const data = await resp.json();
  return data.response as ApiPlayerStats[];
}

Deno.serve(async (_req) => {
  try {
    const stats = await fetchTournamentStats();

    for (const entry of stats) {
      const apiId = entry.player.id;
      const stat = entry.statistics[0];
      if (!stat) continue;

      const goals = stat.goals.total ?? 0;
      const assists = stat.goals.assists ?? 0;
      const cleanSheets = stat.cleansheets ?? 0;
      const position = stat.games.position?.toUpperCase().slice(0, 3) as string;

      const cleanSheetPoints =
        position === "GK" || position === "DEF" ? cleanSheets * 3 : 0;
      const totalPoints = goals * 4 + assists * 3 + cleanSheetPoints;

      const { error } = await supabase
        .from("players")
        .update({ goals, assists, clean_sheets: cleanSheets, total_points: totalPoints })
        .eq("api_football_id", apiId);

      if (error) console.error(`Failed to update player ${apiId}:`, error.message);
    }

    // Recalculate all manager points across all leagues
    const { data: squads } = await supabase
      .from("squad_players")
      .select("league_id, manager_id")
      .order("league_id");

    const seen = new Set<string>();
    for (const row of squads ?? []) {
      const key = `${row.league_id}:${row.manager_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await supabase.rpc("recalculate_manager_points", {
        p_league_id: row.league_id,
        p_manager_id: row.manager_id,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});