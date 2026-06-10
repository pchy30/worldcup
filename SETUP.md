# World Cup Fantasy — Setup Guide

## Prerequisites

- Node.js 20+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) (`npm install -g expo-cli`)
- Xcode (iOS) or Android Studio (Android) for mobile

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Set up Supabase

### Option A — Local dev (recommended)

```bash
supabase start
# Copy the output URLs/keys into apps/web/.env.local and apps/mobile/.env.local
supabase db push
```

### Option B — Hosted

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL editor, run `supabase/migrations/0001_initial_schema.sql`
3. Copy project URL and anon/service keys

---

## 3. Configure environment variables

**apps/web/.env.local**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
API_FOOTBALL_KEY=...
```

**apps/mobile/.env.local** (or via `app.json` extra)
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 4. Run the web app

```bash
npm run dev:web
# Opens at http://localhost:3000
```

---

## 5. Run the mobile app

```bash
cd apps/mobile
npx expo start
# Press 'i' for iOS simulator, 'a' for Android, or scan QR with Expo Go
```

---

## 6. Deploy Supabase Edge Functions (production)

```bash
supabase functions deploy sync-match-stats
supabase functions deploy update-transfer-windows
```

Set environment variables in the Supabase dashboard (Edge Functions → Secrets):
- `API_FOOTBALL_KEY`

Then set up cron triggers in the Supabase dashboard (Database → Extensions → pg_cron):

```sql
-- Sync player stats every 30 minutes
select cron.schedule('sync-stats', '*/30 * * * *',
  $$select net.http_post(url := 'https://<project>.supabase.co/functions/v1/sync-match-stats',
    headers := '{"Authorization": "Bearer <anon-key>"}')$$);

-- Update transfer windows every hour
select cron.schedule('transfer-windows', '0 * * * *',
  $$select net.http_post(url := 'https://<project>.supabase.co/functions/v1/update-transfer-windows',
    headers := '{"Authorization": "Bearer <anon-key>"}')$$);
```

---

## Architecture Overview

```
World-Cup-Fantasy/
├── apps/
│   ├── web/          # Next.js 14 — web app
│   └── mobile/       # Expo SDK 52 — iOS + Android app
├── packages/
│   └── shared/       # TypeScript types + scoring/validation logic
├── supabase/
│   ├── migrations/   # DB schema
│   └── functions/    # Edge functions (stats sync, transfer windows)
```

### Key flows

**Draft (live):** Commissioner starts draft → `draft_order` shuffled → `current_pick_index` advances → each pick validated server-side → Supabase Realtime pushes updates to all clients.

**Draft (slow):** Same flow but `current_pick_deadline` is set X hours ahead; `update-transfer-windows` cron auto-advances on timeout.

**Points:** `sync-match-stats` edge function calls API-Football every 30 min → updates `players.total_points` → calls `recalculate_manager_points()` SQL function for each affected manager.

**Transfers:** `update-transfer-windows` edge function opens/closes windows every 3 days. Client validates transfer via shared `validateTransfer()` logic before submitting to API.
