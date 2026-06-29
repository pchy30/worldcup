"use client";

import { useEffect, useState } from "react";

interface Match {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  minute?: number;
  homeTeam: { id: number; name: string; crest: string };
  awayTeam: { id: number; name: string; crest: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
  };
}

const SHORT_NAMES: Record<string, string> = {
  "United States": "USA",
  "Saudi Arabia": "Saudi",
  "South Korea": "Korea",
  "Ivory Coast": "C. d'Ivoire",
};

function short(name: string) {
  return SHORT_NAMES[name] ?? name;
}

function MatchPill({ m }: { m: Match }) {
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const isFinished = m.status === "FINISHED";
  const home = m.score.fullTime.home;
  const away = m.score.fullTime.away;
  const hasScore = home !== null && away !== null;

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1 rounded-full bg-white/5 border border-white/10">
      {m.homeTeam.crest && (
        <img src={m.homeTeam.crest} alt={m.homeTeam.name} className="w-4 h-4 object-contain" />
      )}
      <span className="text-xs font-semibold text-gray-200">{short(m.homeTeam.name)}</span>

      <span className={`text-xs font-bold px-1.5 ${isLive ? "text-accent animate-pulse" : isFinished ? "text-white" : "text-muted"}`}>
        {isFinished && hasScore
          ? `${home}–${away}`
          : isLive && hasScore
          ? `${home}–${away}`
          : isLive
          ? "LIVE"
          : new Date(m.utcDate).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/London",
            })}
      </span>

      {m.awayTeam.crest && (
        <img src={m.awayTeam.crest} alt={m.awayTeam.name} className="w-4 h-4 object-contain" />
      )}
      <span className="text-xs font-semibold text-gray-200">{short(m.awayTeam.name)}</span>

      {isLive && (
        <span className="ml-0.5 text-[10px] font-bold text-accent bg-accent/10 px-1 rounded">LIVE</span>
      )}
      {isFinished && (
        <span className="ml-0.5 text-[10px] text-muted">FT</span>
      )}
    </div>
  );
}

export default function LiveScoresBanner() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/live-scores");
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches ?? []);
      }
    } catch {}
    setLoaded(true);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!loaded || matches.length === 0) return null;

  const liveFirst = [...matches].sort((a, b) => {
    const rank = (s: string) =>
      s === "IN_PLAY" || s === "PAUSED" ? 0 : s === "SCHEDULED" || s === "TIMED" ? 1 : 2;
    return rank(a.status) - rank(b.status);
  });

  return (
    <div
      className="w-full overflow-hidden"
      style={{ background: "linear-gradient(90deg, rgba(0,61,165,0.35) 0%, rgba(10,22,40,0.9) 50%, rgba(229,0,27,0.25) 100%)", borderBottom: "1px solid rgba(245,183,0,0.12)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 py-1.5 overflow-x-auto scrollbar-thin">
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest flex-shrink-0">
            Today
          </span>
          <div className="flex items-center gap-2 flex-nowrap">
            {liveFirst.map((m) => (
              <MatchPill key={m.id} m={m} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}