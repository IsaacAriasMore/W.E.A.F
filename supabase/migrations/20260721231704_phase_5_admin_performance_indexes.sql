-- Cover every foreign-key side reported by Supabase Performance Advisor.
-- Nullable administrative references use partial indexes to keep them compact.

create index if not exists ads_settings_updated_by_idx
  on public.ads_settings(updated_by) where updated_by is not null;
create index if not exists analytics_events_user_created_idx
  on public.analytics_events(user_id, created_at desc) where user_id is not null;
create index if not exists feature_flags_updated_by_idx
  on public.feature_flags(updated_by) where updated_by is not null;
create index if not exists ini_presets_created_by_idx
  on public.ini_presets(created_by) where created_by is not null;
create index if not exists reports_reporter_user_idx
  on public.reports(reporter_user_id) where reporter_user_id is not null;
create index if not exists server_listing_clicks_user_idx
  on public.server_listing_clicks(user_id) where user_id is not null;
create index if not exists server_listings_created_by_admin_idx
  on public.server_listings(created_by_admin) where created_by_admin is not null;
create index if not exists subscriptions_listing_idx
  on public.subscriptions(listing_id) where listing_id is not null;
create index if not exists subscriptions_user_idx
  on public.subscriptions(user_id);
