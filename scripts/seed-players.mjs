// Seed script: fetches World Cup 2026 squads from football-data.org and inserts
// national_teams + players into Supabase.
//
// Usage:
//   FOOTBALL_DATA_KEY=xxx SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-players.mjs

import { createClient } from "@supabase/supabase-js";

const API_KEY = process.env.FOOTBALL_DATA_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required env vars: FOOTBALL_DATA_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const POSITION_MAP = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Attacker: "FWD",
  Offence: "FWD",
  Defence: "DEF",
  Midfield: "MID",
};

async function apiFetch(path) {
  const res = await fetch(`https://api.football-data.org/v4${path}`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  return res.json();
}

async function run() {
  console.log("Fetching World Cup 2026 teams...");
  const data = await apiFetch("/competitions/WC/teams");
  const teams = data.teams;
  console.log(`Found ${teams.length} teams`);

  for (const team of teams) {
    console.log(`\nProcessing ${team.name} (id: ${team.id})`);

    const code = team.tla?.slice(0, 3).toUpperCase() ?? team.shortName?.slice(0, 3).toUpperCase() ?? team.name.slice(0, 3).toUpperCase();

    // Upsert national team
    const { data: teamRow, error: teamErr } = await supabase
      .from("national_teams")
      .upsert(
        {
          name: team.name,
          code,
          flag_url: team.crest,
          api_football_id: team.id,
        },
        { onConflict: "api_football_id" }
      )
      .select("id")
      .single();

    if (teamErr || !teamRow) {
      console.error(`  Failed to upsert team ${team.name}:`, teamErr?.message);
      continue;
    }

    // Fetch squad
    const squadData = await apiFetch(`/teams/${team.id}`);
    const players = squadData.squad ?? [];
    console.log(`  ${players.length} players`);

    for (const player of players) {
      const position = POSITION_MAP[player.position] ?? "MID";

      const { error: playerErr } = await supabase.from("players").upsert(
        {
          name: player.name,
          position,
          team_id: teamRow.id,
          api_football_id: player.id,
          goals: 0,
          assists: 0,
          clean_sheets: 0,
          total_points: 0,
        },
        { onConflict: "api_football_id" }
      );

      if (playerErr) {
        console.error(`    Failed to upsert player ${player.name}:`, playerErr.message);
      }
    }

    // Respect rate limit (10 requests/minute on free tier)
    await new Promise((r) => setTimeout(r, 6000));
  }

  console.log("\nDone!");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});