# Admin Commands

## Daily Tasks

Every day after matches are played, run these two things manually:

### 1. Assists
Run the Assists edge function with any players who got new assists that day. You only need to include players with new assists — existing ones are preserved. See the [Set Assists](#set-assists) section below for the full command.

### 2. Cards
Run the player-card command once for each yellow or red card issued that day. See the [Player Cards](#player-cards) section below.

Everything else (goals, clean sheets, manager points, leaderboard) updates automatically every 30 minutes via cron.

### Credentials
- **Admin secret:** stored in Vercel env as `ADMIN_SECRET`
- **Supabase service key:** stored in Supabase dashboard → Project Settings → API
- **App URL:** `https://worldcup-web-flame.vercel.app`
- **Supabase URL:** `https://tptsbpnrmqaxdxfiuuix.supabase.co`

---

## Eliminate a Team

When a team gets knocked out of the World Cup, run this to mark them as eliminated.
This allows managers to transfer out players from that team.

Replace `ENG` with the 3-letter team code from the reference table at the bottom of this file.

```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/eliminate-team \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"team_code": "ENG"}'
```

### To un-eliminate a team (e.g. if entered by mistake):

```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/eliminate-team \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"team_code": "ENG", "eliminated": false}'
```

---

## Set Assists

Run this with any players who got new assists. Only players in the list are updated — anyone omitted is left untouched. Safe to send just today's new assists.

```bash
curl -X POST "https://tptsbpnrmqaxdxfiuuix.supabase.co/functions/v1/Assists" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"assists":[{"name":"Player Name","assists":1},{"name":"Player Name 2","assists":2}]}'
```

The response shows which players were updated and any names not found in the DB. If a name isn't found, check the exact spelling in the Supabase players table.

---

## Player Cards

When a player receives a yellow or red card, run this to apply the point deduction.
Points are recalculated on the next sync (within 30 minutes).

**Yellow card (−1 pt):**
```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/player-card \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"player_name": "Mbappe", "card": "yellow"}'
```

**Red card (−3 pts):**
```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/player-card \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"player_name": "Mbappe", "card": "red"}'
```

### To undo a card (entered by mistake):

```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/player-card \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"player_name": "Mbappe", "card": "yellow", "undo": true}'
```

> **Notes:**
> - `player_name` is a partial case-insensitive match — "mbappe", "Mbappé", "Kylian" all work as long as only one player matches
> - If multiple players match, the API returns the list of matches so you can be more specific
> - A red card on the same player as a yellow (second yellow) — add both separately

---

### Team codes reference (3-letter codes):

| Team | Code |
|------|------|
| Argentina | ARG |
| Brazil | BRA |
| England | ENG |
| France | FRA |
| Germany | GER |
| Spain | ESP |
| Portugal | POR |
| Netherlands | NED |
| USA | USA |
| Mexico | MEX |
| Japan | JPN |
| South Korea | KOR |
| Morocco | MAR |
| Senegal | SEN |
| Australia | AUS |
| Croatia | CRO |
| Belgium | BEL |
| Uruguay | URU |
| Colombia | COL |
| Switzerland | SUI |
| Canada | CAN |
| Ecuador | ECU |
| Saudi Arabia | KSA |
| Iran | IRN |
| Tunisia | TUN |
| Ghana | GHA |
| South Africa | RSA |
| Algeria | ALG |
| Egypt | EGY |
| Ivory Coast | CIV |
| Morocco | MAR |
| Congo DR | COD |
| Cape Verde | CPV |
| Qatar | QAT |
| Jordan | JOR |
| Iraq | IRQ |
| Uzbekistan | UZB |
| Norway | NOR |
| Scotland | SCO |
| Austria | AUT |
| Turkey | TUR |
| Sweden | SWE |
| Czechia | CZE |
| Bosnia-Herzegovina | BIH |
| Panama | PAN |
| Haiti | HAI |
| Paraguay | PAR |
| New Zealand | NZL |
| Curaçao | CUW |