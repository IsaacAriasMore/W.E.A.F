-- Servers PayPal Sandbox QA gate regression.
-- Run after supabase db reset --local and the standard seed data.

begin;

do $$
declare
  qa_user uuid := '00000000-0000-0000-0000-0000000000a1';
  other_user uuid := '00000000-0000-0000-0000-0000000000a2';
  qa_listing uuid := 'f0000000-0000-0000-0000-000000000001';
  other_listing uuid := 'f0000000-0000-0000-0000-000000000002';
  normal_version uuid;
  live_version uuid;
  before_subscriptions integer;
  after_subscriptions integer;
  marketplace_before jsonb;
  marketplace_after jsonb;
  catalog_before jsonb;
  catalog_after jsonb;
  result jsonb;
  message text;
begin
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role
  ) values
    (qa_user, 'servers-qa-a@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (other_user, 'servers-qa-b@test.local', crypt('Test1234!', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into public.profiles (id, email, display_name)
  values
    (qa_user, 'servers-qa-a@test.local', 'servers_qa_a'),
    (other_user, 'servers-qa-b@test.local', 'servers_qa_b')
  on conflict (id) do nothing;

  insert into public.server_listings (
    id, owner_user_id, plan, status, title, slug, game, server_type,
    platforms, has_mods, maps, rates, region, language, description,
    discord_invite_url, is_featured, is_verified, billing_source, payment_provider, billing_environment
  ) values
    (qa_listing, qa_user, 'normal', 'draft', 'Servers QA Gate A', 'servers-qa-gate-a', 'ascended', 'pve',
      array['steam'], false, array['theisland'], '{}'::jsonb, 'na', 'en', 'Server-only QA listing A used to validate the PayPal Sandbox gate.',
      'https://discord.gg/serversqagate', false, false, 'paypal', 'paypal', 'sandbox'),
    (other_listing, other_user, 'normal', 'draft', 'Servers QA Gate B', 'servers-qa-gate-b', 'ascended', 'pve',
      array['steam'], false, array['theisland'], '{}'::jsonb, 'na', 'en', 'Server-only QA listing B used to validate the PayPal Sandbox gate.',
      'https://discord.gg/serversqagate', false, false, 'paypal', 'paypal', 'sandbox')
  on conflict (id) do update set
    owner_user_id = excluded.owner_user_id,
    billing_source = 'paypal',
    payment_provider = 'paypal',
    billing_environment = 'sandbox',
    status = 'draft',
    payment_status = 'not_required',
    billing_subscription_id = null,
    external_subscription_id = null;

  select version.id
  into normal_version
  from public.billing_plan_versions version
  join public.billing_plans plan on plan.id = version.plan_id
  where plan.code = 'normal'
    and version.environment = 'sandbox'
  order by version.created_at
  limit 1;

  assert normal_version is not null, 'A Normal Sandbox plan is required for this regression';

  -- A fresh local reset has no provider sync. Make the fixture eligible only
  -- inside this transaction; the final rollback preserves the reset baseline.
  update public.billing_plan_versions
  set
    sync_status = 'synced',
    provider_status = 'ACTIVE',
    external_plan_id_sandbox = coalesce(external_plan_id_sandbox, 'P-SANDBOX-QA-GATE')
  where id = normal_version;

  -- Explicitly create a non-Sandbox version only inside the rolled-back test.
  insert into public.billing_plan_versions (
    plan_id, version_number, environment, currency, base_price_minor,
    promotional_price_minor, discount_type, frequency_unit, interval_count,
    auto_renew, end_behavior, sync_status, provider_status, external_plan_id_live, terms_snapshot
  )
  select
    version.plan_id, 999, 'live', version.currency, version.base_price_minor,
    version.promotional_price_minor, version.discount_type, version.frequency_unit, version.interval_count,
    version.auto_renew, version.end_behavior, 'synced', 'ACTIVE', 'P-LIVE-QA-GATE', version.terms_snapshot
  from public.billing_plan_versions version
  where version.id = normal_version
  returning id into live_version;

  insert into private.server_paypal_qa_settings (key, enabled)
  values ('sandbox_allowlist', false)
  on conflict (key) do update set enabled = excluded.enabled;
  delete from private.server_paypal_qa_allowlist
  where user_id in (qa_user, other_user)
    or server_listing_id in (qa_listing, other_listing);

  insert into public.feature_flags (key, enabled, updated_by)
  values ('paypal_payments', false, qa_user)
  on conflict (key) do update set enabled = excluded.enabled;

  select count(*) into before_subscriptions
  from public.billing_subscriptions
  where server_listing_id in (qa_listing, other_listing);

  select jsonb_build_object(
    'marketplace_enabled', marketplace_enabled,
    'payments_enabled', payments_enabled,
    'price_minor', price_minor,
    'currency', currency,
    'environment', environment
  )
  into marketplace_before
  from public.marketplace_settings
  where key = 'featured_listing';

  select jsonb_agg(jsonb_build_object(
    'code', plan.code,
    'tier', plan.tier,
    'price', version.promotional_price_minor,
    'environment', version.environment
  ) order by plan.code, version.version_number)
  into catalog_before
  from public.billing_plans plan
  join public.billing_plan_versions version on version.plan_id = plan.id
  where plan.code in ('normal', 'plus')
    and version.environment = 'sandbox';

  -- A: global kill switch rejects before every other gate.
  begin
    perform public.prepare_paypal_subscription(qa_user, qa_listing, normal_version, 'f0000000-0000-0000-0000-000000000011');
    raise exception 'Expected billing_disabled';
  exception when others then
    if SQLERRM not like '%billing_disabled%' then raise; end if;
  end;

  update public.feature_flags set enabled = true where key = 'paypal_payments';

  -- B: enabled global switch still fails closed until QA is explicitly enabled.
  begin
    perform public.prepare_paypal_subscription(qa_user, qa_listing, normal_version, 'f0000000-0000-0000-0000-000000000012');
    raise exception 'Expected server_paypal_qa_access_required';
  exception when others then
    if SQLERRM not like '%server_paypal_qa_access_required%' then raise; end if;
  end;

  update private.server_paypal_qa_settings set enabled = true where key = 'sandbox_allowlist';
  insert into private.server_paypal_qa_allowlist (user_id, server_listing_id, active, added_by)
  values (qa_user, qa_listing, true, qa_user);

  -- C/D/E: every mismatched exact pair fails before creating a billing row.
  foreach message in array array['C', 'D', 'E'] loop
    begin
      if message = 'C' then
        perform public.prepare_paypal_subscription(qa_user, other_listing, normal_version, 'f0000000-0000-0000-0000-000000000013');
      elsif message = 'D' then
        perform public.prepare_paypal_subscription(other_user, qa_listing, normal_version, 'f0000000-0000-0000-0000-000000000014');
      else
        perform public.prepare_paypal_subscription(other_user, other_listing, normal_version, 'f0000000-0000-0000-0000-000000000015');
      end if;
      raise exception 'Expected rejection for mismatch %', message;
    exception when others then
      if SQLERRM not like '%listing_not_available%'
        and SQLERRM not like '%server_paypal_qa_access_required%'
      then raise; end if;
    end;
  end loop;

  -- G: a non-Sandbox plan never crosses the Sandbox gate.
  begin
    perform public.prepare_paypal_subscription(qa_user, qa_listing, live_version, 'f0000000-0000-0000-0000-000000000016');
    raise exception 'Expected paypal_sandbox_required';
  exception when others then
    if SQLERRM not like '%paypal_sandbox_required%' then raise; end if;
  end;

  -- F/I/J: exact pair may prepare once; the retry returns the same subscription.
  result := public.prepare_paypal_subscription(qa_user, qa_listing, normal_version, 'f0000000-0000-0000-0000-000000000017');
  assert (result->>'existing')::boolean = false, 'Allowed exact pair must create one pending subscription';
  assert (result->>'price_minor')::integer = 300, 'Normal catalog price changed';
  assert result->>'tier' = 'normal', 'Normal catalog tier changed';

  result := public.prepare_paypal_subscription(qa_user, qa_listing, normal_version, 'f0000000-0000-0000-0000-000000000017');
  assert (result->>'existing')::boolean = true, 'Retry must preserve subscription idempotency';

  select count(*) into after_subscriptions
  from public.billing_subscriptions
  where server_listing_id in (qa_listing, other_listing);

  assert after_subscriptions = before_subscriptions + 1,
    'Rejected paths created a subscription or idempotency duplicated it';
  assert not exists (
    select 1 from public.billing_payments
    where server_listing_id in (qa_listing, other_listing)
  ), 'Prepare must not create a payment';
  assert not exists (
    select 1 from public.server_listings
    where id = other_listing and billing_subscription_id is not null
  ), 'Rejected listing received an entitlement';

  select jsonb_build_object(
    'marketplace_enabled', marketplace_enabled,
    'payments_enabled', payments_enabled,
    'price_minor', price_minor,
    'currency', currency,
    'environment', environment
  )
  into marketplace_after
  from public.marketplace_settings
  where key = 'featured_listing';
  assert marketplace_after = marketplace_before, 'Marketplace settings changed';

  select jsonb_agg(jsonb_build_object(
    'code', plan.code,
    'tier', plan.tier,
    'price', version.promotional_price_minor,
    'environment', version.environment
  ) order by plan.code, version.version_number)
  into catalog_after
  from public.billing_plans plan
  join public.billing_plan_versions version on version.plan_id = plan.id
  where plan.code in ('normal', 'plus')
    and version.environment = 'sandbox';
  assert catalog_after = catalog_before, 'Normal/Plus Sandbox catalog changed';

  assert not has_table_privilege('anon', 'private.server_paypal_qa_settings', 'select')
    and not has_table_privilege('authenticated', 'private.server_paypal_qa_settings', 'select')
    and not has_table_privilege('service_role', 'private.server_paypal_qa_settings', 'select'),
    'Private QA settings unexpectedly grant direct reads';
  assert not has_table_privilege('anon', 'private.server_paypal_qa_allowlist', 'select')
    and not has_table_privilege('authenticated', 'private.server_paypal_qa_allowlist', 'select')
    and not has_table_privilege('service_role', 'private.server_paypal_qa_allowlist', 'select'),
    'Private QA allowlist unexpectedly grants direct reads';
  assert not has_function_privilege('anon', 'private.is_server_paypal_sandbox_qa_allowed(uuid,uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'private.is_server_paypal_sandbox_qa_allowed(uuid,uuid,text)', 'execute'),
    'Private QA helper unexpectedly grants client execution';

  raise notice 'PASS: Servers Sandbox QA gate blocks every unmatched pair and preserves the exact-pair retry contract';
end;
$$;

rollback;
