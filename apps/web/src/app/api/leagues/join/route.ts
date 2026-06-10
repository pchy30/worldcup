import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { invite_code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inviteCode = body.invite_code?.trim().toUpperCase();
  if (!inviteCode) {
    return NextResponse.json({ error: "invite_code is required." }, { status: 400 });
  }

  // Look up league by invite code
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, max_participants, draft_status, commissioner_id")
    .eq("invite_code", inviteCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json(
      { error: "Invalid invite code. No league found." },
      { status: 404 }
    );
  }

  if (league.draft_status !== "pending") {
    return NextResponse.json(
      { error: "This league's draft has already started or completed." },
      { status: 400 }
    );
  }

  // Check already a member
  const { data: existingMembership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership) {
    // Already a member — just redirect them
    return NextResponse.json({ league_id: league.id }, { status: 200 });
  }

  // Check capacity
  const { count } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);

  if (count !== null && count >= league.max_participants) {
    return NextResponse.json(
      { error: "This league is full." },
      { status: 400 }
    );
  }

  // Get display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.username ?? user.email?.split("@")[0] ?? "Manager";

  // Insert member row
  const { error: memberError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    display_name: displayName,
    total_points: 0,
    goals_scored: 0,
    assists: 0,
  });

  if (memberError) {
    return NextResponse.json(
      { error: memberError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ league_id: league.id }, { status: 200 });
}
