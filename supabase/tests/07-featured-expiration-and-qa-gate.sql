-- Featured expiration + QA gate audit fix — compensatory tests
-- Run: Get-Content .\supabase\tests\07-featured-expiration-and-qa-gate.sql -Raw | docker exec -i supabase_db_W.E.A.F psql -U postgres
-- Or: docker exec -i supabase_db_W.E.A.F psql -U postgres -f /dev/stdin < supabase\tests\07-featured-expiration-and-qa-gate.sql

\echo '=== FEATURED EXPIRATION + QA GATE VALIDATION ==='
\echo ''

-- Add a test listing with featured_expires_at IN THE PAST for expiration testing.
-- The seed data from 01-seed-test-data.sql has all featured with featured_expires_at > now().
do $$ begin
  insert into public.marketplace_listings (id, owner_user_id, category_id, slug, listing_type, title, description, game, resource_name, quantity, trade_terms, server_name, region, platform, language, discord_invite_url, rules_accepted_at, status, published_at, expires_at, is_featured, featured_started_at, featured_expires_at)
  select
    'e0000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1',
    id, 'test-expired-featured-001', 'sell', 'TEST-ExpiredFeatured', 'Listing with expired featured period for testing purposes in QA.',
    'ascended', 'test_item', 1, 'TEST1', 'ASA-TEST', 'eu', 'steam', 'en',
    'https://discord.gg/test', now(), 'active', now() - interval '10 days', now() + interval '5 days', true, now() - interval '10 days', now() - interval '3 days'
  from public.marketplace_categories where slug = 'other' limit 1
  on conflict (id) do nothing;
end $$;

-- =============================================================================
-- Test 1: Active featured stays active
-- =============================================================================
do $$
declare
  before_count int;
  after_count int;
begin
  select count(*) into before_count
  from public.marketplace_listings
  where is_featured and featured_expires_at > now();

  perform public.expire_marketplace_featured_benefits();

  select count(*) into after_count
  from public.marketplace_listings
  where is_featured and featured_expires_at > now();

  assert before_count = after_count,
    'Active featured count changed: ' || before_count || ' -> ' || after_count;
  raise notice 'PASS 1: Active featured listing remains active (%)', after_count;
end;
$$;

-- =============================================================================
-- Test 2: Expired featured passes to is_featured=false
-- =============================================================================
do $$
declare
  still_featured int;
begin
  select count(*) into still_featured
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1' and is_featured;

  assert still_featured = 0,
    'Expired featured listing still has is_featured=true';
  raise notice 'PASS 2: Expired featured listing correctly set to is_featured=false';
end;
$$;

-- =============================================================================
-- Test 3: Non-featured (already-unfeatured) listing unchanged
-- =============================================================================
do $$
declare
  before_val boolean;
  after_val boolean;
begin
  select is_featured into before_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  perform public.expire_marketplace_featured_benefits();

  select is_featured into after_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  assert before_val = after_val,
    'Non-featured listing changed is_featured';
  raise notice 'PASS 3: Non-featured listing unchanged';
end;
$$;

-- =============================================================================
-- Test 4: published_at not modified
-- =============================================================================
do $$
declare
  before_val timestamptz;
  after_val timestamptz;
begin
  select published_at into before_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  perform public.expire_marketplace_featured_benefits();

  select published_at into after_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  assert before_val = after_val,
    'published_at was modified: ' || before_val || ' -> ' || after_val;
  raise notice 'PASS 4: published_at unchanged';
end;
$$;

-- =============================================================================
-- Test 5: featured_started_at not modified
-- =============================================================================
do $$
declare
  before_val timestamptz;
  after_val timestamptz;
begin
  select featured_started_at into before_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  perform public.expire_marketplace_featured_benefits();

  select featured_started_at into after_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  assert before_val = after_val,
    'featured_started_at was modified: ' || before_val || ' -> ' || after_val;
  raise notice 'PASS 5: featured_started_at unchanged';
end;
$$;

-- =============================================================================
-- Test 6: featured_expires_at preserved after expiration
-- =============================================================================
do $$
declare
  before_val timestamptz;
  after_val timestamptz;
begin
  select featured_expires_at into before_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  perform public.expire_marketplace_featured_benefits();

  select featured_expires_at into after_val
  from public.marketplace_listings
  where id = 'e0000000-0000-0000-0000-0000000000f1';

  assert before_val = after_val,
    'featured_expires_at was modified: ' || before_val || ' -> ' || after_val;
  raise notice 'PASS 6: featured_expires_at preserved';
end;
$$;

-- =============================================================================
-- Test 7: Second execution is idempotent
-- =============================================================================
do $$
declare
  affected_second int;
begin
  affected_second := public.expire_marketplace_featured_benefits();
  assert affected_second = 0,
    'Second execution expired ' || affected_second || ' rows (expected 0)';
  raise notice 'PASS 7: Second execution idempotent (0 rows affected)';
end;
$$;

-- =============================================================================
-- Test 8: Cron job exists
-- =============================================================================
do $$
declare
  job_exists boolean;
