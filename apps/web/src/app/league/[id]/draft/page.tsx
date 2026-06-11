import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, LeagueMember, Player, DraftPick } from "@wcf/shared";
import DraftRoom from "./DraftRoom";

interface PageProps {
  params: { id: string };
}

export default async function DraftPage({ params }: PageProps) {
  const supabase = createClient();
  const { id } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch league
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (leagueError || !league) {
    notFound();
  }

  if (league.draft_status === "pending") {
    redirect(`/league/${id}/lobby`);
  }
  if (league.draft_status === "completed") {
    redirect(`/league/${id}/leaderboard`);
  }

  // If team picking isn't finished yet, send everyone to that phase first
  const totalTeamPicks = (league.draft_order?.length ?? 0) * 2;
  if ((league.team_pick_index ?? 0) < totalTeamPicks) {
    redirect(`/league/${id}/team-pick`);
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/dashboard");
  }

  // Fetch all members
  const { data: members } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", id)
    .order("joined_at", { ascending: true });

  // Fetch all players
  const { data: players } = await supabase
    .from("players")
    .select("*, team:national_teams(*)")
    .order("total_points", { ascending: false });

  // Fetch existing picks
  const { data: picks } = await supabase
    .from("draft_picks")
    .select("*, player:players(*, team:national_teams(*))")
    .eq("league_id", id)
    .order("pick_number", { ascending: true });

  return (
    <DraftRoom
      league={league as League}
      currentUserId={user.id}
      members={(members as LeagueMember[]) ?? []}
      allPlayers={(players as Player[]) ?? []}
      initialPicks={(picks as DraftPick[]) ?? []}
    />
  );
}
