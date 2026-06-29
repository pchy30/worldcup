// Supabase Edge Function — runs every 30 minutes via cron.
// Fetches WC 2026 scorers + match results from football-data.org,
// calculates goals/assists/clean_sheets/cards, updates players and manager points.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const FOOTBALL_DATA_KEY = Deno.env.get("FOOTBALL_DATA_KEY")!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiFetch(path: string, attempt = 1): Promise<any> {
  const res = await fetch(`https://api.football-data.org/v4${path}`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("X-RequestCounter-Reset") ?? "60", 10);
    console.warn(`Rate limited on ${path}, waiting ${retryAfter + 2}s (attempt ${attempt})`);
    await sleep((retryAfter + 2) * 1000);
    return apiFetch(path, attempt + 1);
  }

  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  return res.json();
}

Deno.serve(async (_req) => {
  try {
    // 1. Fetch scorers and all matches (finished + scheduled) in parallel
    // All matches needed to detect when a full stage is complete
    const [scorersData, matchesData] = await Promise.all([
      apiFetch("/competitions/WC/scorers?limit=500"),
      apiFetch("/competitions/WC/matches"),
    ]);
    const scorers = scorersData.scorers ?? [];
    const allMatches = matchesData.matches ?? [];
    const matches = allMatches.filter((m: { status: string }) => m.status === "FINISHED");

    // Build map of playerId -> { goals, assists }
    const statsMap = new Map<number, { goals: number; assists: number }>();
    for (const entry of scorers) {
      statsMap.set(entry.player.id, {
        goals: entry.goals ?? 0,
        assists: entry.assists ?? 0,
      });
    }

    // Cards are managed manually — auto card detection disabled.
    const newlyFinished: any[] = [];
    const cardMap = new Map<number, { yellow: number; red: number }>();

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

    // 3. Fetch all GK/DEF players with their team's api_football_id and card counts
    const { data: players } = await supabase
      .from("players")
      .select("id, api_football_id, position, assists, yellow_cards, red_cards, team:national_teams(api_football_id)")
      .in("position", ["GK", "DEF"]);

    // Update GK/DEF — clean sheets by team
    for (const player of players ?? []) {
      const team = Array.isArray(player.team) ? player.team[0] : player.team;
      const teamApiId = (team as { api_football_id: number } | null)?.api_football_id;
      if (!teamApiId) continue;

      const cleanSheets = cleanSheetMap.get(teamApiId) ?? 0;
      const goals = statsMap.get(player.api_football_id)?.goals ?? 0;
      const assists = player.assists ?? 0;
      const cardDeductions = (player.yellow_cards ?? 0) * 1 + (player.red_cards ?? 0) * 3;
      const totalPoints = goals * 5 + assists * 3 + cleanSheets * 3 - cardDeductions;

      await supabase
        .from("players")
        .update({ goals, assists, clean_sheets: cleanSheets, total_points: totalPoints })
        .eq("id", player.id);

      statsMap.delete(player.api_football_id);
    }

    // 4. Update all MID/FWD players — scorers get stats from map, others get 0
    // Fetch all MID/FWD with card counts so deductions apply even to non-scorers
    const { data: midFwdPlayers } = await supabase
      .from("players")
      .select("id, api_football_id, assists, yellow_cards, red_cards")
      .in("position", ["MID", "FWD"]);

    for (const player of midFwdPlayers ?? []) {
      const apiStats = statsMap.get(player.api_football_id) ?? { goals: 0, assists: 0 };
      const assists = player.assists ?? 0;
      const cardDeductions = (player.yellow_cards ?? 0) * 1 + (player.red_cards ?? 0) * 3;
      const totalPoints = apiStats.goals * 5 + assists * 3 - cardDeductions;
      await supabase
        .from("players")
        .update({ goals: apiStats.goals, assists, clean_sheets: 0, total_points: totalPoints })
        .eq("id", player.id);
    }

    // 4a. Auto-enable knockout mode and bump per-team player cap when a full stage completes.
    // A stage is "complete" only when every match in that stage is FINISHED.
    function stageComplete(stage: string): boolean {
      const stageMatches = allMatches.filter((m: { stage: string }) => m.stage === stage);
      return stageMatches.length > 0 && stageMatches.every((m: { status: string }) => m.status === "FINISHED");
    }

    const qfComplete = stageComplete("QUARTER_FINALS");
    const sfComplete = stageComplete("SEMI_FINALS");
    const finalComplete = stageComplete("FINAL");
    const hasAnyQF = allMatches.some((m: { stage: string }) => m.stage === "QUARTER_FINALS");

    // Enable knockout mode as soon as QF matches appear (regardless of completion)
    if (hasAnyQF) {
      await supabase.from("leagues").update({ knockout_mode: true }).eq("knockout_mode", false);
    }
    // Bump cap only once the last match of each stage is done — only increase, never decrease
    if (finalComplete) {
      await supabase.from("leagues").update({ max_team_players: 99 }).lt("max_team_players", 99);
    } else if (sfComplete) {
      await supabase.from("leagues").update({ max_team_players: 4 }).lt("max_team_players", 4);
    } else if (qfComplete) {
      await supabase.from("leagues").update({ max_team_players: 3 }).lt("max_team_players", 3);
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

      // In knockout matches, use score.winner (accounts for extra time / penalties)
      // score.winner is "HOME_TEAM", "AWAY_TEAM", or "DRAW" (group stage only)
      const winner = match.score?.winner;

      if (winner === "HOME_TEAM" || (!winner && homeGoals > awayGoals)) {
        const prev = teamResultMap.get(homeTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(homeTeamId, { ...prev, wins: prev.wins + 1 });
      } else if (winner === "AWAY_TEAM" || (!winner && awayGoals > homeGoals)) {
        const prev = teamResultMap.get(awayTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(awayTeamId, { ...prev, wins: prev.wins + 1 });
      } else if (winner === "DRAW" || (!winner && homeGoals === awayGoals)) {
        // Only award draw points in group stage (DRAW only appears when no winner is determined)
        const prevH = teamResultMap.get(homeTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(homeTeamId, { ...prevH, draws: prevH.draws + 1 });
        const prevA = teamResultMap.get(awayTeamId) ?? { wins: 0, draws: 0 };
        teamResultMap.set(awayTeamId, { ...prevA, draws: prevA.draws + 1 });
      }
    }

    // Fetch national_teams api_football_id map (include is_eliminated for auto-detection)
    const { data: allNationalTeams } = await supabase
      .from("national_teams")
      .select("id, api_football_id, is_eliminated");

    const teamApiIdMap = new Map<string, number>();
    const apiIdToTeamId = new Map<number, string>();
    const teamIsEliminated = new Map<number, boolean>();
    for (const t of allNationalTeams ?? []) {
      if (t.api_football_id) {
        teamApiIdMap.set(t.id, t.api_football_id);
        apiIdToTeamId.set(t.api_football_id, t.id);
        teamIsEliminated.set(t.api_football_id, t.is_eliminated ?? false);
      }
    }

    // Auto-detect eliminations from knockout stage matches.
    // The loser of any knockout match is eliminated. Group stage eliminations remain manual.
    const KNOCKOUT_STAGES = new Set(["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"]);
    const availableAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    let autoEliminatedCount = 0;

    for (const match of matches) {
      if (!KNOCKOUT_STAGES.has(match.stage)) continue;
      const winner = match.score?.winner;
      if (!winner || winner === "DRAW") continue;

      const loserApiId: number = winner === "HOME_TEAM" ? match.awayTeam?.id : match.homeTeam?.id;
      if (!loserApiId) continue;
      if (teamIsEliminated.get(loserApiId)) continue; // already marked

      const loserTeamId = apiIdToTeamId.get(loserApiId);
      if (!loserTeamId) continue;

      // Mark as eliminated
      await supabase.from("national_teams").update({ is_eliminated: true }).eq("id", loserTeamId);
      teamIsEliminated.set(loserApiId, true);
      autoEliminatedCount++;

      // Award free transfers to all managers who have a player from this team
      const { data: affectedSquads } = await supabase
        .from("squad_players")
        .select("manager_id, league_id, player:players!inner(team_id)")
        .eq("player.team_id", loserTeamId);

      const seen = new Set<string>();
      for (const row of affectedSquads ?? []) {
        const key = `${row.manager_id}::${row.league_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const { data: member } = await supabase
          .from("league_members")
          .select("free_transfers")
          .eq("user_id", row.manager_id)
          .eq("league_id", row.league_id)
          .maybeSingle();

        if (!member) continue;

        await supabase
          .from("league_members")
          .update({
            free_transfers: member.free_transfers + 1,
            free_transfer_available_at: availableAt,
          })
          .eq("user_id", row.manager_id)
          .eq("league_id", row.league_id);
      }

      console.log(`Auto-eliminated team api_id=${loserApiId} (db id=${loserTeamId}), stage=${match.stage}`);
    }

    // Persist wins/draws/bonus_points per national team
    for (const [apiId, result] of teamResultMap.entries()) {
      const teamId = apiIdToTeamId.get(apiId);
      if (!teamId) continue;
      await supabase
        .from("national_teams")
        .update({
          wins: result.wins,
          draws: result.draws,
          bonus_points: result.wins * 3 + result.draws * 1,
        })
        .eq("id", teamId);
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

    // Also fetch banked_points (from transferred-out players) per member
    const { data: allMembers } = await supabase
      .from("league_members")
      .select("user_id, league_id, banked_points");

    const bankedMap = new Map<string, number>();
    for (const m of allMembers ?? []) {
      bankedMap.set(`${m.user_id}::${m.league_id}`, m.banked_points ?? 0);
    }

    // Aggregate per (manager_id, league_id)
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

    for (const [key, totals] of memberMap.entries()) {
      const [manager_id, league_id] = key.split("::");
      const bonus = bonusMap.get(key) ?? 0;
      const banked = bankedMap.get(key) ?? 0;
      await supabase
        .from("league_members")
        .update({
          total_points: totals.total_points + bonus + banked,
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
      JSON.stringify({ ok: true, scorers: scorers.length, matches: matches.length, auto_eliminated: autoEliminatedCount, card_matches_checked: newlyFinished.length, cards_found: cardMap.size, managers_updated: memberMap.size }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});