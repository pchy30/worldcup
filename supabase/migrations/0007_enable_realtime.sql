-- Enable realtime on tables that need live updates
alter table leagues replica identity full;
alter table league_members replica identity full;
alter table draft_picks replica identity full;
alter table manager_national_teams replica identity full;

alter publication supabase_realtime add table leagues;
alter publication supabase_realtime add table league_members;
alter publication supabase_realtime add table draft_picks;
alter publication supabase_realtime add table manager_national_teams;
