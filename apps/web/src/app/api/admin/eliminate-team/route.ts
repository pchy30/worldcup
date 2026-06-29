import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(request: NextRequest) {
  // Simple secret-based auth for admin endpoints
  const authHeader = request.headers.get("x-admin-secret");
  if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { team_code?: string; eliminated?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { team_code, eliminated = true } = body;
  if (!team_code) {
    return NextResponse.json({ error: "team_code is required." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("national_teams")
    .update({ is_eliminated: eliminated })
    .eq("code", team_code.toUpperCase())
    .select("id, name, code, is_eliminated")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Team not found." },
      { status: 404 }
    );
  }

  let freeTransfersAwarded = 0;

  // If eliminating (not reinstating), award a free transfer to every manager
  // who has at least one player from this team, per league
  if (eliminated) {
    const { data: affectedSquads } = await adminSupabase
      .from("squad_players")
      .select("manager_id, league_id, player:players!inner(team_id)")
      .eq("player.team_id", data.id);

    // Dedupe by manager_id + league_id — one free transfer per manager per elimination
    const seen = new Set<string>();
    for (const row of affectedSquads ?? []) {
      const key = `${row.manager_id}::${row.league_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      freeTransfersAwarded++;

      // Fetch current value and increment
      const { data: member, error: memberError } = await adminSupabase
        .from("league_members")
        .select("free_transfers")
        .eq("user_id", row.manager_id)
        .eq("league_id", row.league_id)
        .maybeSingle();

      if (memberError) {
        console.error(`Failed to fetch league_member for ${row.manager_id} in league ${row.league_id}:`, memberError.message);
        continue;
      }
      if (!member) {
        console.warn(`No league_member row for manager ${row.manager_id} in league ${row.league_id} — skipping`);
        continue;
      }

      const availableAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await adminSupabase
        .from("league_members")
        .update({
          free_transfers: member.free_transfers + 1,
          free_transfer_available_at: availableAt,
        })
        .eq("user_id", row.manager_id)
        .eq("league_id", row.league_id);

      if (updateError) {
        console.error(`Failed to update free_transfers for ${row.manager_id}:`, updateError.message);
        freeTransfersAwarded--; // undo the count since the update failed
      }
    }
  }

  return NextResponse.json({ ...data, free_transfers_awarded: freeTransfersAwarded });
}