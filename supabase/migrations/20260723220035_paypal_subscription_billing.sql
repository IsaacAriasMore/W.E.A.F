-- Provider-neutral billing catalog and PayPal Sandbox subscription lifecycle.
-- Stripe columns and historical tables remain intact for reconciliation and rollback.

alter table public.server_listings
  drop constraint if exists server_listings_billing_source_check;
alter table public.server_listings
  add constraint server_listings_billing_source_check
  check (billing_source in ('paypal', 'stripe', 'manual'));

alter table public.server_listings
  add column if not exists payment_provider text not null default 'stripe'
    check (payment_provider in ('paypal', 'stripe', 'manual')),
  add column if not exists billing_subscription_id uuid,
  add column if not exists billing_plan_version_id uuid,
  add column if not exists external_product_id text,
  add column if not exists external_plan_id text,
  add column if not exists external_subscription_id text,
  add column if not exists external_payment_id text,
  add column if not exists external_customer_id text,
  add column if not exists billing_failure_reason text,
  add column if not exists billing_environment text not null default 'sandbox'
    check (billing_environment in ('sandbox', 'live'));

update public.server_listings
set payment_provider = case when billing_source = 'manual' then 'manual' else 'stripe' end;

create table public.billing_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 2 and 127),
  description text not null default '' check (char_length(description) <= 256),
  provider text not null default 'paypal' check (provider in ('paypal', 'stripe', 'manual')),
  external_product_id_sandbox text,
  external_product_id_live text,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'syncing', 'synced', 'failed', 'retired')),
  last_sync_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.billing_products(id) on delete restrict,
  code text not null unique check (code in ('normal', 'plus')),
  name text not null,
  description text not null default '',
  tier text not null check (tier in ('normal', 'plus')),
  base_price_minor integer not null check (base_price_minor > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_offers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 127),
  description text not null default '' check (char_length(description) <= 1000),
  acquisition_starts_at timestamptz,
  acquisition_ends_at timestamptz,
  subscription_limit integer check (subscription_limit is null or subscription_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  new_customers_only boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'withdrawn', 'expired')),
  current_version_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (acquisition_ends_at is null or acquisition_starts_at is null or acquisition_ends_at > acquisition_starts_at)
);

create table public.billing_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  offer_id uuid references public.billing_offers(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'live')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  base_price_minor integer not null check (base_price_minor > 0),
  promotional_price_minor integer not null check (promotional_price_minor > 0),
  discount_type text not null default 'none' check (discount_type in ('none', 'percentage', 'fixed_amount', 'custom_price')),
  discount_percentage numeric(5,2) check (discount_percentage is null or discount_percentage between 0.01 and 100),
  discount_amount_minor integer check (discount_amount_minor is null or discount_amount_minor > 0),
  frequency_unit text not null default 'MONTH' check (frequency_unit in ('DAY', 'WEEK', 'MONTH', 'YEAR')),
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  benefit_cycles integer check (benefit_cycles is null or benefit_cycles between 1 and 999),
  total_cycles integer check (total_cycles is null or total_cycles between 1 and 999),
  auto_renew boolean not null default true,
  end_behavior text not null default 'base_price' check (end_behavior in ('expire', 'same_price', 'base_price')),
  external_plan_id_sandbox text,
  external_plan_id_live text,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'syncing', 'synced', 'failed', 'inactive')),
  provider_status text,
  last_sync_error text,
  synced_at timestamptz,
  terms_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (plan_id, offer_id, version_number, environment)
);

alter table public.billing_offers
  add constraint billing_offers_current_version_fk
  foreign key (current_version_id) references public.billing_plan_versions(id) on delete restrict;

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  server_listing_id uuid not null references public.server_listings(id) on delete restrict,
  plan_version_id uuid not null references public.billing_plan_versions(id) on delete restrict,
  offer_id uuid references public.billing_offers(id) on delete restrict,
  payment_provider text not null check (payment_provider in ('paypal', 'stripe', 'manual')),
  environment text not null check (environment in ('sandbox', 'live')),
  external_subscription_id text,
  external_customer_id text,
  checkout_idempotency_key uuid not null,
  custom_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approval_pending', 'active', 'suspended', 'cancellation_pending', 'cancelled', 'expired', 'failed', 'refunded', 'reversed')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price_minor integer not null check (price_minor > 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_time timestamptz,
  auto_renew boolean not null,
  completed_cycles integer not null default 0 check (completed_cycles >= 0),
  cancellation_reason text,
  failure_reason text,
  provider_updated_at timestamptz,
  last_reconciled_at timestamptz,
  reconciliation_failures integer not null default 0 check (reconciliation_failures >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_provider, checkout_idempotency_key),
  unique (payment_provider, external_subscription_id)
);

alter table public.server_listings
  add constraint server_listings_billing_subscription_fk foreign key (billing_subscription_id) references public.billing_subscriptions(id) on delete set null,
  add constraint server_listings_billing_plan_version_fk foreign key (billing_plan_version_id) references public.billing_plan_versions(id) on delete set null;

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.billing_subscriptions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  server_listing_id uuid not null references public.server_listings(id) on delete restrict,
  payment_provider text not null check (payment_provider in ('paypal', 'stripe', 'manual')),
  external_payment_id text,
  external_event_id text,
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded', 'reversed', 'cancelled')),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  failure_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_provider, external_payment_id),
  unique (payment_provider, external_event_id)
);

