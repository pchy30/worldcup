import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = createClient();
  const adminSupabase = createAdminClient();
  const { id: leagueId } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { player_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { player_id } = body;
  if (!player_id) {
    return NextResponse.json({ error: "player_id is required." }, { status: 400 });
  }

  // Fetch league
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  if (league.draft_status !== "active") {
    return NextResponse.json(
      { error: "Draft is not currently active." },
      { status: 400 }
    );
  }

  // 1. Verify it's this user's turn
  const draftOrder = league.draft_order ?? [];
  const currentPickerUserId = draftOrder.length > 0
    ? draftOrder[league.current_pick_index % draftOrder.length]
    : null;

  if (currentPickerUserId !== user.id) {
    return NextResponse.json(
      { error: "It is not your turn to pick." },
      { status: 403 }
    );
  }

  // 2. Check deadline (for live mode — slow mode deadline is advisory but still enforced)
  if (league.current_pick_deadline) {
    const deadline = new Date(league.current_pick_deadline);
    if (new Date() > deadline) {
      return NextResponse.json(
        { error: "Your pick deadline has passed." },
        { status: 400 }
      );
    }
  }

  // 3. Check player exists
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*, team:national_teams(*)")
    .eq("id", player_id)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  // 4. Check player not already drafted in this league
  const { data: existingPick } = await supabase
    .from("draft_picks")
    .select("id")
    .eq("league_id", leagueId)
    .eq("player_id", player_id)
    .maybeSingle();

  if (existingPick) {
    return NextResponse.json(
      { error: "This player has already been drafted." },
      { status: 400 }
    );
  }

  // 5. Fetch this user's current squad
  const { data: mySquad } = await supabase
    .from("squad_players")
    .select("player_id, player:players(team_id)")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  const mySquadCount = mySquad?.length ?? 0;

  if (mySquadCount >= 11) {
    return NextResponse.json(
      { error: "Your squad is already full (11 players)." },
      { status: 400 }
    );
  }

  // 6. Position limits: 1 GK, 4 DEF, 3 MID, 3 FWD
  const POSITION_LIMITS: Record<string, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

  // Need player positions in squad — re-fetch with position
  const { data: mySquadWithPos } = await supabase
    .from("squad_players")
    .select("player_id, player:players(team_id, position)")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  const positionCounts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const teamCounts: Record<string, number> = {};
  for (const sp of mySquadWithPos ?? []) {
    const p = Array.isArray(sp.player) ? sp.player[0] : sp.player;
    if (!p) continue;
    const pos = (p as { position: string }).position;
    positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
    const teamId = (p as { team_id: string }).team_id ?? "";
    teamCounts[teamId] = (teamCounts[teamId] ?? 0) + 1;
  }

  const positionLimit = POSITION_LIMITS[player.position] ?? 99;
  const currentPosCount = positionCounts[player.position] ?? 0;
  if (currentPosCount >= positionLimit) {
    return NextResponse.json(
      { error: `You already have the maximum ${positionLimit} ${player.position} player${positionLimit !== 1 ? "s" : ""} in your squad.` },
      { status: 400 }
    );
  }

  const newTeamCount = (teamCounts[player.team_id] ?? 0) + 1;
  if (newTeamCount > 2) {
    return NextResponse.json(
      {
        error: `You already have 2 players from ${
          (player.team as { name: string } | null)?.name ?? player.team_id
        }.`,
      },
      { status: 400 }
    );
  }

  // All checks pass — derive pick_number from actual count to avoid collisions
  const { count: existingPickCount } = await supabase
    .from("draft_picks")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);

  const pickNumber = (existingPickCount ?? 0) + 1;

  const { data: newPick, error: pickError } = await supabase
    .from("draft_picks")
    .insert({
      league_id: leagueId,
      manager_id: user.id,
      player_id,
      pick_number: pickNumber,
    })
    .select("*, player:players(*, team:national_teams(*))")
    .single();

  if (pickError || !newPick) {
    return NextResponse.json(
      { error: pickError?.message ?? "Failed to record pick." },
      { status: 500 }
    );
  }

  // Insert into squad_players
  await supabase.from("squad_players").insert({
    league_id: leagueId,
    manager_id: user.id,
    player_id,
  });

  // Advance pick index
  const nextPickIndex = league.current_pick_index + 1;
  const totalPicks = (league.draft_order?.length ?? 0) * 11;

  if (nextPickIndex >= totalPicks) {
    // Draft complete
    const draftCompletedAt = new Date();
    // Transfer window opens 3 days after draft completion
    const windowOpensAt = new Date(
      draftCompletedAt.getTime() + 3 * 24 * 60 * 60 * 1000
    );
    const windowClosesAt = new Date(
      windowOpensAt.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    await adminSupabase
      .from("leagues")
      .update({
        draft_status: "completed",
        current_pick_deadline: null,
        current_pick_index: nextPickIndex,
      })
      .eq("id", leagueId);

    // Create first transfer window
    await adminSupabase.from("transfer_windows").insert({
      league_id: leagueId,
      opens_at: windowOpensAt.toISOString(),
      closes_at: windowClosesAt.toISOString(),
      status: "closed",
    });
  } else {
    // Advance to next pick
    const deadlineSeconds =
      league.draft_mode === "live"
        ? league.pick_time_limit_seconds
        : league.slow_draft_hours * 3600;

    const nextDeadline = new Date(
      Date.now() + deadlineSeconds * 1000
    ).toISOString();

    const { error: advanceError } = await adminSupabase
      .from("leagues")
      .update({
        current_pick_index: nextPickIndex,
        current_pick_deadline: nextDeadline,
      })
      .eq("id", leagueId);

    if (advanceError) {
      console.error("Failed to advance pick index:", advanceError.message);
    }
  }

  return NextResponse.json(newPick, { status: 201 });
}
