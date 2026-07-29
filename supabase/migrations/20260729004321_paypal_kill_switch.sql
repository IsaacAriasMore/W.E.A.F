-- The database flag is authoritative for NEW PayPal subscriptions.
-- Existing subscriptions, webhooks, reconciliation and cancellation remain operational.

create or replace function public.get_paypal_checkout_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select flag.enabled
    from public.feature_flags flag
    where flag.key = 'paypal_payments'
  ), false);
$$;

revoke all on function public.get_paypal_checkout_status() from public;
grant execute on function public.get_paypal_checkout_status() to anon, authenticated;

create or replace function private.enforce_paypal_checkout_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_provider = 'paypal'
    and not coalesce((
      select flag.enabled
      from public.feature_flags flag
      where flag.key = 'paypal_payments'
    ), false)
  then
    raise exception 'billing_disabled';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_paypal_checkout_flag() from public, anon, authenticated;

drop trigger if exists billing_subscriptions_paypal_flag_guard on public.billing_subscriptions;
create trigger billing_subscriptions_paypal_flag_guard
before insert on public.billing_subscriptions
for each row execute function private.enforce_paypal_checkout_flag();

comment on function public.get_paypal_checkout_status() is
  'Sanitized public status for new PayPal Sandbox checkouts; no secret or catalog internals.';

comment on function private.enforce_paypal_checkout_flag() is
  'Fail-closed database guard for new PayPal subscriptions. Existing lifecycle events remain allowed.';
