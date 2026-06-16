"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

interface Match {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: { id: number; name: string; crest: string };
  awayTeam: { id: number; name: string; crest: string };
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

interface FixturesClientProps {
  upcoming: [string, Match[]][];
  results: [string, Match[]][];
}

const SHORT_NAMES: Record<string, string> = {
  "United States": "USA",
  "Saudi Arabia": "Saudi",
  "South Korea": "Korea",
  "Ivory Coast": "C. d'Ivoire",
};

function shortName(name: string): string {
  return SHORT_NAMES[name] ?? name;
}

function formatStage(stage: string, group: string | null): string {
  if (group) return group.replace("GROUP_", "Group ");
  const map: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_32: "Round of 32",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-Finals",
    SEMI_FINALS: "Semi-Finals",
    THIRD_PLACE: "Third Place",
    FINAL: "Final",
  };
  return map[stage] ?? stage;
}

function formatTime(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function MatchCard({ match: m }: { match: Match }) {
  const isFinished = m.status === "FINISHED";
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const homeScore = m.score.fullTime.home;
  const awayScore = m.score.fullTime.away;
  const homeWon = isFinished && homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = isFinished && homeScore !== null && awayScore !== null && awayScore > homeScore;

  return (
    <div className={`card py-3 px-3 sm:px-4 ${isLive ? "border-accent/40" : ""}`}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {m.homeTeam.crest && (
            <img src={m.homeTeam.crest} alt={m.homeTeam.name} className="w-6 h-6 object-contain flex-shrink-0" />
          )}
          <span className={`text-sm font-semibold truncate ${homeWon ? "text-white" : "text-gray-300"}`}>
            <span className="hidden sm:inline">{m.homeTeam.name}</span>
            <span className="sm:hidden">{shortName(m.homeTeam.name)}</span>
          </span>
        </div>

        <div className="flex-shrink-0 text-center w-[72px]">
          {isFinished ? (
            <span className="text-white font-extrabold text-base">{homeScore} – {awayScore}</span>
          ) : isLive ? (
            <span className="text-accent font-bold text-sm animate-pulse">LIVE</span>
          ) : (
            <div>
              <span className="text-accent font-bold text-sm">{formatTime(m.utcDate)}</span>
              <p className="text-muted text-[10px]">BST</p>
            </div>
          )}
          <p className="text-muted text-[10px] mt-0.5 leading-tight">{formatStage(m.stage, m.group)}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className={`text-sm font-semibold truncate text-right ${awayWon ? "text-white" : "text-gray-300"}`}>
            <span className="hidden sm:inline">{m.awayTeam.name}</span>
            <span className="sm:hidden">{shortName(m.awayTeam.name)}</span>
          </span>
          {m.awayTeam.crest && (
            <img src={m.awayTeam.crest} alt={m.awayTeam.name} className="w-6 h-6 object-contain flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

function MatchDay({ date, matches }: { date: string; matches: Match[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white mb-2">{date}</p>
      <div className="space-y-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

export default function FixturesClient({ upcoming, results }: FixturesClientProps) {
  const [tab, setTab] = useState<"fixtures" | "results">("fixtures");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Fixtures</h1>
          <p className="text-muted text-sm mt-0.5">FIFA World Cup 2026</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("fixtures")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === "fixtures" ? "bg-accent text-primary" : "text-muted hover:text-white"
          }`}
        >
          Fixtures
        </button>
        <button
          onClick={() => setTab("results")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === "results" ? "bg-accent text-primary" : "text-muted hover:text-white"
          }`}
        >
          Results
          {results.length > 0 && (
            <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === "results" ? "bg-primary/30" : "bg-white/10"}`}>
              {results.reduce((n, [, ms]) => n + ms.length, 0)}
            </span>
          )}
        </button>
      </div>

      {tab === "fixtures" && (
        <>
          {upcoming.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-muted text-sm">No upcoming fixtures.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {upcoming.map(([date, dayMatches]) => (
                <MatchDay key={date} date={date} matches={dayMatches} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "results" && (
        <>
          {results.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-muted text-sm">No results yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {results.map(([date, dayMatches]) => (
                <MatchDay key={date} date={date} matches={dayMatches} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}