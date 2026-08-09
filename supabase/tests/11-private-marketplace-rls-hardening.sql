-- Regression suite for the private Marketplace hardening migration.
-- Run after 01-seed-test-data.sql. This test only reads privileged state and
-- never changes payment, benefit, feature-flag, or QA-gate data.

do $$
declare
  v_table text;
  v_count integer;
  v_result jsonb;
  v_cursor text;
  v_decoded jsonb;
  v_blocked boolean;
  v_role text;
begin
  -- A. The three private tables have RLS enabled and are not FORCE RLS.
  foreach v_table in array array[
    'marketplace_ranking_secrets',
    'marketplace_payment_qa_settings',
    'marketplace_payment_qa_allowlist'
  ] loop
    select count(*) into v_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname = v_table
      and c.relrowsecurity
      and not c.relforcerowsecurity;
    assert v_count = 1, format('RLS must be enabled without FORCE RLS for private.%s', v_table);
  end loop;

  -- B. No policy can turn a direct client route into a permissive one.
  select count(*) into v_count
  from pg_policies
  where schemaname = 'private'
    and tablename in (
      'marketplace_ranking_secrets',
      'marketplace_payment_qa_settings',
      'marketplace_payment_qa_allowlist'
    );
  assert v_count = 0, 'Private Marketplace tables must not have RLS policies';

  -- C/D/J. anon, authenticated, and service_role have no direct CRUD grants.
  foreach v_table in array array[
    'marketplace_ranking_secrets',
    'marketplace_payment_qa_settings',
    'marketplace_payment_qa_allowlist'
  ] loop
    foreach v_role in array array[
      'anon',
      'authenticated',
      'service_role'
    ] loop
      select count(*) into v_count
      from unnest(array['select', 'insert', 'update', 'delete']) as privilege_name
      where has_table_privilege(v_role, format('private.%I', v_table), privilege_name);
      assert v_count = 0, format('%s must not have direct CRUD on private.%s', v_role, v_table);
    end loop;
  end loop;

  -- E. Schema USAGE is intentionally unchanged in this minimal migration.
  -- The tables are not exposed by PostgREST and lack table grants; revoking
  -- schema usage is deferred until each non-client dependency is separately
  -- proven under a production-equivalent role matrix.
  assert has_schema_privilege('anon', 'private', 'usage'),
    'Minimal hardening intentionally preserves existing anon private schema USAGE';
  assert has_schema_privilege('authenticated', 'private', 'usage'),
    'Minimal hardening intentionally preserves existing authenticated private schema USAGE';

  -- F. The public, sanitized checkout wrapper still works for anonymous users.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select public.get_marketplace_checkout_settings() into v_result;
  assert jsonb_typeof(v_result) = 'object', 'Public checkout settings wrapper must return JSON';
  assert not (v_result ? 'allowlist') and not (v_result ? 'ranking_secret'),
    'Public checkout settings wrapper must remain sanitized';
  reset role;

  -- G/I. Owner-backed internal functions still work through their deliberate
  -- privileged boundary, including QA settings, allowlist evaluation and cursor
  -- signing/verification. No table write is performed.
  select private.is_marketplace_payment_qa_allowed('00000000-0000-0000-0000-0000000000a1') into v_blocked;
  assert v_blocked is not null, 'QA allowlist SECURITY DEFINER function must remain callable by its owner';
  select private.marketplace_encode_cursor(jsonb_build_object(
    'v', 1, 'b', 1, 's', 1,
    'i', '00000000-0000-0000-0000-000000000001',
    'q', 'private-hardening-regression'
  )) into v_cursor;
  select private.marketplace_decode_cursor(v_cursor) into v_decoded;
  assert v_decoded ->> 'q' = 'private-hardening-regression',
    'Cursor SECURITY DEFINER functions must preserve their contract';

  -- H. The payment-order RPC contract remains service-role only and keeps the
  -- same three UUID arguments / JSONB result. This structural assertion avoids
  -- creating a payment in a security regression test.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'prepare_marketplace_paypal_order'
    and pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_listing_id uuid, p_idempotency_key uuid'
    and pg_get_function_result(p.oid) = 'jsonb'
    and p.prosecdef
    and not has_function_privilege('anon', p.oid, 'execute')
    and not has_function_privilege('authenticated', p.oid, 'execute')
    and has_function_privilege('service_role', p.oid, 'execute')
    and exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) setting
      where setting like 'search_path=%'
    );
  assert v_count = 1, 'prepare_marketplace_paypal_order privilege and signature contract changed';
end;
$$;
