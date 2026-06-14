# Admin Commands

## Eliminate a Team

When a team gets knocked out of the World Cup, run this to mark them as eliminated.
This allows managers to transfer out players from that team.

Replace `ENG` with the 3-letter team code and `your-admin-secret` with the value from your Vercel env.

```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/eliminate-team \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
  -d '{"team_code": "ENG"}'
```

### To un-eliminate a team (e.g. if entered by mistake):

```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/eliminate-team \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
  -d '{"team_code": "ENG", "eliminated": false}'
```

---

## Set Assists

Run this daily with the **full cumulative assists list**. Anyone not in the list gets reset to 0, so always include everyone with assists so far.

```bash
curl -X POST "https://tptsbpnrmqaxdxfiuuix.supabase.co/functions/v1/Assists" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwdHNicG5ybXFheGR4Zml1dWl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTEwMDU1MywiZXhwIjoyMDk2Njc2NTUzfQ.8tzQpYVtjDVkisiQdEV7u15PM9FFDfUB6_c2rWJMcPk" \
  -H "Content-Type: application/json" \
  -d '{"assists":[{"name":"Player Name","assists":1},{"name":"Player Name 2","assists":2}]}'
```

Only players in the list are updated — anyone omitted is left untouched. Safe to send a partial list of just the new assists for the day.

The response shows which players were updated and any names not found in the DB.

---

## Player Cards

When a player receives a yellow or red card, run this to apply the point deduction.
Points are recalculated on the next sync (within 30 minutes).

**Yellow card (−1 pt):**
```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/player-card \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
  -d '{"player_name": "Mbappe", "card": "yellow"}'
```

**Red card (−3 pts):**
```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/player-card \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
  -d '{"player_name": "Mbappe", "card": "red"}'
```

### To undo a card (entered by mistake):

```bash
curl -X POST https://worldcup-web-flame.vercel.app/api/admin/player-card \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
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