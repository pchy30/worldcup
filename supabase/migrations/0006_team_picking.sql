-- Tracks which national teams each manager has picked for bonus points
create table public.manager_national_teams (
  id           uuid primary key default uuid_generate_v4(),
  league_id    uuid not null references public.leagues(id) on delete cascade,
  manager_id   uuid not null references public.profiles(id) on delete cascade,
  team_id      uuid not null references public.national_teams(id),
  round        integer not null check (round in (1, 2)),
  picked_at    timestamptz not null default now(),
  unique(league_id, manager_id, round)
);

alter table public.manager_national_teams enable row level security;
create policy "Team picks visible to league members" on public.manager_national_teams
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = manager_national_teams.league_id and lm.user_id = auth.uid()
    )
  );
create policy "Managers can insert their own team picks" on public.manager_national_teams
  for insert with check (auth.uid() = manager_id);

create index manager_national_teams_league_idx on public.manager_national_teams(league_id);

-- Add team_pick_status to leagues: pending | picking | player_draft | completed
-- We reuse draft_status but need a new phase flag so we don't break existing logic.
-- Instead we add a separate column.
alter table public.leagues
  add column if not exists team_pick_index integer not null default 0,
  add column if not exists team_pick_offers uuid[] not null default '{}';
-- team_pick_offers: the 4 team IDs currently offered to the active picker

-- Add bonus_points column to league_members for national team win/draw bonuses
alter table public.league_members
  add column if not exists bonus_points integer not null default 0;
