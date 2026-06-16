import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:admin@worldcupfantasy.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function handler(request: NextRequest) {
  // Accept ADMIN_SECRET via header (manual calls) or Vercel cron auth
  const adminSecret = request.headers.get("x-admin-secret");
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  const isAuthorized =
    adminSecret === process.env.ADMIN_SECRET ||
    cronSecret === process.env.CRON_SECRET;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const now = new Date().toISOString();

  // Find transfer windows that just opened and haven't had push sent yet
  const { data: openWindows } = await adminSupabase
    .from("transfer_windows")
    .select("id, league_id, league:leagues(name)")
    .lte("opens_at", now)
    .gte("closes_at", now)
    .eq("push_sent", false);

  let pushSent = 0;

  for (const win of openWindows ?? []) {
    const leagueRaw = win.league as { name: string } | { name: string }[] | null;
    const leagueName = (Array.isArray(leagueRaw) ? leagueRaw[0]?.name : leagueRaw?.name) ?? "Your league";

    // Get all members of this league
    const { data: members } = await adminSupabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", win.league_id);

    const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (userIds.length === 0) continue;

    // Get their push subscriptions
    const { data: subs } = await adminSupabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", userIds);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "Transfer Window Open 🔄",
            body: `${leagueName} — window closes in 24 hours. Make your moves!`,
            url: "/dashboard",
            tag: `transfer-${win.id}`,
          })
        );
        pushSent++;
      } catch (e: unknown) {
        // Remove stale subscriptions (410 Gone = unsubscribed)
        if ((e as { statusCode?: number }).statusCode === 410) {
          await adminSupabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        } else {
          console.error("Push failed:", e);
        }
      }
    }

    // Mark window as notified regardless — avoid re-sending on next cron tick
    await adminSupabase
      .from("transfer_windows")
      .update({ push_sent: true })
      .eq("id", win.id);
  }

  return NextResponse.json({ ok: true, windows: openWindows?.length ?? 0, push_sent: pushSent });
}

export { handler as GET, handler as POST };