import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, LeagueMember } from "@wcf/shared";
import TeamPickClient from "./TeamPickClient";

interface PageProps {
  params: { id: string };
}

export default async function TeamPickPage({ params }: PageProps) {
  const supabase = createClient();
  const { id } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (leagueError || !league) notFound();

  if (league.draft_status !== "active") {
    redirect(`/league/${id}/lobby`);
  }

  // If team picking is complete, redirect to player draft
  const totalTeamPicks = (league.draft_order?.length ?? 0) * 2;
  if ((league.team_pick_index ?? 0) >= totalTeamPicks) {
    redirect(`/league/${id}/draft`);
  }

  const { data: members } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", id)
    .order("joined_at", { ascending: true });

  const { data: existingPicks } = await supabase
    .from("manager_national_teams")
    .select("manager_id, round, team:national_teams(id, name, flag_url, code)")
    .eq("league_id", id);

  // Fetch current offer teams
  const currentOffers: string[] = league.team_pick_offers ?? [];
  let offerTeams: { id: string; name: string; flag_url: string | null; code: string }[] = [];
  if (currentOffers.length > 0) {
    const { data: teams } = await supabase
      .from("national_teams")
      .select("id, name, flag_url, code")
      .in("id", currentOffers);
    offerTeams = teams ?? [];
  }

  return (
    <TeamPickClient
      league={league as League}
      members={(members as LeagueMember[]) ?? []}
      existingPicks={existingPicks ?? []}
      offerTeams={offerTeams}
      currentUserId={user.id}
    />
  );
}
