import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const supabase = createClient();
  const adminSupabase = createAdminClient();
  const { id: leagueId } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only the commissioner can delete the league
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: "Only the commissioner can delete this league." }, { status: 403 });
  }

  // Delete all related data (admin client bypasses RLS)
  // Order matters — child tables before parent
  await adminSupabase.from("transfers").delete().eq("league_id", leagueId);
  await adminSupabase.from("squad_players").delete().eq("league_id", leagueId);
  await adminSupabase.from("draft_picks").delete().eq("league_id", leagueId);
  await adminSupabase.from("transfer_windows").delete().eq("league_id", leagueId);
  await adminSupabase.from("manager_national_teams").delete().eq("league_id", leagueId);
  await adminSupabase.from("league_members").delete().eq("league_id", leagueId);

  const { error: deleteError } = await adminSupabase
    .from("leagues")
    .delete()
    .eq("id", leagueId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
