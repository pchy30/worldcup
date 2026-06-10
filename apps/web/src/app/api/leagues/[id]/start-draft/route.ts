import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: { id: string };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

  // Fetch league
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  // Verify requester is commissioner
  if (league.commissioner_id !== user.id) {
    return NextResponse.json(
      { error: "Only the commissioner can start the draft." },
      { status: 403 }
    );
  }

  // Verify status
  if (league.draft_status !== "pending") {
    return NextResponse.json(
      { error: "Draft has already started or is completed." },
      { status: 400 }
    );
  }

  // Fetch members
  const { data: members, error: membersError } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);

  if (membersError || !members) {
    return NextResponse.json(
      { error: "Failed to fetch members." },
      { status: 500 }
    );
  }

  if (members.length < 2) {
    return NextResponse.json(
      { error: "You need at least 2 members to start the draft." },
      { status: 400 }
    );
  }

  // Shuffle draft order
  const draftOrder = shuffle(members.map((m) => m.user_id));

  // Calculate first pick deadline
  const now = new Date();
  const deadlineSeconds =
    league.draft_mode === "live"
      ? league.pick_time_limit_seconds
      : league.slow_draft_hours * 3600;

  const firstDeadline = new Date(now.getTime() + deadlineSeconds * 1000);

  // Update league
  const { data: updatedLeague, error: updateError } = await supabase
    .from("leagues")
    .update({
      draft_status: "active",
      draft_order: draftOrder,
      current_pick_index: 0,
      current_pick_deadline: firstDeadline.toISOString(),
    })
    .eq("id", leagueId)
    .select()
    .single();

  if (updateError || !updatedLeague) {
    return NextResponse.json(
      { error: updateError?.message ?? "Failed to start draft." },
      { status: 500 }
    );
  }

  return NextResponse.json(updatedLeague, { status: 200 });
}
