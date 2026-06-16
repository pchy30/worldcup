-- Push notification subscriptions
create table public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "Users manage own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

-- Track which windows have already had notifications sent
alter table public.transfer_windows
  add column if not exists push_sent boolean not null default false;