import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const MAX_TRANSFERS_PER_WINDOW = 2;

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

  // 1. Fetch league to check knockout_mode and team player cap
  const { data: league } = await supabase
    .from("leagues")
    .select("knockout_mode, max_team_players")
    .eq("id", leagueId)
    .single();

  const knockoutMode = league?.knockout_mode ?? false;
  const maxTeamPlayers = league?.max_team_players ?? 2;

  // 2. Find open transfer window by time range — status is unreliable
  const now = new Date().toISOString();
  const { data: openWindow, error: windowError } = await supabase
    .from("transfer_windows")
    .select("*")
    .eq("league_id", leagueId)
    .lte("opens_at", now)
    .gte("closes_at", now)
    .maybeSingle();

  if (windowError) {
    return NextResponse.json({ error: windowError.message }, { status: 500 });
  }

  // 3. Fetch the player being transferred out early — needed to check elimination status
  const { data: playerOutEarly } = await supabase
    .from("players")
    .select("id, position, team_id, team:national_teams(is_eliminated)")
    .eq("id", player_out_id)
    .single();

  const playerOutTeam = playerOutEarly
    ? (Array.isArray(playerOutEarly.team) ? playerOutEarly.team[0] : playerOutEarly.team)
    : null;
  const playerOutEliminated = playerOutTeam?.is_eliminated ?? false;

  // 4. Fetch manager's free_transfers and cooldown timestamp
  const { data: memberRow } = await supabase
    .from("league_members")
    .select("free_transfers, free_transfer_available_at")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const freeTransfers = memberRow?.free_transfers ?? 0;
  const freeTransferAvailableAt = memberRow?.free_transfer_available_at ?? null;
  const cooldownActive =
    freeTransferAvailableAt !== null && new Date(freeTransferAvailableAt) > new Date(now);
  // Free transfer applies whenever: eliminated player out, cooldown passed, transfers available.
  // This includes during an open window — free transfer takes priority to preserve window slots.
  const isFreeTransfer =
    playerOutEliminated && freeTransfers > 0 && !cooldownActive;

  if (!openWindow && !isFreeTransfer) {
    if (playerOutEliminated && freeTransfers > 0 && cooldownActive) {
      return NextResponse.json(
        {
          error: "Your free transfer is not available yet. Please wait 12 hours after the elimination before swapping.",
          free_transfer_available_at: freeTransferAvailableAt,
        },
        { status: 400 }
      );
    }
    if (playerOutEliminated && freeTransfers === 0) {
      return NextResponse.json(
        { error: "You have no free transfers remaining for eliminated players." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "No transfer window is currently open for this league." },
      { status: 400 }
    );
  }

  // 5. Check transfer quota (window transfers only — skipped when using a free transfer)
  let transfersUsed = 0;
  if (openWindow && !isFreeTransfer) {
    const { count } = await supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("manager_id", user.id)
      .eq("transfer_window_id", openWindow.id);
    transfersUsed = count ?? 0;

    if (transfersUsed >= MAX_TRANSFERS_PER_WINDOW) {
      return NextResponse.json(
        { error: `You have used all ${MAX_TRANSFERS_PER_WINDOW} transfers for this window.` },
        { status: 400 }
      );
    }
  } else if (openWindow && isFreeTransfer) {
    // Still fetch transfersUsed so we can report remaining window slots accurately
    const { count } = await supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("manager_id", user.id)
      .eq("transfer_window_id", openWindow.id);
    transfersUsed = count ?? 0;
  }

  // 6. Verify player_out is in this manager's squad
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

  // 7. Verify player_in is not already in this manager's own squad (always enforced)
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

  // 8. Fetch player_in details
  const { data: playerIn, error: playerInError } = await supabase
    .from("players")
    .select("*, team:national_teams(*)")
    .eq("id", player_in_id)
    .single();

  if (playerInError || !playerIn) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  // 9. Player coming in must be from an active (non-eliminated) nation
  const playerInTeam = Array.isArray(playerIn.team) ? playerIn.team[0] : playerIn.team;
  if ((playerInTeam as { is_eliminated: boolean } | null)?.is_eliminated) {
    return NextResponse.json(
      { error: "This player's national team has been eliminated from the tournament." },
      { status: 400 }
    );
  }

  // 10. Fetch current squad for position + team count checks
  const { data: mySquad } = await supabase
    .from("squad_players")
    .select("player_id, player:players(team_id, position)")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  // Use playerOutEarly which we already fetched; re-alias for clarity
  const playerOut = playerOutEarly;

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

  // Enforce per-team player cap (unlimited when maxTeamPlayers is 99)
  if (maxTeamPlayers < 99) {
    const newTeamCount = (teamCounts[playerIn.team_id] ?? 0) + 1;
    if (newTeamCount > maxTeamPlayers) {
      return NextResponse.json(
        {
          error: `This transfer would give you more than ${maxTeamPlayers} players from ${
            (playerInTeam as { name: string } | null)?.name ?? playerIn.team_id
          }.`,
        },
        { status: 400 }
      );
    }
  }

  // All checks passed — execute transfer using admin client to bypass RLS

  // Fetch player_out's current total_points and baseline so we can bank earned pts
  const { data: playerOutFull } = await supabase
    .from("players")
    .select("total_points")
    .eq("id", player_out_id)
    .single();

  const { data: outSquadRow } = await supabase
    .from("squad_players")
    .select("baseline_points")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id)
    .eq("player_id", player_out_id)
    .single();

  const earnedByOutPlayer =
    (playerOutFull?.total_points ?? 0) - (outSquadRow?.baseline_points ?? 0);

  // Bank those earned points before removing player from squad
  const { data: currentMember } = await adminSupabase
    .from("league_members")
    .select("banked_points")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  await adminSupabase
    .from("league_members")
    .update({ banked_points: (currentMember?.banked_points ?? 0) + earnedByOutPlayer })
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  // Remove player_out from squad
  const { error: removeError } = await adminSupabase
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
  const { error: addError } = await adminSupabase.from("squad_players").insert({
    league_id: leagueId,
    manager_id: user.id,
    player_id: player_in_id,
    baseline_points: playerIn.total_points ?? 0,
  });

  if (addError) {
    // Rollback
    await adminSupabase.from("squad_players").insert({
      league_id: leagueId,
      manager_id: user.id,
      player_id: player_out_id,
    });
    return NextResponse.json({ error: addError.message }, { status: 500 });
  }

  // Insert transfer record (window_id is null for free transfers outside a window)
  const { data: transferRecord, error: transferRecordError } = await supabase
    .from("transfers")
    .insert({
      league_id: leagueId,
      manager_id: user.id,
      player_out_id,
      player_in_id,
      transfer_window_id: isFreeTransfer ? null : (openWindow?.id ?? null),
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (transferRecordError) {
    console.error("Transfer record insert error:", transferRecordError.message);
  }

  // Decrement free_transfers if this was a free transfer; clear cooldown if exhausted
  if (isFreeTransfer) {
    const newCount = freeTransfers - 1;
    await supabase
      .from("league_members")
      .update({
        free_transfers: newCount,
        free_transfer_available_at: newCount === 0 ? null : freeTransferAvailableAt,
      })
      .eq("league_id", leagueId)
      .eq("user_id", user.id);
  }

  const transfersRemaining = openWindow
    ? MAX_TRANSFERS_PER_WINDOW - (isFreeTransfer ? transfersUsed : transfersUsed + 1)
    : null;

  // Return updated squad
  const { data: updatedSquad } = await supabase
    .from("squad_players")
    .select("*, player:players(*, team:national_teams(*))")
    .eq("league_id", leagueId)
    .eq("manager_id", user.id);

  return NextResponse.json(
    {
      transfer: transferRecord,
      squad: updatedSquad,
      transfers_remaining: transfersRemaining,
      free_transfers_remaining: isFreeTransfer ? freeTransfers - 1 : freeTransfers,
      free_transfer_available_at: isFreeTransfer ? null : freeTransferAvailableAt,
    },
    { status: 200 }
  );
}
