-- Marketplace PayPal Sandbox capture reconciliation via the PayPal API.
--
-- A capture can complete at PayPal without a PAYMENT.CAPTURE.COMPLETED webhook
-- ever reaching us (observed in sandbox: approved payment with capture id, zero
-- webhook deliveries). The capture Edge Function now reads the capture back from
-- PayPal and, when it is already COMPLETED, confirms the benefit server-side
-- through confirm_marketplace_paypal_capture_from_api instead of waiting forever.
--
-- This migration:
-- 1. extends prepare_marketplace_paypal_capture so the Edge Function can decide
--    between GET-and-confirm (capture id already known) and POST-and-confirm;
-- 2. adds confirm_marketplace_paypal_capture_from_api, a service_role-only,
--    SECURITY DEFINER RPC that performs the same fixed-price/ASA/ownership guards
--    as the webhook path and grants the seven-day featured benefit once;
-- 3. makes process_marketplace_paypal_event idempotent for a late webhook that
--    arrives after the API already confirmed the capture.

-- 1. prepare_marketplace_paypal_capture now exposes reconciliation inputs.
create or replace function public.prepare_marketplace_paypal_capture(p_payment_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare payment public.marketplace_payments%rowtype;
begin
  select * into payment from public.marketplace_payments where id=p_payment_id and user_id=p_user_id for update;
  if payment.id is null then raise exception 'marketplace_payment_not_owned'; end if;
  if payment.paypal_order_id is null then raise exception 'paypal_order_not_attached'; end if;
  if payment.status in ('refunded','reversed','failed') then raise exception 'marketplace_payment_not_available'; end if;
  return jsonb_build_object(
    'payment_id',payment.id,
    'listing_id',payment.listing_id,
    'paypal_order_id',payment.paypal_order_id,
    'idempotency_key',payment.idempotency_key,
    'already_captured',payment.status='captured',
    'payment_status',payment.status,
    'paypal_capture_id',payment.paypal_capture_id,
    'amount_minor',payment.amount_minor,
    'currency',payment.currency,
    'environment',payment.environment
  );
end;
$$;

-- 2. Server-only confirmation of a capture that is already COMPLETED at PayPal.
create or replace function public.confirm_marketplace_paypal_capture_from_api(
  p_payment_id uuid,
  p_user_id uuid,
  p_order_id text,
  p_capture_id text,
  p_amount_minor integer,
  p_currency text,
  p_captured_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.marketplace_payments%rowtype;
  listing public.marketplace_listings%rowtype;
begin
  if p_payment_id is null or p_user_id is null or p_order_id is null or p_capture_id is null
     or p_amount_minor is null or p_currency is null or p_captured_at is null
  then
    raise exception 'invalid_marketplace_capture';
  end if;

  select * into payment
  from public.marketplace_payments
  where id = p_payment_id and user_id = p_user_id
  for update;

  if payment.id is null then raise exception 'marketplace_payment_not_owned'; end if;
  if payment.environment <> 'sandbox' then raise exception 'invalid_marketplace_payment_configuration'; end if;
  if payment.amount_minor <> 300 or payment.currency <> 'USD' then raise exception 'invalid_marketplace_payment_configuration'; end if;
  if p_amount_minor <> 300 or upper(coalesce(p_currency,'')) <> 'USD' then raise exception 'marketplace_capture_reconciliation_failed'; end if;
  if payment.paypal_order_id is null or payment.paypal_order_id <> p_order_id then raise exception 'marketplace_capture_reconciliation_failed'; end if;

  -- Idempotent replay: already confirmed for this exact order+capture and the
  -- listing is already featured. Return reused=true without touching anything.
  if payment.status = 'captured' then
    if payment.paypal_capture_id = p_capture_id then
      select * into listing from public.marketplace_listings where id = payment.listing_id;
      if listing.id is not null and listing.is_featured then
        return jsonb_build_object('confirmed',true,'reused',true);
      end if;
    end if;
    raise exception 'marketplace_capture_reconciliation_failed';
  end if;

  if payment.status not in ('created','approved') then raise exception 'marketplace_payment_not_available'; end if;
  if payment.paid_at is not null then raise exception 'marketplace_payment_not_available'; end if;
  if payment.paypal_capture_id is not null and payment.paypal_capture_id <> p_capture_id then raise exception 'marketplace_capture_reconciliation_failed'; end if;

  select * into listing
  from public.marketplace_listings
  where id = payment.listing_id
  for update;

  if listing.id is null then raise exception 'marketplace_capture_reconciliation_failed'; end if;
  if listing.owner_user_id <> p_user_id then raise exception 'marketplace_capture_reconciliation_failed'; end if;
  if listing.game <> 'ascended' then raise exception 'marketplace_capture_reconciliation_failed'; end if;
  if listing.status <> 'active' or listing.is_featured then raise exception 'marketplace_capture_reconciliation_failed'; end if;

  update public.marketplace_payments
  set status = 'captured',
      paypal_capture_id = p_capture_id,
      paid_at = p_captured_at
  where id = payment.id;

  update public.marketplace_listings
  set is_featured = true,
      featured_started_at = p_captured_at,
      featured_expires_at = p_captured_at + interval '7 days',
      expires_at = greatest(expires_at, p_captured_at + interval '7 days')
  where id = payment.listing_id
    and owner_user_id = payment.user_id
    and game = 'ascended'
    and status = 'active'
    and is_featured = false;

  if not found then raise exception 'marketplace_capture_reconciliation_failed'; end if;

  insert into public.marketplace_audit_log(listing_id,payment_id,actor_user_id,action,details)
  values (payment.listing_id,payment.id,p_user_id,'capture_confirmed_from_api',jsonb_build_object(
    'duration_days',7,'amount_minor',300,'currency','USD','environment','sandbox','confirmation_source','paypal_api'
  ));
  insert into public.marketplace_audit_log(listing_id,payment_id,actor_user_id,action,details)
  values (payment.listing_id,payment.id,p_user_id,'featured_activated',jsonb_build_object(
    'duration_days',7,'amount_minor',300,'currency','USD','environment','sandbox','confirmation_source','paypal_api'
  ));

  return jsonb_build_object('confirmed',true,'reused',false);
end;
$$;

-- 3. Webhook stays idempotent when the capture was already confirmed from the API.
create or replace function public.process_marketplace_paypal_event(
  p_event_id text,
  p_event_type text,
  p_data jsonb,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.marketplace_payments%rowtype;
  event_time timestamptz;
  amount_minor integer;
  currency text;
  specific_error text;
begin
  if p_event_id is null or char_length(p_event_id) not between 8 and 128 then
    raise exception 'invalid_event_id';
  end if;
  if p_event_type not in (
    'CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED',
    'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED',
    'PAYMENT.CAPTURE.REVERSED'
  ) then
    raise exception 'invalid_event_type';
  end if;
  if jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_payload) <> 'object'
    or pg_column_size(p_payload) > 1048576
  then
    raise exception 'invalid_event_payload';
  end if;

  event_time := coalesce(nullif(p_data->>'event_time', '')::timestamptz, now());
  amount_minor := greatest(coalesce(nullif(p_data->>'amount_minor', '')::integer, 0), 0);
  currency := upper(coalesce(p_data->>'currency', ''));

  insert into private.billing_events(
    provider, environment, event_id, event_type, resource_id, payload, event_created_at
  ) values (
    'paypal', 'sandbox', p_event_id, p_event_type,
    coalesce(p_data->>'order_id', p_data->>'capture_id', p_data->>'custom_id'),
    p_payload, event_time
  ) on conflict(provider, environment, event_id) do nothing;
  if not found then return false; end if;

  select * into payment
  from public.marketplace_payments
  where (nullif(p_data->>'order_id', '') is not null and paypal_order_id = p_data->>'order_id')
     or (nullif(p_data->>'capture_id', '') is not null and paypal_capture_id = p_data->>'capture_id')
     or (coalesce(p_data->>'custom_id', '') = 'weaf_marketplace:' || id::text)
  order by created_at desc
  limit 1
  for update;

  if payment.id is null then
    update private.billing_events
    set processed_at = now(), processing_error = 'resource_not_found'
    where provider = 'paypal' and environment = 'sandbox' and event_id = p_event_id;
    return true;
  end if;

  if payment.environment <> 'sandbox' or payment.amount_minor <> 300 or payment.currency <> 'USD' then
    raise exception 'invalid_marketplace_payment_configuration';
  end if;

  if p_event_type = 'CHECKOUT.ORDER.APPROVED' then
    update public.marketplace_payments
    set status = case when status = 'created' then 'approved' else status end
    where id = payment.id;
  elsif p_event_type = 'PAYMENT.CAPTURE.COMPLETED' then
    if payment.status in ('refunded', 'reversed') then
      insert into public.marketplace_audit_log(listing_id, payment_id, action, details)
      values (payment.listing_id, payment.id, 'stale_capture_ignored', jsonb_build_object('terminal_status', payment.status));
    elsif payment.status = 'captured' then
      -- The capture was already confirmed from the API. A late webhook with the
      -- same capture id is a duplicate: mark it processed, grant nothing again.
      if payment.paypal_capture_id = p_data->>'capture_id' then
        null;
      else
        specific_error := 'marketplace_capture_reconciliation_failed';
        raise exception 'marketplace_capture_reconciliation_failed';
      end if;
    elsif amount_minor <> 300 or currency <> 'USD' then
      update public.marketplace_payments set status = 'failed' where id = payment.id;
      update public.marketplace_listings
      set is_featured = false,
          featured_expires_at = least(featured_expires_at, event_time)
      where id = payment.listing_id;
      insert into public.marketplace_audit_log(listing_id, payment_id, action, details)
      values (payment.listing_id, payment.id, 'capture_amount_mismatch', jsonb_build_object(
        'expected_minor', 300, 'received_minor', amount_minor,
        'expected_currency', 'USD', 'received_currency', currency
      ));
    else
      update public.marketplace_payments
      set status = 'captured',
          paypal_capture_id = coalesce(nullif(p_data->>'capture_id', ''), paypal_capture_id),
          external_event_id = p_event_id,
          paid_at = event_time
      where id = payment.id;
      update public.marketplace_listings
      set status = 'active',
          is_featured = true,
          featured_started_at = event_time,
          featured_expires_at = event_time + interval '7 days',
          expires_at = greatest(expires_at, event_time + interval '7 days')
      where id = payment.listing_id
        and owner_user_id = payment.user_id
        and game = 'ascended';
      if not found then
        raise exception 'marketplace_listing_not_eligible';
      end if;
      insert into public.marketplace_audit_log(listing_id, payment_id, action, details)
      values (payment.listing_id, payment.id, 'featured_activated', jsonb_build_object(
        'duration_days', 7, 'amount_minor', 300, 'currency', 'USD', 'environment', 'sandbox'
      ));
    end if;
  elsif p_event_type = 'PAYMENT.CAPTURE.DENIED' then
    update public.marketplace_payments
    set status = 'failed', external_event_id = p_event_id
    where id = payment.id and status <> 'captured';
    update public.marketplace_listings
    set is_featured = false,
        featured_expires_at = least(featured_expires_at, event_time)
    where id = payment.listing_id and is_featured;
  elsif p_event_type = 'PAYMENT.CAPTURE.REFUNDED' then
    update public.marketplace_payments
    set status = 'refunded', external_event_id = p_event_id
    where id = payment.id;
    update public.marketplace_listings
    set is_featured = false,
        featured_expires_at = least(featured_expires_at, event_time)
    where id = payment.listing_id;
  elsif p_event_type = 'PAYMENT.CAPTURE.REVERSED' then
    update public.marketplace_payments
    set status = 'reversed', external_event_id = p_event_id
    where id = payment.id;
    update public.marketplace_listings
    set is_featured = false,
        featured_expires_at = least(featured_expires_at, event_time)
    where id = payment.listing_id;
  end if;

  update private.billing_events
  set processed_at = now(), processing_error = null
  where provider = 'paypal' and environment = 'sandbox' and event_id = p_event_id;
  return true;
exception when others then
  update private.billing_events
  set processed_at = now(),
      processing_error = coalesce(specific_error, 'marketplace_processing_failed')
  where provider = 'paypal' and environment = 'sandbox' and event_id = p_event_id;
  raise;
end;
$$;

revoke all on function public.prepare_marketplace_paypal_capture(uuid,uuid),public.confirm_marketplace_paypal_capture_from_api(uuid,uuid,text,text,integer,text,timestamptz),public.process_marketplace_paypal_event(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_marketplace_paypal_capture(uuid,uuid),public.confirm_marketplace_paypal_capture_from_api(uuid,uuid,text,text,integer,text,timestamptz),public.process_marketplace_paypal_event(text,text,jsonb,jsonb) to service_role;

comment on function public.confirm_marketplace_paypal_capture_from_api(uuid,uuid,text,text,integer,text,timestamptz) is
  'Server-only confirmation that a Marketplace PayPal Sandbox capture completed at PayPal; activates the seven-day featured benefit once, with fixed-price/ASA/ownership guards, and is idempotent for replays of the same order+capture.';
