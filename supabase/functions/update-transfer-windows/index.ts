// Supabase Edge Function — runs every hour via cron.
// Opens/closes transfer windows based on their scheduled times,
// and auto-creates the next window 3 days after the current one closes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WINDOW_DURATION_HOURS = 24;
const WINDOW_INTERVAL_DAYS = 3;

Deno.serve(async (_req) => {
  const now = new Date().toISOString();

  // Open windows that should now be open
  await supabase
    .from("transfer_windows")
    .update({ status: "open" })
    .eq("status", "closed")
    .lte("opens_at", now)
    .gte("closes_at", now);

  // Close windows that have expired
  const { data: expiredWindows } = await supabase
    .from("transfer_windows")
    .update({ status: "closed" })
    .eq("status", "open")
    .lt("closes_at", now)
    .select("league_id, closes_at");

  // For each closed window, schedule the next one
  for (const w of expiredWindows ?? []) {
    const nextOpen = new Date(w.closes_at);
    nextOpen.setDate(nextOpen.getDate() + WINDOW_INTERVAL_DAYS);
    const nextClose = new Date(nextOpen);
    nextClose.setHours(nextClose.getHours() + WINDOW_DURATION_HOURS);

    await supabase.from("transfer_windows").insert({
      league_id: w.league_id,
      opens_at: nextOpen.toISOString(),
      closes_at: nextClose.toISOString(),
      status: "closed",
    });
  }

  // Expire slow-draft picks that have passed their deadline
  const { data: expiredLeagues } = await supabase
    .from("leagues")
    .select("id, current_pick_index, draft_order, slow_draft_hours")
    .eq("draft_status", "active")
    .eq("draft_mode", "slow")
    .lt("current_pick_deadline", now);

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