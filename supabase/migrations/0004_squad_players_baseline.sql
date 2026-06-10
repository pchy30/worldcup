-- Track the player's points at time of transfer so only post-transfer
-- points count toward the manager's score.
-- Drafted players keep baseline_points = 0 (all tournament points count).
alter table public.squad_players
  add column if not exists baseline_points integer not null default 0;
