-- Stripe listing billing flow: owner drafts, reusable customers and webhook reconciliation.

alter type public.listing_status add value if not exists 'draft';
alter type public.listing_status add value if not exists 'hidden';
alter type public.payment_status add value if not exists 'not_required';

alter table public.server_listings
  add column if not exists plan_type public.listing_plan generated always as (plan) stored,
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists billing_source text not null default 'stripe',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.server_listings
  drop constraint if exists server_listings_billing_source_check,
  add constraint server_listings_billing_source_check
    check (billing_source in ('stripe', 'manual'));

update public.server_listings set billing_source = 'manual', payment_status = 'paid'
where created_by_admin is not null or plan = 'manual';

create or replace function private.set_manual_listing_billing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.created_by_admin is not null
    and new.stripe_subscription_id is null
    and (tg_op = 'INSERT' or old.billing_source = 'manual')
  then
    new.billing_source := 'manual';
    new.payment_status := 'paid';
  elsif tg_op = 'UPDATE'
    and private.is_global_admin()
    and new.status = 'active'
    and new.stripe_subscription_id is null
  then
    new.created_by_admin := coalesce(new.created_by_admin, (select auth.uid()));
    new.billing_source := 'manual';
    new.payment_status := 'paid';
  end if;
  return new;
end;
$$;

drop trigger if exists set_manual_listing_billing on public.server_listings;
create trigger set_manual_listing_billing
before insert or update on public.server_listings
for each row execute function private.set_manual_listing_billing();

create unique index if not exists server_listings_stripe_subscription_unique
  on public.server_listings(stripe_subscription_id)
  where stripe_subscription_id is not null;
create unique index if not exists server_listings_checkout_session_unique
  on public.server_listings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create index if not exists server_listings_owner_billing_idx
  on public.server_listings(owner_user_id, billing_source, payment_status, status);
create index if not exists server_listings_stripe_period_end_idx
  on public.server_listings(current_period_end)
  where billing_source = 'stripe' and status in ('active', 'paused');

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.server_listing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  server_listing_id uuid not null references public.server_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  plan_type public.listing_plan not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_listing_subscriptions_paid_plan_check check (plan_type in ('normal', 'plus'))
);

create index if not exists server_listing_subscriptions_user_idx
  on public.server_listing_subscriptions(user_id, updated_at desc);
create index if not exists server_listing_subscriptions_listing_idx
  on public.server_listing_subscriptions(server_listing_id, updated_at desc);
create index if not exists server_listing_subscriptions_period_end_idx
  on public.server_listing_subscriptions(current_period_end)
  where status in ('active', 'trialing', 'past_due');

alter table public.billing_customers enable row level security;
alter table public.server_listing_subscriptions enable row level security;

drop policy if exists billing_customers_owner_read on public.billing_customers;
create policy billing_customers_owner_read
on public.billing_customers for select to authenticated
using (user_id = (select auth.uid()) or private.is_global_admin());

drop policy if exists server_listing_subscriptions_owner_read on public.server_listing_subscriptions;
create policy server_listing_subscriptions_owner_read
on public.server_listing_subscriptions for select to authenticated
using (user_id = (select auth.uid()) or private.is_global_admin());

revoke all on public.billing_customers, public.server_listing_subscriptions from anon, authenticated;
grant select on public.billing_customers, public.server_listing_subscriptions to authenticated;

