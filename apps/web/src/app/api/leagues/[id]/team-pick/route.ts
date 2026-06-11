import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface RouteContext {
  params: { id: string };
}

const POOL_TEAMS = [
  "Argentina", "Netherlands", "Spain", "Croatia", "France", "Brazil",
  "United States", "Portugal", "England", "Germany", "Turkey", "Morocco",
  "Japan", "Senegal", "Ivory Coast", "Norway", "Mexico", "Uruguay",
  "Colombia", "Ecuador", "Scotland", "South Korea", "Belgium",
  "Saudi Arabia", "Egypt",
];

const OFFERS_PER_PICK = 4;
const ROUNDS = 2;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draw 4 teams from the pool that haven't been offered yet this round
function drawOffers(
  allTeamIds: { id: string; name: string }[],
  alreadyOffered: string[],
  alreadyPicked: string[],
  count: number
): string[] {
  const available = allTeamIds
    .filter((t) => !alreadyOffered.includes(t.id) && !alreadyPicked.includes(t.id))
    .map((t) => t.id);
  return shuffle(available).slice(0, count);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = createClient();
  const adminSupabase = createAdminClient();
  const { id: leagueId } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { team_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* no body on first call to init offers */
  }

  const { team_id } = body;

  // Fetch league
  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });
  if (league.draft_status !== "active") {
    return NextResponse.json({ error: "Draft is not active." }, { status: 400 });
  }

  // Check team picking phase: use team_pick_index to know if we're still picking teams
  const draftOrder: string[] = league.draft_order ?? [];
  const totalTeamPicks = draftOrder.length * ROUNDS;
  const teamPickIndex: number = league.team_pick_index ?? 0;

  if (teamPickIndex >= totalTeamPicks) {
    return NextResponse.json({ error: "Team picking phase is complete." }, { status: 400 });
  }

  const currentRound = Math.floor(teamPickIndex / draftOrder.length) + 1; // 1 or 2
  const positionInRound = teamPickIndex % draftOrder.length;

  // Snake order: round 1 = forward, round 2 = reverse
  const currentPickerId =
    currentRound === 1
      ? draftOrder[positionInRound]
      : draftOrder[draftOrder.length - 1 - positionInRound];

  if (currentPickerId !== user.id) {
    return NextResponse.json({ error: "It is not your turn to pick a team." }, { status: 403 });
  }

  // Fetch pool team IDs from national_teams table
  const { data: poolRows } = await adminSupabase
    .from("national_teams")
    .select("id, name")
    .in("name", POOL_TEAMS);

  const poolTeams = poolRows ?? [];

  // Already picked teams in this league (across all rounds)
  const { data: existingPicks } = await supabase
    .from("manager_national_teams")
    .select("team_id")
    .eq("league_id", leagueId);

  const alreadyPicked = (existingPicks ?? []).map((r: { team_id: string }) => r.team_id);

  // Current offers stored on the league row
  const currentOffers: string[] = league.team_pick_offers ?? [];

  if (team_id) {
    // --- Submitting a pick ---
    if (!currentOffers.includes(team_id)) {
      return NextResponse.json({ error: "That team is not in your current offer." }, { status: 400 });
    }
    if (alreadyPicked.includes(team_id)) {
      return NextResponse.json({ error: "That team has already been picked." }, { status: 400 });
    }

    // Insert pick
    const { error: insertError } = await supabase
      .from("manager_national_teams")
      .insert({
        league_id: leagueId,
        manager_id: user.id,
        team_id,
        round: currentRound,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const nextTeamPickIndex = teamPickIndex + 1;
    const nextRound = Math.floor(nextTeamPickIndex / draftOrder.length) + 1;
    const nextPositionInRound = nextTeamPickIndex % draftOrder.length;

    if (nextTeamPickIndex >= totalTeamPicks) {
      // All team picks done — now start the player draft proper
      const deadlineSeconds =
        league.draft_mode === "live"
          ? league.pick_time_limit_seconds
          : league.slow_draft_hours * 3600;

      const firstDeadline = new Date(Date.now() + deadlineSeconds * 1000);

      await adminSupabase
        .from("leagues")
        .update({
          team_pick_index: nextTeamPickIndex,
          team_pick_offers: [],
          current_pick_index: 0,
          current_pick_deadline: firstDeadline.toISOString(),
        })
        .eq("id", leagueId);

      return NextResponse.json({ done: true, player_draft_started: true });
    }

    // Draw offers for the next picker
    const nextPickerId =
      nextRound === 1
        ? draftOrder[nextPositionInRound]
        : draftOrder[draftOrder.length - 1 - nextPositionInRound];

    // Already offered = remaining offers from current pick (the 3 not chosen) + picked
    // We reset per-pick: just exclude all already-picked teams
    const newAlreadyPicked = [...alreadyPicked, team_id];
    const nextOffers = drawOffers(poolTeams, [], newAlreadyPicked, OFFERS_PER_PICK);

    await adminSupabase
      .from("leagues")
      .update({
        team_pick_index: nextTeamPickIndex,
        team_pick_offers: nextOffers,
      })
      .eq("id", leagueId);

    return NextResponse.json({
      done: false,
      next_picker_id: nextPickerId,
      next_round: nextRound,
    });
  } else {
    // --- No team_id: initialise offers if not already set ---
    if (currentOffers.length > 0) {
      // Offers already exist, just return them with team details
      const { data: offerTeams } = await supabase
        .from("national_teams")
        .select("id, name, flag_url, code")
        .in("id", currentOffers);

      return NextResponse.json({
        offers: offerTeams ?? [],
        current_picker_id: currentPickerId,
        round: currentRound,
        team_pick_index: teamPickIndex,
        total_team_picks: totalTeamPicks,
      });
    }

    // First call — generate initial offers
    const initialOffers = drawOffers(poolTeams, [], alreadyPicked, OFFERS_PER_PICK);

    await adminSupabase
      .from("leagues")
      .update({ team_pick_offers: initialOffers })
      .eq("id", leagueId);

    const { data: offerTeams } = await supabase
      .from("national_teams")
      .select("id, name, flag_url, code")
      .in("id", initialOffers);

    return NextResponse.json({
      offers: offerTeams ?? [],
      current_picker_id: currentPickerId,
      round: currentRound,
      team_pick_index: teamPickIndex,
      total_team_picks: totalTeamPicks,
    });
  }
}
