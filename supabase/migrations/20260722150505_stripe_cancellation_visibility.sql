-- Hide Stripe listings immediately when cancellation or payment failure is observed.

update public.server_listings
set payment_status = 'not_required'
where billing_source = 'manual';

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
    new.payment_status := 'not_required';
  elsif tg_op = 'UPDATE'
    and private.is_global_admin()
    and new.status = 'active'
    and new.stripe_subscription_id is null
  then
    new.created_by_admin := coalesce(new.created_by_admin, (select auth.uid()));
    new.billing_source := 'manual';
    new.payment_status := 'not_required';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_server_listing_visibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.billing_source = 'stripe' then
    if new.payment_status = 'canceled' then
      new.status := 'canceled';
      new.is_featured := false;
    elsif new.payment_status = 'failed' then
      new.status := case when new.status = 'rejected' then new.status else 'paused'::public.listing_status end;
      new.is_featured := false;
    elsif new.cancel_at_period_end then
      new.status := case when new.status = 'rejected' then new.status else 'paused'::public.listing_status end;
      new.is_featured := false;
    elsif new.status in ('canceled', 'expired', 'paused', 'hidden', 'rejected', 'pending_payment', 'draft') then
      new.is_featured := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_server_listing_visibility on public.server_listings;
create trigger enforce_server_listing_visibility
before insert or update on public.server_listings
for each row execute function private.enforce_server_listing_visibility();

update public.server_listings
set
  status = case
    when payment_status = 'canceled' then 'canceled'::public.listing_status
    else 'paused'::public.listing_status
  end,
  is_featured = false,
  updated_at = now()
where billing_source = 'stripe'
  and status <> 'rejected'
  and (
    cancel_at_period_end
    or payment_status in ('failed', 'canceled')
  );

drop policy if exists listings_public_or_owner_read on public.server_listings;
create policy listings_public_or_owner_read
on public.server_listings for select to anon, authenticated
using (
  (
    status = 'active'::public.listing_status
    and coalesce(starts_at, now()) <= now()
    and (expires_at is null or expires_at > now())
    and (
      (billing_source = 'stripe' and payment_status = 'paid' and not cancel_at_period_end)
      or (billing_source = 'manual' and payment_status = 'not_required')
    )
  )
  or owner_user_id = (select auth.uid())
  or private.is_global_admin()
);

create index if not exists server_listings_public_billing_idx
on public.server_listings(is_featured desc, created_at desc)
where status = 'active'
  and (
    (billing_source = 'stripe' and payment_status = 'paid' and not cancel_at_period_end)
    or (billing_source = 'manual' and payment_status = 'not_required')
  );

revoke all on function private.enforce_server_listing_visibility() from public, anon, authenticated;
