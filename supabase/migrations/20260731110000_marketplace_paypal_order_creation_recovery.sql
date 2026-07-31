-- Recovery for Marketplace PayPal order-creation failures (502 paypal_approval_url_missing).
-- A preparation inserts the payment row BEFORE calling PayPal. If the Edge Function
-- fails before a PayPal order id is returned (OAuth/network/API/approval-url missing),
-- the row stays status=created with no order attached and blocks retries for the listing.
-- This RPC closes such a stuck, locally-only preparation to failed so a new attempt
-- with a different idempotency key becomes possible.
-- It never touches approved/captured/refunded/reversed payments, never modifies rows
-- with a PayPal order/capture already attached, never deletes data, and is usable
-- only by service_role (called from the Edge Function, not by anon/authenticated).

create or replace function public.fail_marketplace_paypal_order_creation(
  p_payment_id uuid,
  p_user_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.marketplace_payments%rowtype;
  reason_safe text;
begin
  if p_payment_id is null or p_user_id is null then
    raise exception 'invalid_marketplace_order';
  end if;

  select * into payment
  from public.marketplace_payments
  where id = p_payment_id
    and user_id = p_user_id
  for update;

  if payment.id is null then
    return false;
  end if;

  if payment.status <> 'created'
    or payment.paypal_order_id is not null
    or payment.paypal_capture_id is not null
    or payment.paid_at is not null
  then
    return false;
  end if;

  reason_safe := left(
    regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g'),
    80
  );
  if reason_safe = '' then
    reason_safe := 'order_creation_failed';
  end if;

  update public.marketplace_payments
  set status = 'failed'
  where id = p_payment_id;

  insert into public.marketplace_audit_log(
    listing_id, payment_id, actor_user_id, action, details
  ) values (
    payment.listing_id, payment.id, p_user_id, 'paypal_order_creation_failed',
    jsonb_build_object(
      'reason', reason_safe,
      'environment', 'sandbox',
      'previous_status', 'created'
    )
  );

  return true;
end;
$$;

revoke all on function public.fail_marketplace_paypal_order_creation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_marketplace_paypal_order_creation(uuid, uuid, text)
  to service_role;

comment on function public.fail_marketplace_paypal_order_creation(uuid, uuid, text) is
  'Server-only closure of a Marketplace PayPal order-creation attempt stuck in created without an attached PayPal order; writes sanitized audit only, never deletes.';