begin
  select exists(select 1 from cron.job where jobname = 'expire-marketplace-featured-benefits')
  into job_exists;
  assert job_exists, 'Cron job "expire-marketplace-featured-benefits" not found';
  raise notice 'PASS 8: Cron job exists';
end;
$$;

-- =============================================================================
-- Test 9: Only one job with the defined name
-- =============================================================================
do $$
declare
  job_count int;
begin
  select count(*) into job_count
  from cron.job
  where jobname = 'expire-marketplace-featured-benefits';
  assert job_count = 1,
    'Expected 1 cron job, found ' || job_count;
  raise notice 'PASS 9: Exactly one cron job for expire-marketplace-featured-benefits';
end;
$$;

-- =============================================================================
-- Test 10: Job invokes the correct function
-- =============================================================================
do $$
declare
  command_text text;
begin
  select command into command_text
  from cron.job
  where jobname = 'expire-marketplace-featured-benefits';
  assert command_text = 'select public.expire_marketplace_featured_benefits();',
    'Unexpected command: ' || coalesce(command_text, 'NULL');
  raise notice 'PASS 10: Cron job invokes correct function';
end;
$$;

-- =============================================================================
-- Test 11: qa_gate_enforced=true logged correctly
-- =============================================================================
do $$
declare
  v_payment_id uuid;
  v_audit_details jsonb;
  seller_a_id uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- Ensure paypal_payments is enabled
  insert into public.feature_flags (key, enabled, updated_by)
  values ('paypal_payments', true, seller_a_id)
  on conflict (key) do update set enabled = true;

  -- Ensure marketplace_settings are correct
  update public.marketplace_settings
  set marketplace_enabled = true, payments_enabled = true, price_minor = 300, currency = 'USD', environment = 'sandbox'
  where key = 'featured_listing';

  -- Ensure qa_gate is enforced (default is true)
  update private.marketplace_payment_qa_settings set enforced = true where key = 'sandbox_allowlist';

  -- Add seller-a to allowlist so they can pass qa check
  insert into private.marketplace_payment_qa_allowlist (user_id, active, added_by)
  values (seller_a_id, true, seller_a_id)
  on conflict (user_id) do nothing;

  -- Execute prepare using seller-a who owns listing a0000000-...-0001
  v_payment_id := (public.prepare_marketplace_paypal_order(
    seller_a_id,
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000011'
  )->>'payment_id')::uuid;

  -- Read audit log
  select details into v_audit_details
  from public.marketplace_audit_log
  where payment_id = v_payment_id and action = 'paypal_order_prepared'
  order by created_at desc limit 1;

  assert (v_audit_details->>'qa_gate_enforced')::boolean = true,
    'Expected qa_gate_enforced=true, got ' || coalesce(v_audit_details->>'qa_gate_enforced', 'NULL');
  raise notice 'PASS 11: qa_gate_enforced=true logged correctly (audit: %)', v_audit_details->>'qa_gate_enforced';
end;
$$;

-- =============================================================================
-- Test 12: qa_gate_enforced=false logged correctly
-- =============================================================================
do $$
declare
  v_payment_id uuid;
  v_audit_details jsonb;
  v_new_key uuid := gen_random_uuid();
  seller_a_id uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- Turn off enforcement
  update private.marketplace_payment_qa_settings set enforced = false where key = 'sandbox_allowlist';

  -- Remove seller-a from allowlist (should not matter since enforced=false)
  delete from private.marketplace_payment_qa_allowlist where user_id = seller_a_id;

  -- Execute prepare (should succeed even without allowlist because enforced=false)
  v_payment_id := (public.prepare_marketplace_paypal_order(
    seller_a_id,
    'a0000000-0000-0000-0000-000000000002',
    v_new_key
  )->>'payment_id')::uuid;

  -- Read audit log
  select details into v_audit_details
  from public.marketplace_audit_log
  where payment_id = v_payment_id and action = 'paypal_order_prepared'
  order by created_at desc limit 1;

  assert (v_audit_details->>'qa_gate_enforced')::boolean = false,
    'Expected qa_gate_enforced=false, got ' || coalesce(v_audit_details->>'qa_gate_enforced', 'NULL');
  raise notice 'PASS 12: qa_gate_enforced=false logged correctly (audit: %)', v_audit_details->>'qa_gate_enforced';

  -- Restore enforcement and allowlist for remaining tests
  update private.marketplace_payment_qa_settings set enforced = true where key = 'sandbox_allowlist';
  insert into private.marketplace_payment_qa_allowlist (user_id, active, added_by)
  values (seller_a_id, true, seller_a_id)
  on conflict (user_id) do nothing;
end;
$$;

-- =============================================================================
-- Test 13: anon cannot execute expire function
-- =============================================================================
do $$
declare
  err_msg text;
begin
  perform set_config('role', 'anon', true);
  begin
    perform public.expire_marketplace_featured_benefits();
    err_msg := 'FAIL: anon was able to execute expire function';
  exception when insufficient_privilege then
    err_msg := null;
  when others then
    err_msg := null;
  end;
  perform set_config('role', 'postgres', true);
  if err_msg is not null then
    raise exception '%', err_msg;
  end if;
  raise notice 'PASS 13: anon cannot execute expire_marketplace_featured_benefits()';
