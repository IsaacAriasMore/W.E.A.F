-- Safely resume an existing Marketplace PayPal Sandbox checkout.
--
-- A browser cancellation is not proof that a PayPal order is terminal, so this
-- migration never changes an attached order. It only returns one compatible
-- created payment to the server-side Edge Function, which then reads the order
-- from PayPal and exposes an approval URL only when PayPal still allows it.

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
  qa_enforced boolean;
  reusable_count integer;
begin
  if p_user_id is null or p_listing_id is null or p_idempotency_key is null then
    raise exception 'invalid_marketplace_order';
  end if;

  select flag.enabled into global_paypal_enabled
  from public.feature_flags flag
  where flag.key = 'paypal_payments'
  for share;
  if coalesce(global_paypal_enabled, false) is not true then
    raise exception 'billing_disabled';
  end if;

  select * into setting
  from public.marketplace_settings
  where key = 'featured_listing'
  for share;
  if coalesce(setting.marketplace_enabled, false) is not true
    or coalesce(setting.payments_enabled, false) is not true
    or setting.price_minor <> 300
    or setting.currency <> 'USD'
    or setting.environment <> 'sandbox'
  then
    raise exception 'marketplace_payments_disabled';
  end if;

  if not private.is_marketplace_payment_qa_allowed(p_user_id) then
    raise exception 'marketplace_qa_access_required';
  end if;

  -- This row lock serializes every checkout attempt for this listing. It is
  -- acquired before looking up or inserting payment attempts, so two browser
  -- tabs with different client idempotency keys cannot create two rows.
  select * into listing
  from public.marketplace_listings
  where id = p_listing_id
    and owner_user_id = p_user_id
  for update;
  if listing.id is null then raise exception 'listing_not_owned'; end if;
  if listing.game <> 'ascended'
    or listing.status <> 'active'
    or listing.expires_at <= now()
  then
    raise exception 'listing_not_available';
  end if;

  -- Preserve the original idempotency contract. A reused response always
  -- carries the original key; the browser never receives or chooses it.
  select * into payment
  from public.marketplace_payments
  where idempotency_key = p_idempotency_key
  for update;
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

  -- An already-featured listing never receives a second benefit. Keeping this
  -- after the original idempotency lookup preserves safe retries of a prior
  -- request without opening a new checkout.
  if listing.is_featured
    or (listing.featured_started_at is not null and listing.featured_expires_at > now())
  then
    raise exception 'marketplace_payment_in_progress';
  end if;

  -- A created payment with a valid attached Sandbox order is the only retryable
  -- state. Terminal, captured, malformed, foreign, and no-order rows remain
  -- closed to reuse and fall through to marketplace_payment_in_progress.
  select count(*) into reusable_count
  from public.marketplace_payments p
  where p.listing_id = p_listing_id
    and p.user_id = p_user_id
    and p.provider = 'paypal'
    and p.environment = 'sandbox'
    and p.status = 'created'
    and p.amount_minor = 300
    and p.currency = 'USD'
    and p.paypal_order_id is not null
    and p.paypal_capture_id is null
    and p.paid_at is null;

  if reusable_count = 1 then
    select * into payment
    from public.marketplace_payments p
    where p.listing_id = p_listing_id
      and p.user_id = p_user_id
      and p.provider = 'paypal'
      and p.environment = 'sandbox'
      and p.status = 'created'
      and p.amount_minor = 300
      and p.currency = 'USD'
      and p.paypal_order_id is not null
      and p.paypal_capture_id is null
      and p.paid_at is null
    for update;

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

  if reusable_count > 1 or exists(
    select 1
    from public.marketplace_payments p
    where p.listing_id = p_listing_id
      and (
        p.status in ('created', 'approved')
        or (p.status = 'captured' and listing.featured_expires_at > now())
      )
  ) then
    raise exception 'marketplace_payment_in_progress';
  end if;

  insert into public.marketplace_payments(
    listing_id, user_id, amount_minor, currency, idempotency_key,
    provider, environment
  ) values (
    p_listing_id, p_user_id, 300, 'USD', p_idempotency_key,
    'paypal', 'sandbox'
  ) returning * into payment;

  select coalesce(q.enforced, true) into qa_enforced
  from private.marketplace_payment_qa_settings q
  where q.key = 'sandbox_allowlist';

  insert into public.marketplace_audit_log(
    listing_id, payment_id, actor_user_id, action, details
  ) values (
    p_listing_id, payment.id, p_user_id, 'paypal_order_prepared',
    jsonb_build_object(
      'amount_minor', 300, 'currency', 'USD', 'environment', 'sandbox',
      'qa_gate_enforced', qa_enforced
    )
  );

  return jsonb_build_object(
    'payment_id', payment.id,
    'amount_minor', 300,
    'currency', 'USD',
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
  'Server-only Marketplace PayPal Sandbox preparation. Reuses exactly one compatible created order for the same owner and listing; all other in-progress states fail closed.';
