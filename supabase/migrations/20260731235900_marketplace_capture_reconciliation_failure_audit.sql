-- Audit persistente de fallos de reconciliación del webhook de Marketplace.
--
-- El handler de excepción anterior de process_marketplace_paypal_event intentaba
-- marcar processing_error en private.billing_events dentro de la misma transacción
-- que después aborta con `raise`, por lo que ese UPDATE nunca persistía: un webhook
-- tardío con capture id distinto quedaba sin rastro aunque el webhook respondiera
-- HTTP 500. El test 19 de
-- supabase/tests/marketplace-capture-api-reconciliation.sql pasaba falsamente porque
-- `processing_error <> 'x'` sobre una fila inexistente devuelve NULL (falso).
--
-- Esta migración:
-- 1. reescribe process_marketplace_paypal_event para que el fallo de conciliación
--    se propague (HTTP 500) sin un UPDATE engañoso dentro de la transacción que
--    va a abortar;
-- 2. añade record_marketplace_paypal_event_failure, RPC service_role-only,
--    SECURITY DEFINER, search_path='', idempotente por event_id, que persiste el
--    fallo con el payload real en una segunda transacción desde el webhook antes
--    de devolver 500.

-- 1. Webhook: fallo de conciliación se propaga, no se oculta con UPDATE no persistente.
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
      -- A different capture id is a reconciliation failure: the exception
      -- propagates (HTTP 500) and the webhook persists the failure via
      -- record_marketplace_paypal_event_failure in its own transaction.
      if payment.paypal_capture_id <> p_data->>'capture_id' then
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
end;
$$;

-- 2. Persistencia del fallo en transacción propia desde el webhook.
create or replace function public.record_marketplace_paypal_event_failure(
  p_event_id text,
  p_event_type text,
  p_resource_id text,
  p_payload jsonb,
  p_event_time timestamptz,
  p_processing_error text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 1048576 then
    raise exception 'invalid_event_payload';
  end if;
  if p_processing_error is null or char_length(p_processing_error) not between 1 and 80 then
    raise exception 'invalid_processing_error';
  end if;

  insert into private.billing_events(
    provider, environment, event_id, event_type, resource_id, payload,
    event_created_at, processed_at, processing_error
  ) values (
    'paypal', 'sandbox', p_event_id, p_event_type, p_resource_id, p_payload,
    coalesce(p_event_time, now()), now(), p_processing_error
  )
  on conflict(provider, environment, event_id)
  do update set
    processed_at = now(),
    processing_error = excluded.processing_error;

  return true;
end;
$$;

revoke all on function public.record_marketplace_paypal_event_failure(text,text,text,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_marketplace_paypal_event_failure(text,text,text,jsonb,timestamptz,text) to service_role;

comment on function public.record_marketplace_paypal_event_failure(text,text,text,jsonb,timestamptz,text) is
  'Server-only persistence of a failed Marketplace PayPal webhook event; runs in its own transaction from paypal-webhook before returning HTTP 500, idempotent by event_id, stores the real payload and never touches payment or listing benefits.';