create table private.billing_events (
  provider text not null check (provider in ('paypal', 'stripe', 'manual')),
  environment text not null check (environment in ('sandbox', 'live')),
  event_id text not null,
  event_type text not null,
  resource_id text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  event_created_at timestamptz,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  primary key (provider, environment, event_id)
);

create table private.billing_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  offer_id uuid references public.billing_offers(id) on delete set null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index billing_versions_public_idx on public.billing_plan_versions(environment, sync_status, plan_id);
create index billing_offers_window_idx on public.billing_offers(status, acquisition_starts_at, acquisition_ends_at);
create index billing_subscriptions_user_idx on public.billing_subscriptions(user_id, created_at desc);
create index billing_subscriptions_listing_idx on public.billing_subscriptions(server_listing_id, updated_at desc);
create index billing_subscriptions_reconcile_idx on public.billing_subscriptions(payment_provider, environment, status, last_reconciled_at);
create index billing_payments_subscription_idx on public.billing_payments(subscription_id, created_at desc);
create unique index billing_subscription_one_open_listing_idx on public.billing_subscriptions(server_listing_id)
  where status in ('pending', 'approval_pending', 'active', 'suspended', 'cancellation_pending');

alter table public.billing_products enable row level security;
alter table public.billing_plans enable row level security;
alter table public.billing_offers enable row level security;
alter table public.billing_plan_versions enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table private.billing_events enable row level security;
alter table private.billing_audit_log enable row level security;

create policy billing_subscriptions_owner_read on public.billing_subscriptions for select to authenticated
using (user_id = (select auth.uid()) or private.is_global_admin());
create policy billing_payments_owner_read on public.billing_payments for select to authenticated
using (user_id = (select auth.uid()) or private.is_global_admin());

revoke all on public.billing_products, public.billing_plans, public.billing_offers, public.billing_plan_versions from public, anon, authenticated;
revoke all on public.billing_subscriptions, public.billing_payments from public, anon, authenticated;
grant select on public.billing_subscriptions, public.billing_payments to authenticated;
revoke all on private.billing_events, private.billing_audit_log from public, anon, authenticated;

insert into public.billing_products(code, name, description, provider)
values ('server_listing', 'W.E.A.F Server Listings', 'Monthly and fixed-duration server listing subscriptions.', 'paypal')
on conflict (code) do update set name = excluded.name, description = excluded.description, updated_at = now();

insert into public.billing_plans(product_id, code, name, description, tier, base_price_minor, currency, features)
select product.id, seed.code, seed.name, seed.description, seed.tier, seed.price, 'USD', seed.features
from public.billing_products product
cross join (values
  ('normal', 'Normal', 'Visible server listing without featured placement.', 'normal', 300, '["Full listing","Edit while active","Click analytics"]'::jsonb),
  ('plus', 'Plus', 'Featured server listing with internal promotion.', 'plus', 700, '["Everything in Normal","Featured placement","Internal promotion"]'::jsonb)
) seed(code, name, description, tier, price, features)
where product.code = 'server_listing'
on conflict (code) do update set base_price_minor = excluded.base_price_minor, currency = excluded.currency,
  features = excluded.features, is_active = true, updated_at = now();

insert into public.billing_plan_versions(plan_id, version_number, environment, currency, base_price_minor,
  promotional_price_minor, discount_type, frequency_unit, interval_count, auto_renew, end_behavior,
  terms_snapshot)
select plan.id, 1, 'sandbox', plan.currency, plan.base_price_minor, plan.base_price_minor, 'none', 'MONTH', 1,
  true, 'same_price', jsonb_build_object('tier', plan.tier, 'base', true)
from public.billing_plans plan
where not exists (
  select 1 from public.billing_plan_versions version
  where version.plan_id = plan.id and version.offer_id is null and version.version_number = 1 and version.environment = 'sandbox'
);

create or replace function public.get_public_billing_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plans', coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.price_minor) from (
      select plan.id, plan.code, plan.name, plan.description, plan.tier, plan.features,
        version.id as plan_version_id, version.currency, version.promotional_price_minor as price_minor,
        version.base_price_minor, version.frequency_unit, version.interval_count, version.total_cycles,
        version.auto_renew, version.end_behavior, null::uuid as offer_id, null::text as offer_name,
        null::timestamptz as acquisition_ends_at
      from public.billing_plans plan
      join public.billing_plan_versions version on version.plan_id = plan.id and version.offer_id is null
      where plan.is_active and version.environment = 'sandbox' and version.sync_status = 'synced'
    ) row_data), '[]'::jsonb),
    'offers', coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.price_minor) from (
      select plan.id, plan.code, plan.name, plan.description, plan.tier, plan.features,
        version.id as plan_version_id, version.currency, version.promotional_price_minor as price_minor,
        version.base_price_minor, version.frequency_unit, version.interval_count, version.total_cycles,
        version.benefit_cycles, version.auto_renew, version.end_behavior, offer.id as offer_id,
        offer.name as offer_name, offer.description as offer_description, offer.acquisition_ends_at,
        offer.subscription_limit, offer.used_count, offer.new_customers_only
      from public.billing_offers offer
      join public.billing_plan_versions version on version.id = offer.current_version_id
      join public.billing_plans plan on plan.id = offer.plan_id
      where offer.status in ('active','scheduled') and version.environment = 'sandbox' and version.sync_status = 'synced'
        and (offer.acquisition_starts_at is null or offer.acquisition_starts_at <= now())
        and (offer.acquisition_ends_at is null or offer.acquisition_ends_at > now())
        and (offer.subscription_limit is null or offer.used_count < offer.subscription_limit)
    ) row_data), '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_billing_catalog() from public;
