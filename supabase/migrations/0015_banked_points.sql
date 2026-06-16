-- Stores points earned by players who have since been transferred out.
-- The sync recalculates from current squad_players only, so we bank
-- transferred-out earnings here to preserve the manager's running total.
alter table public.league_members
  add column if not exists banked_points integer not null default 0;