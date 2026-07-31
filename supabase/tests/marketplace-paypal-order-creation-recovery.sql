-- Marketplace PayPal order-creation recovery — validation runner
-- Covers public.fail_marketplace_paypal_order_creation introduced by
-- 20260731110000_marketplace_paypal_order_creation_recovery.sql.
-- Run: Get-Content .\supabase\tests\marketplace-paypal-order-creation-recovery.sql -Raw | docker exec -i supabase_db_W.E.A.F psql -U postgres
-- Everything runs inside a transaction that is rolled back at the end, so the
-- local database remains pristine (flags/settings toggled for test 14 are restored).

\set ON_ERROR_STOP off

\echo '=== MARKETPLACE PAYPAL ORDER-CREATION RECOVERY VALIDATION ==='

begin;

-- =============================================================================
-- Fixtures (local dev only, rolled back at the end)
-- =============================================================================
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('f1000000-0000-0000-0000-0000000000f1', 'recovery-owner@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('f2000000-0000-0000-0000-0000000000f2', 'recovery-other@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, email, display_name)
values
  ('f1000000-0000-0000-0000-0000000000f1', 'recovery-owner@test.local', 'recovery_owner'),
  ('f2000000-0000-0000-0000-0000000000f2', 'recovery-other@test.local', 'recovery_other')
on conflict (id) do nothing;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1',
  id, 'recovery-listing-001', 'sell', 'Recovery Test Listing One', 'Recovery test fixture listing owned by recovery owner in ASA.',
  'ascended', 'metal', 10, 'FT only', 'REC-PVP-01', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '6 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-0000000000f2',
  id, 'recovery-listing-002', 'sell', 'Recovery Test Listing Two', 'Recovery test fixture listing owned by the other user in ASA.',
  'ascended', 'crystal', 5, 'Offers accepted', 'REC-PVP-02', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '6 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured)
select
  'f0000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-0000000000f1',
  id, 'recovery-listing-003', 'sell', 'Recovery Test Listing Three', 'Recovery test fixture listing used for the failed-payment retry test.',
  'ascended', 'sulfur', 3, 'PayPal only', 'REC-PVP-03', 'eu', 'steam', 'en',
  'https://discord.gg/test', now(), 'active', now() - interval '1 day', now() + interval '6 days', false
from public.marketplace_categories where slug = 'resources' limit 1;