grant execute on function public.get_public_billing_catalog() to anon, authenticated;

create or replace function public.save_paypal_server_listing_draft(p_listing_id uuid, p_plan_type text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid;
begin
  result_id := public.save_server_listing_draft(p_listing_id, p_plan_type, p_payload);
  update public.server_listings set billing_source = 'paypal', payment_provider = 'paypal', billing_environment = 'sandbox',
    stripe_checkout_session_id = null, stripe_price_id = null, updated_at = now()
  where id = result_id and owner_user_id = (select auth.uid()) and billing_source <> 'manual'
    and status <> 'active';
  return result_id;
end;
$$;

create or replace function public.prepare_paypal_subscription(
  p_user_id uuid, p_listing_id uuid, p_plan_version_id uuid, p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare listing public.server_listings%rowtype; selected record; existing public.billing_subscriptions%rowtype;
  new_subscription_id uuid; external_plan text; custom_value text;
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_user_id is null or p_listing_id is null or p_plan_version_id is null or p_idempotency_key is null then raise exception 'invalid_subscription_request'; end if;
  select * into listing from public.server_listings where id = p_listing_id and owner_user_id = p_user_id for update;
  if listing.id is null or listing.billing_source = 'manual' then raise exception 'listing_not_available'; end if;
  if exists (select 1 from public.billing_subscriptions where server_listing_id = p_listing_id
    and status in ('pending','approval_pending','active','suspended','cancellation_pending')) then
    select * into existing from public.billing_subscriptions where server_listing_id = p_listing_id
      and checkout_idempotency_key = p_idempotency_key limit 1;
    if existing.id is not null then
      return jsonb_build_object('subscription_id', existing.id, 'existing', true, 'external_subscription_id', existing.external_subscription_id);
    end if;
    raise exception 'listing_already_subscribed';
  end if;
  select version.*, plan.tier, offer.status as offer_status, offer.acquisition_starts_at, offer.acquisition_ends_at,
    offer.subscription_limit, offer.used_count, offer.new_customers_only
  into selected from public.billing_plan_versions version
  join public.billing_plans plan on plan.id = version.plan_id and plan.is_active
  left join public.billing_offers offer on offer.id = version.offer_id
  where version.id = p_plan_version_id and version.environment = 'sandbox' and version.sync_status = 'synced';
  if selected.id is null then raise exception 'plan_not_available'; end if;
  external_plan := selected.external_plan_id_sandbox;
  if external_plan is null then raise exception 'paypal_plan_not_synced'; end if;
  if selected.offer_id is not null and (selected.offer_status <> 'active'
    or (selected.acquisition_starts_at is not null and selected.acquisition_starts_at > now())
    or (selected.acquisition_ends_at is not null and selected.acquisition_ends_at <= now())
    or (selected.subscription_limit is not null and (
      select count(*) from public.billing_subscriptions reserved
      where reserved.offer_id=selected.offer_id and reserved.status in ('pending','approval_pending','active','suspended','cancellation_pending')
    ) >= selected.subscription_limit)) then raise exception 'offer_not_available'; end if;
  if selected.new_customers_only and exists (select 1 from public.billing_subscriptions where user_id = p_user_id and status in ('active','cancelled','expired','refunded','reversed')) then raise exception 'new_customers_only'; end if;
  custom_value := p_user_id::text || ':' || p_listing_id::text || ':' || p_plan_version_id::text;
  insert into public.billing_subscriptions(user_id, server_listing_id, plan_version_id, offer_id,
    payment_provider, environment, checkout_idempotency_key, custom_id, status, currency, price_minor, auto_renew)
  values (p_user_id, p_listing_id, p_plan_version_id, selected.offer_id, 'paypal', 'sandbox', p_idempotency_key,
    custom_value, 'pending', selected.currency, selected.promotional_price_minor, selected.auto_renew)
  returning id into new_subscription_id;
  update public.server_listings set plan = selected.tier::public.listing_plan, status = 'pending_payment', payment_status = 'pending',
    billing_source = 'paypal', payment_provider = 'paypal', billing_subscription_id = new_subscription_id,
    billing_plan_version_id = p_plan_version_id, external_plan_id = external_plan, is_featured = false, updated_at = now()
  where id = p_listing_id;
  return jsonb_build_object('subscription_id', new_subscription_id, 'existing', false, 'paypal_plan_id', external_plan,
    'custom_id', custom_value, 'tier', selected.tier, 'currency', selected.currency,
    'price_minor', selected.promotional_price_minor);
exception when unique_violation then
  select * into existing from public.billing_subscriptions where payment_provider = 'paypal' and checkout_idempotency_key = p_idempotency_key;
  if existing.user_id = p_user_id and existing.server_listing_id = p_listing_id then
    return jsonb_build_object('subscription_id', existing.id, 'existing', true, 'external_subscription_id', existing.external_subscription_id);
  end if;
  raise;
end;
$$;

create or replace function public.attach_paypal_subscription(p_subscription_id uuid, p_user_id uuid, p_external_subscription_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_external_subscription_id !~ '^[A-Z0-9-]{8,64}$' then raise exception 'invalid_paypal_subscription'; end if;
  update public.billing_subscriptions set external_subscription_id = p_external_subscription_id,
    status = 'approval_pending', updated_at = now()
  where id = p_subscription_id and user_id = p_user_id and payment_provider = 'paypal' and status = 'pending';
  if not found then raise exception 'subscription_not_available'; end if;
  update public.server_listings set external_subscription_id = p_external_subscription_id, updated_at = now()
  where billing_subscription_id = p_subscription_id and owner_user_id = p_user_id;
end;
$$;

create or replace function public.process_paypal_billing_event(p_event_id text, p_event_type text, p_data jsonb, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target public.billing_subscriptions%rowtype; event_time timestamptz; payment_inserted boolean := false;
  external_sub text := nullif(p_data->>'subscription_id',''); external_payment text := nullif(p_data->>'payment_id','');
  amount_minor integer := greatest(coalesce((p_data->>'amount_minor')::integer, 0), 0);
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_event_id is null or char_length(p_event_id) > 128 or char_length(p_event_type) > 120
    or jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 1048576 then raise exception 'invalid_paypal_event'; end if;
  event_time := coalesce(nullif(p_data->>'event_time','')::timestamptz, now());
  insert into private.billing_events(provider, environment, event_id, event_type, resource_id, payload, event_created_at)
  values ('paypal','sandbox',p_event_id,p_event_type,coalesce(external_sub,external_payment),p_payload,event_time)
  on conflict do nothing;
  if not found then return false; end if;
  if external_sub is not null then select * into target from public.billing_subscriptions where payment_provider='paypal' and external_subscription_id=external_sub for update; end if;
  if target.id is null and external_payment is not null then
    select subscription.* into target from public.billing_payments payment join public.billing_subscriptions subscription on subscription.id=payment.subscription_id
    where payment.payment_provider='paypal' and payment.external_payment_id=external_payment for update of subscription;
  end if;
  if target.id is null and nullif(p_data->>'custom_id','') is not null then
    select * into target from public.billing_subscriptions
    where payment_provider='paypal' and custom_id=p_data->>'custom_id' for update;
    if target.id is not null and external_sub is not null and target.external_subscription_id is null then
      update public.billing_subscriptions set external_subscription_id=external_sub,updated_at=now() where id=target.id;
      update public.server_listings set external_subscription_id=external_sub,updated_at=now() where id=target.server_listing_id;
    end if;
  end if;
  if target.id is null then
    update private.billing_events set processing_error='subscription_not_found' where provider='paypal' and environment='sandbox' and event_id=p_event_id;
    return true;
  end if;

  if p_event_type = 'BILLING.SUBSCRIPTION.CREATED' then
    update public.billing_subscriptions set status='approval_pending', provider_updated_at=greatest(coalesce(provider_updated_at,event_time),event_time), updated_at=now()
    where id=target.id and status='pending';
  elsif p_event_type in ('BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.UPDATED') then
    update public.billing_subscriptions set status=case when status in ('cancelled','expired','refunded','reversed') then status else 'active' end,
      next_billing_time=nullif(p_data->>'next_billing_time','')::timestamptz,
      provider_updated_at=greatest(coalesce(provider_updated_at,event_time),event_time), updated_at=now()
    where id=target.id and (provider_updated_at is null or event_time >= provider_updated_at);
  elsif p_event_type = 'PAYMENT.SALE.COMPLETED' then
    insert into public.billing_payments(subscription_id,user_id,server_listing_id,payment_provider,external_payment_id,external_event_id,status,amount_minor,currency,paid_at)
    values(target.id,target.user_id,target.server_listing_id,'paypal',external_payment,p_event_id,'paid',amount_minor,coalesce(nullif(p_data->>'currency',''),target.currency),event_time)
    on conflict do nothing;
    payment_inserted := found;
    if payment_inserted and (target.provider_updated_at is null or event_time >= target.provider_updated_at)
      and target.status not in ('cancelled','suspended','expired','refunded','reversed') then
      update public.billing_subscriptions set status='active', completed_cycles=completed_cycles+1,
        current_period_start=coalesce(current_period_start,event_time), next_billing_time=nullif(p_data->>'next_billing_time','')::timestamptz,
        current_period_end=coalesce(nullif(p_data->>'next_billing_time','')::timestamptz, current_period_end),
        provider_updated_at=event_time, updated_at=now() where id=target.id;
      update public.server_listings listing set status='active', payment_status='paid', starts_at=coalesce(starts_at,event_time),
        expires_at=coalesce(nullif(p_data->>'next_billing_time','')::timestamptz,expires_at), current_period_end=coalesce(nullif(p_data->>'next_billing_time','')::timestamptz,current_period_end),
        external_payment_id=external_payment, is_featured=listing.plan='plus', billing_failure_reason=null, updated_at=now()
      where id=target.server_listing_id and billing_source='paypal' and status<>'rejected';
      update public.billing_offers set used_count=used_count+1,updated_at=now() where id=target.offer_id;
    end if;
  elsif p_event_type in ('BILLING.SUBSCRIPTION.PAYMENT.FAILED','BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.EXPIRED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED') then
    update public.billing_subscriptions set status=case p_event_type
      when 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' then 'failed' when 'BILLING.SUBSCRIPTION.CANCELLED' then 'cancelled'
      when 'BILLING.SUBSCRIPTION.SUSPENDED' then 'suspended' when 'BILLING.SUBSCRIPTION.EXPIRED' then 'expired'
      when 'PAYMENT.SALE.REFUNDED' then 'refunded' else 'reversed' end,
      failure_reason=nullif(p_data->>'reason',''),provider_updated_at=event_time,updated_at=now()
    where id=target.id and (provider_updated_at is null or event_time >= provider_updated_at);
    if found then
      update public.server_listings set status=case when p_event_type='BILLING.SUBSCRIPTION.CANCELLED' then 'canceled'::public.listing_status
        when p_event_type='BILLING.SUBSCRIPTION.EXPIRED' then 'expired'::public.listing_status else 'paused'::public.listing_status end,
        payment_status=case when p_event_type='BILLING.SUBSCRIPTION.CANCELLED' then 'canceled'::public.payment_status
          when p_event_type='PAYMENT.SALE.REFUNDED' then 'refunded'::public.payment_status else 'failed'::public.payment_status end,
        is_featured=false,billing_failure_reason=coalesce(nullif(p_data->>'reason',''),p_event_type),updated_at=now()
      where id=target.server_listing_id and billing_source='paypal' and status<>'rejected';
    end if;
    if external_payment is not null then
      update public.billing_payments set status=case when p_event_type='PAYMENT.SALE.REFUNDED' then 'refunded' else 'reversed' end,
        refunded_at=event_time,updated_at=now() where payment_provider='paypal' and external_payment_id=external_payment;
    end if;
  end if;
  update private.billing_events set processed_at=now() where provider='paypal' and environment='sandbox' and event_id=p_event_id;
  return true;
exception when others then
  update private.billing_events set processing_error=left(sqlerrm,1000) where provider='paypal' and environment='sandbox' and event_id=p_event_id;
  raise;
end;
$$;

create or replace function public.get_my_server_billing()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'subscriptions',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc) from (
      select subscription.id,subscription.server_listing_id as listing_id,subscription.status,subscription.currency,
        subscription.price_minor,subscription.current_period_end,subscription.next_billing_time,subscription.auto_renew,
        subscription.completed_cycles,subscription.created_at,plan.code as plan_code,plan.name as plan_name,
        offer.name as offer_name,subscription.payment_provider,subscription.cancellation_reason
      from public.billing_subscriptions subscription join public.billing_plan_versions version on version.id=subscription.plan_version_id
      join public.billing_plans plan on plan.id=version.plan_id left join public.billing_offers offer on offer.id=subscription.offer_id
      where subscription.user_id=(select auth.uid())
    ) row_data),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc) from (
      select payment.id,payment.subscription_id,payment.status,payment.amount_minor,payment.currency,payment.paid_at,payment.refunded_at,payment.created_at
      from public.billing_payments payment where payment.user_id=(select auth.uid())
    ) row_data),'[]'::jsonb),
    'listings',coalesce((select jsonb_agg(to_jsonb(listing) order by listing.created_at desc) from public.server_listings listing where listing.owner_user_id=(select auth.uid())),'[]'::jsonb)
  );
