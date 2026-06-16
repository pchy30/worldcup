import FixturesClient from "./FixturesClient";

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY ?? "";

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

function formatDate(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
}

export const revalidate = 1800;

export default async function FixturesPage() {
  let matches: Match[] = [];

  if (FOOTBALL_DATA_KEY) {
    try {
      const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
        next: { revalidate: 1800 },
      });
      if (res.ok) {
        const data = await res.json();
        matches = data.matches ?? [];
      }
    } catch {
      // fall through to empty state
    }
  }

  const byDate = new Map<string, Match[]>();
  for (const m of matches) {
    const date = formatDate(m.utcDate);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(m);
  }

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

  upcoming.sort((a, b) => new Date(a[1][0].utcDate).getTime() - new Date(b[1][0].utcDate).getTime());
  results.sort((a, b) => new Date(b[1][0].utcDate).getTime() - new Date(a[1][0].utcDate).getTime());

  return <FixturesClient upcoming={upcoming} results={results} />;
}