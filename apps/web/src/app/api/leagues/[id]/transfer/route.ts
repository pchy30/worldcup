import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_TRANSFERS_PER_WINDOW = 2;

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = createClient();
  const { id: leagueId } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { player_out_id?: string; player_in_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { player_out_id, player_in_id } = body;
  if (!player_out_id || !player_in_id) {
    return NextResponse.json(
      { error: "player_out_id and player_in_id are required." },
      { status: 400 }
    );
  }

  if (player_out_id === player_in_id) {
    return NextResponse.json(
      { error: "player_in and player_out must be different players." },
      { status: 400 }
    );
  }

  // 1. Fetch league to check knockout_mode
  const { data: league } = await supabase
    .from("leagues")
    .select("knockout_mode")
    .eq("id", leagueId)
    .single();

  const knockoutMode = league?.knockout_mode ?? false;

  // 2. Find open transfer window for this league
  const now = new Date().toISOString();
  const { data: openWindow, error: windowError } = await supabase
    .from("transfer_windows")
    .select("*")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .lte("opens_at", now)
    .gte("closes_at", now)
    .maybeSingle();

  if (windowError) {
    return NextResponse.json({ error: windowError.message }, { status: 500 });
  }

  if (!openWindow) {
    return NextResponse.json(
      { error: "No transfer window is currently open for this league." },
      { status: 400 }
    );
  }

  // 2. Check this manager hasn't used all transfers this window
  const { count: transfersUsed } = await supabase
    .from("transfers")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("manager_id", user.id)
    .eq("transfer_window_id", openWindow.id);

  if ((transfersUsed ?? 0) >= MAX_TRANSFERS_PER_WINDOW) {
    return NextResponse.json(
      { error: `You have used all ${MAX_TRANSFERS_PER_WINDOW} transfers for this window.` },
      { status: 400 }
    );
  }

  // 3. Verify player_out is in this manager's squad
  const { data: outSquadEntry } = await supabase
    .from("squad_players")
    .select("id")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id)
    .eq("player_id", player_out_id)
    .maybeSingle();

  if (!outSquadEntry) {
    return NextResponse.json(
      { error: "The player you're transferring out is not in your squad." },
      { status: 400 }
    );
  }

  // 4. Verify player_in is not already in this manager's own squad (always enforced)
  const { data: myExistingEntry } = await supabase
    .from("squad_players")
    .select("id")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id)
    .eq("player_id", player_in_id)
    .maybeSingle();

  if (myExistingEntry) {
    return NextResponse.json(
      { error: "This player is already in your squad." },
      { status: 400 }
    );
  }

  // In normal mode, also verify player_in is not in any other manager's squad
  if (!knockoutMode) {
    const { data: inSquadEntry } = await supabase
      .from("squad_players")
      .select("id")
      .eq("league_id", leagueId)
      .eq("player_id", player_in_id)
      .maybeSingle();

    if (inSquadEntry) {
      return NextResponse.json(
        { error: "This player is already in another manager's squad." },
        { status: 400 }
      );
    }
  }

  // 5. Fetch player_in details
  const { data: playerIn, error: playerInError } = await supabase
    .from("players")
    .select("*, team:national_teams(*)")
    .eq("id", player_in_id)
    .single();

  if (playerInError || !playerIn) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  // 6. Player coming in must be from an active (non-eliminated) nation
  if ((playerIn.team as { is_eliminated: boolean } | null)?.is_eliminated) {
    return NextResponse.json(
      { error: "This player's national team has been eliminated from the tournament." },
      { status: 400 }
    );
  }

  // 7. Fetch current squad for position + team count checks
  const { data: mySquad } = await supabase
    .from("squad_players")
    .select("player_id, player:players(team_id, position)")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  // Fetch the player being transferred out to get their position
  const { data: playerOut } = await supabase
    .from("players")
    .select("id, position, team_id")
    .eq("id", player_out_id)
    .single();

  if (!playerOut) {
    return NextResponse.json({ error: "Player to transfer out not found." }, { status: 404 });
  }

  const squadWithoutOut = (mySquad ?? []).filter(
    (sp) => sp.player_id !== player_out_id
  );

  const teamCounts: Record<string, number> = {};
  const positionCounts: Record<string, number> = {};
  for (const sp of squadWithoutOut) {
    const p = Array.isArray(sp.player) ? sp.player[0] : sp.player;
    const teamId = (p as { team_id: string } | null)?.team_id ?? "";
    const pos = (p as { position: string } | null)?.position ?? "";
    teamCounts[teamId] = (teamCounts[teamId] ?? 0) + 1;
    positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
  }

  // Position limits — only enforce if swapping to a different position
  const POSITION_LIMITS: Record<string, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
  if (playerOut.position !== playerIn.position) {
    const posLimit = POSITION_LIMITS[playerIn.position] ?? 99;
    const currentPosCount = positionCounts[playerIn.position] ?? 0;
    if (currentPosCount >= posLimit) {
      return NextResponse.json(
        { error: `You already have the maximum ${posLimit} ${playerIn.position} players. Transfer out a ${playerIn.position} first.` },
        { status: 400 }
      );
    }
  }

  // Max 2 players per national team after transfer (relaxed in knockout mode)
  if (!knockoutMode) {
    const newTeamCount = (teamCounts[playerIn.team_id] ?? 0) + 1;
    if (newTeamCount > 2) {
      return NextResponse.json(
        {
          error: `This transfer would give you more than 2 players from ${
            (playerIn.team as { name: string } | null)?.name ?? playerIn.team_id
          }.`,
        },
        { status: 400 }
      );
    }
  }

  // All checks passed — execute transfer
  // Remove player_out from squad
  const { error: removeError } = await supabase
    .from("squad_players")
    .delete()
    .eq("league_id", leagueId)
    .eq("manager_id", user.id)
    .eq("player_id", player_out_id);

  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 500 });
  }

  // Add player_in to squad with their current points as baseline
  // so only points scored after this transfer count for the manager
  const { error: addError } = await supabase.from("squad_players").insert({
    league_id: leagueId,
    manager_id: user.id,
    player_id: player_in_id,
    baseline_points: playerIn.total_points ?? 0,
  });

  if (addError) {
    // Rollback
    await supabase.from("squad_players").insert({
      league_id: leagueId,
      manager_id: user.id,
      player_id: player_out_id,
    });
    return NextResponse.json({ error: addError.message }, { status: 500 });
  }

  // Insert transfer record
  const { data: transferRecord, error: transferRecordError } = await supabase
    .from("transfers")
    .insert({
      league_id: leagueId,
      manager_id: user.id,
      player_out_id,
      player_in_id,
      transfer_window_id: openWindow.id,
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (transferRecordError) {
    console.error("Transfer record insert error:", transferRecordError.message);
  }

  const transfersRemaining = MAX_TRANSFERS_PER_WINDOW - ((transfersUsed ?? 0) + 1);

  // Return updated squad
  const { data: updatedSquad } = await supabase
    .from("squad_players")
    .select("*, player:players(*, team:national_teams(*))")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  return NextResponse.json(
    { transfer: transferRecord, squad: updatedSquad, transfers_remaining: transfersRemaining },
    { status: 200 }
  );
}