$$;

create or replace function public.get_paypal_subscription_for_cancel(p_user_id uuid,p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected public.billing_subscriptions%rowtype;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  select * into selected from public.billing_subscriptions where id=p_subscription_id and user_id=p_user_id and payment_provider='paypal' for update;
  if selected.id is null then raise exception 'subscription_not_owned'; end if;
  if selected.status in ('cancelled','expired','refunded','reversed') then return jsonb_build_object('already_terminal',true,'status',selected.status); end if;
  return jsonb_build_object('already_terminal',false,'external_subscription_id',selected.external_subscription_id,'listing_id',selected.server_listing_id);
end;
$$;

create or replace function public.mark_paypal_cancellation_requested(p_user_id uuid,p_subscription_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare selected public.billing_subscriptions%rowtype;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  select * into selected from public.billing_subscriptions where id=p_subscription_id and user_id=p_user_id and payment_provider='paypal' for update;
  if selected.id is null then raise exception 'subscription_not_owned'; end if;
  if selected.status in ('cancelled','expired','refunded','reversed') then return; end if;
  update public.billing_subscriptions set status='cancellation_pending',cancellation_reason=left(trim(coalesce(p_reason,'User requested cancellation')),500),updated_at=now() where id=selected.id;
  update public.server_listings set status='canceled',payment_status='canceled',is_featured=false,cancel_at_period_end=false,updated_at=now()
    where id=selected.server_listing_id and billing_source='paypal';
  insert into private.billing_audit_log(actor_user_id,subscription_id,action,after_data)
  values(p_user_id,selected.id,'paypal.cancellation_requested',jsonb_build_object('reason',left(trim(coalesce(p_reason,'')),500)));
end;
$$;

create or replace function public.get_paypal_reconciliation_batch(p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(row_data)) from (
    select id,external_subscription_id,status,server_listing_id,provider_updated_at,last_reconciled_at
    from public.billing_subscriptions where payment_provider='paypal' and environment='sandbox'
      and external_subscription_id is not null and status in ('approval_pending','active','suspended','cancellation_pending','failed')
    order by coalesce(last_reconciled_at,'epoch'::timestamptz) asc limit least(greatest(p_limit,1),50)
  ) row_data),'[]'::jsonb);
