-- Compensatory migration: schedule featured benefit expiration via pg_cron,
-- and fix qa_gate_enforced audit-log value in prepare_marketplace_paypal_order.

-- =============================================================================
-- 1. Schedule expire_marketplace_featured_benefits() every hour via pg_cron
-- =============================================================================
-- pg_cron already enabled by 20260721234229_phase_7_stripe_checkout.sql
do $$ begin
  if exists(select 1 from cron.job where jobname='expire-marketplace-featured-benefits') then
    perform cron.unschedule('expire-marketplace-featured-benefits');
  end if;
  perform cron.schedule(
    'expire-marketplace-featured-benefits',
    '0 * * * *',
    'select public.expire_marketplace_featured_benefits();'
  );
end $$;

-- =============================================================================
-- 2. Fix prepare_marketplace_paypal_order: log real qa_gate_enforced value
-- =============================================================================
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

  select * into payment
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

  if exists(
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

  -- Capture actual qa_gate_enforced value from settings
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
  'Requires both kill switches, Sandbox, exact USD 3 server price, ownership, ASA and the optional private QA gate.';

comment on column public.marketplace_listings.is_featured is
  'Set to true after payment capture; reset to false by cron when featured_expires_at <= now().';
