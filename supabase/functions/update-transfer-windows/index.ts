// Supabase Edge Function — runs every hour via cron.
// Auto-creates the next transfer window 3 days after the current one closes,
// based purely on time (not status column).
// Also expires slow-draft picks that have passed their deadline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WINDOW_DURATION_HOURS = 24;
const WINDOW_INTERVAL_DAYS = 3;

Deno.serve(async (_req) => {
  const now = new Date();
  const nowIso = now.toISOString();

  // Find all leagues whose most recent window has closed and don't yet have a
  // future window scheduled. We do this by finding windows that closed in the
  // past and checking no window exists with opens_at > now for that league.
  const { data: recentlyClosed } = await supabase
    .from("transfer_windows")
    .select("league_id, closes_at")
    .lt("closes_at", nowIso)
    .order("closes_at", { ascending: false });

  // Dedupe to the latest closed window per league
  const latestClosedPerLeague = new Map<string, string>();
  for (const w of recentlyClosed ?? []) {
    if (!latestClosedPerLeague.has(w.league_id)) {
      latestClosedPerLeague.set(w.league_id, w.closes_at);
    }
  }

  for (const [leagueId, closedAt] of latestClosedPerLeague.entries()) {
    // Check if a future window already exists for this league
    const { data: futureWindows } = await supabase
      .from("transfer_windows")
      .select("id")
      .eq("league_id", leagueId)
      .gt("opens_at", nowIso)
      .limit(1);

    if (futureWindows && futureWindows.length > 0) continue;

    // No future window — create the next one
    const nextOpen = new Date(closedAt);
    nextOpen.setDate(nextOpen.getDate() + WINDOW_INTERVAL_DAYS);
    const nextClose = new Date(nextOpen);
    nextClose.setHours(nextClose.getHours() + WINDOW_DURATION_HOURS);

    await supabase.from("transfer_windows").insert({
      league_id: leagueId,
      opens_at: nextOpen.toISOString(),
      closes_at: nextClose.toISOString(),
    });
  }

  // Expire slow-draft picks that have passed their deadline
  const { data: expiredLeagues } = await supabase
    .from("leagues")
    .select("id, current_pick_index, draft_order, slow_draft_hours")
    .eq("draft_status", "active")
    .eq("draft_mode", "slow")
    .lt("current_pick_deadline", nowIso);

  for (const league of expiredLeagues ?? []) {
    const nextIndex = league.current_pick_index + 1;
    if (nextIndex >= league.draft_order.length * 11) {
      await supabase
        .from("leagues")
        .update({ draft_status: "completed" })
        .eq("id", league.id);
    } else {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + league.slow_draft_hours);
      await supabase
        .from("leagues")
        .update({
          current_pick_index: nextIndex,
          current_pick_deadline: deadline.toISOString(),
        })
        .eq("id", league.id);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});