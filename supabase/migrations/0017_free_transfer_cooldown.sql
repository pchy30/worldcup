-- Add a cooldown timestamp per manager per league for free transfers.
-- When a team is eliminated, free_transfer_available_at is set to now + 12 hours.
-- The transfer API blocks free transfers until this timestamp has passed.
alter table public.league_members
  add column if not exists free_transfer_available_at timestamptz default null;