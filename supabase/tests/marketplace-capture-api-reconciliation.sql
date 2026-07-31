-- Marketplace PayPal capture API reconciliation — validation runner
-- Covers prepare_marketplace_paypal_capture extensions,
-- confirm_marketplace_paypal_capture_from_api and the idempotent late-webhook
-- behavior of process_marketplace_paypal_event introduced by
-- 20260731233000_marketplace_capture_api_reconciliation.sql.
-- Run: Get-Content .\supabase\tests\marketplace-capture-api-reconciliation.sql -Raw | docker exec -i supabase_db_W.E.A.F psql -U postgres
-- Everything runs inside a transaction rolled back at the end, so the local
-- database stays pristine (the ASA-only check is dropped in-memory for one fixture).

\set ON_ERROR_STOP off

\echo '=== MARKETPLACE PAYPAL CAPTURE API RECONCILIATION VALIDATION ==='

begin;

-- =============================================================================
-- Fixtures (local dev only, rolled back at the end)
-- =============================================================================
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('f3000000-0000-0000-0000-0000000000f3', 'capture-owner@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('f4000000-0000-0000-0000-0000000000f4', 'capture-other@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, email, display_name)
values
  ('f3000000-0000-0000-0000-0000000000f3', 'capture-owner@test.local', 'capture_owner'),
  ('f4000000-0000-0000-0000-0000000000f4', 'capture-other@test.local', 'capture_other')
on conflict (id) do nothing;

-- One fixture uses game='evolved'; the ASA-only check (NOT VALID) would block it.
alter table public.marketplace_listings drop constraint marketplace_new_writes_asa_only;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-0000000000f3',
  id, 'capture-listing-001', 'sell', 'Capture Listing One', 'Capture test fixture listing owned by the capture owner in ASA.',
  'ascended', 'metal', 10, 'FT only', 'CAP-PVP-01', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '30 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000002', 'f4000000-0000-0000-0000-0000000000f4',
  id, 'capture-listing-002', 'sell', 'Capture Listing Two', 'Capture test fixture listing owned by the other user in ASA.',
  'ascended', 'crystal', 5, 'Offers accepted', 'CAP-PVP-02', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '30 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-0000000000f3',
  id, 'capture-listing-003', 'sell', 'Capture Listing Three', 'Capture test fixture listing that is not an ascended listing.',
  'evolved', 'metal', 2, 'FT only', 'CAP-PVP-03', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '30 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-0000000000f3',
  id, 'capture-listing-004', 'sell', 'Capture Listing Four', 'Capture test fixture listing that is not active.',
  'ascended', 'sulfur', 3, 'PayPal only', 'CAP-PVP-04', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'hidden', now() - interval '1 day', now() + interval '30 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured, featured_started_at, featured_expires_at)
select
  'f0000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-0000000000f3',
  id, 'capture-listing-005', 'sell', 'Capture Listing Five', 'Capture test fixture listing already featured from a prior confirmation.',
  'ascended', 'fiber', 4, 'FT only', 'CAP-PVP-05', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '30 days', true, now() - interval '1 day', now() + interval '6 days'
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3',
  id, 'capture-listing-006', 'sell', 'Capture Listing Six', 'Capture test fixture listing for error-path fixtures.',
  'ascended', 'crystal', 7, 'Offers accepted', 'CAP-PVP-06', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '30 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_payments (id, listing_id, user_id, status, amount_minor, currency, paypal_order_id, paypal_capture_id, idempotency_key, paid_at)
