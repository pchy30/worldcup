import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { League } from "@wcf/shared";
import {
  Trophy,
  Plus,
  UserPlus,
  Users,
  Clock,
  CheckCircle2,
  PlayCircle,
} from "lucide-react";
import LeaveLeagueButton from "./LeaveLeagueButton";

interface LeagueWithMeta extends League {
  memberCount: number;
  myPoints: number;
  myDisplayName: string;
}

const draftStatusConfig: Record<
  string,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: "Draft Pending",
    icon: Clock,
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  },
  active: {
    label: "Draft Live",
    icon: PlayCircle,
    className: "bg-green-500/20 text-green-400 border-green-500/40",
  },
  completed: {
    label: "Season Active",
    icon: CheckCircle2,
    className: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  },
};

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch leagues the user is a member of, with member counts
  const { data: memberRows, error } = await supabase
    .from("league_members")
    .select(
      `
      total_points,
      display_name,
      league_id,
      leagues (
        id,
        name,
        invite_code,
        commissioner_id,
        draft_mode,
        draft_status,
        draft_order,
        current_pick_index,
        pick_time_limit_seconds,
        slow_draft_hours,
        current_pick_deadline,
        max_participants,
        created_at
      )
    `
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (error) {
    console.error("Dashboard fetch error:", error.message);
  }

  // For each league, also get total member count
  const leagues: LeagueWithMeta[] = [];

  if (memberRows) {
    for (const row of memberRows) {
      const league = row.leagues as unknown as League | null;
      if (!league) continue;

      const { count } = await supabase
        .from("league_members")
        .select("id", { count: "exact", head: true })
        .eq("league_id", league.id);

      leagues.push({
        ...league,
        memberCount: count ?? 0,
        myPoints: row.total_points ?? 0,
        myDisplayName: row.display_name ?? "",
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Leagues</h1>
          <p className="text-muted mt-1">
            {leagues.length === 0
              ? "You haven't joined any leagues yet."
              : `${leagues.length} league${leagues.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/join"
            className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
          >
            <UserPlus className="w-4 h-4" />
            Join League
          </Link>
          <Link
            href="/league/new"
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Create League
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {leagues.length === 0 && (
        <div className="card text-center py-16">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
              <Trophy className="w-8 h-8 text-accent/60" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            No leagues yet
          </h2>
          <p className="text-muted mb-8 max-w-sm mx-auto">
            Create your own league and invite friends, or join an existing one
            with an invite code.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/league/new" className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create a League
            </Link>
            <Link href="/join" className="btn-secondary flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Join a League
            </Link>
          </div>
        </div>
      )}

      {/* Leagues grid */}
      {leagues.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {leagues.map((league) => {
            const statusConfig =
              draftStatusConfig[league.draft_status] ??
              draftStatusConfig.pending;
            const StatusIcon = statusConfig.icon;
            const draftPath =
              league.draft_status === "active"
                ? `/league/${league.id}/draft`
                : league.draft_status === "completed"
                  ? `/league/${league.id}/leaderboard`
                  : `/league/${league.id}/lobby`;

            return (
              <div key={league.id} className="card hover:border-muted/60 hover:shadow-xl transition-all duration-200 group">
              <Link
                href={draftPath}
                className="block"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusConfig.className}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusConfig.label}
                  </span>
                  <span className="text-xs text-muted uppercase font-medium tracking-wider">
                    {league.draft_mode} draft
                  </span>
                </div>

                {/* League name */}
                <h2 className="text-lg font-bold text-white mb-4 group-hover:text-accent transition-colors duration-200 leading-tight">
                  {league.name}
                </h2>

                {/* Stats row */}
                <div className="flex items-center gap-4 pt-4 border-t border-muted/20">
                  <div className="flex-1 text-center">
                    <p className="text-accent font-bold text-xl leading-none">
                      {league.myPoints}
                    </p>
                    <p className="text-muted text-xs mt-1">Your pts</p>
                  </div>
                  <div className="w-px h-8 bg-muted/20" />
                  <div className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-400">
                    <Users className="w-4 h-4 text-muted" />
                    <span>
                      {league.memberCount} / {league.max_participants}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-muted/20" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted">
                      {league.commissioner_id === user.id ? (
                        <span className="text-accent font-semibold">Commissioner</span>
                      ) : (
                        "Member"
                      )}
                    </p>
                  </div>
                </div>
              </Link>
              {league.commissioner_id !== user.id && league.draft_status === "pending" && (
                <LeaveLeagueButton leagueId={league.id} leagueName={league.name} />
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
