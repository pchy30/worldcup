import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, ManagerStanding } from "@wcf/shared";
import { rankManagers } from "@wcf/shared";
import LeaderboardClient, { type ManagerDetail } from "./LeaderboardClient";

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
    standings = viewData.map((r) => ({
      manager_id: r.user_id,
      display_name: r.display_name,
      total_points: r.total_points ?? 0,
      goals_scored: r.goals_scored ?? 0,
      assists: r.assists ?? 0,
      highest_individual_player_points: r.highest_individual_player_points ?? 0,
    })) as ManagerStanding[];
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

  const adminSupabase = createAdminClient();

  // Fetch every manager's squad players — use admin to bypass RLS on squad_players
  const { data: allSquadRows } = await adminSupabase
    .from("squad_players")
    .select("manager_id, baseline_points, player:players(id, name, position, total_points, goals, assists, clean_sheets)")
    .eq("league_id", id);

  // Fetch every manager's bonus national teams
  const { data: allBonusTeams } = await adminSupabase
    .from("manager_national_teams")
    .select("manager_id, round, team:national_teams(id, name, flag_url, code)")
    .eq("league_id", id)
    .order("round", { ascending: true });

  // Group by manager_id
  const managerDetails: Record<string, ManagerDetail> = {};
  for (const row of allSquadRows ?? []) {
    if (!managerDetails[row.manager_id]) {
      managerDetails[row.manager_id] = { squad: [], bonusTeams: [] };
    }
    const rawPlayer = Array.isArray(row.player) ? row.player[0] : row.player;
    if (!rawPlayer) continue;
    const earnedPoints = Math.max(0, (rawPlayer.total_points ?? 0) - (row.baseline_points ?? 0));
    managerDetails[row.manager_id].squad.push({
      id: rawPlayer.id,
      name: rawPlayer.name,
      position: rawPlayer.position,
      total_points: earnedPoints,
      goals: rawPlayer.goals,
      assists: rawPlayer.assists,
      clean_sheets: rawPlayer.clean_sheets,
      team: null,
    } as ManagerDetail["squad"][number]);
  }
  for (const row of allBonusTeams ?? []) {
    if (!managerDetails[row.manager_id]) {
      managerDetails[row.manager_id] = { squad: [], bonusTeams: [] };
    }
    const team = Array.isArray(row.team) ? row.team[0] : row.team;
    if (team) managerDetails[row.manager_id].bonusTeams.push({ ...team, round: row.round } as ManagerDetail["bonusTeams"][number]);
  }

  return (
    <LeaderboardClient
      league={league as League}
      initialStandings={rankedStandings}
      currentUserId={user.id}
      managerDetails={managerDetails}
    />
  );
}
