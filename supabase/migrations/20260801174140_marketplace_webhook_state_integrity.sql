-- Harden Marketplace PayPal webhook reconciliation without changing payment
-- enablement, price, environment, RLS, or provider configuration.
--
-- Invariants:
-- * every supplied provider identifier must resolve to the same payment;
-- * a late DENIED event never downgrades a captured/terminal payment and never
--   revokes a benefit (a denial belongs to an attempt, not to the listing);
-- * refund/reversal can only transition the matching captured payment;
-- * COMPLETED cannot resurrect a locally failed or terminal payment;
-- * the existing billing-event uniqueness remains the idempotency boundary.

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
  order_id text;
  capture_id text;
  custom_id text;
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
  order_id := nullif(p_data->>'order_id', '');
  capture_id := nullif(p_data->>'capture_id', '');
  custom_id := nullif(p_data->>'custom_id', '');

  if order_id is null and capture_id is null and custom_id is null then
    raise exception 'invalid_event_payload';
  end if;
  if p_event_type like 'PAYMENT.CAPTURE.%' and capture_id is null then
    raise exception 'invalid_event_payload';
  end if;

  insert into private.billing_events(
    provider, environment, event_id, event_type, resource_id, payload, event_created_at
  ) values (
    'paypal', 'sandbox', p_event_id, p_event_type,
    coalesce(order_id, capture_id, custom_id), p_payload, event_time
  ) on conflict(provider, environment, event_id) do nothing;
  if not found then return false; end if;

  select * into payment
  from public.marketplace_payments
  where (order_id is not null and paypal_order_id = order_id)
     or (capture_id is not null and paypal_capture_id = capture_id)
     or (custom_id = 'weaf_marketplace:' || id::text)
  order by created_at desc
  limit 1
  for update;

  if payment.id is null then
    update private.billing_events
    set processed_at = now(), processing_error = 'resource_not_found'
    where provider = 'paypal' and environment = 'sandbox' and event_id = p_event_id;
    return true;
  end if;

  -- Matching one identifier is insufficient: reject mixed identifiers that
  -- point at different payment attempts.
  if (order_id is not null and payment.paypal_order_id is distinct from order_id)
    or (custom_id is not null and custom_id <> 'weaf_marketplace:' || payment.id::text)
    or (
      capture_id is not null
      and payment.paypal_capture_id is not null
      and payment.paypal_capture_id <> capture_id
    )
  then
    raise exception 'marketplace_capture_reconciliation_failed';
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
      -- Identifier consistency was validated above; this is an idempotent late
      -- webhook after API reconciliation and must not grant twice.
      null;
    elsif payment.status = 'failed' then
      raise exception 'marketplace_capture_reconciliation_failed';
    elsif amount_minor <> 300 or currency <> 'USD' then
      update public.marketplace_payments set status = 'failed' where id = payment.id;
      insert into public.marketplace_audit_log(listing_id, payment_id, action, details)
      values (payment.listing_id, payment.id, 'capture_amount_mismatch', jsonb_build_object(
        'expected_minor', 300, 'received_minor', amount_minor,
        'expected_currency', 'USD', 'received_currency', currency
      ));
    else
      update public.marketplace_payments
      set status = 'captured',
          paypal_capture_id = capture_id,
          external_event_id = p_event_id,
          paid_at = event_time
      where id = payment.id and status in ('created', 'approved');
      if not found then
        raise exception 'marketplace_capture_reconciliation_failed';
      end if;

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
    if payment.status in ('captured', 'refunded', 'reversed') then
      insert into public.marketplace_audit_log(listing_id, payment_id, action, details)
      values (payment.listing_id, payment.id, 'stale_denial_ignored', jsonb_build_object('terminal_status', payment.status));
    else
      update public.marketplace_payments
      set status = 'failed', external_event_id = p_event_id
      where id = payment.id and status in ('created', 'approved');
    end if;
    -- A denied attempt never owns an active benefit, so it must not mutate the
    -- listing. A previous successful payment may still be providing featured.

  elsif p_event_type in ('PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED') then
    if payment.paypal_capture_id is null or payment.paypal_capture_id <> capture_id then
      raise exception 'marketplace_capture_reconciliation_failed';
    end if;

    if payment.status = 'captured' then
      update public.marketplace_payments
      set status = case
            when p_event_type = 'PAYMENT.CAPTURE.REFUNDED' then 'refunded'
            else 'reversed'
          end,
          external_event_id = p_event_id
      where id = payment.id and status = 'captured';

      update public.marketplace_listings
      set is_featured = false,
          featured_expires_at = least(featured_expires_at, event_time)
      where id = payment.listing_id and is_featured;
    elsif (p_event_type = 'PAYMENT.CAPTURE.REFUNDED' and payment.status = 'refunded')
       or (p_event_type = 'PAYMENT.CAPTURE.REVERSED' and payment.status = 'reversed') then
      null;
    elsif payment.status in ('refunded', 'reversed') then
      insert into public.marketplace_audit_log(listing_id, payment_id, action, details)
      values (payment.listing_id, payment.id, 'stale_terminal_event_ignored', jsonb_build_object('terminal_status', payment.status));
    else
      raise exception 'marketplace_capture_reconciliation_failed';
    end if;
  end if;

  update private.billing_events
  set processed_at = now(), processing_error = null
  where provider = 'paypal' and environment = 'sandbox' and event_id = p_event_id;
  return true;
end;
$$;

revoke all on function public.process_marketplace_paypal_event(text,text,jsonb,jsonb)
from public, anon, authenticated;
grant execute on function public.process_marketplace_paypal_event(text,text,jsonb,jsonb)
to service_role;

comment on function public.process_marketplace_paypal_event(text,text,jsonb,jsonb) is
  'Server-only, idempotent Sandbox webhook state machine with strict cross-identifier reconciliation and monotonic terminal payment transitions.';
