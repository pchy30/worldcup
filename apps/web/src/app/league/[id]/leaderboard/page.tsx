import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, ManagerStanding } from "@wcf/shared";
import { rankManagers } from "@wcf/shared";
import LeaderboardClient from "./LeaderboardClient";

interface PageProps {
  params: { id: string };
}

export default async function LeaderboardPage({ params }: PageProps) {
  const supabase = createClient();
  const { id } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (leagueError || !league) {
    notFound();
  }

  // Try the leaderboard view first; fall back to league_members
  let standings: ManagerStanding[] = [];

  const { data: viewData } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("league_id", id);

  if (viewData && viewData.length > 0) {
    standings = viewData as ManagerStanding[];
  } else {
    // Fallback: build from league_members
    const { data: members } = await supabase
      .from("league_members")
      .select("user_id, display_name, total_points, goals_scored, assists")
      .eq("league_id", id);

    if (members) {
      standings = members.map((m) => ({
        manager_id: m.user_id,
        display_name: m.display_name,
        total_points: m.total_points ?? 0,
        goals_scored: m.goals_scored ?? 0,
        assists: m.assists ?? 0,
        highest_individual_player_points: 0,
      }));
    }
  }

  const rankedStandings = rankManagers(standings);

  return (
    <LeaderboardClient
      league={league as League}
      initialStandings={rankedStandings}
      currentUserId={user.id}
    />
  );
}