create or replace function public.save_server_listing_draft(
  p_listing_id uuid,
  p_plan_type text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_listing public.server_listings%rowtype;
  result_id uuid;
  selected_plan public.listing_plan;
  selected_platforms text[];
  selected_mods text[];
  selected_maps text[];
  selected_gallery text[];
  selected_rates jsonb;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if p_plan_type not in ('normal', 'plus') then raise exception 'plan_not_available'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then
    raise exception 'invalid_listing_payload';
  end if;
  if not exists (select 1 from public.profiles where id = actor_id and not is_suspended) then
    raise exception 'account_not_available';
  end if;

  selected_plan := p_plan_type::public.listing_plan;
  selected_platforms := array(select jsonb_array_elements_text(coalesce(p_payload->'platforms', '[]'::jsonb)));
  selected_mods := array(select jsonb_array_elements_text(coalesce(p_payload->'mods', '[]'::jsonb)));
  selected_maps := array(select jsonb_array_elements_text(coalesce(p_payload->'maps', '[]'::jsonb)));
  selected_gallery := array(select jsonb_array_elements_text(coalesce(p_payload->'gallery_urls', '[]'::jsonb)));
  selected_rates := coalesce(p_payload->'rates', '{}'::jsonb);

  if char_length(trim(p_payload->>'title')) not between 2 and 100
    or (p_payload->>'slug') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(p_payload->>'description')) not between 20 and 4000
    or char_length(trim(p_payload->>'region')) not between 2 and 40
    or char_length(trim(p_payload->>'language')) not between 2 and 40
    or cardinality(selected_platforms) not between 1 and 8
    or cardinality(selected_maps) not between 1 and 20
    or cardinality(selected_mods) > 30
    or cardinality(selected_gallery) > 6
    or jsonb_typeof(selected_rates) <> 'object'
    or (p_payload->>'discord_invite_url') !~ '^https://(discord[.]gg|discord[.]com/invite)/'
  then raise exception 'invalid_listing_payload'; end if;

  if p_listing_id is not null then
    select * into current_listing from public.server_listings
    where id = p_listing_id and owner_user_id = actor_id for update;
    if current_listing.id is null then raise exception 'listing_not_available'; end if;
    if current_listing.billing_source = 'manual' then
      selected_plan := current_listing.plan;
    elsif current_listing.status = 'active' and current_listing.current_period_end > now()
      and current_listing.plan <> selected_plan then
      raise exception 'plan_change_requires_portal';
    end if;

    update public.server_listings set
      plan = selected_plan,
      title = trim(p_payload->>'title'),
      slug = lower(trim(p_payload->>'slug')),
      game = (p_payload->>'game')::public.game_mode,
      server_type = (p_payload->>'server_type')::public.server_type,
      platforms = selected_platforms,
      has_mods = cardinality(selected_mods) > 0,
      mods = selected_mods,
      maps = selected_maps,
      rates = selected_rates,
      region = trim(p_payload->>'region'),
      language = trim(p_payload->>'language'),
      description = trim(p_payload->>'description'),
      discord_invite_url = trim(p_payload->>'discord_invite_url'),
      website_url = nullif(trim(p_payload->>'website_url'), ''),
      banner_url = nullif(trim(p_payload->>'banner_url'), ''),
      gallery_urls = selected_gallery,
      cluster_name = nullif(trim(p_payload->>'cluster_name'), ''),
      wipe_date = nullif(p_payload->>'wipe_date', '')::date,
      uses_propagators = coalesce((p_payload->>'uses_propagators')::boolean, false),
      updated_at = now()
    where id = current_listing.id returning id into result_id;
  else
    insert into public.server_listings (
      owner_user_id, plan, status, payment_status, billing_source,
      title, slug, game, server_type, platforms, has_mods, mods, maps, rates,
      region, language, description, discord_invite_url, website_url, banner_url,
      gallery_urls, is_featured, is_verified, cluster_name, wipe_date, uses_propagators
    ) values (
      actor_id, selected_plan, 'pending_payment', 'pending', 'stripe',
      trim(p_payload->>'title'), lower(trim(p_payload->>'slug')),
      (p_payload->>'game')::public.game_mode, (p_payload->>'server_type')::public.server_type,
      selected_platforms, cardinality(selected_mods) > 0, selected_mods, selected_maps, selected_rates,
      trim(p_payload->>'region'), trim(p_payload->>'language'), trim(p_payload->>'description'),
      trim(p_payload->>'discord_invite_url'), nullif(trim(p_payload->>'website_url'), ''),
      nullif(trim(p_payload->>'banner_url'), ''), selected_gallery, false, false,
      nullif(trim(p_payload->>'cluster_name'), ''), nullif(p_payload->>'wipe_date', '')::date,
      coalesce((p_payload->>'uses_propagators')::boolean, false)
    ) returning id into result_id;
  end if;
  return result_id;
exception when unique_violation then
  raise exception 'listing_slug_taken';
end;
$$;

