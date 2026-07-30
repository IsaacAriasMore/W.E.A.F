-- Private QA gate for controlled PayPal Sandbox validation.
-- It is an additional gate only: it never bypasses either payment kill switch.

create table private.marketplace_payment_qa_settings (
  key text primary key check (key = 'sandbox_allowlist'),
  enforced boolean not null default true,
  updated_at timestamptz not null default now()
);

create table private.marketplace_payment_qa_allowlist (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 200),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.marketplace_payment_qa_settings(key, enforced)
values ('sandbox_allowlist', true);

create trigger set_marketplace_payment_qa_settings_updated_at
before update on private.marketplace_payment_qa_settings
for each row execute function private.set_updated_at();

create trigger set_marketplace_payment_qa_allowlist_updated_at
before update on private.marketplace_payment_qa_allowlist
for each row execute function private.set_updated_at();

revoke all on table
  private.marketplace_payment_qa_settings,
  private.marketplace_payment_qa_allowlist
from public, anon, authenticated;

create or replace function private.is_marketplace_payment_qa_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce((
      select enforced
      from private.marketplace_payment_qa_settings
      where key = 'sandbox_allowlist'
    ), true) = false then true
    else exists(
      select 1
      from private.marketplace_payment_qa_allowlist
      where user_id = p_user_id and active
    )
  end
$$;

revoke all on function private.is_marketplace_payment_qa_allowed(uuid)
  from public, anon, authenticated;

create or replace function public.get_marketplace_checkout_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'marketplace_enabled', s.marketplace_enabled,
    'featured_enabled',
      s.payments_enabled
      and s.price_minor = 300
      and s.currency = 'USD'
      and s.environment = 'sandbox'
      and coalesce(f.enabled, false)
      and (select auth.uid()) is not null
      and private.is_marketplace_payment_qa_allowed((select auth.uid())),
    'payments_enabled', s.payments_enabled and coalesce(f.enabled, false),
    'price_minor', 300,
    'currency', 'USD',
    'environment', 'sandbox',
    'qa_eligible', (select auth.uid()) is not null
      and private.is_marketplace_payment_qa_allowed((select auth.uid())),
    'qa_gate_enforced', coalesce(q.enforced, true)
  )
  from public.marketplace_settings s
  left join public.feature_flags f on f.key = 'paypal_payments'
  left join private.marketplace_payment_qa_settings q on q.key = 'sandbox_allowlist'
  where s.key = 'featured_listing'
$$;

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

  insert into public.marketplace_audit_log(
    listing_id, payment_id, actor_user_id, action, details
  ) values (
    p_listing_id, payment.id, p_user_id, 'paypal_order_prepared',
    jsonb_build_object(
      'amount_minor', 300, 'currency', 'USD', 'environment', 'sandbox',
      'qa_gate_enforced', true
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

comment on table private.marketplace_payment_qa_allowlist is
  'Server-only user-id allowlist for controlled PayPal Sandbox tests; contains no frontend-visible emails.';
comment on function public.prepare_marketplace_paypal_order(uuid, uuid, uuid) is
  'Requires both kill switches, Sandbox, exact USD 3 server price, ownership, ASA and the optional private QA gate.';
