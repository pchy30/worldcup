import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const POOL_TEAMS = [
  "Argentina", "Netherlands", "Spain", "Croatia", "France", "Brazil",
  "USA", "Portugal", "England", "Germany", "Turkey", "Morocco",
  "Japan", "Senegal", "Ivory Coast", "Norway", "Mexico", "Uruguay",
  "Colombia", "Ecuador", "Scotland", "South Korea", "Belgium",
  "Saudi Arabia", "Egypt",
];

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
  const adminSupabase = createAdminClient();
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

  // Fetch pool teams from DB so we have their UUIDs
  const { data: poolRows } = await adminSupabase
    .from("national_teams")
    .select("id, name")
    .in("name", POOL_TEAMS);

  const poolTeams = poolRows ?? [];

  // Draw 4 random teams for the first picker's offer
  const shuffledPool = shuffle(poolTeams.map((t: { id: string }) => t.id));
  const firstOffers = shuffledPool.slice(0, 4);

  // Mark league as active — team_pick_index starts at 0 (team picking phase)
  // current_pick_deadline is NOT set yet; it will be set when team picking completes
  const { data: updatedLeague, error: updateError } = await adminSupabase
    .from("leagues")
    .update({
      draft_status: "active",
      draft_order: draftOrder,
      team_pick_index: 0,
      team_pick_offers: firstOffers,
      current_pick_index: 0,
      current_pick_deadline: null,
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

  return NextResponse.json({ ...updatedLeague, phase: "team_picking" }, { status: 200 });
}
