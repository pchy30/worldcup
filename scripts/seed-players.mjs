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

// Free tier: 10 req/min. Use 7s gap to stay well under the limit.
const RATE_LIMIT_MS = 7000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiFetch(path, attempt = 1) {
  const res = await fetch(`https://api.football-data.org/v4${path}`, {
    headers: { "X-Auth-Token": API_KEY },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("X-RequestCounter-Reset") ?? "60", 10);
    const waitMs = (retryAfter + 2) * 1000;
    console.warn(`  Rate limited. Waiting ${retryAfter + 2}s before retry (attempt ${attempt})...`);
    await sleep(waitMs);
    return apiFetch(path, attempt + 1);
  }

  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  return res.json();
}

async function run() {
  console.log("Fetching World Cup 2026 teams...");
  const data = await apiFetch("/competitions/WC/teams");
  const teams = data.teams;
  console.log(`Found ${teams.length} teams`);

  // Wait after the competition fetch before starting per-team requests
  await sleep(RATE_LIMIT_MS);

  const failed = [];

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    console.log(`\n[${i + 1}/${teams.length}] Processing ${team.name} (id: ${team.id})`);

    const code =
      team.tla?.slice(0, 3).toUpperCase() ??
      team.shortName?.slice(0, 3).toUpperCase() ??
      team.name.slice(0, 3).toUpperCase();

    // Upsert national team
    const { data: teamRow, error: teamErr } = await supabase
      .from("national_teams")
      .upsert(
        { name: team.name, code, flag_url: team.crest, api_football_id: team.id },
        { onConflict: "api_football_id" }
      )
      .select("id")
      .single();

    if (teamErr || !teamRow) {
      console.error(`  Failed to upsert team ${team.name}:`, teamErr?.message);
      failed.push(team.name);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Fetch squad (counts as one API request)
    let squadData;
    try {
      squadData = await apiFetch(`/teams/${team.id}`);
    } catch (err) {
      console.error(`  Failed to fetch squad for ${team.name}:`, err.message);
      failed.push(team.name);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const players = squadData.squad ?? [];
    console.log(`  ${players.length} players`);

    if (players.length === 0) {
      console.warn(`  WARNING: empty squad for ${team.name} — squad may not be published yet`);
      failed.push(`${team.name} (empty squad)`);
    }

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

    // Wait before next team's API request
    await sleep(RATE_LIMIT_MS);
  }

  if (failed.length > 0) {
    console.warn("\nTeams with issues (re-run to retry):");
    failed.forEach((t) => console.warn(`  - ${t}`));
  }

  console.log("\nDone!");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});