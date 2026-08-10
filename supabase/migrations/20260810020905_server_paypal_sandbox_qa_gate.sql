-- Server-only gate for controlled PayPal Sandbox subscription QA.
--
-- This is deliberately independent from the Marketplace QA configuration.
-- It never enables checkout by itself: the global paypal_payments kill switch
-- remains the first authoritative gate. The setting starts disabled and the
-- allowlist must match both the owner and one exact server listing.

create table private.server_paypal_qa_settings (
  key text primary key check (key = 'sandbox_allowlist'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table private.server_paypal_qa_allowlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  server_listing_id uuid not null references public.server_listings(id) on delete cascade,
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 200),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, server_listing_id)
);

insert into private.server_paypal_qa_settings (key, enabled)
values ('sandbox_allowlist', false);

create trigger set_server_paypal_qa_settings_updated_at
before update on private.server_paypal_qa_settings
for each row execute function private.set_updated_at();

create trigger set_server_paypal_qa_allowlist_updated_at
before update on private.server_paypal_qa_allowlist
for each row execute function private.set_updated_at();

alter table private.server_paypal_qa_settings enable row level security;
alter table private.server_paypal_qa_allowlist enable row level security;

revoke all on table
  private.server_paypal_qa_settings,
  private.server_paypal_qa_allowlist
from public, anon, authenticated, service_role;

