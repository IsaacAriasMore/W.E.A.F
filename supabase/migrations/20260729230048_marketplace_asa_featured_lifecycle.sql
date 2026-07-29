-- Marketplace ASA-only writes and an independent seven-day featured lifecycle.
-- Historical ASE/Both rows remain stored for audit and rollback, but public RPCs hide them.

alter table public.marketplace_listings
  add column featured_started_at timestamptz,
  add column featured_expires_at timestamptz;

alter table public.marketplace_listings
  drop constraint marketplace_listings_check;

alter table public.marketplace_listings
  add constraint marketplace_active_term_check
  check (
    status <> 'active'
    or (published_at is not null and expires_at >= published_at + interval '7 days')
  );

alter table public.marketplace_listings
  add constraint marketplace_new_writes_asa_only
  check (game = 'ascended') not valid;

alter table public.marketplace_listings
  add constraint marketplace_featured_term_check
  check (
    not is_featured
    or (
      status = 'active'
      and featured_started_at is not null
      and featured_expires_at = featured_started_at + interval '7 days'
      and featured_expires_at <= expires_at
    )
  ) not valid;

create index marketplace_asa_catalog_idx
  on public.marketplace_listings(published_at desc, id desc)
  where status = 'active' and game = 'ascended';

create index marketplace_active_featured_term_idx
  on public.marketplace_listings(featured_expires_at, owner_user_id)
  where status = 'active' and is_featured and game = 'ascended';

update public.marketplace_settings
set price_minor = 300,
    currency = 'USD',
    environment = 'sandbox'
where key = 'featured_listing';

alter table public.marketplace_settings
  add constraint marketplace_featured_fixed_price_check
  check (price_minor is null or (price_minor = 300 and currency = 'USD' and environment = 'sandbox'));

create or replace function private.validate_marketplace_payload(p_payload jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  clean jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_marketplace_payload';
  end if;

  clean := jsonb_build_object(
    'category_id', nullif(p_payload->>'category_id', '')::uuid,
    'listing_type', p_payload->>'listing_type',
    'title', trim(p_payload->>'title'),
    'description', trim(p_payload->>'description'),
    'game', p_payload->>'game',
    'resource_name', trim(p_payload->>'resource_name'),
    'quantity', nullif(p_payload->>'quantity', '')::integer,
    'trade_terms', trim(p_payload->>'trade_terms'),
    'server_name', nullif(trim(p_payload->>'server_name'), ''),
    'region', trim(p_payload->>'region'),
    'platform', p_payload->>'platform',
    'language', trim(p_payload->>'language'),
    'discord_invite_url', trim(p_payload->>'discord_invite_url'),
    'image_url', nullif(trim(p_payload->>'image_url'), '')
  );

  if clean->>'game' <> 'ascended' then
    raise exception 'marketplace_asa_only';
  end if;
  if coalesce(clean->>'title', '') ~* '<[a-z!/]'
    or coalesce(clean->>'description', '') ~* '<[a-z!/]'
    or coalesce(clean->>'trade_terms', '') ~* '<[a-z!/]'
  then
    raise exception 'html_not_allowed';
  end if;
  if coalesce(clean->>'description', '') ~* '(password|contraseña|token|secret|cookie|cuenta robada|stolen account|cheat|exploit)' then
    raise exception 'prohibited_marketplace_content';
  end if;
  return clean;
exception when invalid_text_representation then
  raise exception 'invalid_marketplace_payload';
end;
$$;

create or replace function public.get_marketplace_catalog(p_slug text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'name_es', c.name_es, 'name_en', c.name_en
      ) order by c.sort_order)
      from public.marketplace_categories c
      where c.is_active
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'category_id', l.category_id, 'slug', l.slug,
        'listing_type', l.listing_type, 'title', l.title, 'description', l.description,
        'game', l.game, 'resource_name', l.resource_name, 'quantity', l.quantity,
        'trade_terms', l.trade_terms, 'server_name', l.server_name, 'region', l.region,
        'platform', l.platform, 'language', l.language,
        'discord_invite_url', l.discord_invite_url, 'image_url', l.image_url,
        'is_featured', l.is_featured and l.featured_expires_at > now(),
        'published_at', l.published_at, 'expires_at', l.expires_at,
        'featured_started_at', l.featured_started_at,
        'featured_expires_at', l.featured_expires_at
      ) order by (l.is_featured and l.featured_expires_at > now()) desc, l.published_at desc, l.id desc)
      from public.marketplace_listings l
      where l.status = 'active'
        and l.expires_at > now()
        and l.game = 'ascended'
        and (p_slug is null or l.slug = p_slug)
    ), '[]'::jsonb)
  );
$$;

create or replace function public.admin_set_marketplace_setting(
  p_marketplace_enabled boolean,
  p_payments_enabled boolean,
  p_price_minor integer,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_global_admin() then
    raise exception 'global_admin_required';
  end if;
  if p_price_minor is distinct from 300 or upper(coalesce(p_currency, '')) <> 'USD' then
    raise exception 'marketplace_featured_price_fixed';
  end if;
  update public.marketplace_settings
  set marketplace_enabled = p_marketplace_enabled,
      payments_enabled = p_payments_enabled,
      price_minor = 300,
      currency = 'USD',
      environment = 'sandbox',
      updated_by = (select auth.uid())
  where key = 'featured_listing';
  insert into public.marketplace_audit_log(actor_user_id, action, details)
  values (
    (select auth.uid()),
    'settings_updated',
    jsonb_build_object(
      'marketplace_enabled', p_marketplace_enabled,
      'payments_enabled', p_payments_enabled,
      'price_minor', 300,
      'currency', 'USD',
      'environment', 'sandbox'
    )
  );
end;
$$;

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
exception when others then
  update private.billing_events
  set processed_at = now(), processing_error = 'marketplace_processing_failed'
  where provider = 'paypal' and environment = 'sandbox' and event_id = p_event_id;
  raise;
end;
$$;

create or replace function public.expire_marketplace_featured_benefits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if (select auth.uid()) is not null
    and (select auth.role()) <> 'service_role'
    and not private.is_global_admin()
  then
    raise exception 'service_role_or_admin_required';
  end if;
  update public.marketplace_listings
  set is_featured = false
  where is_featured
    and featured_expires_at <= now();
  get diagnostics affected = row_count;
  insert into public.marketplace_audit_log(action, details)
  values ('featured_expiration_job', jsonb_build_object('expired', affected));
  return affected;
end;
$$;

revoke all on function public.expire_marketplace_featured_benefits()
  from public, anon, authenticated;
grant execute on function public.expire_marketplace_featured_benefits()
  to service_role;

comment on column public.marketplace_listings.featured_started_at is
  'Verified PayPal Sandbox webhook timestamp; independent from published_at.';
comment on column public.marketplace_listings.featured_expires_at is
  'Seven-day featured benefit end; listing expiry may be later but never earlier.';