values
  -- P01 fresh approved payment for the happy-path confirmation (L01)
  ('f0000000-0000-0000-0000-00000000c001', 'f0000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0001', null, 'c1000000-0000-0000-0000-000000000001', null),
  -- P02 captured payment whose listing is already featured (replay + late webhook) (L05)
  ('f0000000-0000-0000-0000-00000000c002', 'f0000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-0000000000f3', 'captured', 300, 'USD', 'PAYIDAPI0002', 'CAPIDAPI0002', 'c2000000-0000-0000-0000-000000000002', now()),
  -- P03 other-user payment (L02)
  ('f0000000-0000-0000-0000-00000000c003', 'f0000000-0000-0000-0000-000000000002', 'f4000000-0000-0000-0000-0000000000f4', 'approved', 300, 'USD', 'PAYIDAPI0003', null, 'c3000000-0000-0000-0000-000000000003', null),
  -- P04 failed payment (L06)
  ('f0000000-0000-0000-0000-00000000c004', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'failed', 300, 'USD', 'PAYIDAPI0004', null, 'c4000000-0000-0000-0000-000000000004', null),
  -- P05 refunded payment (L06)
  ('f0000000-0000-0000-0000-00000000c005', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'refunded', 300, 'USD', 'PAYIDAPI0005', null, 'c5000000-0000-0000-0000-000000000005', null),
  -- P06 reversed payment (L06)
  ('f0000000-0000-0000-0000-00000000c006', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'reversed', 300, 'USD', 'PAYIDAPI0006', null, 'c6000000-0000-0000-0000-000000000006', null),
  -- P07 approved with paid_at set (L06)
  ('f0000000-0000-0000-0000-00000000c007', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0007', null, 'c7000000-0000-0000-0000-000000000007', now()),
  -- P08 approved for incoming-amount mismatch (L06)
  ('f0000000-0000-0000-0000-00000000c008', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0008', null, 'c8000000-0000-0000-0000-000000000008', null),
  -- P09 approved for incoming-currency mismatch (L06)
  ('f0000000-0000-0000-0000-00000000c009', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0009', null, 'c9000000-0000-0000-0000-000000000009', null),
  -- P10 approved for order mismatch (L06)
  ('f0000000-0000-0000-0000-00000000c010', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0010', null, 'ca000000-0000-0000-0000-00000000000a', null),
  -- P11 approved with an already-attached capture id (mismatch replay) (L06)
  ('f0000000-0000-0000-0000-00000000c011', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0011', 'CAPIDAPI0011', 'cb000000-0000-0000-0000-00000000000b', null),
  -- P12 approved on the other-user listing (L02)
  ('f0000000-0000-0000-0000-00000000c012', 'f0000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0012', null, 'cc000000-0000-0000-0000-00000000000c', null),
  -- P13 approved on the evolved listing (L03)
  ('f0000000-0000-0000-0000-00000000c013', 'f0000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0013', null, 'cd000000-0000-0000-0000-00000000000d', null),
  -- P14 approved on the hidden listing (L04)
  ('f0000000-0000-0000-0000-00000000c014', 'f0000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0014', null, 'ce000000-0000-0000-0000-00000000000e', null),
  -- P15 approved on the already-featured listing (L05)
  ('f0000000-0000-0000-0000-00000000c015', 'f0000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-0000000000f3', 'approved', 300, 'USD', 'PAYIDAPI0015', null, 'cf000000-0000-0000-0000-00000000000f', null),
  -- P16 captured payment on a non-featured listing for the late-webhook mismatch (L06)
  ('f0000000-0000-0000-0000-00000000c016', 'f0000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-0000000000f3', 'captured', 300, 'USD', 'PAYIDAPI0016', 'CAPIDAPI0016', 'c1000000-0000-0000-0000-000000000010', now());

-- =============================================================================
-- 1. prepare_marketplace_paypal_capture exposes reconciliation inputs
-- =============================================================================
do $$
declare
  r jsonb;
begin
  r := public.prepare_marketplace_paypal_capture('f0000000-0000-0000-0000-00000000c001'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid);
  if r->>'payment_status' <> 'approved' then raise exception 'FAIL: payment_status'; end if;
  if r->>'paypal_capture_id' is not null then raise exception 'FAIL: paypal_capture_id should be null'; end if;
  if r->>'amount_minor' <> '300' or r->>'currency' <> 'USD' then raise exception 'FAIL: amount/currency'; end if;
  if r->>'environment' <> 'sandbox' then raise exception 'FAIL: environment'; end if;
  if r->>'already_captured' <> 'false' then raise exception 'FAIL: already_captured false expected'; end if;
  if r->>'paypal_order_id' is null then raise exception 'FAIL: order id missing'; end if;
  r := public.prepare_marketplace_paypal_capture('f0000000-0000-0000-0000-00000000c002'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid);
  if r->>'payment_status' <> 'captured' or r->>'already_captured' <> 'true' then raise exception 'FAIL: captured payment shape'; end if;
  if r->>'paypal_capture_id' <> 'CAPIDAPI0002' then raise exception 'FAIL: attached capture id not returned'; end if;
  raise notice 'PASS: prepare returns payment_status/paypal_capture_id/amount/currency/environment';
end;
$$;

-- =============================================================================
-- 2. Fresh confirmation activates the benefit exactly once
-- =============================================================================
do $$
declare
  result jsonb;
  pay_status text;
  pay_paid_at timestamptz;
  feat boolean;
  feat_start timestamptz;
  feat_end timestamptz;
  expires timestamptz;
  audit_ca integer;
  audit_fa integer;
  captured_at timestamptz := now();
begin
  result := public.confirm_marketplace_paypal_capture_from_api(
    'f0000000-0000-0000-0000-00000000c001'::uuid,
    'f3000000-0000-0000-0000-0000000000f3'::uuid,
    'PAYIDAPI0001', 'CAPIDAPI0001', 300, 'USD', captured_at
  );
  if result->>'confirmed' <> 'true' or result->>'reused' <> 'false' then raise exception 'FAIL: confirmation result'; end if;
  select status, paid_at into pay_status, pay_paid_at from public.marketplace_payments where id = 'f0000000-0000-0000-0000-00000000c001';
  if pay_status <> 'captured' or pay_paid_at is null then raise exception 'FAIL: payment not captured'; end if;
  select is_featured, featured_started_at, featured_expires_at, expires_at
  into feat, feat_start, feat_end, expires
  from public.marketplace_listings where id = 'f0000000-0000-0000-0000-000000000001';
  if not feat then raise exception 'FAIL: listing not featured'; end if;
  if feat_start is null or feat_end is null or feat_end <> feat_start + interval '7 days' then raise exception 'FAIL: featured window'; end if;
  if expires < feat_end then raise exception 'FAIL: expires_at not extended'; end if;
  select count(*) into audit_ca from public.marketplace_audit_log
  where payment_id = 'f0000000-0000-0000-0000-00000000c001' and action = 'capture_confirmed_from_api';
  select count(*) into audit_fa from public.marketplace_audit_log
  where payment_id = 'f0000000-0000-0000-0000-00000000c001' and action = 'featured_activated';
  if audit_ca <> 1 or audit_fa <> 1 then raise exception 'FAIL: expected exactly one audit row per action'; end if;
  raise notice 'PASS: fresh confirmation captures, features listing, writes both audits';
end;
$$;

-- =============================================================================
-- 3. Replaying the same order+capture is idempotent (reused, no new audit)
-- =============================================================================
do $$
declare
  result jsonb;
  feat_end_before timestamptz;
  feat_end_after timestamptz;
  audit_cnt integer;
begin
  select featured_expires_at into feat_end_before from public.marketplace_listings where id = 'f0000000-0000-0000-0000-000000000005';
  result := public.confirm_marketplace_paypal_capture_from_api(
    'f0000000-0000-0000-0000-00000000c002'::uuid,
    'f3000000-0000-0000-0000-0000000000f3'::uuid,
    'PAYIDAPI0002', 'CAPIDAPI0002', 300, 'USD', now()
  );
  if result->>'confirmed' <> 'true' or result->>'reused' <> 'true' then raise exception 'FAIL: replay should be reused'; end if;
  select featured_expires_at into feat_end_after from public.marketplace_listings where id = 'f0000000-0000-0000-0000-000000000005';
  if feat_end_before <> feat_end_after then raise exception 'FAIL: replay changed the featured window'; end if;
  select count(*) into audit_cnt from public.marketplace_audit_log
  where payment_id = 'f0000000-0000-0000-0000-00000000c002';
  if audit_cnt <> 0 then raise exception 'FAIL: replay wrote audit rows'; end if;
  raise notice 'PASS: replay returns reused and changes nothing';
end;
$$;

-- =============================================================================
-- 4-16. Guard failures raise the expected codes
-- =============================================================================
do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c010'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI9999', 'CAPIDAPI0001', 300, 'USD', now());
    raise exception 'FAIL: expected order mismatch error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: order mismatch raises marketplace_capture_reconciliation_failed';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c011'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0011', 'CAPIDAPI0099', 300, 'USD', now());
    raise exception 'FAIL: expected capture mismatch error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: different capture id for approved payment raises reconciliation_failed';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c003'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0003', 'CAPIDAPI0003', 300, 'USD', now());
    raise exception 'FAIL: expected not-owned error';
  exception when others then
    if sqlerrm not like '%marketplace_payment_not_owned%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: other user raises marketplace_payment_not_owned';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c004'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0004', 'CAPIDAPI0004', 300, 'USD', now());
    raise exception 'FAIL: expected failed-payment error';
  exception when others then
    if sqlerrm not like '%marketplace_payment_not_available%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: failed payment raises marketplace_payment_not_available';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c005'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0005', 'CAPIDAPI0005', 300, 'USD', now());
    raise exception 'FAIL: expected refunded-payment error';
  exception when others then
    if sqlerrm not like '%marketplace_payment_not_available%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: refunded payment raises marketplace_payment_not_available';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c006'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0006', 'CAPIDAPI0006', 300, 'USD', now());
    raise exception 'FAIL: expected reversed-payment error';
  exception when others then
    if sqlerrm not like '%marketplace_payment_not_available%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: reversed payment raises marketplace_payment_not_available';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c007'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0007', 'CAPIDAPI0007', 300, 'USD', now());
    raise exception 'FAIL: expected paid payment error';
  exception when others then
    if sqlerrm not like '%marketplace_payment_not_available%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: already-paid payment raises marketplace_payment_not_available';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c008'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0008', 'CAPIDAPI0008', 301, 'USD', now());
    raise exception 'FAIL: expected incoming-amount error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: incoming amount mismatch raises reconciliation_failed';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c009'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0009', 'CAPIDAPI0009', 300, 'EUR', now());
    raise exception 'FAIL: expected incoming-currency error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: incoming currency mismatch raises reconciliation_failed';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c013'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0013', 'CAPIDAPI0013', 300, 'USD', now());
    raise exception 'FAIL: expected non-ASA error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: evolved listing raises reconciliation_failed';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c014'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0014', 'CAPIDAPI0014', 300, 'USD', now());
    raise exception 'FAIL: expected inactive-listing error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: hidden listing raises reconciliation_failed';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c015'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0015', 'CAPIDAPI0015', 300, 'USD', now());
    raise exception 'FAIL: expected already-featured error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: already-featured listing raises reconciliation_failed';
