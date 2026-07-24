-- =====================================================================
-- Migration: Security audit fixes for PayPal billing
-- Generated: 2026-07-23
-- Addresses: CRITICAL + MEDIUM findings from 3-agent audit
-- =====================================================================

-- -------------------------------------------------------------------
-- C1: Fix enforce_server_listing_visibility trigger regression
--     Stripe cancel_at_period_end must also reset payment_status
-- -------------------------------------------------------------------
create or replace function private.enforce_server_listing_visibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  /*
   * STRIPE LEGACY
   *
   * Conservamos el comportamiento histórico:
   * cancel_at_period_end puede retirar la publicación según
   * el flujo Stripe existente.
   */
  if new.billing_source = 'stripe' then

    if new.payment_status in ('canceled', 'refunded')
       or new.cancel_at_period_end
    then

      new.status :=
        case
          when new.status in ('rejected', 'expired') then new.status
          else 'canceled'::public.listing_status
        end;

      new.payment_status := 'canceled';
      new.is_featured := false;

    elsif new.payment_status = 'failed' then

      new.status :=
        case
          when new.status = 'rejected' then new.status
          else 'paused'::public.listing_status
        end;

      new.is_featured := false;

    elsif new.status in (
      'canceled',
      'expired',
      'paused',
      'hidden',
      'rejected',
      'pending_payment',
      'draft'
    ) then

      new.is_featured := false;

    end if;

  /*
   * PAYPAL
   *
   * cancel_at_period_end NO significa que el periodo
   * ya pagado terminó.
   *
   * La publicación puede permanecer active/paid
   * hasta current_period_end.
   */
  elsif new.billing_source = 'paypal' then

    if new.payment_status in ('canceled', 'refunded') then

      new.status :=
        case
          when new.status in ('rejected', 'expired') then new.status
          else 'canceled'::public.listing_status
        end;

      new.is_featured := false;

    elsif new.payment_status = 'failed' then

      new.status :=
        case
          when new.status = 'rejected' then new.status
          else 'paused'::public.listing_status
        end;

      new.is_featured := false;

    elsif new.cancel_at_period_end then

      /*
       * Mantener entitlement del periodo pagado.
       * Solo retiramos promoción Plus.
       */
      new.is_featured := false;

    elsif new.status in (
      'canceled',
      'expired',
      'paused',
      'hidden',
      'rejected',
      'pending_payment',
      'draft'
    ) then

      new.is_featured := false;

    end if;

  end if;

  return new;
end;
$$;
-- -------------------------------------------------------------------
-- C2: Add PayPal to public visibility policy
--     Active PayPal listings with paid status must be publicly visible
-- -------------------------------------------------------------------
drop policy if exists listings_public_or_owner_read on public.server_listings;
create policy listings_public_or_owner_read
on public.server_listings for select to anon, authenticated
using (
  (
    status = 'active'::public.listing_status
    and coalesce(starts_at, now()) <= now()
    and (expires_at is null or expires_at > now())
    and (
      payment_status = 'paid'
      or (billing_source = 'manual' and payment_status in ('not_required', 'paid'))
      or (billing_source = 'paypal' and payment_status = 'paid')
    )
  )
  or owner_user_id = (select auth.uid())
  or private.is_global_admin()
);

drop index if exists public.server_listings_public_billing_idx;
create index server_listings_public_billing_idx
on public.server_listings(is_featured desc, created_at desc)
where status = 'active'
  and (
    payment_status = 'paid'
    or (billing_source = 'manual' and payment_status in ('not_required', 'paid'))
    or (billing_source = 'paypal' and payment_status = 'paid')
  );