create or replace function private.is_server_paypal_sandbox_qa_allowed(
  p_user_id uuid,
  p_server_listing_id uuid,
  p_environment text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  qa_enabled boolean;
begin
  if p_user_id is null
    or p_server_listing_id is null
    or p_environment is distinct from 'sandbox'
  then
    return false;
  end if;

  select settings.enabled
  into qa_enabled
  from private.server_paypal_qa_settings settings
  where settings.key = 'sandbox_allowlist'
  for share;

  if coalesce(qa_enabled, false) is not true then
    return false;
  end if;

  perform 1
  from private.server_paypal_qa_allowlist allowlist
  where allowlist.user_id = p_user_id
    and allowlist.server_listing_id = p_server_listing_id
    and allowlist.active
  for share;

  return found;
end;
$$;

revoke all on function private.is_server_paypal_sandbox_qa_allowed(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.prepare_paypal_subscription(
  p_user_id uuid,
  p_listing_id uuid,
  p_plan_version_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.server_listings%rowtype;
  selected record;
  existing public.billing_subscriptions%rowtype;
  new_subscription_id uuid;
  external_plan text;
  custom_value text;
  requested_environment text;
  global_paypal_enabled boolean;
begin
  if p_user_id is null
    or p_listing_id is null
    or p_plan_version_id is null
    or p_idempotency_key is null
  then
    raise exception 'invalid_subscription_request';
  end if;

  -- Gate 1: the global kill switch is always authoritative.
  select flag.enabled
  into global_paypal_enabled
  from public.feature_flags flag
  where flag.key = 'paypal_payments'
  for share;

  if coalesce(global_paypal_enabled, false) is not true then
    raise exception 'billing_disabled';
  end if;

  -- Gate 2: this QA-only route must never authorize a Live plan.
  select version.environment
  into requested_environment
  from public.billing_plan_versions version
  where version.id = p_plan_version_id;

  if requested_environment is null then
    raise exception 'plan_not_available';
  end if;

  if requested_environment <> 'sandbox' then
    raise exception 'paypal_sandbox_required';
  end if;

  -- Gate 3: preserve ownership, listing, catalog and offer checks.
  select *
  into listing
  from public.server_listings
  where id = p_listing_id
    and owner_user_id = p_user_id
  for update;

  if listing.id is null or listing.billing_source = 'manual' then
    raise exception 'listing_not_available';
  end if;

  select
    version.*,
    plan.tier,
    offer.status as offer_status,
    offer.acquisition_starts_at,
    offer.acquisition_ends_at,
    offer.subscription_limit,
    offer.used_count,
    offer.new_customers_only
  into selected
  from public.billing_plan_versions version
  join public.billing_plans plan
    on plan.id = version.plan_id
    and plan.is_active
  left join public.billing_offers offer
    on offer.id = version.offer_id
  where version.id = p_plan_version_id
    and version.environment = 'sandbox'
    and version.sync_status = 'synced'
    and upper(coalesce(version.provider_status, '')) = 'ACTIVE';

  if selected.id is null then
    raise exception 'plan_not_available';
  end if;

  external_plan := selected.external_plan_id_sandbox;
  if external_plan is null then
    raise exception 'paypal_plan_not_synced';
  end if;

  -- Gate 4: exact private QA allowlist. This happens before every read that
  -- could return a retryable checkout and before any subscription insert.
  if not private.is_server_paypal_sandbox_qa_allowed(
    p_user_id,
    p_listing_id,
    requested_environment
  ) then
    raise exception 'server_paypal_qa_access_required';
  end if;

  if exists (
    select 1
    from public.billing_subscriptions subscription
    where subscription.server_listing_id = p_listing_id
      and subscription.status in (
        'pending',
        'approval_pending',
        'active',
        'suspended',
        'cancellation_pending'
      )
  ) then
    select *
    into existing
    from public.billing_subscriptions subscription
    where subscription.server_listing_id = p_listing_id
      and subscription.checkout_idempotency_key = p_idempotency_key
    limit 1;

    if existing.id is not null then
      return jsonb_build_object(
        'subscription_id', existing.id,
        'existing', true,
        'external_subscription_id', existing.external_subscription_id
      );
    end if;

    raise exception 'listing_already_subscribed';
  end if;

  if selected.offer_id is not null
    and (
      selected.offer_status <> 'active'
      or (
        selected.acquisition_starts_at is not null
        and selected.acquisition_starts_at > now()
      )
      or (
        selected.acquisition_ends_at is not null
        and selected.acquisition_ends_at <= now()
      )
      or (
        selected.subscription_limit is not null
        and (
          select count(*)
          from public.billing_subscriptions reserved
          where reserved.offer_id = selected.offer_id
            and reserved.status in (
              'pending',
              'approval_pending',
              'active',
              'suspended',
              'cancellation_pending'
            )
        ) >= selected.subscription_limit
      )
    )
  then
    raise exception 'offer_not_available';
  end if;

  if selected.new_customers_only
    and exists (
      select 1
      from public.billing_subscriptions subscription
      where subscription.user_id = p_user_id
        and subscription.status in (
          'active',
          'cancelled',
          'expired',
          'refunded',
          'reversed'
        )
    )
  then
    raise exception 'new_customers_only';
  end if;

  custom_value := p_user_id::text
    || ':' || p_listing_id::text
    || ':' || p_plan_version_id::text;

  insert into public.billing_subscriptions(
    user_id,
    server_listing_id,
    plan_version_id,
    offer_id,
    payment_provider,
    environment,
    checkout_idempotency_key,
    custom_id,
    status,
    currency,
    price_minor,
    auto_renew
  )
  values (
    p_user_id,
    p_listing_id,
    p_plan_version_id,
    selected.offer_id,
    'paypal',
    'sandbox',
    p_idempotency_key,
    custom_value,
    'pending',
    selected.currency,
    selected.promotional_price_minor,
    selected.auto_renew
  )
  returning id into new_subscription_id;

  update public.server_listings
  set
    plan = selected.tier::public.listing_plan,
    status = 'pending_payment',
    payment_status = 'pending',
    billing_source = 'paypal',
    payment_provider = 'paypal',
    billing_subscription_id = new_subscription_id,
    billing_plan_version_id = p_plan_version_id,
    external_plan_id = external_plan,
    is_featured = false,
    updated_at = now()
  where id = p_listing_id;

  return jsonb_build_object(
    'subscription_id', new_subscription_id,
    'existing', false,
    'paypal_plan_id', external_plan,
    'custom_id', custom_value,
    'tier', selected.tier,
    'currency', selected.currency,
    'price_minor', selected.promotional_price_minor
  );
exception
  when unique_violation then
    select *
    into existing
    from public.billing_subscriptions subscription
    where subscription.payment_provider = 'paypal'
      and subscription.checkout_idempotency_key = p_idempotency_key;

    if existing.user_id = p_user_id
      and existing.server_listing_id = p_listing_id
    then
      return jsonb_build_object(
        'subscription_id', existing.id,
        'existing', true,
        'external_subscription_id', existing.external_subscription_id
      );
    end if;

    raise;
end;
$$;

revoke all on function public.prepare_paypal_subscription(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_paypal_subscription(uuid, uuid, uuid, uuid)
  to service_role;

comment on table private.server_paypal_qa_settings is
  'Server-only switch for a controlled PayPal Sandbox Servers QA window. Defaults fail-closed.';
comment on table private.server_paypal_qa_allowlist is
  'Server-only exact user/listing allowlist for controlled PayPal Sandbox Servers QA.';
comment on function private.is_server_paypal_sandbox_qa_allowed(uuid, uuid, text) is
  'Fails closed unless the private Servers Sandbox QA gate is explicitly enabled and both user and listing match.';
comment on function public.prepare_paypal_subscription(uuid, uuid, uuid, uuid) is
  'Server-only PayPal Sandbox preparation. Requires global kill switch, sandbox plan, ownership/catalog checks and exact Servers QA allowlist before inserting.';
