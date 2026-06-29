import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.FOOTBALL_DATA_KEY ?? "";
  if (!key) return NextResponse.json({ matches: [] });

  const today = new Date().toISOString().split("T")[0];

  try {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`,
      { headers: { "X-Auth-Token": key }, cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ matches: [] });
    const data = await res.json();
    return NextResponse.json({ matches: data.matches ?? [] });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}