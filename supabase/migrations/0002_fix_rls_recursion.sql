-- Helper that checks membership without triggering RLS (security definer bypasses it)
create or replace function public.is_league_member(p_league_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

-- Fix league_members select policy (was self-recursive)
drop policy if exists "Members can view members of their leagues" on public.league_members;
create policy "Members can view members of their leagues" on public.league_members
  for select using (public.is_league_member(league_id));

-- Fix leagues select policy to use the same helper
drop policy if exists "League members can view their leagues" on public.leagues;
create policy "League members can view their leagues" on public.leagues
  for select using (
    auth.uid() = commissioner_id
    or public.is_league_member(id)
  );

-- Fix all other policies that reference league_members directly
drop policy if exists "Squad visible to league members" on public.squad_players;
create policy "Squad visible to league members" on public.squad_players
  for select using (public.is_league_member(league_id));

drop policy if exists "Draft picks visible to league members" on public.draft_picks;
create policy "Draft picks visible to league members" on public.draft_picks
  for select using (public.is_league_member(league_id));

drop policy if exists "Transfer windows visible to league members" on public.transfer_windows;
create policy "Transfer windows visible to league members" on public.transfer_windows
  for select using (public.is_league_member(league_id));

drop policy if exists "Transfers visible to league members" on public.transfers;
create policy "Transfers visible to league members" on public.transfers
  for select using (public.is_league_member(league_id));