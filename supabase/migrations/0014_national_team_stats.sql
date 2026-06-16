-- Add wins/draws/bonus_points columns to national_teams so the leaderboard
-- can display per-team points accumulated without extra API calls.
alter table public.national_teams
  add column if not exists wins integer not null default 0,
  add column if not exists draws integer not null default 0,
  add column if not exists bonus_points integer not null default 0;