-- Seed test data for Marketplace v2 validation

do $$
begin

-- Create auth users directly (local dev only)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'seller-a@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'seller-b@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'seller-c@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'seller-d@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'viewer-a@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- Create corresponding public.profiles
insert into public.profiles (id, email, display_name)
values
  ('00000000-0000-0000-0000-0000000000a1', 'seller-a@test.local', 'seller_a'),
  ('00000000-0000-0000-0000-0000000000a2', 'seller-b@test.local', 'seller_b'),
  ('00000000-0000-0000-0000-0000000000a3', 'seller-c@test.local', 'seller_c'),
  ('00000000-0000-0000-0000-0000000000a4', 'seller-d@test.local', 'seller_d'),
  ('00000000-0000-0000-0000-0000000000a5', 'viewer-a@test.local', 'viewer_a')
on conflict (id) do nothing;

end;
$$;

-- Create active ASA marketplace listings for each seller
-- Seller A: 3 listings (1 featured, 2 organic)
insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured, featured_started_at, featured_expires_at)
select
  'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
  id, 'seller-a-featured-001', 'sell', 'A-Rare Resources', 'High quality metal and crystal for your crafting needs in ASA.',
  'ascended', 'metal', 100, 'FT only', 'ASA-PVP-01', 'eu', 'steam', 'es',
  'https://discord.gg/test', now(), 'active', now() - interval '2 days', now() + interval '5 days', true, now() - interval '2 days', now() + interval '5 days'
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1',
  id, 'seller-a-organic-001', 'trade', 'Breeding Rex Pair', 'Top stats rexes for breeding perfect mutations in ASA.',
  'ascended', 'rex', 2, 'Offers accepted', 'ASA-PVP-01', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '5 days', now() + interval '2 days', false
from public.marketplace_categories where slug = 'creatures' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1',
  id, 'seller-a-organic-002', 'sell', 'Ascendant Shotgun BP', '357 damage ascendant shotgun blueprint cheap price.',
  'ascended', 'shotgun_bp', 1, 'PayPal only', 'ASA-PVP-02', 'na', 'xbox', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '6 days', false
from public.marketplace_categories where slug = 'equipment' limit 1;

-- Seller B: 3 listings (1 featured, 2 organic)
insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured, featured_started_at, featured_expires_at)
select
  'b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a2',
  id, 'seller-b-featured-001', 'sell', 'B-Sturdy Gear Package', 'Full ascendant flak set and pump shotgun in ASA cluster.',
  'ascended', 'gear_set', 1, 'PayPal', 'ASA-Cross-01', 'eu', 'crossplay', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '3 days', now() + interval '4 days', true, now() - interval '3 days', now() + interval '4 days'
from public.marketplace_categories where slug = 'equipment' limit 1;

-- Seller B: 2 listings (0 featured, 2 organic)
insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2',
  id, 'seller-b-organic-001', 'sell', 'Tek Replicator BP', 'Tek replicator blueprint for sale at great price in ASA.',
  'ascended', 'tek_replicator', 1, 'Negotiable', 'ASA-Cross-01', 'eu', 'crossplay', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '3 days', now() + interval '4 days', false
from public.marketplace_categories where slug = 'blueprints' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2',
  id, 'seller-b-organic-002', 'buy', 'Taming Service', 'I will tame any creature for you at low prices in ASA.',
  'ascended', 'taming', null, 'PayPal', 'ASA-PVE-01', 'sa', 'epic', 'es',
  'https://discord.gg/test', now(), 'active', now() - interval '7 days', now() + interval '0 days', false
from public.marketplace_categories where slug = 'services' limit 1;

-- Seller C: 2 listings (1 featured, 1 organic but expired)
insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured, featured_started_at, featured_expires_at)
select
  'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3',
  id, 'seller-c-featured-001', 'sell', 'C-Rare Pearls', 'Black pearls bulk for sale good price in ASA server.',
  'ascended', 'black_pearls', 500, 'FT only', 'ASA-PVP-03', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '6 days', true, now() - interval '1 day', now() + interval '6 days'
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a3',
  id, 'seller-c-expired-001', 'sell', 'C-Expired Gear', 'The expired listing must not appear in catalog results.',
  'ascended', 'old_gear', 1, 'Not available', 'ASA-PVP-03', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'expired', now() - interval '10 days', now() - interval '3 days', false
