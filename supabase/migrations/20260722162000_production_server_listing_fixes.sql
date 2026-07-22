-- Production hardening for listing slugs, Stripe cancellation and public visibility.

create or replace function public.generate_server_listing_slug(
  p_title text,
  p_listing_id uuid default null
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  base_slug text;
  candidate text;
  suffix_number integer := 1;
begin
  base_slug := trim(both '-' from regexp_replace(
    translate(
      lower(trim(coalesce(p_title, ''))),
      'áàäâãåéèëêíìïîóòöôõúùüûñç',
      'aaaaaaeeeeiiiiooooouuuunc'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
  base_slug := left(coalesce(nullif(base_slug, ''), 'servidor'), 72);

  -- Serialize equal titles so concurrent inserts cannot choose the same suffix.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(base_slug, 0));
  candidate := base_slug;
  while exists (
    select 1
    from public.server_listings
    where slug = candidate
      and (p_listing_id is null or id <> p_listing_id)
  ) loop
    suffix_number := suffix_number + 1;
    candidate := left(base_slug, 71 - char_length(suffix_number::text)) || '-' || suffix_number::text;
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_server_listing_slug(text, uuid) from public, anon, authenticated;

create or replace function private.ensure_server_listing_slug()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.generate_server_listing_slug(new.title, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_server_listing_slug on public.server_listings;
create trigger ensure_server_listing_slug
before insert or update of title, slug on public.server_listings
for each row execute function private.ensure_server_listing_slug();

revoke all on function private.ensure_server_listing_slug() from public, anon, authenticated;

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
  selected_maps text[];
  selected_gallery text[];
  selected_rates jsonb;
  selected_has_mods boolean;
  generated_slug text;
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
  selected_maps := array(select jsonb_array_elements_text(coalesce(p_payload->'maps', '[]'::jsonb)));
  selected_gallery := array(select jsonb_array_elements_text(coalesce(p_payload->'gallery_urls', '[]'::jsonb)));
  selected_rates := coalesce(p_payload->'rates', '{"preset":"not_specified"}'::jsonb);
  selected_has_mods := coalesce((p_payload->>'has_mods')::boolean, false);

  if char_length(trim(p_payload->>'title')) not between 2 and 100
    or char_length(trim(p_payload->>'description')) not between 20 and 4000
    or char_length(trim(p_payload->>'region')) not between 2 and 40
    or char_length(trim(p_payload->>'language')) not between 2 and 40
    or cardinality(selected_platforms) not between 1 and 8
    or cardinality(selected_maps) not between 1 and 20
    or cardinality(selected_gallery) > 6
    or jsonb_typeof(selected_rates) <> 'object'
    or (p_payload->>'discord_invite_url') !~ '^https://(discord[.]gg|discord[.]com/invite)/'
    or (
      nullif(trim(p_payload->>'website_url'), '') is not null
      and (p_payload->>'website_url') !~ '^https?://'
    )
  then raise exception 'invalid_listing_payload'; end if;

  if p_listing_id is not null then
    select * into current_listing
    from public.server_listings
    where id = p_listing_id and owner_user_id = actor_id
    for update;
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
      slug = coalesce(nullif(slug, ''), public.generate_server_listing_slug(p_payload->>'title', id)),
      game = (p_payload->>'game')::public.game_mode,
      server_type = (p_payload->>'server_type')::public.server_type,
      platforms = selected_platforms,
      has_mods = selected_has_mods,
      mods = '{}'::text[],
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
    where id = current_listing.id
    returning id into result_id;
  else
    generated_slug := public.generate_server_listing_slug(p_payload->>'title');
    insert into public.server_listings (
      owner_user_id, plan, status, payment_status, billing_source,
      title, slug, game, server_type, platforms, has_mods, mods, maps, rates,
      region, language, description, discord_invite_url, website_url, banner_url,
      gallery_urls, is_featured, is_verified, cluster_name, wipe_date, uses_propagators
    ) values (
      actor_id, selected_plan, 'pending_payment', 'pending', 'stripe',
      trim(p_payload->>'title'), generated_slug,
      (p_payload->>'game')::public.game_mode, (p_payload->>'server_type')::public.server_type,
      selected_platforms, selected_has_mods, '{}'::text[], selected_maps, selected_rates,
      trim(p_payload->>'region'), trim(p_payload->>'language'), trim(p_payload->>'description'),
      trim(p_payload->>'discord_invite_url'), nullif(trim(p_payload->>'website_url'), ''),
      nullif(trim(p_payload->>'banner_url'), ''), selected_gallery, false, false,
      nullif(trim(p_payload->>'cluster_name'), ''), nullif(p_payload->>'wipe_date', '')::date,
      coalesce((p_payload->>'uses_propagators')::boolean, false)
    ) returning id into result_id;
  end if;
  return result_id;
end;
$$;

revoke all on function public.save_server_listing_draft(uuid, text, jsonb) from public, anon;
grant execute on function public.save_server_listing_draft(uuid, text, jsonb) to authenticated;

-- Preserve the audited processor and wrap it with the immediate visibility rule.
alter function public.process_stripe_listing_event(text, text, jsonb)
rename to process_stripe_listing_event_core;

revoke all on function public.process_stripe_listing_event_core(text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.process_stripe_listing_event_core(text, text, jsonb)
to service_role;

create function public.process_stripe_listing_event(
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
  event_processed boolean;
  listing_id uuid;
  cancel_at_end boolean := coalesce((p_data->>'cancel_at_period_end')::boolean, false);
  subscription_status text := coalesce(p_data->>'subscription_status', '');
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;

  event_processed := public.process_stripe_listing_event_core(p_event_id, p_event_type, p_data);
  if not event_processed then return false; end if;

  if coalesce(p_data->>'server_listing_id', '') ~ '^[0-9a-fA-F-]{36}$' then
    listing_id := (p_data->>'server_listing_id')::uuid;
  elsif nullif(p_data->>'subscription_id', '') is not null then
    select server_listing_id into listing_id
    from public.server_listing_subscriptions
    where stripe_subscription_id = p_data->>'subscription_id';
  end if;

  if p_event_type = 'customer.subscription.updated' and cancel_at_end then
    update public.server_listings set
      status = 'canceled',
      payment_status = 'canceled',
      is_featured = false,
      updated_at = now()
    where id = listing_id and status <> 'rejected';
  elsif p_event_type = 'customer.subscription.updated'
    and not cancel_at_end
    and subscription_status in ('active', 'trialing')
  then
    update public.server_listings set
      status = 'active',
      payment_status = 'paid',
      is_featured = plan = 'plus',
      updated_at = now()
    where id = listing_id and status <> 'rejected';
  end if;

  return true;
end;
$$;

revoke all on function public.process_stripe_listing_event(text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.process_stripe_listing_event(text, text, jsonb)
to service_role;

create or replace function private.enforce_server_listing_visibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.billing_source = 'stripe' then
    if new.payment_status = 'canceled' or new.cancel_at_period_end then
      new.status := case when new.status = 'rejected' then new.status else 'canceled'::public.listing_status end;
      new.payment_status := 'canceled';
      new.is_featured := false;
    elsif new.payment_status = 'failed' then
      new.status := case when new.status = 'rejected' then new.status else 'paused'::public.listing_status end;
      new.is_featured := false;
    elsif new.status in ('canceled', 'expired', 'paused', 'hidden', 'rejected', 'pending_payment', 'draft') then
      new.is_featured := false;
    end if;
  end if;
  return new;
end;
$$;

update public.server_listings
set status = 'canceled', payment_status = 'canceled', is_featured = false, updated_at = now()
where billing_source = 'stripe'
  and cancel_at_period_end
  and status <> 'rejected';

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
  );

revoke all on function private.enforce_server_listing_visibility() from public, anon, authenticated;
