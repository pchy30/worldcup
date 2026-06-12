import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const supabase = createClient();
  const { id: leagueId } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the league to check commissioner and draft status
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("commissioner_id, draft_status")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  // Commissioner cannot leave their own league
  if (league.commissioner_id === user.id) {
    return NextResponse.json(
      { error: "As the commissioner you cannot leave your own league. Delete it instead." },
      { status: 400 }
    );
  }

  // Cannot leave once the draft has started or completed
  if (league.draft_status !== "pending") {
    return NextResponse.json(
      { error: "You cannot leave a league once the draft has started." },
      { status: 400 }
    );
  }

  // Remove from league_members
  const { error: leaveError } = await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (leaveError) {
    return NextResponse.json({ error: leaveError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