from public.marketplace_categories where slug = 'other' limit 1;

-- Seller D: 4 listings (1 featured, 2 organic, 1 hidden)
insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured, featured_started_at, featured_expires_at)
select
  'd0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a4',
  id, 'seller-d-featured-001', 'sell', 'D-Tek Generator Blueprint', 'Tek generator BP cheap sale in ASA cluster server now.',
  'ascended', 'tek_generator', 1, 'PayPal', 'ASA-PVP-04', 'oc', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '6 days', true, now() - interval '1 day', now() + interval '6 days'
from public.marketplace_categories where slug = 'blueprints' limit 1;

-- Seller D: 3 listings (0 featured, 2 organic, 1 hidden)
insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4',
  id, 'seller-d-organic-001', 'trade', 'D-PTP Giga Egg', 'Giga egg for trade top quality in ASA server cluster.',
  'ascended', 'giga_egg', 1, 'Trade only', 'ASA-PVP-04', 'oc', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '4 days', now() + interval '3 days', false
from public.marketplace_categories where slug = 'creatures' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'd0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a4',
  id, 'seller-d-organic-002', 'sell', 'D-MasterC Helmet BP', 'Mastercraft helmet blueprint for cheap price in ASA.',
  'ascended', 'mc_helmet', 1, 'PayPal', 'ASA-PVP-04', 'oc', 'playstation', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '2 days', now() + interval '5 days', false
from public.marketplace_categories where slug = 'equipment' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status)
select
  'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a4',
  id, 'seller-d-hidden-001', 'sell', 'D-Hidden Listing', 'The hidden listing should not appear in catalog views.',
  'ascended', 'hidden_item', 1, 'Not available', 'ASA-PVP-04', 'oc', 'steam', 'en',
  'https://discord.gg/test', now(), 'hidden'
from public.marketplace_categories where slug = 'services' limit 1;

-- Recommendation preferences for viewer-a (profile already exists)
insert into public.marketplace_recommendation_preferences (user_id, personalization_enabled, reset_at)
values ('00000000-0000-0000-0000-0000000000a5', true, now())
on conflict (user_id) do update set personalization_enabled = true;

-- Record events for viewer-a
insert into public.marketplace_recommendation_events (user_id, listing_id, event_type, weight, context, client_event_id, created_at)
select
  '00000000-0000-0000-0000-0000000000a5', null, 'filter', 1,
  '{"category":"resources"}', gen_random_uuid(), now() - interval '1 hour'
where not exists (select 1 from public.marketplace_recommendation_events where user_id = '00000000-0000-0000-0000-0000000000a5');

insert into public.marketplace_recommendation_events (user_id, listing_id, event_type, weight, context, client_event_id, created_at)
select
  '00000000-0000-0000-0000-0000000000a5', null, 'search', 1,
  '{"search":"rex"}', gen_random_uuid(), now() - interval '30 minutes';

-- Refresh interest profile
select private.refresh_marketplace_interest_profile('00000000-0000-0000-0000-0000000000a5');

-- Record an impression for exposure tracking
insert into public.marketplace_listing_impressions (user_id, listing_id, bucket_key, placement, position)
select '00000000-0000-0000-0000-0000000000a5', id, floor(extract(epoch from now())/3600)::bigint, 'organic', 1
from public.marketplace_listings
where owner_user_id = '00000000-0000-0000-0000-0000000000a1'
  and status = 'active'
limit 1;

-- Add viewer-a to QA allowlist
insert into private.marketplace_payment_qa_allowlist (user_id, active, added_by)
values ('00000000-0000-0000-0000-0000000000a5', true, '00000000-0000-0000-0000-0000000000a1')
on conflict (user_id) do nothing;

-- Enable paypal_payments feature flag for relevant tests
insert into public.feature_flags (key, enabled, updated_by)
values ('paypal_payments', true, '00000000-0000-0000-0000-0000000000a1')
on conflict (key) do update set enabled = true;

-- Ensure marketplace_settings are correct
update public.marketplace_settings
set marketplace_enabled = true, payments_enabled = true, price_minor = 300, currency = 'USD', environment = 'sandbox'
where key = 'featured_listing';

do $$
begin
  raise notice 'Seed data loaded successfully';
end;
$$;