end;
$$;

create or replace function public.apply_paypal_reconciliation(p_subscription_id uuid,p_status text,p_next_billing_time timestamptz,p_provider_time timestamptz,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare selected public.billing_subscriptions%rowtype; normalized text;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  select * into selected from public.billing_subscriptions where id=p_subscription_id and payment_provider='paypal' for update;
  if selected.id is null then raise exception 'subscription_not_found'; end if;
  normalized:=case upper(coalesce(p_status,'')) when 'ACTIVE' then 'active' when 'SUSPENDED' then 'suspended'
    when 'CANCELLED' then 'cancelled' when 'EXPIRED' then 'expired' when 'APPROVAL_PENDING' then 'approval_pending' else 'failed' end;
  update public.billing_subscriptions set status=normalized,next_billing_time=p_next_billing_time,current_period_end=coalesce(p_next_billing_time,current_period_end),
    provider_updated_at=greatest(coalesce(provider_updated_at,p_provider_time),p_provider_time),last_reconciled_at=now(),
    reconciliation_failures=case when p_error is null then 0 else reconciliation_failures+1 end,failure_reason=coalesce(p_error,failure_reason),updated_at=now() where id=selected.id;
  if normalized<>'active' then update public.server_listings set status=case when normalized='cancelled' then 'canceled'::public.listing_status when normalized='expired' then 'expired'::public.listing_status else 'paused'::public.listing_status end,
    is_featured=false,billing_failure_reason=coalesce(p_error,'paypal_reconciliation_'||normalized),updated_at=now()
    where id=selected.server_listing_id and billing_source='paypal' and status<>'rejected'; end if;
end;
$$;

create or replace function public.get_admin_billing_workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  return jsonb_build_object(
    'plans',coalesce((select jsonb_agg(to_jsonb(plan) order by plan.base_price_minor) from public.billing_plans plan),'[]'::jsonb),
    'offers',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc) from (
      select offer.*,plan.code as plan_code,plan.tier,version.version_number,version.environment,version.currency,
        version.base_price_minor,version.promotional_price_minor,version.discount_type,version.discount_percentage,
        version.discount_amount_minor,version.frequency_unit,version.interval_count,version.benefit_cycles,version.total_cycles,
        version.auto_renew,version.end_behavior,version.sync_status,version.provider_status,version.last_sync_error,
        version.external_plan_id_sandbox,version.external_plan_id_live,
        (select count(*) from public.billing_subscriptions subscription where subscription.offer_id=offer.id) as subscriber_count
      from public.billing_offers offer join public.billing_plans plan on plan.id=offer.plan_id
      join public.billing_plan_versions version on version.id=offer.current_version_id
    ) row_data),'[]'::jsonb),
    'versions',coalesce((select jsonb_agg(to_jsonb(version) order by version.created_at desc) from public.billing_plan_versions version),'[]'::jsonb),
    'subscriptions',coalesce((select jsonb_agg(to_jsonb(subscription) order by subscription.created_at desc) from public.billing_subscriptions subscription limit 200),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(log) order by log.created_at desc) from private.billing_audit_log log limit 200),'[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_save_billing_offer(p_offer_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); selected_plan public.billing_plans%rowtype; result_id uuid; version_id uuid; next_version integer;
  base_minor integer; promo_minor integer; discount text; status_value text; environment_value text;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>32768 then raise exception 'invalid_offer_payload'; end if;
  select * into selected_plan from public.billing_plans where code=p_payload->>'plan_code' and is_active;
  if selected_plan.id is null then raise exception 'plan_not_available'; end if;
  base_minor:=coalesce((p_payload->>'base_price_minor')::integer,selected_plan.base_price_minor);
  promo_minor:=(p_payload->>'promotional_price_minor')::integer;
  discount:=coalesce(p_payload->>'discount_type','none'); status_value:=coalesce(p_payload->>'status','draft');
  environment_value:=coalesce(p_payload->>'environment','sandbox');
  if environment_value<>'sandbox' or status_value not in ('draft','scheduled') or discount not in ('none','percentage','fixed_amount','custom_price')
    or base_minor<=0 or promo_minor<=0 or promo_minor>base_minor or char_length(trim(p_payload->>'name')) not between 2 and 127 then raise exception 'invalid_offer_payload'; end if;
  if p_offer_id is null then
    insert into public.billing_offers(plan_id,name,description,acquisition_starts_at,acquisition_ends_at,subscription_limit,new_customers_only,status,created_by,updated_by)
    values(selected_plan.id,trim(p_payload->>'name'),left(trim(coalesce(p_payload->>'description','')),1000),nullif(p_payload->>'acquisition_starts_at','')::timestamptz,
      nullif(p_payload->>'acquisition_ends_at','')::timestamptz,nullif(p_payload->>'subscription_limit','')::integer,coalesce((p_payload->>'new_customers_only')::boolean,false),status_value,actor,actor)
    returning id into result_id;
    next_version:=1;
  else
    select coalesce(max(version_number),0)+1 into next_version from public.billing_plan_versions where offer_id=p_offer_id;
    update public.billing_offers set plan_id=selected_plan.id,name=trim(p_payload->>'name'),description=left(trim(coalesce(p_payload->>'description','')),1000),
      acquisition_starts_at=nullif(p_payload->>'acquisition_starts_at','')::timestamptz,acquisition_ends_at=nullif(p_payload->>'acquisition_ends_at','')::timestamptz,
      subscription_limit=nullif(p_payload->>'subscription_limit','')::integer,new_customers_only=coalesce((p_payload->>'new_customers_only')::boolean,false),
      status=status_value,updated_by=actor,updated_at=now() where id=p_offer_id returning id into result_id;
    if result_id is null then raise exception 'offer_not_found'; end if;
  end if;
  insert into public.billing_plan_versions(plan_id,offer_id,version_number,environment,currency,base_price_minor,promotional_price_minor,
    discount_type,discount_percentage,discount_amount_minor,frequency_unit,interval_count,benefit_cycles,total_cycles,auto_renew,end_behavior,terms_snapshot,created_by)
  values(selected_plan.id,result_id,next_version,'sandbox',coalesce(p_payload->>'currency','USD'),base_minor,promo_minor,discount,
    nullif(p_payload->>'discount_percentage','')::numeric,nullif(p_payload->>'discount_amount_minor','')::integer,coalesce(p_payload->>'frequency_unit','MONTH'),
    coalesce((p_payload->>'interval_count')::integer,1),nullif(p_payload->>'benefit_cycles','')::integer,nullif(p_payload->>'total_cycles','')::integer,
    coalesce((p_payload->>'auto_renew')::boolean,true),coalesce(p_payload->>'end_behavior','base_price'),p_payload,actor) returning id into version_id;
  update public.billing_offers set current_version_id=version_id where id=result_id;
  insert into private.billing_audit_log(actor_user_id,offer_id,action,after_data) values(actor,result_id,'billing.offer.version_created',jsonb_build_object('version_id',version_id,'version',next_version));
  return result_id;