create or replace function public.prepare_server_listing_checkout(
  p_user_id uuid,
  p_listing_id uuid,
  p_plan_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.server_listings%rowtype;
  selected_plan public.plans%rowtype;
  customer_id text;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_user_id is null or p_listing_id is null then raise exception 'authentication_required'; end if;
  if p_plan_type not in ('normal', 'plus') then raise exception 'plan_not_available'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and not is_suspended) then
    raise exception 'account_not_available';
  end if;

  select * into listing from public.server_listings
  where id = p_listing_id and owner_user_id = p_user_id for update;
  if listing.id is null then raise exception 'listing_not_available'; end if;
  if listing.billing_source = 'manual' then raise exception 'manual_listing_not_billable'; end if;
  if listing.status = 'active' and listing.current_period_end > now() then
    raise exception 'listing_already_active';
  end if;
  if listing.stripe_checkout_session_id is not null
    and listing.payment_status = 'pending'
    and listing.updated_at >= now() - interval '2 minutes'
  then raise exception 'checkout_rate_limit'; end if;

  select * into selected_plan from public.plans
  where code = p_plan_type and is_active and code in ('normal', 'plus');
  if selected_plan.id is null or selected_plan.price_usd_cents <= 0 then
    raise exception 'plan_not_available';
  end if;

  select stripe_customer_id into customer_id from public.billing_customers where user_id = p_user_id;
  customer_id := coalesce(customer_id, listing.stripe_customer_id);
  return jsonb_build_object(
    'listing_id', listing.id,
    'listing_title', listing.title,
    'plan_id', selected_plan.id,
    'plan_type', selected_plan.code,
    'amount_usd_cents', selected_plan.price_usd_cents,
    'stripe_customer_id', customer_id
  );
end;
$$;

