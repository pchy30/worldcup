select cron.schedule(
  'update-transfer-windows-every-hour',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tptsbpnrmqaxdxfiuuix.supabase.co/functions/v1/update-transfer-windows',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwdHNicG5ybXFheGR4Zml1dWl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTEwMDU1MywiZXhwIjoyMDk2Njc2NTUzfQ.8tzQpYVtjDVkisiQdEV7u15PM9FFDfUB6_c2rWJMcPk"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);