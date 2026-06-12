"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Loader2, ChevronDown } from "lucide-react";
import type { DraftMode } from "@wcf/shared";

interface FormState {
  name: string;
  draft_mode: DraftMode;
  pick_time_limit_seconds: number;
  slow_draft_hours: number;
  max_participants: number;
}

export default function CreateLeaguePage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: "",
    draft_mode: "live",
    pick_time_limit_seconds: 60,
    slow_draft_hours: 24,
    max_participants: 8,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.name.trim().length < 3) {
      setError("League name must be at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create league.");
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-accent/15 rounded-full flex items-center justify-center border border-accent/30">
              <Trophy className="w-7 h-7 text-accent" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create a League</h1>
          <p className="text-muted">Set up your draft and invite your friends</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* League Name */}
            <div>
              <label htmlFor="name" className="label">
                League Name
              </label>
              <input
                id="name"
                type="text"
                required
                minLength={3}
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="e.g. The Galácticos Cup"
              />
            </div>

            {/* Draft Mode */}
            <div>
              <label className="label">Draft Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {(["live", "slow"] as DraftMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm({ ...form, draft_mode: mode })}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all duration-200
                      ${
                        form.draft_mode === mode
                          ? "border-accent bg-accent/10"
                          : "border-muted/30 hover:border-muted/60"
                      }
                    `}
                  >
                    <p className="font-bold text-white capitalize">{mode} Draft</p>
                    <p className="text-xs text-muted mt-1">
                      {mode === "live"
                        ? "All managers pick in real-time with a countdown timer"
                        : "Each manager has hours to make their pick"}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Live: Pick Time Limit */}
            {form.draft_mode === "live" && (
              <div>
                <label htmlFor="pick_time" className="label">
                  Pick Time Limit
                </label>
                <div className="relative">
                  <select
                    id="pick_time"
                    value={form.pick_time_limit_seconds}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pick_time_limit_seconds: Number(e.target.value),
                      })
                    }
                    className="input appearance-none pr-10"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={90}>90 seconds</option>
                    <option value={120}>120 seconds</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                </div>
              </div>
            )}

            {/* Slow: Hours per pick */}
            {form.draft_mode === "slow" && (
              <div>
                <label htmlFor="slow_hours" className="label">
                  Hours per Pick
                </label>
                <div className="relative">
                  <select
                    id="slow_hours"
                    value={form.slow_draft_hours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        slow_draft_hours: Number(e.target.value),
                      })
                    }
                    className="input appearance-none pr-10"
                  >
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                </div>
              </div>
            )}

            {/* Max Participants */}
            <div>
              <label htmlFor="max_participants" className="label">
                Max Participants:{" "}
                <span className="text-accent font-bold">
                  {form.max_participants}
                </span>
              </label>
              <input
                id="max_participants"
                type="range"
                min={2}
                max={20}
                step={1}
                value={form.max_participants}
                onChange={(e) =>
                  setForm({
                    ...form,
                    max_participants: Number(e.target.value),
                  })
                }
                className="w-full accent-accent cursor-pointer h-2 rounded-full bg-muted/30"
              />
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>4</span>
                <span>20</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating League…
                </>
              ) : (
                "Create League"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
