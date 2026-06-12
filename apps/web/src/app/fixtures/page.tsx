import { Calendar } from "lucide-react";

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY!;

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
    halfTime: { home: number | null; away: number | null };
  };
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

function formatDate(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
}

export const revalidate = 1800; // revalidate every 30 minutes

export default async function FixturesPage() {
  let matches: Match[] = [];
  let error = false;

  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
      next: { revalidate: 1800 },
    });
    if (res.ok) {
      const data = await res.json();
      matches = data.matches ?? [];
    } else {
      error = true;
    }
  } catch {
    error = true;
  }

  // Group by date
  const byDate = new Map<string, Match[]>();
  for (const m of matches) {
    const date = formatDate(m.utcDate);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(m);
  }

  // Split into upcoming and results
  const now = new Date();
  const upcoming: [string, Match[]][] = [];
  const results: [string, Match[]][] = [];

  for (const [date, dayMatches] of byDate.entries()) {
    const finished = dayMatches.every((m) => m.status === "FINISHED");
    if (finished) {
      results.push([date, dayMatches]);
    } else {
      upcoming.push([date, dayMatches]);
    }
  }

  // Sort upcoming ascending, results descending
  upcoming.sort((a, b) => new Date(a[1][0].utcDate).getTime() - new Date(b[1][0].utcDate).getTime());
  results.sort((a, b) => new Date(b[1][0].utcDate).getTime() - new Date(a[1][0].utcDate).getTime());

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Fixtures</h1>
          <p className="text-muted text-sm mt-0.5">FIFA World Cup 2026</p>
        </div>
      </div>

      {error && (
        <div className="card text-center py-12">
          <p className="text-muted text-sm">Could not load fixtures. Try again later.</p>
        </div>
      )}

      {!error && matches.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-muted text-sm">No fixtures available yet.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Upcoming</h2>
          <div className="space-y-6">
            {upcoming.map(([date, dayMatches]) => (
              <MatchDay key={date} date={date} matches={dayMatches} />
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Results</h2>
          <div className="space-y-6">
            {results.map(([date, dayMatches]) => (
              <MatchDay key={date} date={date} matches={dayMatches} />
            ))}
          </div>
        </div>
      )}
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

function MatchCard({ match: m }: { match: Match }) {
  const isFinished = m.status === "FINISHED";
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const homeScore = m.score.fullTime.home;
  const awayScore = m.score.fullTime.away;

  return (
    <div className={`card py-3 px-4 ${isLive ? "border-accent/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {m.homeTeam.crest && (
            <img src={m.homeTeam.crest} alt={m.homeTeam.name} className="w-6 h-6 object-contain flex-shrink-0" />
          )}
          <span className={`text-sm font-semibold truncate ${isFinished && homeScore !== null && awayScore !== null && homeScore > awayScore ? "text-white" : "text-gray-300"}`}>
            {m.homeTeam.name}
          </span>
        </div>

        {/* Score / time */}
        <div className="flex-shrink-0 text-center w-20">
          {isFinished ? (
            <span className="text-white font-extrabold text-lg">
              {homeScore} – {awayScore}
            </span>
          ) : isLive ? (
            <span className="text-accent font-bold text-sm animate-pulse">LIVE</span>
          ) : (
            <div>
              <span className="text-accent font-bold text-sm">{formatTime(m.utcDate)}</span>
              <p className="text-muted text-[10px]">BST</p>
            </div>
          )}
          <p className="text-muted text-[10px] mt-0.5">{formatStage(m.stage, m.group)}</p>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className={`text-sm font-semibold truncate ${isFinished && homeScore !== null && awayScore !== null && awayScore > homeScore ? "text-white" : "text-gray-300"}`}>
            {m.awayTeam.name}
          </span>
          {m.awayTeam.crest && (
            <img src={m.awayTeam.crest} alt={m.awayTeam.name} className="w-6 h-6 object-contain flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}
