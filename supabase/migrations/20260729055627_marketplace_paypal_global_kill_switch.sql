-- Chain marketplace featured orders to the global PayPal checkout flag.
-- Existing captures, webhooks, refunds and reconciliation remain available;
-- only the creation of NEW marketplace payments is blocked.

create or replace function public.prepare_marketplace_paypal_order(
  p_user_id uuid,
  p_listing_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.marketplace_listings%rowtype;
  setting public.marketplace_settings%rowtype;
  payment public.marketplace_payments%rowtype;
  global_paypal_enabled boolean;
begin
  if p_user_id is null or p_listing_id is null or p_idempotency_key is null then
    raise exception 'invalid_marketplace_order';
  end if;

  select flag.enabled
    into global_paypal_enabled
    from public.feature_flags flag
    where flag.key = 'paypal_payments'
    for share;

  if coalesce(global_paypal_enabled, false) is not true then
    raise exception 'billing_disabled';
  end if;

  select *
    into setting
    from public.marketplace_settings
    where key = 'featured_listing'
    for share;

  if coalesce(setting.marketplace_enabled, false) is not true
    or coalesce(setting.payments_enabled, false) is not true
    or setting.price_minor is null
    or setting.price_minor <= 0
    or setting.environment <> 'sandbox'
  then
    raise exception 'marketplace_payments_disabled';
  end if;

  select *
    into listing
    from public.marketplace_listings
    where id = p_listing_id
      and owner_user_id = p_user_id
    for update;

  if listing.id is null then raise exception 'listing_not_owned'; end if;
  if listing.status <> 'active' or listing.expires_at <= now() then
    raise exception 'listing_not_available';
  end if;

  select *
    into payment
    from public.marketplace_payments
    where idempotency_key = p_idempotency_key;

  if payment.id is not null then
    if payment.user_id <> p_user_id or payment.listing_id <> p_listing_id then
      raise exception 'idempotency_conflict';
    end if;
    return jsonb_build_object(
      'payment_id', payment.id,
      'amount_minor', payment.amount_minor,
      'currency', payment.currency,
      'custom_id', 'weaf_marketplace:' || payment.id::text,
      'paypal_order_id', payment.paypal_order_id,
      'existing', true,
      'idempotency_key', payment.idempotency_key
    );
  end if;

  if exists (
    select 1
    from public.marketplace_payments
    where listing_id = p_listing_id
      and status in ('created', 'approved', 'captured')
  ) then
    raise exception 'marketplace_payment_in_progress';
  end if;

  insert into public.marketplace_payments(
    listing_id,
    user_id,
    amount_minor,
    currency,
    idempotency_key
  ) values (
    p_listing_id,
    p_user_id,
    setting.price_minor,
    setting.currency,
    p_idempotency_key
  )
  returning * into payment;

  insert into public.marketplace_audit_log(
    listing_id,
    payment_id,
    actor_user_id,
    action,
    details
  ) values (
    p_listing_id,
    payment.id,
    p_user_id,
    'paypal_order_prepared',
    jsonb_build_object(
      'amount_minor', payment.amount_minor,
      'currency', payment.currency,
      'environment', 'sandbox'
    )
  );

  return jsonb_build_object(
    'payment_id', payment.id,
    'amount_minor', payment.amount_minor,
    'currency', payment.currency,
    'custom_id', 'weaf_marketplace:' || payment.id::text,
    'paypal_order_id', null,
    'existing', false,
    'idempotency_key', payment.idempotency_key
  );
end;
$$;

revoke all on function public.prepare_marketplace_paypal_order(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_marketplace_paypal_order(uuid, uuid, uuid)
  to service_role;

comment on function public.prepare_marketplace_paypal_order(uuid, uuid, uuid) is
  'Creates a Sandbox marketplace payment only when both global and marketplace payment switches are enabled.';
