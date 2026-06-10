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