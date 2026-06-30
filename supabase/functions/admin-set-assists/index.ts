// Admin endpoint to set the definitive assists list for all players.
// Accepts the full current list — safe to re-run (idempotent).
// Any player not in the list gets assists set to 0.
//
// POST body: { assists: [{ name: string, assists: number }] }
//
// Example:
//   curl -X POST https://<project>.supabase.co/functions/v1/admin-set-assists \
//     -H "Authorization: Bearer <service_role_key>" \
//     -H "Content-Type: application/json" \
//     -d '{"assists":[{"name":"Bruno Guimaraes","assists":1},{"name":"Christian Pulisic","assists":1}]}'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }

  let body: { assists: { name: string; assists: number }[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const incoming = body.assists ?? [];
  if (!Array.isArray(incoming)) {
    return new Response(JSON.stringify({ error: "assists must be an array" }), { status: 400 });
  }

  // Fetch all players with their current stats and card counts
  const { data: allPlayers, error: fetchErr } = await supabase
    .from("players")
    .select("id, name, position, goals, assists, clean_sheets, yellow_cards, red_cards");

  if (fetchErr || !allPlayers) {
    return new Response(JSON.stringify({ error: fetchErr?.message ?? "Failed to fetch players" }), { status: 500 });
  }

  // Build a lookup: lowercase name -> assists count from the incoming list
  const assistLookup = new Map<string, number>();
  for (const entry of incoming) {
    assistLookup.set(entry.name.toLowerCase().trim(), entry.assists ?? 0);
  }

  const updated: string[] = [];
  const notFound: string[] = [];

  // Check all incoming names resolve to a player
  for (const entry of incoming) {
    const key = entry.name.toLowerCase().trim();
    const match = allPlayers.find((p) => p.name.toLowerCase() === key);
    if (!match) notFound.push(entry.name);
  }

  // Only update players explicitly in the list — everyone else is left untouched
  for (const player of allPlayers) {
    const key = player.name.toLowerCase();
    if (!assistLookup.has(key)) continue;

    const newAssists = assistLookup.get(key)!;
    const goals = player.goals ?? 0;
    const cleanSheets = player.clean_sheets ?? 0;
    const cardDeductions = (player.yellow_cards ?? 0) * 1 + (player.red_cards ?? 0) * 3;

    let totalPoints: number;
    if (player.position === "GK" || player.position === "DEF") {
      totalPoints = goals * 5 + newAssists * 3 + cleanSheets * 3 - cardDeductions;
    } else {
      totalPoints = goals * 5 + newAssists * 3 - cardDeductions;
    }

    const { error: updateErr } = await supabase
      .from("players")
      .update({ assists: newAssists, total_points: totalPoints })
      .eq("id", player.id);

    if (updateErr) {
      console.error(`Failed to update ${player.name}:`, updateErr.message);
    } else if (newAssists !== (player.assists ?? 0)) {
      updated.push(`${player.name}: ${player.assists ?? 0} → ${newAssists}`);
    }
  }

  // Recalculate league_members totals from squad_players
  const { data: squadRows } = await supabase
    .from("squad_players")
    .select("manager_id, league_id, baseline_points, player:players(total_points, goals, assists)");

  const { data: allManagerTeams } = await supabase
    .from("manager_national_teams")
    .select("manager_id, league_id, team_id");

  const { data: allNationalTeams } = await supabase
    .from("national_teams")
    .select("id, api_football_id");

  // Recalculate bonus points (wins/draws) from league_members existing bonus_points
  // We don't re-fetch match results here — just preserve existing bonus_points
  const { data: existingMembers } = await supabase
    .from("league_members")
    .select("user_id, league_id, bonus_points, banked_points");

  const bonusMap = new Map<string, number>();
  const bankedMap = new Map<string, number>();
  for (const m of existingMembers ?? []) {
    bonusMap.set(`${m.user_id}::${m.league_id}`, m.bonus_points ?? 0);
    bankedMap.set(`${m.user_id}::${m.league_id}`, m.banked_points ?? 0);
  }

  const memberMap = new Map<string, { total_points: number; goals_scored: number; assists: number; highest: number }>();
  for (const row of squadRows ?? []) {
    const player = Array.isArray(row.player) ? row.player[0] : row.player;
    if (!player) continue;
    const key = `${row.manager_id}::${row.league_id}`;
    const existing = memberMap.get(key) ?? { total_points: 0, goals_scored: 0, assists: 0, highest: 0 };
    const earnedPoints = (player.total_points ?? 0) - (row.baseline_points ?? 0);
    existing.total_points += earnedPoints;
    existing.goals_scored += player.goals ?? 0;
    existing.assists += player.assists ?? 0;
    existing.highest = Math.max(existing.highest, earnedPoints);
    memberMap.set(key, existing);
  }

  let managersUpdated = 0;
  for (const [key, totals] of memberMap.entries()) {
    const [manager_id, league_id] = key.split("::");
    const bonus = bonusMap.get(key) ?? 0;
    const banked = bankedMap.get(key) ?? 0;
    await supabase
      .from("league_members")
      .update({
        total_points: totals.total_points + bonus + banked,
        goals_scored: totals.goals_scored,
        assists: totals.assists,
        highest_individual_player_points: totals.highest,
      })
      .eq("user_id", manager_id)
      .eq("league_id", league_id);
    managersUpdated++;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      players_updated: updated,
      not_found: notFound,
      managers_updated: managersUpdated,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});