-- -------------------------------------------------------------------
-- C3: Fix mark_paypal_cancellation_requested
--     Don't prematurely kill listing; subscription is still active
--     until period end. Set cancel_at_period_end instead of status=canceled
-- -------------------------------------------------------------------
create or replace function public.mark_paypal_cancellation_requested(p_user_id uuid, p_subscription_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare selected public.billing_subscriptions%rowtype;
begin
  select * into selected from public.billing_subscriptions where id = p_subscription_id and user_id = p_user_id and payment_provider = 'paypal' for update;
  if selected.id is null then raise exception 'subscription_not_owned'; end if;
  if selected.status in ('cancelled','expired','refunded','reversed') then return; end if;
  update public.billing_subscriptions set status = 'cancellation_pending',
    cancellation_reason = left(trim(coalesce(p_reason, 'User requested cancellation')), 500), updated_at = now()
  where id = selected.id;
  update public.server_listings set cancel_at_period_end = true, is_featured = false, updated_at = now()
    where id = selected.server_listing_id and billing_source = 'paypal' and status = 'active';
  insert into private.billing_audit_log(actor_user_id, subscription_id, action, after_data)
  values (p_user_id, selected.id, 'paypal.cancellation_requested', jsonb_build_object('reason', left(trim(coalesce(p_reason, '')), 500)));
end;
$$;

-- -------------------------------------------------------------------
-- C4: Fix expire_server_listings to update payment_status for PayPal
-- -------------------------------------------------------------------
create or replace function public.expire_server_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.server_listings set status = 'expired',
    payment_status = case when billing_source = 'paypal' then 'canceled'::public.payment_status else payment_status end,
    is_featured = false, updated_at = now()
  where status in ('active','paused')
    and expires_at is not null and expires_at <= now()
    and not (billing_source in ('stripe','paypal') and current_period_end is not null and current_period_end > now());
  get diagnostics affected = row_count;
  update public.billing_subscriptions set status = 'expired', updated_at = now()
  where status in ('active','suspended','cancellation_pending')
    and current_period_end is not null and current_period_end <= now();
  return affected;
end;
$$;

-- -------------------------------------------------------------------
-- P4a: Ensure INACTIVE plans are not visible in public catalog
-- -------------------------------------------------------------------
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
        and upper(coalesce(version.provider_status, '')) = 'ACTIVE'
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
       and upper(coalesce(version.provider_status, '')) = 'ACTIVE'
        and (offer.acquisition_starts_at is null or offer.acquisition_starts_at <= now())
        and (offer.acquisition_ends_at is null or offer.acquisition_ends_at > now())
        and (offer.subscription_limit is null or offer.used_count < offer.subscription_limit)
    ) row_data), '[]'::jsonb)
  );
$$;

