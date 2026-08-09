-- Marketplace featured PayPal retry validation (local only).
-- Run after `supabase db reset`:
-- Get-Content .\supabase\tests\marketplace-payment-retry-reuse.sql -Raw |
--   docker exec -i supabase_db_W.E.A.F psql -U postgres
-- All fixtures and flag changes are rolled back.

\set ON_ERROR_STOP on
begin;

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-0000000000a1';
  other_id uuid := '00000000-0000-0000-0000-0000000000a2';
  category_id uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  values
    (owner_id, 'payment-retry-owner@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (other_id, 'payment-retry-other@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated')
  on conflict (id) do nothing;
  insert into public.profiles (id, email, display_name)
  values
    (owner_id, 'payment-retry-owner@test.local', 'payment_retry_owner'),
    (other_id, 'payment-retry-other@test.local', 'payment_retry_other')
  on conflict (id) do nothing;
  select id into category_id from public.marketplace_categories where slug = 'resources' limit 1;
  if category_id is null then raise exception 'fixture category missing'; end if;

  update public.feature_flags set enabled = true where key = 'paypal_payments';
  update public.marketplace_settings
  set marketplace_enabled = true, payments_enabled = true, price_minor = 300, currency = 'USD', environment = 'sandbox'
  where key = 'featured_listing';
  insert into private.marketplace_payment_qa_allowlist(user_id, active, added_by)
  values (owner_id, true, owner_id), (other_id, true, owner_id)
  on conflict (user_id) do update set active = true;

  insert into public.marketplace_listings (
    id, owner_user_id, category_id, slug, listing_type, title, description, game,
    resource_name, quantity, trade_terms, region, platform, language,
    discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured
  ) values
    ('91000000-0000-0000-0000-000000000001', owner_id, category_id, 'retry-reuse-01', 'sell', 'Retry reuse one', 'Local test fixture for retry reuse with an attached order.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false),
    ('91000000-0000-0000-0000-000000000002', owner_id, category_id, 'retry-wrong-amount', 'sell', 'Retry wrong amount', 'Local test fixture for incompatible amount.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false),
    ('91000000-0000-0000-0000-000000000003', owner_id, category_id, 'retry-wrong-currency', 'sell', 'Retry wrong currency', 'Local test fixture for incompatible currency.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false),
    ('91000000-0000-0000-0000-000000000004', owner_id, category_id, 'retry-wrong-environment', 'sell', 'Retry wrong environment', 'Local test fixture for incompatible environment.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false),
    ('91000000-0000-0000-0000-000000000005', owner_id, category_id, 'retry-no-order', 'sell', 'Retry no order', 'Local test fixture for an unattached order.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false),
    ('91000000-0000-0000-0000-000000000006', owner_id, category_id, 'retry-ambiguous', 'sell', 'Retry ambiguous', 'Local test fixture for duplicate compatible rows.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false),
    ('91000000-0000-0000-0000-000000000007', owner_id, category_id, 'retry-terminal', 'sell', 'Retry terminal', 'Local test fixture for terminal status preservation.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false),
    ('91000000-0000-0000-0000-000000000008', owner_id, category_id, 'retry-lock-equivalent', 'sell', 'Retry lock equivalent', 'Local test fixture for deterministic duplicate prevention.', 'ascended', 'metal', 1, 'Test terms', 'na', 'steam', 'en', 'https://discord.gg/test', now(), 'active', now(), now() + interval '7 days', false);
end $$;

insert into public.marketplace_payments (
  id, listing_id, user_id, status, amount_minor, currency, provider, environment,
  paypal_order_id, paypal_capture_id, idempotency_key, paid_at
) values
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'created', 300, 'USD', 'paypal', 'sandbox', 'TEST_ORDER_REUSE_01', null, '93000000-0000-0000-0000-000000000001', null),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'created', 301, 'USD', 'paypal', 'sandbox', 'TEST_ORDER_AMOUNT', null, '93000000-0000-0000-0000-000000000002', null),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', 'created', 300, 'EUR', 'paypal', 'sandbox', 'TEST_ORDER_CURRENCY', null, '93000000-0000-0000-0000-000000000003', null),
  ('92000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000a1', 'created', 300, 'USD', 'paypal', 'sandbox', null, null, '93000000-0000-0000-0000-000000000005', null),
  ('92000000-0000-0000-0000-000000000006', '91000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a1', 'created', 300, 'USD', 'paypal', 'sandbox', 'TEST_ORDER_AMBIGUOUS_A', null, '93000000-0000-0000-0000-000000000006', null),
  ('92000000-0000-0000-0000-000000000007', '91000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000a1', 'created', 300, 'USD', 'paypal', 'sandbox', 'TEST_ORDER_AMBIGUOUS_B', null, '93000000-0000-0000-0000-000000000007', null),
  ('92000000-0000-0000-0000-000000000008', '91000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000a1', 'failed', 300, 'USD', 'paypal', 'sandbox', 'TEST_ORDER_FAILED', null, '93000000-0000-0000-0000-000000000008', null);

-- 1/2. The original idempotency key is stable and a fresh key reuses the
-- attached order without inserting another payment.
do $$
declare
  first_result jsonb;
  retry_result jsonb;
  payment_count integer;
begin
  first_result := public.prepare_marketplace_paypal_order('00000000-0000-0000-0000-0000000000a1', '91000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001');
  retry_result := public.prepare_marketplace_paypal_order('00000000-0000-0000-0000-0000000000a1', '91000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000101');
  select count(*) into payment_count from public.marketplace_payments where listing_id = '91000000-0000-0000-0000-000000000001';
  assert first_result->>'payment_id' = '92000000-0000-0000-0000-000000000001', 'same idempotency did not return original payment';
  assert retry_result->>'payment_id' = '92000000-0000-0000-0000-000000000001', 'new idempotency did not reuse the attached payment';
  assert retry_result->>'idempotency_key' = '93000000-0000-0000-0000-000000000001', 'retry did not return original idempotency key';
  assert payment_count = 1, 'retry inserted a duplicate payment';
end $$;

-- 3. A different user cannot reuse the owner payment.
do $$ begin
  begin
    perform public.prepare_marketplace_paypal_order('00000000-0000-0000-0000-0000000000a2', '91000000-0000-0000-0000-000000000001', gen_random_uuid());
    raise exception 'other owner unexpectedly prepared payment';
  exception when others then
    assert sqlerrm = 'listing_not_owned', 'unexpected ownership error: ' || sqlerrm;
  end;
end $$;

-- 4-7. Incompatible or incomplete created rows remain fail-closed. A live
-- environment cannot be inserted at all: the table's environment constraint
-- preserves the function's explicit sandbox-only check as defense in depth.
do $$
declare
  test_listing uuid;
begin
  assert exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketplace_payments'::regclass
      and pg_get_constraintdef(oid) like '%environment = ''sandbox''%'
  ), 'marketplace payments no longer reject a non-sandbox environment';
  foreach test_listing in array array[
    '91000000-0000-0000-0000-000000000002'::uuid,
    '91000000-0000-0000-0000-000000000003'::uuid,
    '91000000-0000-0000-0000-000000000005'::uuid,
    '91000000-0000-0000-0000-000000000006'::uuid
  ] loop
    begin
      perform public.prepare_marketplace_paypal_order('00000000-0000-0000-0000-0000000000a1', test_listing, gen_random_uuid());
      raise exception 'incompatible payment unexpectedly proceeded';
    exception when others then
      assert sqlerrm = 'marketplace_payment_in_progress', 'unexpected incompatible payment error: ' || sqlerrm;
    end;
  end loop;
end $$;

-- 9. Terminal rows are never reused or mutated; a failed prior attempt may
-- safely begin a distinct server-side attempt.
do $$
declare
  result jsonb;
begin
  result := public.prepare_marketplace_paypal_order('00000000-0000-0000-0000-0000000000a1', '91000000-0000-0000-0000-000000000007', '93000000-0000-0000-0000-000000000107');
  assert result->>'payment_id' <> '92000000-0000-0000-0000-000000000008', 'terminal payment was reused';
  assert (select status from public.marketplace_payments where id = '92000000-0000-0000-0000-000000000008') = 'failed', 'terminal payment was mutated';
end $$;

-- 10/11. Two different idempotency keys cannot create two payments for the
-- same listing. The listing FOR UPDATE lock serializes concurrent callers;
-- this deterministic equivalent verifies the resulting invariant.
do $$
declare
  first_result jsonb;
  payment_count integer;
begin
  first_result := public.prepare_marketplace_paypal_order('00000000-0000-0000-0000-0000000000a1', '91000000-0000-0000-0000-000000000008', '93000000-0000-0000-0000-000000000108');
  assert first_result->>'existing' = 'false', 'first checkout was not new';
  begin
    perform public.prepare_marketplace_paypal_order('00000000-0000-0000-0000-0000000000a1', '91000000-0000-0000-0000-000000000008', '93000000-0000-0000-0000-000000000109');
    raise exception 'second checkout unexpectedly proceeded';
  exception when others then
    assert sqlerrm = 'marketplace_payment_in_progress', 'unexpected duplicate checkout error: ' || sqlerrm;
  end;
  select count(*) into payment_count from public.marketplace_payments where listing_id = '91000000-0000-0000-0000-000000000008';
  assert payment_count = 1, 'distinct keys created two payments';
end $$;

-- 12. The function remains server-only and retains a fixed secure search path.
do $$
begin
  assert not has_function_privilege('anon', 'public.prepare_marketplace_paypal_order(uuid,uuid,uuid)', 'EXECUTE'), 'anon can execute prepare';
  assert not has_function_privilege('authenticated', 'public.prepare_marketplace_paypal_order(uuid,uuid,uuid)', 'EXECUTE'), 'authenticated can execute prepare';
  assert has_function_privilege('service_role', 'public.prepare_marketplace_paypal_order(uuid,uuid,uuid)', 'EXECUTE'), 'service_role cannot execute prepare';
  assert (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.prepare_marketplace_paypal_order(uuid,uuid,uuid)'::regprocedure), 'prepare has no fixed empty search_path';
end $$;

rollback;
