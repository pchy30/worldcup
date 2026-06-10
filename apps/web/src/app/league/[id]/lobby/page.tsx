import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { League, LeagueMember } from "@wcf/shared";
import LobbyClient from "./LobbyClient";

interface PageProps {
  params: { id: string };
}

export default async function LobbyPage({ params }: PageProps) {
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

  // Redirect to draft/leaderboard if already past pending
  if (league.draft_status === "active") {
    redirect(`/league/${id}/draft`);
  }
  if (league.draft_status === "completed") {
    redirect(`/league/${id}/leaderboard`);
  }

  const { data: members, error: membersError } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", id)
    .order("joined_at", { ascending: true });

  if (membersError) {
    console.error("Lobby members fetch error:", membersError.message);
  }

  const isCommissioner = league.commissioner_id === user.id;

  return (
    <LobbyClient
      league={league as League}
      initialMembers={(members as LeagueMember[]) ?? []}
      currentUserId={user.id}
      isCommissioner={isCommissioner}
    />
  );
}