-- -------------------------------------------------------------------
-- P4b: Ensure INACTIVE plans are not purchasable via subscription
-- -------------------------------------------------------------------
create or replace function public.prepare_paypal_subscription(
  p_user_id uuid, p_listing_id uuid, p_plan_version_id uuid, p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare listing public.server_listings%rowtype; selected record; existing public.billing_subscriptions%rowtype;
  new_subscription_id uuid; external_plan text; custom_value text;
begin
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
  where version.id = p_plan_version_id and version.environment = 'sandbox'
    and version.sync_status = 'synced'
    and upper(coalesce(version.provider_status, '')) = 'ACTIVE';
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

-- -------------------------------------------------------------------
-- M2: Sanitize process_paypal_billing_event error logging
--     Don't store raw sqlerrm in billing_events
-- -------------------------------------------------------------------
-- -------------------------------------------------------------------
-- M2: Safe and schema-correct PayPal webhook reconciliation
-- -------------------------------------------------------------------
create or replace function public.process_paypal_billing_event(
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
  target public.billing_subscriptions%rowtype;

  event_time timestamptz;
  next_billing timestamptz;

  payment_inserted boolean := false;

  external_sub text :=
    nullif(p_data->>'subscription_id', '');

  external_payment text :=
    nullif(p_data->>'payment_id', '');

  custom_ref text :=
    nullif(
      coalesce(
        p_data->>'custom_id',
        p_payload->'resource'->>'custom_id'
      ),
      ''
    );

  event_reason text :=
    nullif(p_data->>'reason', '');

  amount_minor integer :=
    greatest(
      coalesce(
        nullif(p_data->>'amount_minor', '')::integer,
        0
      ),
      0
    );
begin

  -- ---------------------------------------------------------------
  -- Basic validation
  -- ---------------------------------------------------------------

  if p_event_id is null
     or char_length(p_event_id) < 8
     or char_length(p_event_id) > 128
  then
    raise exception 'invalid_event_id';
  end if;

  if p_event_type is null
     or p_event_type not in (
       'BILLING.SUBSCRIPTION.CREATED',
       'BILLING.SUBSCRIPTION.ACTIVATED',
       'BILLING.SUBSCRIPTION.UPDATED',
       'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
       'BILLING.SUBSCRIPTION.CANCELLED',
       'BILLING.SUBSCRIPTION.SUSPENDED',
       'BILLING.SUBSCRIPTION.EXPIRED',
       'PAYMENT.SALE.COMPLETED',
       'PAYMENT.SALE.REFUNDED',
       'PAYMENT.SALE.REVERSED'
     )
  then
    raise exception 'invalid_event_type';
  end if;

  if p_data is null
     or jsonb_typeof(p_data) <> 'object'
  then
    raise exception 'invalid_event_data';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or pg_column_size(p_payload) > 1048576
  then
    raise exception 'invalid_event_payload';
  end if;


  -- ---------------------------------------------------------------
  -- Event timestamps
  -- ---------------------------------------------------------------

  event_time :=
    coalesce(
      nullif(p_data->>'event_time', '')::timestamptz,
      now()
    );

  next_billing :=
    nullif(
      p_data->>'next_billing_time',
      ''
    )::timestamptz;


  -- ---------------------------------------------------------------
  -- Webhook idempotency
  --
  -- private.billing_events PK:
  -- (provider, environment, event_id)
  -- ---------------------------------------------------------------

  insert into private.billing_events(
    provider,
    environment,
    event_id,
    event_type,
    resource_id,
    payload,
    event_created_at
  )
  values (
    'paypal',
    'sandbox',
    p_event_id,
    p_event_type,
    coalesce(
      external_sub,
      external_payment,
      custom_ref
    ),
    p_payload,
    event_time
  )
  on conflict (
    provider,
    environment,
    event_id
  )
  do nothing;

  if not found then
    -- Event already processed/registered.
    return false;
  end if;


  -- ---------------------------------------------------------------
  -- Resolve local subscription
  -- ---------------------------------------------------------------

  if external_sub is not null then

    select *
    into target
    from public.billing_subscriptions
    where payment_provider = 'paypal'
      and environment = 'sandbox'
      and external_subscription_id = external_sub
    for update;

  end if;


  -- Refund/reversal events may resolve from an existing payment.
  if target.id is null
     and external_payment is not null
  then

    select subscription.*
    into target
    from public.billing_payments payment
    join public.billing_subscriptions subscription
      on subscription.id = payment.subscription_id
    where payment.payment_provider = 'paypal'
      and payment.external_payment_id = external_payment
    for update of subscription;

  end if;


  -- Fallback for early PayPal events which arrive before the
  -- external_subscription_id has been attached locally.
  if target.id is null
     and custom_ref is not null
  then

    select *
    into target
    from public.billing_subscriptions
    where payment_provider = 'paypal'
      and environment = 'sandbox'
      and custom_id = custom_ref
    for update;

    if target.id is not null
       and external_sub is not null
       and target.external_subscription_id is null
    then

      update public.billing_subscriptions
      set
        external_subscription_id = external_sub,
        updated_at = now()
      where id = target.id;

      update public.server_listings
      set
        external_subscription_id = external_sub,
        updated_at = now()
      where id = target.server_listing_id
        and billing_source = 'paypal';

      target.external_subscription_id := external_sub;

    end if;

  end if;


  /*
   * IMPORTANT:
   *
   * We deliberately raise here instead of marking the event as
   * successfully processed.
   *
   * The transaction rolls back the billing_events INSERT, allowing
   * PayPal to retry the webhook after the local subscription exists.
   */
  if target.id is null then
    raise exception 'subscription_not_found';
  end if;


  -- ===============================================================
  -- SUBSCRIPTION CREATED
  -- ===============================================================

  if p_event_type = 'BILLING.SUBSCRIPTION.CREATED' then

    update public.billing_subscriptions
    set
      status =
        case
          when status = 'pending'
            then 'approval_pending'
          else status
        end,

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id
      and (
        provider_updated_at is null
        or event_time >= provider_updated_at
      );


  -- ===============================================================
  -- SUBSCRIPTION ACTIVATED
  --
  -- IMPORTANT:
  -- This DOES NOT mark the server listing as paid.
  -- PAYMENT.SALE.COMPLETED is required for that.
  -- ===============================================================

  elsif p_event_type = 'BILLING.SUBSCRIPTION.ACTIVATED' then

    update public.billing_subscriptions
    set
      status =
        case
          when status in (
            'cancelled',
            'expired',
            'refunded',
            'reversed',
            'cancellation_pending'
          )
          then status

          else 'active'
        end,

      next_billing_time =
        coalesce(
          next_billing,
          next_billing_time
        ),

      current_period_end =
        coalesce(
          next_billing,
          current_period_end
        ),

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id
      and (
        provider_updated_at is null
        or event_time >= provider_updated_at
      );

    /*
     * DO NOT UPDATE server_listings HERE.
     *
     * A PayPal subscription being ACTIVE is not proof that the
     * corresponding payment has been successfully captured.
     */


  -- ===============================================================
  -- SUBSCRIPTION UPDATED
  -- ===============================================================

  elsif p_event_type = 'BILLING.SUBSCRIPTION.UPDATED' then

    update public.billing_subscriptions
    set
      status =
        case
          when status in (
            'cancelled',
            'expired',
            'refunded',
            'reversed',
            'cancellation_pending'
          )
          then status

          else 'active'
        end,

      next_billing_time =
        coalesce(
          next_billing,
          next_billing_time
        ),

      current_period_end =
        coalesce(
          next_billing,
          current_period_end
        ),

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id
      and (
        provider_updated_at is null
        or event_time >= provider_updated_at
      );


  -- ===============================================================
  -- SUCCESSFUL PAYMENT
  --
  -- This is the ONLY event that activates a paid listing.
  -- ===============================================================

  elsif p_event_type = 'PAYMENT.SALE.COMPLETED' then

    if external_payment is null
       or amount_minor <= 0
    then
      raise exception 'invalid_payment_event';
    end if;


    insert into public.billing_payments(
      subscription_id,
      user_id,
      server_listing_id,
      payment_provider,
      external_payment_id,
      external_event_id,
      status,
      amount_minor,
      currency,
      paid_at
    )
    values (
      target.id,
      target.user_id,
      target.server_listing_id,
      'paypal',
      external_payment,
      p_event_id,
      'paid',
      amount_minor,
      coalesce(
        nullif(p_data->>'currency', ''),
        target.currency
      ),
      event_time
    )
    on conflict do nothing;

    payment_inserted := found;


    /*
     * Duplicate webhook or duplicate PayPal payment.
     *
     * Do not increment cycles or offer usage again.
     */
    if payment_inserted
       and target.status not in (
         'cancelled',
         'suspended',
         'expired',
         'refunded',
         'reversed'
       )
    then

      update public.billing_subscriptions
      set
        status =
          case
            when status = 'cancellation_pending'
              then 'cancellation_pending'
            else 'active'
          end,

        completed_cycles =
          completed_cycles + 1,

        current_period_start =
          coalesce(
            current_period_start,
            event_time
          ),

        next_billing_time =
          coalesce(
            next_billing,
            next_billing_time
          ),

        current_period_end =
          coalesce(
            next_billing,
            current_period_end
          ),

        provider_updated_at =
          greatest(
            coalesce(provider_updated_at, event_time),
            event_time
          ),

        failure_reason = null,

        updated_at = now()

      where id = target.id;


      update public.server_listings listing
      set
        status = 'active',

        payment_status = 'paid',

        starts_at =
          coalesce(
            starts_at,
            event_time
          ),

        expires_at =
          coalesce(
            next_billing,
            expires_at
          ),

        current_period_end =
          coalesce(
            next_billing,
            current_period_end
          ),

        external_payment_id =
          external_payment,

        /*
         * Only Plus listings can be featured.
         *
         * The visibility trigger will also remove featured state
         * when cancel_at_period_end is already true.
         */
        is_featured =
          (listing.plan = 'plus'),

        billing_failure_reason = null,

        updated_at = now()

      where id = target.server_listing_id
        and billing_source = 'paypal'
        and status <> 'rejected';


      /*
       * An offer is consumed ONE TIME PER SUBSCRIPTION,
       * not once per monthly payment.
       *
       * target.completed_cycles contains the value BEFORE the
       * increment performed above.
       */
      if target.completed_cycles = 0
         and target.offer_id is not null
      then

        update public.billing_offers
        set
          used_count = used_count + 1,
          updated_at = now()
        where id = target.offer_id;

      end if;

    end if;


  -- ===============================================================
  -- PAYMENT FAILED
  -- ===============================================================

  elsif p_event_type =
    'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
  then

    update public.billing_subscriptions
    set
      status =
        case
          when status in (
            'cancelled',
            'expired',
            'refunded',
            'reversed',
            'cancellation_pending'
          )
          then status

          else 'failed'
        end,

      failure_reason =
        coalesce(
          event_reason,
          'payment_failed'
        ),

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id
      and (
        provider_updated_at is null
        or event_time >= provider_updated_at
      );


    update public.server_listings
    set
      payment_status = 'failed',
      status =
        case
          when status = 'rejected'
            then status
          else 'paused'::public.listing_status
        end,
      is_featured = false,
      billing_failure_reason =
        coalesce(
          event_reason,
          'paypal_payment_failed'
        ),
      updated_at = now()

    where id = target.server_listing_id
      and billing_source = 'paypal'
      and status <> 'rejected';


  -- ===============================================================
  -- SUBSCRIPTION SUSPENDED
  -- ===============================================================

  elsif p_event_type =
    'BILLING.SUBSCRIPTION.SUSPENDED'
  then

    update public.billing_subscriptions
    set
      status =
        case
          when status in (
            'cancelled',
            'expired',
            'refunded',
            'reversed'
          )
          then status

          else 'suspended'
        end,

      failure_reason =
        coalesce(
          event_reason,
          'subscription_suspended'
        ),

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id
      and (
        provider_updated_at is null
        or event_time >= provider_updated_at
      );


    update public.server_listings
    set
      status =
        case
          when status = 'rejected'
            then status
          else 'paused'::public.listing_status
        end,

      is_featured = false,

      billing_failure_reason =
        coalesce(
          event_reason,
          'paypal_subscription_suspended'
        ),

      updated_at = now()

    where id = target.server_listing_id
      and billing_source = 'paypal'
      and status <> 'rejected';


  -- ===============================================================
  -- SUBSCRIPTION CANCELLED
  --
  -- W.E.A.F policy:
  -- retain the already-paid entitlement until current_period_end.
  -- ===============================================================

  elsif p_event_type =
    'BILLING.SUBSCRIPTION.CANCELLED'
  then

    /*
     * There is still paid time remaining.
     */
    if target.current_period_end is not null
       and target.current_period_end > event_time
    then

      update public.billing_subscriptions
      set
        status = 'cancellation_pending',
        auto_renew = false,

        provider_updated_at =
          greatest(
            coalesce(provider_updated_at, event_time),
            event_time
          ),

        updated_at = now()

      where id = target.id;


      update public.server_listings
      set
        cancel_at_period_end = true,

        /*
         * Remove Plus promotion immediately,
         * but keep the paid listing active.
         */
        is_featured = false,

        updated_at = now()

      where id = target.server_listing_id
        and billing_source = 'paypal';


    /*
     * No paid period remains.
     */
    else

      update public.billing_subscriptions
      set
        status = 'cancelled',
        auto_renew = false,

        provider_updated_at =
          greatest(
            coalesce(provider_updated_at, event_time),
            event_time
          ),

        updated_at = now()

      where id = target.id;


      update public.server_listings
      set
        status = 'canceled',
        payment_status = 'canceled',
        cancel_at_period_end = false,
        is_featured = false,
        updated_at = now()

      where id = target.server_listing_id
        and billing_source = 'paypal';

    end if;


  -- ===============================================================
  -- SUBSCRIPTION EXPIRED
  -- ===============================================================

  elsif p_event_type =
    'BILLING.SUBSCRIPTION.EXPIRED'
  then

    update public.billing_subscriptions
    set
      status = 'expired',
      auto_renew = false,

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id;


    update public.server_listings
    set
      status = 'expired',
      payment_status = 'canceled',
      cancel_at_period_end = false,
      is_featured = false,
      updated_at = now()

    where id = target.server_listing_id
      and billing_source = 'paypal';


  -- ===============================================================
  -- PAYMENT REFUNDED
  -- ===============================================================

  elsif p_event_type =
    'PAYMENT.SALE.REFUNDED'
  then

    update public.billing_subscriptions
    set
      status = 'refunded',

      failure_reason =
        coalesce(
          event_reason,
          'paypal_payment_refunded'
        ),

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id;


    if external_payment is not null then

      update public.billing_payments
      set
        status = 'refunded',
        refunded_at = event_time,
        updated_at = now()

      where payment_provider = 'paypal'
        and external_payment_id =
          external_payment;

    end if;


    update public.server_listings
    set
      status = 'canceled',
      payment_status = 'refunded',
      is_featured = false,

      billing_failure_reason =
        coalesce(
          event_reason,
          'paypal_payment_refunded'
        ),

      updated_at = now()

    where id = target.server_listing_id
      and billing_source = 'paypal';


  -- ===============================================================
  -- PAYMENT REVERSED
  -- ===============================================================

  elsif p_event_type =
    'PAYMENT.SALE.REVERSED'
  then

    update public.billing_subscriptions
    set
      status = 'reversed',

      failure_reason =
        coalesce(
          event_reason,
          'paypal_payment_reversed'
        ),

      provider_updated_at =
        greatest(
          coalesce(provider_updated_at, event_time),
          event_time
        ),

      updated_at = now()

    where id = target.id;


    if external_payment is not null then

      update public.billing_payments
      set
        status = 'reversed',
        refunded_at = event_time,
        updated_at = now()

      where payment_provider = 'paypal'
        and external_payment_id =
          external_payment;

    end if;


    update public.server_listings
    set
      status = 'paused',
      payment_status = 'failed',
      is_featured = false,

      billing_failure_reason =
        coalesce(
          event_reason,
          'paypal_payment_reversed'
        ),

      updated_at = now()

    where id = target.server_listing_id
      and billing_source = 'paypal'
      and status <> 'rejected';

  end if;


  -- ---------------------------------------------------------------
  -- Event successfully reconciled
  -- ---------------------------------------------------------------

  update private.billing_events
  set
    processed_at = now(),
    processing_error = null

  where provider = 'paypal'
    and environment = 'sandbox'
    and event_id = p_event_id;


  return true;


exception
  when others then

    /*
     * Do NOT persist sqlerrm/raw PostgreSQL details.
     *
     * The exception is intentionally re-raised so the Edge Function
     * returns a controlled failure and PayPal can retry the webhook.
     */
    raise;

end;
$$;

-- -------------------------------------------------------------------
-- S2: Remove deprecated auth.role()/current_user checks from 7 remaining RPCs
-- All 10 are REVOKE FROM public,anon,authenticated + GRANT TO service_role.
-- Internal auth checks are redundant with GRANT/REVOKE.
-- -------------------------------------------------------------------

create or replace function public.attach_paypal_subscription(p_subscription_id uuid, p_user_id uuid, p_external_subscription_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_external_subscription_id !~ '^[A-Z0-9-]{8,64}$' then raise exception 'invalid_paypal_subscription'; end if;
  update public.billing_subscriptions set external_subscription_id = p_external_subscription_id,
    status = 'approval_pending', updated_at = now()
  where id = p_subscription_id and user_id = p_user_id and payment_provider = 'paypal' and status = 'pending';
  if not found then raise exception 'subscription_not_available'; end if;
  update public.server_listings set external_subscription_id = p_external_subscription_id, updated_at = now()
  where billing_subscription_id = p_subscription_id and owner_user_id = p_user_id;
end;
$$;

create or replace function public.get_paypal_subscription_for_cancel(p_user_id uuid, p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected public.billing_subscriptions%rowtype;
begin
  select * into selected from public.billing_subscriptions where id=p_subscription_id and user_id=p_user_id and payment_provider='paypal' for update;
  if selected.id is null then raise exception 'subscription_not_owned'; end if;
  if selected.status in ('cancelled','expired','refunded','reversed') then return jsonb_build_object('already_terminal',true,'status',selected.status); end if;
  return jsonb_build_object('already_terminal',false,'external_subscription_id',selected.external_subscription_id,'listing_id',selected.server_listing_id);
end;
$$;

create or replace function public.get_paypal_reconciliation_batch(p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return coalesce((select jsonb_agg(to_jsonb(row_data)) from (
    select id,external_subscription_id,status,server_listing_id,provider_updated_at,last_reconciled_at
    from public.billing_subscriptions where payment_provider='paypal' and environment='sandbox'
      and external_subscription_id is not null and status in ('approval_pending','active','suspended','cancellation_pending','failed')
    order by coalesce(last_reconciled_at,'epoch'::timestamptz) asc limit least(greatest(p_limit,1),50)
  ) row_data),'[]'::jsonb);
end;
$$;

create or replace function public.apply_paypal_reconciliation(p_subscription_id uuid, p_status text, p_next_billing_time timestamptz, p_provider_time timestamptz, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare selected public.billing_subscriptions%rowtype; normalized text;
begin
  select * into selected from public.billing_subscriptions where id=p_subscription_id and payment_provider='paypal' for update;
  if selected.id is null then raise exception 'subscription_not_found'; end if;
  normalized:=case upper(coalesce(p_status,'')) when 'ACTIVE' then 'active' when 'SUSPENDED' then 'suspended'
    when 'CANCELLED' then 'cancelled' when 'EXPIRED' then 'expired' when 'APPROVAL_PENDING' then 'approval_pending' else 'failed' end;
  update public.billing_subscriptions set status=normalized,next_billing_time=p_next_billing_time,current_period_end=coalesce(p_next_billing_time,current_period_end),
    provider_updated_at=greatest(coalesce(provider_updated_at,p_provider_time),p_provider_time),last_reconciled_at=now(),
    reconciliation_failures=case when p_error is null then 0 else reconciliation_failures+1 end,failure_reason=coalesce(p_error,failure_reason),updated_at=now() where id=selected.id;
  if normalized<>'active' then update public.server_listings set status=case when normalized='cancelled' then 'canceled'::public.listing_status when normalized='expired' then 'expired'::public.listing_status else 'paused'::public.listing_status end,
    is_featured=false,billing_failure_reason=coalesce(p_error,'paypal_reconciliation_'||normalized),updated_at=now()
    where id=selected.server_listing_id and billing_source='paypal'; end if;
  insert into private.billing_audit_log(actor_user_id,subscription_id,action,before_data,after_data)
  values((select auth.uid()),selected.id,'paypal.reconciliation_applied',jsonb_build_object('status',selected.status),jsonb_build_object('status',normalized));
end;
$$;

create or replace function public.get_paypal_plan_sync_payload(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row_data record;
begin
  select version.*,plan.code,plan.name,plan.description,plan.tier,product.id product_uuid,product.external_product_id_sandbox
  into row_data from public.billing_plan_versions version join public.billing_plans plan on plan.id=version.plan_id
  join public.billing_products product on product.id=plan.product_id where version.id=p_version_id and version.environment='sandbox';
  if row_data.id is null then raise exception 'plan_version_not_found'; end if;
  return to_jsonb(row_data);
end;
$$;

create or replace function public.complete_paypal_product_sync(p_product_id uuid, p_external_product_id text, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$ begin
  update public.billing_products set external_product_id_sandbox=coalesce(p_external_product_id,external_product_id_sandbox),sync_status=case when p_error is null then 'synced' else 'failed' end,
    last_sync_error=p_error,synced_at=case when p_error is null then now() else synced_at end,updated_at=now() where id=p_product_id;
end; $$;

create or replace function public.complete_paypal_plan_sync(p_version_id uuid, p_external_plan_id text, p_provider_status text, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$ begin
  update public.billing_plan_versions set external_plan_id_sandbox=coalesce(p_external_plan_id,external_plan_id_sandbox),provider_status=p_provider_status,
    sync_status=case when p_error is null then 'synced' else 'failed' end,last_sync_error=p_error,
    synced_at=case when p_error is null then now() else synced_at end where id=p_version_id and environment='sandbox';
end; $$;

-- -------------------------------------------------------------------
-- S2-expire: expire_server_listings — auth.role() removed.
-- REVOKE from public,anon,authenticated + GRANT to service_role already restricts to service_role.
-- -------------------------------------------------------------------
create or replace function public.expire_server_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.server_listings set status = 'expired',
    payment_status = case when billing_source = 'paypal' then 'canceled'::public.payment_status else payment_status end,
    is_featured = false, updated_at = now()
  where status in ('active','paused')
    and expires_at is not null and expires_at <= now()
    and not (billing_source in ('stripe','paypal') and current_period_end is not null and current_period_end > now());
  get diagnostics affected = row_count;
  update public.billing_subscriptions set status = 'expired', updated_at = now()
  where status in ('active','suspended','cancellation_pending')
    and current_period_end is not null and current_period_end <= now();
  return affected;
end;
$$;
