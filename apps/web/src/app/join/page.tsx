"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";

export default function JoinLeaguePage() {
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = inviteCode.trim().toUpperCase();

    if (code.length === 0) {
      setError("Please enter an invite code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to join league.");
        return;
      }

      router.push(`/league/${data.league_id}/lobby`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-6 sm:py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-accent/15 rounded-full flex items-center justify-center border border-accent/30">
              <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 text-accent" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Join a League</h1>
          <p className="text-muted text-sm sm:text-base">
            Enter the invite code shared by the league commissioner
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="invite_code" className="label">
                Invite Code
              </label>
              <input
                id="invite_code"
                type="text"
                required
                value={inviteCode}
                onChange={(e) =>
                  setInviteCode(e.target.value.toUpperCase())
                }
                className="input text-center text-lg sm:text-2xl font-mono tracking-widest uppercase"
                placeholder="XXXXXXXX"
                maxLength={12}
                spellCheck={false}
                autoComplete="off"
              />
              <p className="text-xs text-muted mt-1.5">
                Invite codes are case-insensitive
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Joining…
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Join League
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-sm mt-6">
          Want to start your own?{" "}
          <a
            href="/league/new"
            className="text-accent hover:text-yellow-400 font-semibold transition-colors duration-200"
          >
            Create a league
          </a>
        </p>
      </div>
    </div>
  );
}
