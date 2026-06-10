import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // 1. Find open transfer window for this league
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
    return NextResponse.json(
      { error: windowError.message },
      { status: 500 }
    );
  }

  if (!openWindow) {
    return NextResponse.json(
      { error: "No transfer window is currently open for this league." },
      { status: 400 }
    );
  }

  // 2. Verify player_out is in this manager's squad
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

  // 2b. Verify player_out is from an eliminated team
  const { data: playerOut } = await supabase
    .from("players")
    .select("*, team:national_teams(is_eliminated, name)")
    .eq("id", player_out_id)
    .single();

  const playerOutTeam = playerOut?.team as { is_eliminated: boolean; name: string } | null;
  if (!playerOutTeam?.is_eliminated) {
    return NextResponse.json(
      { error: `You can only transfer out players from eliminated teams. ${playerOutTeam?.name ?? "This team"} has not been eliminated yet.` },
      { status: 400 }
    );
  }

  // 3. Verify player_in is not in any squad in this league
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

  // 4. Fetch player_in details
  const { data: playerIn, error: playerInError } = await supabase
    .from("players")
    .select("*, team:national_teams(*)")
    .eq("id", player_in_id)
    .single();

  if (playerInError || !playerIn) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  // 5. Check player_in's national team is not eliminated
  if ((playerIn.team as { is_eliminated: boolean } | null)?.is_eliminated) {
    return NextResponse.json(
      { error: "This player's national team has been eliminated from the tournament." },
      { status: 400 }
    );
  }

  // 6. Check max 2 players per national team after transfer
  const { data: mySquad } = await supabase
    .from("squad_players")
    .select("player_id, player:players(team_id)")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  const squadWithoutOut = (mySquad ?? []).filter(
    (sp) => sp.player_id !== player_out_id
  );

  const teamCounts: Record<string, number> = {};
  for (const sp of squadWithoutOut) {
    const p = Array.isArray(sp.player) ? sp.player[0] : sp.player;
    const teamId = (p as { team_id: string } | null)?.team_id ?? "";
    teamCounts[teamId] = (teamCounts[teamId] ?? 0) + 1;
  }

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

  // All checks passed — execute transfer
  // Remove player_out from squad
  const { error: removeError } = await supabase
    .from("squad_players")
    .delete()
    .eq("league_id", leagueId)
    .eq("manager_id", user.id)
    .eq("player_id", player_out_id);

  if (removeError) {
    return NextResponse.json(
      { error: removeError.message },
      { status: 500 }
    );
  }

  // Add player_in to squad
  const { error: addError } = await supabase.from("squad_players").insert({
    league_id: leagueId,
    manager_id: user.id,
    player_id: player_in_id,
  });

  if (addError) {
    // Attempt to rollback
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
    // Transfer still happened; non-fatal
  }

  // Recalculate manager points
  try {
    await supabase.rpc("recalculate_manager_points", {
      p_league_id: leagueId,
      p_manager_id: user.id,
    });
  } catch (rpcErr) {
    console.error("recalculate_manager_points RPC failed:", rpcErr);
    // Non-fatal
  }

  // Return updated squad
  const { data: updatedSquad } = await supabase
    .from("squad_players")
    .select("*, player:players(*, team:national_teams(*))")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  return NextResponse.json(
    { transfer: transferRecord, squad: updatedSquad },
    { status: 200 }
  );
}
