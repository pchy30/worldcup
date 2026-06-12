import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-admin-secret");
  if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { player_name?: string; card?: string; undo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { player_name, card, undo = false } = body;
  if (!player_name || !card) {
    return NextResponse.json(
      { error: "player_name and card (yellow | red) are required." },
      { status: 400 }
    );
  }

  if (card !== "yellow" && card !== "red") {
    return NextResponse.json(
      { error: "card must be 'yellow' or 'red'." },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Find player by name (case-insensitive partial match)
  const { data: players, error: searchError } = await adminSupabase
    .from("players")
    .select("id, name, yellow_cards, red_cards, total_points")
    .ilike("name", `%${player_name}%`);

  if (searchError) {
    return NextResponse.json({ error: searchError.message }, { status: 500 });
  }

  if (!players || players.length === 0) {
    return NextResponse.json(
      { error: `No player found matching "${player_name}".` },
      { status: 404 }
    );
  }

  if (players.length > 1) {
    return NextResponse.json(
      {
        error: "Multiple players matched — be more specific.",
        matches: players.map((p) => p.name),
      },
      { status: 400 }
    );
  }

  const player = players[0];
  const delta = undo ? -1 : 1;

  const yellowCards = card === "yellow"
    ? Math.max(0, player.yellow_cards + delta)
    : player.yellow_cards;
  const redCards = card === "red"
    ? Math.max(0, player.red_cards + delta)
    : player.red_cards;

  const { error: updateError } = await adminSupabase
    .from("players")
    .update({ yellow_cards: yellowCards, red_cards: redCards })
    .eq("id", player.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    player: player.name,
    yellow_cards: yellowCards,
    red_cards: redCards,
    undo,
  });
}