end;
$$;

-- =============================================================================
-- Test 14: authenticated cannot execute expire function
-- =============================================================================
do $$
declare
  err_msg text;
begin
  perform set_config('role', 'authenticated', true);
  begin
    perform public.expire_marketplace_featured_benefits();
    err_msg := 'FAIL: authenticated was able to execute expire function';
  exception when insufficient_privilege then
    err_msg := null;
  when others then
    err_msg := null;
  end;
  perform set_config('role', 'postgres', true);
  if err_msg is not null then
    raise exception '%', err_msg;
  end if;
  raise notice 'PASS 14: authenticated cannot execute expire_marketplace_featured_benefits()';
end;
$$;

-- =============================================================================
-- Test 15: Kill switches continue working (paypal_payments=false blocks)
-- =============================================================================
do $$
declare
  err_msg text;
  seller_a_id uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- Disable paypal_payments
  update public.feature_flags set enabled = false where key = 'paypal_payments';

  -- Attempt to prepare order (should fail with billing_disabled)
  begin
    perform public.prepare_marketplace_paypal_order(
      seller_a_id,
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000099'
    );
    err_msg := 'FAIL: prepare succeeded despite paypal_payments=false';
  exception when others then
    if SQLERRM like '%billing_disabled%' then
      err_msg := null;
    else
      err_msg := 'FAIL: unexpected error: ' || SQLERRM;
    end if;
  end;

  -- Restore paypal_payments
  update public.feature_flags set enabled = true where key = 'paypal_payments';

  if err_msg is not null then
    raise exception '%', err_msg;
  end if;
  raise notice 'PASS 15: Kill switch blocks prepare_marketplace_paypal_order when paypal_payments=false';
end;
$$;

-- =============================================================================
-- Bonus: Allowlist tests
-- =============================================================================
do $$
declare
  err_msg text;
  seller_a_id uuid := '00000000-0000-0000-0000-0000000000a1';
  new_viewer_id uuid := '00000000-0000-0000-0000-000000000099';
begin
  -- Create a new user who is NOT on the allowlist
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  values (new_viewer_id, 'unauth@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated')
  on conflict (id) do nothing;
  insert into public.profiles (id, email, display_name)
  values (new_viewer_id, 'unauth@test.local', 'unauth_viewer')
  on conflict (id) do nothing;

  -- Ensure qa is enforced and user not on allowlist
  update private.marketplace_payment_qa_settings set enforced = true where key = 'sandbox_allowlist';
  delete from private.marketplace_payment_qa_allowlist where user_id = new_viewer_id;

  begin
    perform public.prepare_marketplace_paypal_order(
      new_viewer_id,
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000098'
    );
    err_msg := 'FAIL: User outside allowlist was allowed through';
  exception when others then
    if SQLERRM like '%marketplace_qa_access_required%' then
      err_msg := null;
    elsif SQLERRM like '%listing_not_owned%' then
      -- User doesn't own the listing, but that's after qa check. Let's check that qa check passed.
      -- Actually the flow checks qa first, then listing ownership.
      -- So if we get listing_not_owned, it means qa passed (which is wrong, qa should have blocked).
      err_msg := 'FAIL: QA check passed for user outside allowlist (got listing_not_owned instead)';
    else
      err_msg := 'FAIL: unexpected error: ' || SQLERRM;
    end if;
  end;

  if err_msg is not null then
    raise exception '%', err_msg;
  end if;
  raise notice 'PASS Bonus A: Allowlist correctly blocks user outside allowlist';
end;
$$;

do $$
declare
  can_pass boolean;
begin
  update private.marketplace_payment_qa_settings set enforced = true where key = 'sandbox_allowlist';
  delete from private.marketplace_payment_qa_allowlist;

  can_pass := private.is_marketplace_payment_qa_allowed('00000000-0000-0000-0000-0000000000a1');
  assert can_pass = false,
    'Empty allowlist with enforced=true should block everyone';
  raise notice 'PASS Bonus B: Empty allowlist with enforced=true blocks all users';
end;
$$;

do $$
declare
  can_pass boolean;
begin
  update private.marketplace_payment_qa_settings set enforced = false where key = 'sandbox_allowlist';

  can_pass := private.is_marketplace_payment_qa_allowed('00000000-0000-0000-0000-000000000099');
  assert can_pass = true,
    'enforced=false should allow any user';
  raise notice 'PASS Bonus C: enforced=false allows all users regardless of allowlist';

  -- Restore state for other tests
  update private.marketplace_payment_qa_settings set enforced = true where key = 'sandbox_allowlist';
  insert into private.marketplace_payment_qa_allowlist (user_id, active, added_by)
  values ('00000000-0000-0000-0000-0000000000a1', true, '00000000-0000-0000-0000-0000000000a1')
  on conflict (user_id) do nothing;
end;
$$;

\echo ''
\echo '=== FEATURED EXPIRATION + QA GATE COMPLETE ==='

-- Cleanup test listing
delete from public.marketplace_listings where id = 'e0000000-0000-0000-0000-0000000000f1';
