"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { League, LeagueMember } from "@wcf/shared";
import {
  Copy,
  Check,
  Users,
  Crown,
  Clock,
  PlayCircle,
  Loader2,
  RefreshCcw,
} from "lucide-react";

interface LobbyClientProps {
  league: League;
  initialMembers: LeagueMember[];
  currentUserId: string;
  isCommissioner: boolean;
}

export default function LobbyClient({
  league,
  initialMembers,
  currentUserId,
  isCommissioner,
}: LobbyClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [members, setMembers] = useState<LeagueMember[]>(initialMembers);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(league.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = league.invite_code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Subscribe to new members joining
  useEffect(() => {
    const channel = supabase
      .channel(`lobby:${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "league_members",
          filter: `league_id=eq.${league.id}`,
        },
        (payload) => {
          setMembers((prev) => {
            const newMember = payload.new as LeagueMember;
            if (prev.some((m) => m.id === newMember.id)) return prev;
            return [...prev, newMember];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leagues",
          filter: `id=eq.${league.id}`,
        },
        (payload) => {
          const updated = payload.new as League;
          if (updated.draft_status === "active") {
            router.push(`/league/${league.id}/draft`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [league.id, router, supabase]);

  const handleStartDraft = async () => {
    setStartError(null);
    setStarting(true);

    try {
      const res = await fetch(`/api/leagues/${league.id}/start-draft`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setStartError(data.error ?? "Failed to start draft.");
        return;
      }

      router.push(`/league/${league.id}/draft`);
    } catch {
      setStartError("An unexpected error occurred.");
    } finally {
      setStarting(false);
    }
  };

  const modeLabel =
    league.draft_mode === "live" ? "Live Draft" : "Slow Draft";
  const pickTimeLabel =
    league.draft_mode === "live"
      ? `${league.pick_time_limit_seconds}s per pick`
      : `${league.slow_draft_hours}h per pick`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-muted text-sm mb-2">
          <Clock className="w-4 h-4" />
          <span>Waiting for draft to start</span>
        </div>
        <h1 className="text-4xl font-extrabold text-white">{league.name}</h1>
      </div>

      <div className="space-y-6">
        {/* Invite Code Card */}
        <div className="card">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Invite Code
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 bg-primary rounded-lg border border-muted/30 px-4 py-3">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-accent">
                {league.invite_code}
              </span>
            </div>
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-2 btn-secondary py-3 px-4 text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-muted mt-2">
            Share this code with friends to let them join your league.
          </p>
        </div>

        {/* Draft Settings */}
        <div className="card">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Draft Settings
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-primary/50 rounded-lg p-3">
              <p className="text-xs text-muted mb-1">Mode</p>
              <p className="font-bold text-white">{modeLabel}</p>
            </div>
            <div className="bg-primary/50 rounded-lg p-3">
              <p className="text-xs text-muted mb-1">Pick Limit</p>
              <p className="font-bold text-white">{pickTimeLabel}</p>
            </div>
            <div className="bg-primary/50 rounded-lg p-3">
              <p className="text-xs text-muted mb-1">Max Players</p>
              <p className="font-bold text-white">{league.max_participants}</p>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Members
            </h2>
            <span className="text-sm text-white font-semibold">
              {members.length} / {league.max_participants}
            </span>
          </div>

          <div className="space-y-2">
            {members.map((member) => {
              const isCommissionerMember =
                member.user_id === league.commissioner_id;
              const isCurrentUser = member.user_id === currentUserId;

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/50"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-sm font-bold text-accent">
                    {member.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 min-w-0 font-medium text-white text-sm truncate">
                    {member.display_name}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-muted">(you)</span>
                    )}
                  </span>
                  {isCommissionerMember && (
                    <span className="flex items-center gap-1 text-xs text-accent font-semibold">
                      <Crown className="w-3.5 h-3.5" />
                      Commissioner
                    </span>
                  )}
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({
              length: Math.max(
                0,
                league.max_participants - members.length
              ),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-muted/20"
              >
                <div className="w-8 h-8 rounded-full border border-dashed border-muted/30 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-muted/40" />
                </div>
                <span className="text-muted/40 text-sm">Waiting for player…</span>
              </div>
            ))}
          </div>
        </div>

        {/* Start Draft */}
        {isCommissioner && (
          <div className="card">
            {startError && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
                {startError}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white">Ready to draft?</h3>
                <p className="text-sm text-muted mt-0.5">
                  You need at least 2 members to start the draft.
                  {members.length < 2 && (
                    <span className="text-yellow-400 ml-1">
                      Waiting for more players…
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleStartDraft}
                disabled={starting || members.length < 2}
                className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    Start Draft
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {!isCommissioner && (
          <div className="card text-center py-6">
            <RefreshCcw className="w-6 h-6 text-muted mx-auto mb-2 animate-spin" />
            <p className="text-muted text-sm">
              Waiting for the commissioner to start the draft…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