insert into public.marketplace_payments (id, listing_id, user_id, status, amount_minor, currency, paypal_order_id, paypal_capture_id, idempotency_key, paid_at)
values
  ('f0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'created', 300, 'USD', null, null, '11111111-1111-1111-1111-111111111111', null),
  ('f0000000-0000-0000-0000-0000000000a2', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'approved', 300, 'USD', null, null, '22222222-2222-2222-2222-222222222222', null),
  ('f0000000-0000-0000-0000-0000000000a3', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'captured', 300, 'USD', null, null, '33333333-3333-3333-3333-333333333333', now()),
  ('f0000000-0000-0000-0000-0000000000a4', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'created', 300, 'USD', 'PAYIDTEST000001', null, '44444444-4444-4444-4444-444444444444', null),
  ('f0000000-0000-0000-0000-0000000000a5', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'created', 300, 'USD', null, 'CAPTEST000001', '55555555-5555-5555-5555-555555555555', null),
  ('f0000000-0000-0000-0000-0000000000a6', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'created', 300, 'USD', null, null, '66666666-6666-6666-6666-666666666666', now()),
  ('f0000000-0000-0000-0000-0000000000a7', 'f0000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-0000000000f2', 'created', 300, 'USD', null, null, '77777777-7777-7777-7777-777777777777', null),
  ('f0000000-0000-0000-0000-0000000000a8', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'created', 300, 'USD', null, null, '88888888-8888-8888-8888-888888888888', null),
  ('f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-0000000000f1', 'created', 300, 'USD', null, null, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null),
  ('f0000000-0000-0000-0000-0000000000a9', 'f0000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-0000000000f1', 'failed', 300, 'USD', null, null, '99999999-9999-9999-9999-999999999999', null);

-- 1. A created payment with no order id can be closed to failed
do $$
declare
  closed boolean;
  audit_cnt integer;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a1'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'paypal_approval_url_missing'
  );
  assert closed = true, 'expected created payment to close';
  if (select status from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a1') <> 'failed' then
    raise exception 'FAIL: status not failed after close';
  end if;
  select count(*) into audit_cnt
  from public.marketplace_audit_log
  where payment_id = 'f0000000-0000-0000-0000-0000000000a1'
    and action = 'paypal_order_creation_failed';
  assert audit_cnt = 1, 'expected one audit row';
  raise notice 'PASS: created without order id -> failed + audit row';
end;
$$;

-- 2. An approved payment cannot change
do $$
declare
  closed boolean;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a2'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'test'
  );
  assert closed = false, 'approved must not close';
  if (select status from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a2') <> 'approved' then
    raise exception 'FAIL: approved payment changed';
  end if;
  raise notice 'PASS: approved cannot change';
end;
$$;

-- 3. A captured payment cannot change
do $$
declare
  closed boolean;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a3'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'test'
  );
  assert closed = false, 'captured must not close';
  if (select status from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a3') <> 'captured' then
    raise exception 'FAIL: captured payment changed';
  end if;
  raise notice 'PASS: captured cannot change';
end;
$$;

-- 4. A created payment with an attached PayPal order cannot change
do $$
declare
  closed boolean;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a4'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'test'
  );
  assert closed = false, 'payment with order id must not close';
  if (select paypal_order_id from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a4') is null then
    raise exception 'FAIL: paypal_order_id lost';
  end if;
  raise notice 'PASS: created with paypal_order_id cannot change';
end;
$$;

-- 5. A created payment with an attached capture id cannot change
do $$
declare
  closed boolean;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a5'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'test'
  );
  assert closed = false, 'payment with capture id must not close';
  if (select paypal_capture_id from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a5') is null then
    raise exception 'FAIL: paypal_capture_id lost';
  end if;
  raise notice 'PASS: created with paypal_capture_id cannot change';
end;
$$;

-- 6. A payment with paid_at cannot change
do $$
declare
  closed boolean;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a6'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'test'
  );
  assert closed = false, 'paid payment must not close';
  if (select status from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a6') <> 'created' then
    raise exception 'FAIL: paid payment changed';
  end if;
  raise notice 'PASS: created with paid_at cannot change';
end;
$$;

-- 7. A different user cannot close another user's payment
do $$
declare
  closed boolean;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a7'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'test'
  );
  assert closed = false, 'other user must not close';
  if (select status from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a7') <> 'created' then
    raise exception 'FAIL: other user payment changed';
  end if;
  raise notice 'PASS: different user cannot close';
end;
$$;

-- 8/9/10. Grants: anon/authenticated denied, service_role allowed
do $$
begin
  if has_function_privilege('anon', 'public.fail_marketplace_paypal_order_creation(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: anon has EXECUTE on the RPC';
  end if;
  raise notice 'PASS: anon has no EXECUTE on the RPC';

  if has_function_privilege('authenticated', 'public.fail_marketplace_paypal_order_creation(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated has EXECUTE on the RPC';
  end if;
  raise notice 'PASS: authenticated has no EXECUTE on the RPC';

  if not has_function_privilege('service_role', 'public.fail_marketplace_paypal_order_creation(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: service_role lacks EXECUTE on the RPC';
  end if;
  raise notice 'PASS: service_role has EXECUTE on the RPC';
end;
$$;

-- 8/9 (actual attempts). Permission denied must be raised for anon and authenticated
set local role anon;
savepoint sp_anon;
select public.fail_marketplace_paypal_order_creation(
  'f0000000-0000-0000-0000-0000000000a1'::uuid,
  'f1000000-0000-0000-0000-0000000000f1'::uuid,
  'anon_attempt'
);
rollback to sp_anon;
reset role;

set local role authenticated;
savepoint sp_auth;
select public.fail_marketplace_paypal_order_creation(
  'f0000000-0000-0000-0000-0000000000a1'::uuid,
  'f1000000-0000-0000-0000-0000000000f1'::uuid,
  'auth_attempt'
);
rollback to sp_auth;
reset role;

-- 10 (actual execution). service_role can close a created payment
set local role service_role;
select public.fail_marketplace_paypal_order_creation(
  'f0000000-0000-0000-0000-0000000000a8'::uuid,
  'f1000000-0000-0000-0000-0000000000f1'::uuid,
  'service_role_test'
) as sr_closed \gset
reset role;
\if :sr_closed
  \echo 'PASS: service_role executed the RPC and closed the payment'
\else
  \echo 'FAIL: service_role RPC returned false'
\endif
do $$
begin
  if (select status from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a8') <> 'failed' then
    raise exception 'FAIL: service_role close did not persist';
  end if;
  raise notice 'PASS: service_role close persisted as failed';
end;
$$;

-- 11. Audit action paypal_order_creation_failed is created with the expected shape
do $$
declare
  rec record;
begin
  select details into rec
  from public.marketplace_audit_log
  where payment_id = 'f0000000-0000-0000-0000-0000000000a1'
    and action = 'paypal_order_creation_failed'
  limit 1;
  if rec is null then
    raise exception 'FAIL: audit row missing';
  end if;
  if rec.details->>'environment' <> 'sandbox' then
    raise exception 'FAIL: audit environment not sandbox';
  end if;
  if rec.details->>'previous_status' <> 'created' then
    raise exception 'FAIL: audit previous_status not created';
  end if;
  raise notice 'PASS: audit row paypal_order_creation_failed present with expected shape';
end;
$$;

-- 12. Audit details contain no secrets and reason is sanitized and limited
do $$
declare
  closed boolean;
  rec record;
  expected jsonb;
  long_reason text := repeat('x', 200) || ' secret-token-abc123 https://evil.example.com';
begin
  expected := jsonb_build_object('reason', repeat('x', 80), 'environment', 'sandbox', 'previous_status', 'created');
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000b1'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    long_reason
  );
  assert closed = true, 'expected close';
  select details into rec
  from public.marketplace_audit_log
  where payment_id = 'f0000000-0000-0000-0000-0000000000b1'
    and action = 'paypal_order_creation_failed'
  limit 1;
  if rec is null then
    raise exception 'FAIL: audit row missing';
  end if;
  if (rec.details ? 'paypal_order_id') or (rec.details ? 'url') or (rec.details ? 'href')
     or (rec.details ? 'token') or (rec.details ? 'credential') or (rec.details ? 'authorization')
     or (rec.details ? 'email') or (rec.details ? 'user_id')
  then
    raise exception 'FAIL: audit contains a forbidden key';
  end if;
  if rec.details <> expected then
    raise exception 'FAIL: audit details differ from the sanitized expectation';
  end if;
  if (rec.details->>'reason') like '%secret-token-abc123%' or (rec.details->>'reason') like '%evil.example.com%' then
    raise exception 'FAIL: audit reason leaked a secret';
  end if;
  raise notice 'PASS: audit details sanitized, limited and secret-free';
end;
$$;

-- 13. A second call on the already-closed payment is idempotent and returns false
do $$
declare
  closed boolean;
begin
  closed := public.fail_marketplace_paypal_order_creation(
    'f0000000-0000-0000-0000-0000000000a1'::uuid,
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'again'
  );
  assert closed = false, 'second call must return false';
  if (select status from public.marketplace_payments where id = 'f0000000-0000-0000-0000-0000000000a1') <> 'failed' then
    raise exception 'FAIL: status regressed';
  end if;
  raise notice 'PASS: second call idempotent, returns false';
end;
$$;

-- 14. A failed payment does not block a new attempt with a different idempotency key
do $$
declare
  result jsonb;
  new_cnt integer;
  failed_status text;
begin
  update public.feature_flags
  set enabled = true
  where key = 'paypal_payments';

  update public.marketplace_settings
  set marketplace_enabled = true, payments_enabled = true
  where key = 'featured_listing';

  insert into private.marketplace_payment_qa_allowlist(user_id, active)
  values ('f1000000-0000-0000-0000-0000000000f1', true)
  on conflict (user_id) do update set active = true;

  select status into failed_status
  from public.marketplace_payments
  where id = 'f0000000-0000-0000-0000-0000000000a9';
  if failed_status <> 'failed' then
    raise exception 'FAIL: fixture failed payment missing';
  end if;

  result := public.prepare_marketplace_paypal_order(
    'f1000000-0000-0000-0000-0000000000f1'::uuid,
    'f0000000-0000-0000-0000-000000000003'::uuid,
    gen_random_uuid()
  );
  if result is null or result->>'payment_id' is null then
    raise exception 'FAIL: prepare did not return a new payment';
  end if;

  select count(*) into new_cnt
  from public.marketplace_payments
  where listing_id = 'f0000000-0000-0000-0000-000000000003'
    and status = 'created';
  assert new_cnt = 1, 'expected exactly one new created payment';
  raise notice 'PASS: failed payment did not block a new attempt with a different idempotency key';
end;
$$;

\echo ''
\echo '=== RECOVERY VALIDATION COMPLETE (14 cases) ==='

rollback;
