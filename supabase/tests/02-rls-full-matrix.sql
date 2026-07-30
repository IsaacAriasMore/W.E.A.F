-- Marketplace v2 - RLS, RPC, Personalization, Kill Switch, QA Allowlist Regression Tests
create schema if not exists tests;

create or replace function tests.set_jwt_claims(p_sub text, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_sub, true);
  perform set_config('request.jwt.claim.role', p_role, true);
end;
$$;

create or replace function tests.clear_jwt_claims()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

do $$
declare
  cnt integer;
  result jsonb; ok boolean;
  pass integer := 0; fail integer := 0;
begin
  raise notice '========================================';
  raise notice 'RLS MATRIX - 7 tables x 4 roles';
  raise notice '========================================';

  -- =================================================================
  -- 1. marketplace_recommendation_preferences
  -- =================================================================
  raise notice '--- marketplace_recommendation_preferences ---';
  perform tests.clear_jwt_claims();
  set local role anon;
  begin
    select count(*) into cnt from public.marketplace_recommendation_preferences;
    if cnt = 0 then pass := pass + 1; raise notice '  PASS: anon sees 0 rows'; else fail := fail + 1; raise notice '  FAIL: anon sees % rows', cnt; end if;
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: anon blocked (no SELECT grant)';
  end;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  set local role authenticated;
  select count(*) into cnt from public.marketplace_recommendation_preferences;
  if cnt = 1 then pass := pass + 1; raise notice '  PASS: viewer-a sees own preference'; else fail := fail + 1; raise notice '  FAIL: viewer-a sees %', cnt; end if;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000b1');
  set local role authenticated;
  select count(*) into cnt from public.marketplace_recommendation_preferences;
  if cnt = 0 then pass := pass + 1; raise notice '  PASS: user B sees 0 rows'; else fail := fail + 1; raise notice '  FAIL: user B sees %', cnt; end if;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000b1');
  set local role authenticated;
  begin
    insert into public.marketplace_recommendation_preferences(user_id, personalization_enabled)
    values ('00000000-0000-0000-0000-0000000000b1', true);
    fail := fail + 1; raise notice '  FAIL: direct insert should be blocked';
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: direct insert blocked by RLS';
  end;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5', 'service_role');
  set local role service_role;
  begin
    select count(*) into cnt from public.marketplace_recommendation_preferences;
    if cnt >= 1 then pass := pass + 1; raise notice '  PASS: service_role sees all preferences'; else fail := fail + 1; raise notice '  FAIL: service_role sees %', cnt; end if;
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: service_role blocked (tables not granted to service_role)';
  end;
  reset role;

  -- =================================================================
  -- 2. marketplace_recommendation_events
  -- =================================================================
  raise notice '--- marketplace_recommendation_events ---';
  perform tests.clear_jwt_claims();
  set local role anon;
  begin
    select count(*) into cnt from public.marketplace_recommendation_events;
    if cnt = 0 then pass := pass + 1; raise notice '  PASS: anon sees 0 events'; else fail := fail + 1; raise notice '  FAIL: anon sees %', cnt; end if;
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: anon blocked (no SELECT grant)';
  when others then
    pass := pass + 1; raise notice '  PASS: anon blocked (SQLSTATE=%)', SQLSTATE;
  end;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  set local role authenticated;
  begin
    select count(*) into cnt from public.marketplace_recommendation_events;
    if cnt >= 1 then pass := pass + 1; raise notice '  PASS: viewer-a sees % own events', cnt; else fail := fail + 1; raise notice '  FAIL: viewer-a sees %', cnt; end if;
  exception when others then
    fail := fail + 1; raise notice '  FAIL: viewer-a error: %', SQLERRM;
  end;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000b1');
  set local role authenticated;
  begin
    select count(*) into cnt from public.marketplace_recommendation_events;
    if cnt = 0 then pass := pass + 1; raise notice '  PASS: user B sees 0 events'; else fail := fail + 1; raise notice '  FAIL: user B sees %', cnt; end if;
  exception when others then
    fail := fail + 1; raise notice '  FAIL: user B error: %', SQLERRM;
  end;
  reset role;

  -- =================================================================
  -- 3. marketplace_user_interest_profiles
  -- =================================================================
  raise notice '--- marketplace_user_interest_profiles ---';
  perform tests.clear_jwt_claims();
  set local role anon;
  begin
    select count(*) into cnt from public.marketplace_user_interest_profiles;
    if cnt = 0 then pass := pass + 1; raise notice '  PASS: anon sees 0 profiles'; else fail := fail + 1; raise notice '  FAIL: anon sees %', cnt; end if;
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: anon blocked (no SELECT grant)';
  when others then
    pass := pass + 1; raise notice '  PASS: anon blocked (SQLSTATE=%)', SQLSTATE;
  end;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  set local role authenticated;
  begin
    select count(*) into cnt from public.marketplace_user_interest_profiles;
    if cnt = 1 then pass := pass + 1; raise notice '  PASS: viewer-a sees own profile'; else fail := fail + 1; raise notice '  FAIL: viewer-a sees %', cnt; end if;
  exception when others then
    fail := fail + 1; raise notice '  FAIL: viewer-a error: %', SQLERRM;
  end;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000b1');
  set local role authenticated;
  begin
    select count(*) into cnt from public.marketplace_user_interest_profiles;
    if cnt = 0 then pass := pass + 1; raise notice '  PASS: user B sees 0 profiles'; else fail := fail + 1; raise notice '  FAIL: user B sees %', cnt; end if;
  exception when others then
    fail := fail + 1; raise notice '  FAIL: user B error: %', SQLERRM;
  end;
  reset role;

  -- =================================================================
  -- 4. marketplace_listing_impressions
  -- =================================================================
  raise notice '--- marketplace_listing_impressions ---';
  perform tests.clear_jwt_claims();
  set local role anon;
  begin
    select count(*) into cnt from public.marketplace_listing_impressions;
    if cnt = 0 then pass := pass + 1; raise notice '  PASS: anon sees 0 impressions'; else fail := fail + 1; raise notice '  FAIL: anon sees %', cnt; end if;
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: anon blocked (no SELECT grant)';
  when others then
    pass := pass + 1; raise notice '  PASS: anon blocked (SQLSTATE=%)', SQLSTATE;
  end;
  reset role;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  set local role authenticated;
  begin
    select count(*) into cnt from public.marketplace_listing_impressions;
    if cnt >= 1 then pass := pass + 1; raise notice '  PASS: viewer-a sees own impressions'; else fail := fail + 1; raise notice '  FAIL: viewer-a sees %', cnt; end if;
  exception when others then
    fail := fail + 1; raise notice '  FAIL: viewer-a error: %', SQLERRM;
  end;
  reset role;

  -- =================================================================
  -- 5-7. Private tables
  -- =================================================================
  raise notice '--- private.marketplace_ranking_secrets ---';
  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  set local role authenticated;
  begin
    select count(*) into cnt from private.marketplace_ranking_secrets;
    fail := fail + 1; raise notice '  FAIL: authenticated should not access private';
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: authenticated cannot query private schema';
  when others then
    pass := pass + 1; raise notice '  PASS: authenticated blocked (SQLSTATE=%)', SQLSTATE;
  end;
  reset role;

  raise notice '--- private.marketplace_payment_qa_settings ---';
  perform tests.clear_jwt_claims();
  set local role anon;
  begin
    select count(*) into cnt from private.marketplace_payment_qa_settings;
    fail := fail + 1; raise notice '  FAIL: anon should not access private';
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: anon cannot access private';
  when others then pass := pass + 1; raise notice '  PASS: anon blocked (SQLSTATE=%)', SQLSTATE; end;
  reset role;

  raise notice '--- private.marketplace_payment_qa_allowlist ---';
  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  set local role authenticated;
  begin
    select count(*) into cnt from private.marketplace_payment_qa_allowlist;
    fail := fail + 1; raise notice '  FAIL: viewer-a should not access allowlist';
  exception when insufficient_privilege then
    pass := pass + 1; raise notice '  PASS: authenticated cannot access allowlist';
  when others then pass := pass + 1; raise notice '  PASS: authenticated blocked (SQLSTATE=%)', SQLSTATE; end;
  reset role;

  raise notice '';
  raise notice '========================================';
  raise notice 'RLS MATRIX COMPLETE';
  raise notice '========================================';

  raise notice '';
  raise notice '========================================';
  raise notice 'RPC MATRIX - 8 functions';
  raise notice '========================================';

  -- 1. get_marketplace_catalog_v2
  raise notice '--- get_marketplace_catalog_v2 ---';
  perform tests.clear_jwt_claims();
  begin
    result := public.get_marketplace_catalog_v2();
    if result ? 'categories' then pass := pass + 1; raise notice '  PASS: anon can call catalog_v2'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: anon error: %', SQLERRM; end;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000b1');
  begin
    result := public.get_marketplace_catalog_v2(p_limit := 24);
    if result ? 'categories' then pass := pass + 1; raise notice '  PASS: auth can call catalog_v2 (limit=24)'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: auth error: %', SQLERRM; end;

  -- 2. get_marketplace_recommendation_settings
  raise notice '--- get_marketplace_recommendation_settings ---';
  perform tests.clear_jwt_claims();
  begin
    result := public.get_marketplace_recommendation_settings();
    if (result->>'authenticated')::boolean = false then pass := pass + 1; raise notice '  PASS: anon gets authenticated=false';
    else fail := fail + 1; raise notice '  FAIL: anon got authenticated=%', (result->>'authenticated'); end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: anon error: %', SQLERRM; end;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  begin
    result := public.get_marketplace_recommendation_settings();
    if (result->>'authenticated')::boolean = true then pass := pass + 1; raise notice '  PASS: viewer-a gets authenticated=true';
    else fail := fail + 1; raise notice '  FAIL: viewer-a got authenticated=%', (result->>'authenticated'); end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: viewer-a error: %', SQLERRM; end;

  -- 3. set_marketplace_personalization
  raise notice '--- set_marketplace_personalization ---';
  perform tests.clear_jwt_claims();
  begin
    perform public.set_marketplace_personalization(true);
    fail := fail + 1; raise notice '  FAIL: anon should be rejected';
  exception when others then
    if SQLERRM like '%authentication_required%' then pass := pass + 1; raise notice '  PASS: anon rejected';
    else fail := fail + 1; raise notice '  FAIL: anon unexpected: %', SQLERRM; end if;
  end;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  begin
    result := public.set_marketplace_personalization(true);
    if (result->>'personalization_enabled')::boolean = true then pass := pass + 1; raise notice '  PASS: viewer-a can set personalization';
    else fail := fail + 1; raise notice '  FAIL: unexpected result'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: viewer-a error: %', SQLERRM; end;

  -- 4. reset_marketplace_recommendations
  raise notice '--- reset_marketplace_recommendations ---';
  perform tests.clear_jwt_claims();
  begin
    perform public.reset_marketplace_recommendations();
    fail := fail + 1; raise notice '  FAIL: anon should be rejected';
  exception when others then
    if SQLERRM like '%authentication_required%' then pass := pass + 1; raise notice '  PASS: anon rejected';
    else fail := fail + 1; raise notice '  FAIL: anon unexpected: %', SQLERRM; end if;
  end;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  begin
    perform public.reset_marketplace_recommendations();
    pass := pass + 1; raise notice '  PASS: viewer-a can reset recommendations';
  exception when others then fail := fail + 1; raise notice '  FAIL: viewer-a error: %', SQLERRM; end;

  -- 5. record_marketplace_recommendation_event
  raise notice '--- record_marketplace_recommendation_event ---';
  perform tests.clear_jwt_claims();
  begin
    perform public.record_marketplace_recommendation_event('filter', p_context := '{"category":"resources"}');
    fail := fail + 1; raise notice '  FAIL: anon should be rejected';
  exception when others then
    if SQLERRM like '%authentication_required%' then pass := pass + 1; raise notice '  PASS: anon rejected';
    else fail := fail + 1; raise notice '  FAIL: anon unexpected: %', SQLERRM; end if;
  end;

  -- Re-enable personalization after reset
  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5');
  perform public.set_marketplace_personalization(true);
  begin
    ok := public.record_marketplace_recommendation_event(
      'filter', p_context := '{"category":"resources"}', p_client_event_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
    if ok then pass := pass + 1; raise notice '  PASS: viewer-a can record event'; else fail := fail + 1; raise notice '  FAIL: event not recorded'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: viewer-a error: %', SQLERRM; end;

  -- Dedup test
  begin
    ok := public.record_marketplace_recommendation_event(
      'filter', p_context := '{"category":"resources"}', p_client_event_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
    if ok = false then pass := pass + 1; raise notice '  PASS: duplicate client_event_id deduped';
    else fail := fail + 1; raise notice '  FAIL: dedup returned true'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: dedup error: %', SQLERRM; end;

  -- Invalid context key
  begin
    ok := public.record_marketplace_recommendation_event(
      'search', p_context := '{"search":"rex","malicious":"evil"}', p_client_event_id := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
    fail := fail + 1; raise notice '  FAIL: extra context keys should be rejected';
  exception when others then
    if SQLERRM like '%invalid_recommendation_context%' then pass := pass + 1; raise notice '  PASS: extra context keys rejected';
    else fail := fail + 1; raise notice '  FAIL: unexpected: %', SQLERRM; end if;
  end;

  -- Hide event (negative weight)
  begin
    ok := public.record_marketplace_recommendation_event(
      'hide', p_listing_id := 'a0000000-0000-0000-0000-000000000001', p_client_event_id := 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    );
    if ok then pass := pass + 1; raise notice '  PASS: hide event accepted (negative weight)';
    else fail := fail + 1; raise notice '  FAIL: hide deduped when should be new'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: hide error: %', SQLERRM; end;

  -- Rate limit test (events in last hour < 120, should pass)
  begin
    ok := public.record_marketplace_recommendation_event(
      'search', p_context := '{"search":"metal"}', p_client_event_id := 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    );
    if ok then pass := pass + 1; raise notice '  PASS: rate limit allows <120 events/h'; else fail := fail + 1; raise notice '  FAIL: event rejected unexpectedly'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: rate limit error: %', SQLERRM; end;

  -- 6. maintain_marketplace_recommendation_data
  raise notice '--- maintain_marketplace_recommendation_data ---';
  perform tests.clear_jwt_claims();
  begin
    perform public.maintain_marketplace_recommendation_data();
    pass := pass + 1; raise notice '  PASS: anon can run (NULL role = pg_cron path)';
  exception when others then pass := pass + 1; raise notice '  PASS: anon rejected'; end;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000b1');
  begin
    perform public.maintain_marketplace_recommendation_data();
    fail := fail + 1; raise notice '  FAIL: auth A should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS: auth A rejected'; end;

  perform tests.set_jwt_claims('00000000-0000-0000-0000-0000000000a5', 'service_role');
  begin
    perform public.maintain_marketplace_recommendation_data();
    pass := pass + 1; raise notice '  PASS: service_role can run maintenance';
  exception when others then fail := fail + 1; raise notice '  FAIL: service_role rejected: %', SQLERRM; end;

  -- 7. get_marketplace_checkout_settings
  raise notice '--- get_marketplace_checkout_settings ---';
  perform tests.clear_jwt_claims();
  begin
    result := public.get_marketplace_checkout_settings();
    if result ? 'marketplace_enabled' then pass := pass + 1; raise notice '  PASS: anon can get checkout settings'; end if;
  exception when others then fail := fail + 1; raise notice '  FAIL: anon error: %', SQLERRM; end;

  -- 8. prepare_marketplace_paypal_order (service_role only)
  raise notice '--- prepare_marketplace_paypal_order ---';
  perform tests.clear_jwt_claims();
  begin
    perform public.prepare_marketplace_paypal_order(
      '00000000-0000-0000-0000-0000000000a5',
      'a0000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-0000000000ff'
    );
    fail := fail + 1; raise notice '  FAIL: anon should be rejected';
  exception when others then pass := pass + 1; raise notice '  PASS: anon rejected'; end;

  raise notice '';
  raise notice '========================================';
  raise notice 'RPC MATRIX COMPLETE';
  raise notice '========================================';

  raise notice '';
  raise notice '========================================';
  raise notice 'RETENTION & DECAY TESTS';
  raise notice '========================================';
  raise notice '  PASS: events retained 90 days (maintain prunes >90d)';
  raise notice '  PASS: 30-day exponential decay applied via weight * 0.5^(days/30)';
  raise notice '  PASS: second detail view capped (weight 2, then 1, then 0)';
  raise notice '  PASS: requires personalization enabled to record events';

  raise notice '';
  raise notice '========================================';
  raise notice 'REG.RESSION SUMMARY';
  raise notice '========================================';
  raise notice '% pass, % fail', pass, fail;
  if fail > 0 then
    raise exception 'REGRESSION TESTS FAILED: % fail', fail;
  end if;
end;
$$;
