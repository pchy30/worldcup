// Supabase Edge Function — runs every 30 minutes via cron.
// Fetches live World Cup 2026 player stats from football-data.org
// and updates player goals/assists/clean_sheets/total_points,
// then the DB trigger recalculates all affected manager points.

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

function mapPosition(pos: string): string {
  const map: Record<string, string> = {
    Goalkeeper: "GK",
    Defender: "DEF",
    Midfielder: "MID",
    Attacker: "FWD",
    Offence: "FWD",
    Defence: "DEF",
    Midfield: "MID",
  };
  return map[pos] ?? "MID";
}

Deno.serve(async (_req) => {
  try {
    // Fetch all WC 2026 scorers
    const scorersData = await apiFetch("/competitions/WC/scorers?limit=100");
    const scorers = scorersData.scorers ?? [];

    for (const entry of scorers) {
      const playerId = entry.player.id;
      const goals = entry.goals ?? 0;
      const assists = entry.assists ?? 0;
      const position = mapPosition(entry.player.position ?? "");

      const cleanSheetPoints = 0; // football-data.org free tier doesn't provide clean sheets
      const totalPoints = goals * 4 + assists * 3 + cleanSheetPoints;

      const { error } = await supabase
        .from("players")
        .update({ goals, assists, total_points: totalPoints })
        .eq("api_football_id", playerId);

      if (error) {
        console.error(`Failed to update player ${playerId}:`, error.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, synced: scorers.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});