end;
$$;

do $$
begin
  begin
    perform public.confirm_marketplace_paypal_capture_from_api(
      'f0000000-0000-0000-0000-00000000c012'::uuid,'f3000000-0000-0000-0000-0000000000f3'::uuid,
      'PAYIDAPI0012', 'CAPIDAPI0012', 300, 'USD', now());
    raise exception 'FAIL: expected foreign-listing error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  raise notice 'PASS: foreign listing raises reconciliation_failed';
end;
$$;

-- =============================================================================
-- 17. Grants: anon/authenticated denied, service_role allowed
-- =============================================================================
do $$
begin
  if has_function_privilege('anon', 'public.confirm_marketplace_paypal_capture_from_api(uuid,uuid,text,text,integer,text,timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: anon has EXECUTE on the RPC';
  end if;
  raise notice 'PASS: anon has no EXECUTE on the RPC';

  if has_function_privilege('authenticated', 'public.confirm_marketplace_paypal_capture_from_api(uuid,uuid,text,text,integer,text,timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: authenticated has EXECUTE on the RPC';
  end if;
  raise notice 'PASS: authenticated has no EXECUTE on the RPC';

  if not has_function_privilege('service_role', 'public.confirm_marketplace_paypal_capture_from_api(uuid,uuid,text,text,integer,text,timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: service_role lacks EXECUTE on the RPC';
  end if;
  raise notice 'PASS: service_role has EXECUTE on the RPC';
end;
$$;

-- =============================================================================
-- 18. Late webhook with the same capture id is a duplicate: processed, no re-grant
-- =============================================================================
do $$
declare
  processed boolean;
  audit_cnt integer;
  event_key text := 'WEBH-18-DUPLICATE-CAPTURE-API';
begin
  select count(*) into audit_cnt from public.marketplace_audit_log
  where payment_id = 'f0000000-0000-0000-0000-00000000c002' and action = 'featured_activated';
  processed := public.process_marketplace_paypal_event(
    event_key, 'PAYMENT.CAPTURE.COMPLETED',
    jsonb_build_object('order_id','PAYIDAPI0002','capture_id','CAPIDAPI0002','amount_minor',300,'currency','USD','event_time',now()::text),
    jsonb_build_object('id',event_key,'event_type','PAYMENT.CAPTURE.COMPLETED','resource',jsonb_build_object('supplementary_data',jsonb_build_object('related_ids',jsonb_build_object('order_id','PAYIDAPI0002'))))
  );
  if processed is distinct from true then raise exception 'FAIL: duplicate late webhook should return true'; end if;
  if (select processing_error from private.billing_events where event_id = event_key) is not null then
    raise exception 'FAIL: duplicate late webhook should be processed without error';
  end if;
  if (select count(*) from public.marketplace_audit_log where payment_id = 'f0000000-0000-0000-0000-00000000c002' and action = 'featured_activated') <> audit_cnt then
    raise exception 'FAIL: duplicate late webhook re-activated the benefit';
  end if;
  if (select is_featured from public.marketplace_listings where id = 'f0000000-0000-0000-0000-000000000005') is distinct from true then
    raise exception 'FAIL: listing lost its featured state';
  end if;
  raise notice 'PASS: late webhook with same capture id is idempotent and grants nothing again';
end;
$$;

-- =============================================================================
-- 19. Late webhook with a different capture id fails reconciliation
-- =============================================================================
do $$
declare
  event_key text := 'WEBH-19-MISMATCH-CAPTURE-API';
begin
  begin
    perform public.process_marketplace_paypal_event(
      event_key, 'PAYMENT.CAPTURE.COMPLETED',
      jsonb_build_object('order_id','PAYIDAPI0016','capture_id','CAPIDAPI9999','amount_minor',300,'currency','USD','event_time',now()::text),
    jsonb_build_object('id',event_key,'event_type','PAYMENT.CAPTURE.COMPLETED','resource',jsonb_build_object('supplementary_data',jsonb_build_object('related_ids',jsonb_build_object('order_id','PAYIDAPI0016'))))
  );
    raise exception 'FAIL: expected mismatch error';
  exception when others then
    if sqlerrm not like '%marketplace_capture_reconciliation_failed%' then raise exception 'UNEXPECTED: %', sqlerrm; end if;
  end;
  if (select processing_error from private.billing_events where event_id = event_key) <> 'marketplace_capture_reconciliation_failed' then
    raise exception 'FAIL: billing event did not record the reconciliation error';
  end if;
  raise notice 'PASS: different capture id marks the event failed with reconciliation error';
end;
$$;

\echo ''
\echo '=== CAPTURE API RECONCILIATION VALIDATION COMPLETE (19 cases) ==='

rollback;
