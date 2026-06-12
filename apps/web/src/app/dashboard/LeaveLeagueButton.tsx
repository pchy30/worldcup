"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

interface LeaveLeagueButtonProps {
  leagueId: string;
  leagueName: string;
}

export default function LeaveLeagueButton({ leagueId, leagueName }: LeaveLeagueButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/leave`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to leave league.");
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-muted/20" onClick={(e) => e.preventDefault()}>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-xs text-gray-400">Leave <span className="text-white font-semibold">{leagueName}</span>?</p>
        <div className="flex gap-2">
          <button
            onClick={handleLeave}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
            Confirm
          </button>
          <button
            onClick={() => { setConfirming(false); setError(null); }}
            className="flex-1 px-3 py-1.5 rounded-lg border border-muted/30 text-muted text-xs font-semibold hover:border-muted/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-muted/20" onClick={(e) => e.preventDefault()}>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors"
      >
        <LogOut className="w-3 h-3" />
        Leave league
      </button>
    </div>
  );
}
