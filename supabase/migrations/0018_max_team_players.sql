-- Per-league cap on players from the same national team.
-- Starts at 2 (group stage default), auto-bumped by sync cron as tournament progresses:
-- QF → 3, SF → 4, Final → unlimited (99)
alter table public.leagues
  add column if not exists max_team_players integer not null default 2;