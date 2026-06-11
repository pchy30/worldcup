create table public.player_point_snapshots (
  player_id    uuid not null references public.players(id) on delete cascade,
  snapshot_date date not null,
  total_points  integer not null default 0,
  primary key (player_id, snapshot_date)
);

create index player_point_snapshots_date_idx on public.player_point_snapshots(snapshot_date desc);

alter table public.player_point_snapshots enable row level security;
create policy "Snapshots readable by all" on public.player_point_snapshots for select using (true);
