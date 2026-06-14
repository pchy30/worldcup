create table if not exists app_settings (
  key text primary key,
  value text not null
);

-- Tracks the last time card events were fetched per match so the sync
-- only fetches match detail for newly finished matches.
insert into app_settings (key, value)
values ('last_card_sync_at', '1970-01-01T00:00:00Z')
on conflict (key) do nothing;