create or replace function public.attach_server_listing_checkout(
  p_user_id uuid,
  p_listing_id uuid,
  p_plan_type text,
  p_stripe_price_id text,
  p_stripe_customer_id text,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare selected_plan public.plans%rowtype;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_plan_type not in ('normal', 'plus') then raise exception 'plan_not_available'; end if;
  if p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+' then raise exception 'invalid_stripe_customer'; end if;
  if p_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+' then raise exception 'invalid_checkout_session'; end if;
  if p_stripe_price_id !~ '^price_[A-Za-z0-9]+' then raise exception 'invalid_stripe_price'; end if;

  select * into selected_plan from public.plans where code = p_plan_type and is_active;
  if selected_plan.id is null then raise exception 'plan_not_available'; end if;

  insert into public.billing_customers(user_id, stripe_customer_id)
  values (p_user_id, p_stripe_customer_id)
  on conflict (user_id) do update set
    stripe_customer_id = excluded.stripe_customer_id,
    updated_at = now();

  update public.server_listings set
    plan = p_plan_type::public.listing_plan,
    status = 'pending_payment',
    payment_status = 'pending',
    billing_source = 'stripe',
    stripe_customer_id = p_stripe_customer_id,
    stripe_price_id = p_stripe_price_id,
    stripe_checkout_session_id = p_session_id,
    is_featured = false,
    updated_at = now()
  where id = p_listing_id and owner_user_id = p_user_id and billing_source = 'stripe';
  if not found then raise exception 'listing_not_available'; end if;

  insert into public.payments(
    user_id, listing_id, plan_id, stripe_checkout_session_id, amount_usd_cents, status
  ) values (
    p_user_id, p_listing_id, selected_plan.id, p_session_id, selected_plan.price_usd_cents, 'pending'
  ) on conflict (stripe_checkout_session_id) where stripe_checkout_session_id is not null
    do update set listing_id = excluded.listing_id, plan_id = excluded.plan_id,
      amount_usd_cents = excluded.amount_usd_cents, updated_at = now();
end;
$$;

create or replace function public.process_stripe_listing_event(
  p_event_id text,
  p_event_type text,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_id uuid;
  target_user_id uuid;
  listing public.server_listings%rowtype;
  plan_id uuid;
  subscription_status text := coalesce(p_data->>'subscription_status', '');
  period_start timestamptz;
  period_end timestamptz;
  subscription_id text := nullif(p_data->>'subscription_id', '');
  customer_id text := nullif(p_data->>'customer_id', '');
  price_id text := nullif(p_data->>'stripe_price_id', '');
  plan_code text := nullif(coalesce(p_data->>'plan_type', p_data->>'plan_code'), '');
  cancel_at_end boolean := coalesce((p_data->>'cancel_at_period_end')::boolean, false);
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_event_id !~ '^evt_[A-Za-z0-9]+'
    or char_length(p_event_type) > 100
    or jsonb_typeof(p_data) <> 'object'
    or pg_column_size(p_data) > 65536
  then raise exception 'invalid_stripe_event'; end if;

  insert into private.stripe_events(id, event_type, payload)
  values (p_event_id, p_event_type, p_data)
  on conflict (id) do nothing;
  if not found then return false; end if;

  if coalesce(p_data->>'server_listing_id', '') ~ '^[0-9a-fA-F-]{36}$' then
    listing_id := (p_data->>'server_listing_id')::uuid;
  elsif subscription_id is not null then
    select server_listing_id into listing_id
    from public.server_listing_subscriptions
    where stripe_subscription_id = subscription_id;
  end if;
  if listing_id is null then raise exception 'listing_not_found'; end if;

  select * into listing from public.server_listings where id = listing_id for update;
  if listing.id is null or listing.billing_source <> 'stripe' then raise exception 'listing_not_found'; end if;
  target_user_id := listing.owner_user_id;
  if nullif(p_data->>'user_id', '') is not null and (p_data->>'user_id')::uuid <> target_user_id then
    raise exception 'listing_owner_mismatch';
  end if;
  plan_code := coalesce(plan_code, listing.plan::text);
  if plan_code not in ('normal', 'plus') then raise exception 'plan_reconciliation_failed'; end if;
  select id into plan_id from public.plans where code = plan_code;
  if plan_id is null then raise exception 'plan_reconciliation_failed'; end if;

  if nullif(p_data->>'current_period_start', '') is not null then
    period_start := to_timestamp((p_data->>'current_period_start')::double precision);
  end if;
  if nullif(p_data->>'current_period_end', '') is not null then
    period_end := to_timestamp((p_data->>'current_period_end')::double precision);
  end if;

  if p_event_type = 'checkout.session.completed' then
    if coalesce(p_data->>'payment_status', '') not in ('paid', 'no_payment_required')
      or subscription_id is null or customer_id is null or price_id is null
      or period_end is null or period_end <= now()
    then raise exception 'checkout_not_paid'; end if;
    if listing.stripe_checkout_session_id is distinct from p_data->>'session_id' then
      raise exception 'checkout_session_mismatch';
    end if;
    if (p_data->>'amount_total')::integer <> (select price_usd_cents from public.plans where id = plan_id) then
      raise exception 'payment_reconciliation_failed';
    end if;

    update public.server_listings set
      plan = plan_code::public.listing_plan,
      status = case when subscription_status in ('active', 'trialing') then 'active'::public.listing_status else 'pending_payment'::public.listing_status end,
      payment_status = 'paid',
      stripe_customer_id = customer_id,
      stripe_subscription_id = subscription_id,
      stripe_price_id = price_id,
      current_period_start = period_start,
      current_period_end = period_end,
      starts_at = case when subscription_status in ('active', 'trialing') then coalesce(starts_at, now()) else starts_at end,
      expires_at = period_end,
      cancel_at_period_end = cancel_at_end,
      is_featured = plan_code = 'plus' and subscription_status in ('active', 'trialing'),
      updated_at = now()
    where id = listing_id;

    update public.payments set status = 'paid', updated_at = now()
    where stripe_checkout_session_id = p_data->>'session_id'
      and public.payments.user_id = target_user_id;
  elsif p_event_type in ('customer.subscription.created', 'customer.subscription.updated') then
    if subscription_id is null or customer_id is null or price_id is null then raise exception 'invalid_subscription'; end if;
    update public.server_listings set
      plan = plan_code::public.listing_plan,
      status = case
        when subscription_status in ('active', 'trialing') then 'active'::public.listing_status
        when subscription_status in ('past_due', 'unpaid') then 'paused'::public.listing_status
        when subscription_status in ('canceled', 'incomplete_expired') then 'canceled'::public.listing_status
        else 'pending_payment'::public.listing_status end,
      payment_status = case
        when subscription_status in ('active', 'trialing') then 'paid'::public.payment_status
        when subscription_status in ('past_due', 'unpaid', 'incomplete_expired') then 'failed'::public.payment_status
        when subscription_status = 'canceled' then 'canceled'::public.payment_status
        else payment_status end,
      stripe_customer_id = customer_id,
      stripe_subscription_id = subscription_id,
      stripe_price_id = price_id,
      current_period_start = coalesce(period_start, current_period_start),
      current_period_end = coalesce(period_end, current_period_end),
      starts_at = case when subscription_status in ('active', 'trialing') then coalesce(starts_at, now()) else starts_at end,
      expires_at = coalesce(period_end, expires_at),
      cancel_at_period_end = cancel_at_end,
      is_featured = plan_code = 'plus' and subscription_status in ('active', 'trialing'),
      updated_at = now()
    where id = listing_id;
  elsif p_event_type = 'invoice.paid' then
    if subscription_id is null or period_end is null then raise exception 'invalid_invoice'; end if;
    update public.server_listings set
      status = 'active', payment_status = 'paid',
      current_period_start = coalesce(period_start, current_period_start),
      current_period_end = period_end, expires_at = period_end,
      starts_at = coalesce(starts_at, now()),
      is_featured = plan = 'plus', updated_at = now()
    where id = listing_id and status <> 'rejected';
    insert into public.payments(
      user_id, listing_id, plan_id, stripe_invoice_id, stripe_payment_intent_id,
      amount_usd_cents, status
    ) values (
      target_user_id, listing_id, plan_id, p_data->>'invoice_id', nullif(p_data->>'payment_intent_id', ''),
      coalesce((p_data->>'amount_paid')::integer, 0), 'paid'
    ) on conflict (stripe_invoice_id) where stripe_invoice_id is not null do nothing;
  elsif p_event_type = 'invoice.payment_failed' then
    update public.server_listings set
      status = 'paused', payment_status = 'failed', is_featured = false, updated_at = now()
    where id = listing_id and status <> 'rejected';
    insert into public.payments(
      user_id, listing_id, plan_id, stripe_invoice_id, amount_usd_cents, status, failure_reason
    ) values (
      target_user_id, listing_id, plan_id, p_data->>'invoice_id',
      coalesce((p_data->>'amount_due')::integer, 0), 'failed', 'invoice_payment_failed'
    ) on conflict (stripe_invoice_id) where stripe_invoice_id is not null
      do update set status = 'failed', failure_reason = 'invoice_payment_failed', updated_at = now();
  elsif p_event_type = 'customer.subscription.deleted' then
    update public.server_listings set
      status = 'canceled', payment_status = 'canceled', is_featured = false,
      current_period_end = coalesce(period_end, current_period_end),
      expires_at = coalesce(period_end, now()), cancel_at_period_end = false, updated_at = now()
    where id = listing_id;
  end if;

  if customer_id is not null then
    insert into public.billing_customers(user_id, stripe_customer_id)
    values (target_user_id, customer_id)
    on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now();
  end if;

  if subscription_id is not null and customer_id is not null and price_id is not null then
    insert into public.server_listing_subscriptions(
      server_listing_id, user_id, stripe_customer_id, stripe_subscription_id,
      stripe_price_id, plan_type, status, current_period_start, current_period_end, cancel_at_period_end
    ) values (
      listing_id, target_user_id, customer_id, subscription_id, price_id,
      plan_code::public.listing_plan, subscription_status, period_start, period_end, cancel_at_end
    ) on conflict (stripe_subscription_id) do update set
      server_listing_id = excluded.server_listing_id,
      user_id = excluded.user_id,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_price_id = excluded.stripe_price_id,
      plan_type = excluded.plan_type,
      status = excluded.status,
      current_period_start = coalesce(excluded.current_period_start, public.server_listing_subscriptions.current_period_start),
      current_period_end = coalesce(excluded.current_period_end, public.server_listing_subscriptions.current_period_end),
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = now();

    insert into public.subscriptions(
      user_id, listing_id, stripe_subscription_id, status, current_period_start,
      current_period_end, cancel_at_period_end, plan_id, stripe_customer_id
    ) values (
      target_user_id, listing_id, subscription_id, subscription_status, period_start,
      period_end, cancel_at_end, plan_id, customer_id
    ) on conflict (stripe_subscription_id) where stripe_subscription_id is not null do update set
      listing_id = excluded.listing_id,
      status = excluded.status,
      current_period_start = coalesce(excluded.current_period_start, public.subscriptions.current_period_start),
      current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
      cancel_at_period_end = excluded.cancel_at_period_end,
      plan_id = excluded.plan_id,
      stripe_customer_id = excluded.stripe_customer_id,
      updated_at = now();
  end if;

  update private.stripe_events set processed_at = now() where id = p_event_id;
  return true;
end;
$$;

create or replace function public.process_stripe_server_event(
  p_event_id text,
  p_event_type text,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_data ? 'server_listing_id'
    or p_data ? 'plan_type'
    or exists (
      select 1 from public.server_listing_subscriptions
      where stripe_subscription_id = nullif(p_data->>'subscription_id', '')
    )
  then
    return public.process_stripe_listing_event(p_event_id, p_event_type, p_data);
  end if;
  if p_event_type = 'checkout.session.completed' and (
    coalesce(p_data->>'payment_status', '') not in ('paid', 'no_payment_required')
    or nullif(p_data->>'amount_total', '') is null
  ) then raise exception 'checkout_not_paid'; end if;
  if p_event_type = 'invoice.paid' and coalesce((p_data->>'amount_paid')::integer, -1) < 0 then
    raise exception 'invalid_invoice_amount';
  end if;
  return public.process_stripe_server_event_verified_payload(p_event_id, p_event_type, p_data);
end;
$$;

create or replace function public.get_my_server_billing()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'subscriptions', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select s.id, s.server_listing_id as listing_id, s.status, s.current_period_end,
          s.cancel_at_period_end, s.plan_type::text as plan_code,
          case when s.plan_type = 'plus' then 'Plus' else 'Normal' end as plan_name
        from public.server_listing_subscriptions s
        where s.user_id = (select auth.uid()) order by s.created_at desc
      ) x
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.server_listings l where l.owner_user_id = (select auth.uid())
    ), '[]'::jsonb),
    'has_customer', exists(
      select 1 from public.billing_customers where user_id = (select auth.uid())
    )
  );
