-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────
create type draft_mode as enum ('live', 'slow');
create type draft_status as enum ('pending', 'active', 'completed');
create type transfer_window_status as enum ('open', 'closed');
create type player_position as enum ('GK', 'DEF', 'MID', 'FWD');

-- ─── Profiles (extends Supabase auth.users) ───────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- ─── National Teams ───────────────────────────────────────────────────────────
create table public.national_teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code char(3) not null unique,
  flag_url text,
  is_eliminated boolean not null default false,
  api_football_id integer unique
);
alter table public.national_teams enable row level security;
create policy "Teams are readable by all" on public.national_teams for select using (true);

-- ─── Players ──────────────────────────────────────────────────────────────────
create table public.players (
  id uuid primary key default uuid_generate_v4(),
  api_football_id integer unique,
  name text not null,
  position player_position not null,
  team_id uuid not null references public.national_teams(id),
  goals integer not null default 0,
  assists integer not null default 0,
  clean_sheets integer not null default 0,
  total_points integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.players enable row level security;
create policy "Players are readable by all" on public.players for select using (true);

-- Index for fast "available players" queries
create index players_team_id_idx on public.players(team_id);
create index players_total_points_idx on public.players(total_points desc);

-- ─── Leagues ──────────────────────────────────────────────────────────────────
create table public.leagues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 8)),
  commissioner_id uuid not null references public.profiles(id),
  draft_mode draft_mode not null default 'live',
  draft_status draft_status not null default 'pending',
  draft_order uuid[] not null default '{}',
  current_pick_index integer not null default 0,
  pick_time_limit_seconds integer not null default 90,
  slow_draft_hours integer not null default 24,
  current_pick_deadline timestamptz,
  max_participants integer not null default 12,
  created_at timestamptz not null default now()
);
alter table public.leagues enable row level security;

create policy "Commissioners can update their leagues" on public.leagues
  for update using (auth.uid() = commissioner_id);
create policy "Authenticated users can create leagues" on public.leagues
  for insert with check (auth.uid() = commissioner_id);

-- ─── League Members ───────────────────────────────────────────────────────────
create table public.league_members (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  total_points integer not null default 0,
  goals_scored integer not null default 0,
  assists integer not null default 0,
  highest_individual_player_points integer not null default 0,
  joined_at timestamptz not null default now(),
  unique(league_id, user_id)
);
alter table public.league_members enable row level security;
create policy "Members can view members of their leagues" on public.league_members
  for select using (
    exists (
      select 1 from public.league_members lm2
      where lm2.league_id = league_members.league_id and lm2.user_id = auth.uid()
    )
  );
create policy "Users can join leagues (insert own record)" on public.league_members
  for insert with check (auth.uid() = user_id);

create index league_members_league_id_idx on public.league_members(league_id);
create index league_members_user_id_idx on public.league_members(user_id);

-- Deferred: league_members must exist before this policy can reference it
create policy "League members can view their leagues" on public.leagues
  for select using (
    auth.uid() = commissioner_id
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = leagues.id and lm.user_id = auth.uid()
    )
  );

-- ─── Squad Players (which players each manager has drafted) ──────────────────
create table public.squad_players (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.players(id),
  drafted_at timestamptz not null default now(),
  unique(league_id, player_id),            -- no duplicate players across squads
  unique(league_id, manager_id, player_id) -- can't draft same player twice
);
alter table public.squad_players enable row level security;
create policy "Squad visible to league members" on public.squad_players
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = squad_players.league_id and lm.user_id = auth.uid()
    )
  );
create policy "Manager can insert their own squad players" on public.squad_players
  for insert with check (auth.uid() = manager_id);

create index squad_players_league_id_idx on public.squad_players(league_id);
create index squad_players_manager_id_idx on public.squad_players(manager_id);

-- ─── Draft Picks (log of every pick during the draft) ────────────────────────
create table public.draft_picks (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  manager_id uuid not null references public.profiles(id),
  player_id uuid not null references public.players(id),
  pick_number integer not null,
  picked_at timestamptz not null default now(),
  unique(league_id, pick_number)
);
alter table public.draft_picks enable row level security;
create policy "Draft picks visible to league members" on public.draft_picks
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = draft_picks.league_id and lm.user_id = auth.uid()
    )
  );
create policy "Managers can insert own picks" on public.draft_picks
  for insert with check (auth.uid() = manager_id);

-- ─── Transfer Windows ─────────────────────────────────────────────────────────
create table public.transfer_windows (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status transfer_window_status not null default 'closed',
  created_at timestamptz not null default now()
);
alter table public.transfer_windows enable row level security;
create policy "Transfer windows visible to league members" on public.transfer_windows
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = transfer_windows.league_id and lm.user_id = auth.uid()
    )
  );

-- ─── Transfers ────────────────────────────────────────────────────────────────
create table public.transfers (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  manager_id uuid not null references public.profiles(id),
  player_out_id uuid not null references public.players(id),
  player_in_id uuid not null references public.players(id),
  transfer_window_id uuid not null references public.transfer_windows(id),
  confirmed_at timestamptz not null default now()
);
alter table public.transfers enable row level security;
create policy "Transfers visible to league members" on public.transfers
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = transfers.league_id and lm.user_id = auth.uid()
    )
  );
create policy "Managers can make their own transfers" on public.transfers
  for insert with check (auth.uid() = manager_id);

-- ─── Function: recalculate manager points ────────────────────────────────────
create or replace function public.recalculate_manager_points(p_league_id uuid, p_manager_id uuid)
returns void language plpgsql security definer as $$
declare
  v_total integer := 0;
  v_goals integer := 0;
  v_assists integer := 0;
  v_highest integer := 0;
  v_player_points integer;
begin
  for v_player_points, v_goals, v_assists in
    select
      pl.total_points,
      pl.goals,
      pl.assists
    from public.squad_players sp
    join public.players pl on pl.id = sp.player_id
    where sp.league_id = p_league_id and sp.manager_id = p_manager_id
  loop
    v_total := v_total + v_player_points;
    if v_player_points > v_highest then
      v_highest := v_player_points;
    end if;
  end loop;

  update public.league_members
  set
    total_points = v_total,
    goals_scored = (
      select coalesce(sum(pl.goals), 0)
      from public.squad_players sp
      join public.players pl on pl.id = sp.player_id
      where sp.league_id = p_league_id and sp.manager_id = p_manager_id
    ),
    assists = (
      select coalesce(sum(pl.assists), 0)
      from public.squad_players sp
      join public.players pl on pl.id = sp.player_id
      where sp.league_id = p_league_id and sp.manager_id = p_manager_id
    ),
    highest_individual_player_points = v_highest
  where league_id = p_league_id and user_id = p_manager_id;
end;
$$;

-- ─── Function: realtime leaderboard view ─────────────────────────────────────
create or replace view public.leaderboard as
select
  lm.league_id,
  lm.user_id,
  lm.display_name,
  lm.total_points,
  lm.goals_scored,
  lm.assists,
  lm.highest_individual_player_points,
  rank() over (
    partition by lm.league_id
    order by
      lm.total_points desc,
      lm.goals_scored desc,
      lm.assists desc,
      lm.highest_individual_player_points desc
  ) as position
from public.league_members lm;