end;
$$;

create or replace function public.admin_set_billing_offer_status(p_offer_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid:=(select auth.uid()); selected public.billing_offers%rowtype; version public.billing_plan_versions%rowtype;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_status not in ('draft','scheduled','active','withdrawn','expired') then raise exception 'invalid_offer_status'; end if;
  select * into selected from public.billing_offers where id=p_offer_id for update;
  if selected.id is null then raise exception 'offer_not_found'; end if;
  select * into version from public.billing_plan_versions where id=selected.current_version_id;
  if p_status='active' and (version.sync_status<>'synced' or version.environment<>'sandbox' or version.external_plan_id_sandbox is null) then raise exception 'paypal_plan_not_synced'; end if;
  update public.billing_offers set status=p_status,updated_by=actor,updated_at=now() where id=p_offer_id;
  insert into private.billing_audit_log(actor_user_id,offer_id,action,before_data,after_data) values(actor,p_offer_id,'billing.offer.status_changed',jsonb_build_object('status',selected.status),jsonb_build_object('status',p_status));
end;
$$;

create or replace function public.admin_duplicate_billing_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source record; result uuid; actor uuid:=(select auth.uid()); version_id uuid;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  select offer.*,version.* into source from public.billing_offers offer join public.billing_plan_versions version on version.id=offer.current_version_id where offer.id=p_offer_id;
  if source.id is null then raise exception 'offer_not_found'; end if;
  insert into public.billing_offers(plan_id,name,description,subscription_limit,new_customers_only,status,created_by,updated_by)
  values(source.plan_id,left(source.name||' (copia)',127),source.description,source.subscription_limit,source.new_customers_only,'draft',actor,actor) returning id into result;
  insert into public.billing_plan_versions(plan_id,offer_id,version_number,environment,currency,base_price_minor,promotional_price_minor,discount_type,discount_percentage,discount_amount_minor,frequency_unit,interval_count,benefit_cycles,total_cycles,auto_renew,end_behavior,terms_snapshot,created_by)
  values(source.plan_id,result,1,'sandbox',source.currency,source.base_price_minor,source.promotional_price_minor,source.discount_type,source.discount_percentage,source.discount_amount_minor,source.frequency_unit,source.interval_count,source.benefit_cycles,source.total_cycles,source.auto_renew,source.end_behavior,source.terms_snapshot,actor) returning id into version_id;
  update public.billing_offers set current_version_id=version_id where id=result;
  return result;
end;
$$;

create or replace function public.get_paypal_plan_sync_payload(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row_data record;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  select version.*,plan.code,plan.name,plan.description,plan.tier,product.id product_uuid,product.external_product_id_sandbox
  into row_data from public.billing_plan_versions version join public.billing_plans plan on plan.id=version.plan_id
  join public.billing_products product on product.id=plan.product_id where version.id=p_version_id and version.environment='sandbox';
  if row_data.id is null then raise exception 'plan_version_not_found'; end if;
  return to_jsonb(row_data);
end;
$$;

create or replace function public.complete_paypal_product_sync(p_product_id uuid,p_external_product_id text,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$ begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.billing_products set external_product_id_sandbox=coalesce(p_external_product_id,external_product_id_sandbox),sync_status=case when p_error is null then 'synced' else 'failed' end,
    last_sync_error=p_error,synced_at=case when p_error is null then now() else synced_at end,updated_at=now() where id=p_product_id;
end; $$;

create or replace function public.complete_paypal_plan_sync(p_version_id uuid,p_external_plan_id text,p_provider_status text,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$ begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  update public.billing_plan_versions set external_plan_id_sandbox=coalesce(p_external_plan_id,external_plan_id_sandbox),provider_status=p_provider_status,
    sync_status=case when p_error is null then 'synced' else 'failed' end,last_sync_error=p_error,
    synced_at=case when p_error is null then now() else synced_at end where id=p_version_id and environment='sandbox';
end; $$;

create or replace function private.enforce_server_listing_visibility()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.billing_source in ('stripe','paypal') then
    if new.payment_status in ('canceled','refunded') or new.cancel_at_period_end then
      new.status:=case when new.status='rejected' then new.status else 'canceled'::public.listing_status end; new.is_featured:=false;
    elsif new.payment_status='failed' then new.status:=case when new.status='rejected' then new.status else 'paused'::public.listing_status end; new.is_featured:=false;
    elsif new.status in ('canceled','expired','paused','hidden','rejected','pending_payment','draft') then new.is_featured:=false; end if;
  end if;
  return new;
end; $$;

create or replace function public.expire_server_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if (select auth.role()) <> 'service_role' and not private.is_global_admin() then raise exception 'billing_worker_or_admin_required'; end if;
  update public.server_listings set status='expired',is_featured=false,updated_at=now()
  where status in ('active','paused') and expires_at is not null and expires_at<=now()
    and not (billing_source in ('stripe','paypal') and current_period_end is not null and current_period_end>now());
  get diagnostics affected=row_count;
  update public.billing_subscriptions set status='expired',updated_at=now() where status in ('active','suspended','cancellation_pending') and current_period_end is not null and current_period_end<=now();
  return affected;
end; $$;

insert into public.feature_flags(key,description,enabled,configuration)
values('paypal_payments','PayPal Subscriptions Sandbox for server listings',false,'{"mode":"sandbox"}'::jsonb)
on conflict(key) do update set description=excluded.description,configuration=excluded.configuration,updated_at=now();
update public.feature_flags set enabled=false,updated_at=now() where key='stripe_payments';

revoke all on function public.save_paypal_server_listing_draft(uuid,text,jsonb) from public,anon;
grant execute on function public.save_paypal_server_listing_draft(uuid,text,jsonb) to authenticated;
revoke all on function public.get_my_server_billing() from public,anon;
grant execute on function public.get_my_server_billing() to authenticated;
revoke all on function public.get_admin_billing_workspace() from public,anon;
grant execute on function public.get_admin_billing_workspace() to authenticated;
revoke all on function public.admin_save_billing_offer(uuid,jsonb) from public,anon;
revoke all on function public.admin_set_billing_offer_status(uuid,text) from public,anon;
revoke all on function public.admin_duplicate_billing_offer(uuid) from public,anon;
grant execute on function public.admin_save_billing_offer(uuid,jsonb) to authenticated;
grant execute on function public.admin_set_billing_offer_status(uuid,text) to authenticated;
grant execute on function public.admin_duplicate_billing_offer(uuid) to authenticated;

revoke all on function public.prepare_paypal_subscription(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.attach_paypal_subscription(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.process_paypal_billing_event(text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.get_paypal_subscription_for_cancel(uuid,uuid) from public,anon,authenticated;
revoke all on function public.mark_paypal_cancellation_requested(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.get_paypal_reconciliation_batch(integer) from public,anon,authenticated;
revoke all on function public.apply_paypal_reconciliation(uuid,text,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.get_paypal_plan_sync_payload(uuid) from public,anon,authenticated;
revoke all on function public.complete_paypal_product_sync(uuid,text,text) from public,anon,authenticated;
revoke all on function public.complete_paypal_plan_sync(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.prepare_paypal_subscription(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.attach_paypal_subscription(uuid,uuid,text) to service_role;
grant execute on function public.process_paypal_billing_event(text,text,jsonb,jsonb) to service_role;
grant execute on function public.get_paypal_subscription_for_cancel(uuid,uuid) to service_role;
grant execute on function public.mark_paypal_cancellation_requested(uuid,uuid,text) to service_role;
grant execute on function public.get_paypal_reconciliation_batch(integer) to service_role;
grant execute on function public.apply_paypal_reconciliation(uuid,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.get_paypal_plan_sync_payload(uuid) to service_role;
grant execute on function public.complete_paypal_product_sync(uuid,text,text) to service_role;
grant execute on function public.complete_paypal_plan_sync(uuid,text,text,text) to service_role;
revoke all on function private.enforce_server_listing_visibility() from public,anon,authenticated;