$$;

create or replace function public.expire_server_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  if (select auth.role()) <> 'service_role' and not private.is_global_admin() then
    raise exception 'billing_worker_or_admin_required';
  end if;
  update public.server_listings set
    status = 'expired',
    payment_status = case when billing_source = 'stripe' then payment_status else 'canceled'::public.payment_status end,
    is_featured = false,
    updated_at = now()
  where status in ('active', 'paused')
    and expires_at is not null and expires_at <= now()
    and not (
      billing_source = 'stripe'
      and current_period_end is not null
      and current_period_end > now()
    );
  get diagnostics affected = row_count;

  update public.server_listing_subscriptions set status = 'expired', updated_at = now()
  where status in ('active', 'trialing', 'past_due', 'canceled')
    and current_period_end is not null and current_period_end <= now();
  update public.subscriptions set status = 'expired', updated_at = now()
  where status in ('active', 'trialing', 'past_due', 'canceled')
    and current_period_end is not null and current_period_end <= now();
  return affected;
end;
$$;

revoke all on function public.save_server_listing_draft(uuid, text, jsonb) from public, anon;
grant execute on function public.save_server_listing_draft(uuid, text, jsonb) to authenticated;
revoke all on function public.get_my_server_billing() from public, anon;
grant execute on function public.get_my_server_billing() to authenticated;

revoke all on function public.prepare_server_listing_checkout(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.attach_server_listing_checkout(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.process_stripe_listing_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.process_stripe_server_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_server_listing_checkout(uuid, uuid, text) to service_role;
grant execute on function public.attach_server_listing_checkout(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.process_stripe_server_event(text, text, jsonb) to service_role;

revoke all on function public.expire_server_listings() from public, anon, authenticated;
grant execute on function public.expire_server_listings() to service_role;

update public.feature_flags set
  description = 'Stripe Checkout mensual por anuncio, portal y webhooks firmados; requiere secretos del proveedor',
  updated_at = now()
where key = 'stripe_payments';
