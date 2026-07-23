-- Phase 7: Stripe Checkout, signed webhook reconciliation and listing expiry.

alter table public.subscriptions
  add column if not exists plan_id uuid references public.plans(id),
  add column if not exists checkout_payment_id uuid references public.payments(id),
  add column if not exists stripe_customer_id text,
  add column if not exists current_period_start timestamptz;

alter table public.payments
  add column if not exists stripe_invoice_id text,
  add column if not exists failure_reason text;

create unique index if not exists subscriptions_stripe_id_unique
  on public.subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;
create unique index if not exists payments_checkout_session_unique
  on public.payments(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists payments_invoice_unique
  on public.payments(stripe_invoice_id) where stripe_invoice_id is not null;
create index if not exists subscriptions_period_end_idx
  on public.subscriptions(current_period_end) where status in ('active', 'trialing', 'past_due');
create index if not exists server_listings_expiration_idx
  on public.server_listings(expires_at) where status = 'active' and expires_at is not null;

update public.plans set name = 'Normal', price_usd_cents = 300, duration_months = 1,
  features = '["Ficha completa","Edición mientras esté activo","Analítica de clics"]'::jsonb,
  is_active = true, updated_at = now() where code = 'normal';
update public.plans set name = 'Plus', price_usd_cents = 700, duration_months = 1,
  features = '["Todo lo de Normal","Posición destacada","Insignia de destacado"]'::jsonb,
  is_active = true, updated_at = now() where code = 'plus';

create or replace function public.prepare_server_checkout(p_user_id uuid, p_plan_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare selected_plan public.plans%rowtype; payment_id uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_user_id is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and not is_suspended) then raise exception 'account_not_available'; end if;
  select * into selected_plan from public.plans where code = p_plan_code and is_active and code in ('normal', 'plus');
  if selected_plan.id is null or selected_plan.price_usd_cents <= 0 then raise exception 'plan_not_available'; end if;
  if exists (select 1 from public.payments where user_id = p_user_id and status = 'pending' and created_at >= now() - interval '2 minutes')
    then raise exception 'checkout_rate_limit'; end if;
  insert into public.payments (user_id, plan_id, amount_usd_cents, status)
  values (p_user_id, selected_plan.id, selected_plan.price_usd_cents, 'pending') returning id into payment_id;
  return jsonb_build_object('payment_id', payment_id, 'plan_id', selected_plan.id, 'plan_code', selected_plan.code,
    'plan_name', selected_plan.name, 'amount_usd_cents', selected_plan.price_usd_cents);
end;
$$;

create or replace function public.attach_stripe_checkout_session(p_payment_id uuid, p_user_id uuid, p_session_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+' then raise exception 'invalid_checkout_session'; end if;
  update public.payments set stripe_checkout_session_id = p_session_id, updated_at = now()
  where id = p_payment_id and user_id = p_user_id and status = 'pending';
  if not found then raise exception 'payment_not_available'; end if;
end;
$$;

create or replace function public.process_stripe_server_event(p_event_id text, p_event_type text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_payment public.payments%rowtype; target_subscription public.subscriptions%rowtype; plan_uuid uuid; new_subscription_id uuid; period_end timestamptz;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_event_id !~ '^evt_[A-Za-z0-9]+' or char_length(p_event_type) > 100 or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 65536 then raise exception 'invalid_stripe_event'; end if;
  insert into private.stripe_events(id,event_type,payload) values (p_event_id,p_event_type,p_data) on conflict (id) do nothing;
  if not found then return false; end if;

  if p_event_type = 'checkout.session.completed' then
    select * into target_payment from public.payments where id = (p_data->>'payment_id')::uuid and user_id = (p_data->>'user_id')::uuid for update;
    if target_payment.id is null or target_payment.amount_usd_cents <> (p_data->>'amount_total')::integer then raise exception 'payment_reconciliation_failed'; end if;
    select id into plan_uuid from public.plans where id = target_payment.plan_id and code = p_data->>'plan_code';
    if plan_uuid is null then raise exception 'plan_reconciliation_failed'; end if;
    period_end := to_timestamp((p_data->>'current_period_end')::double precision);
    if period_end <= now() then raise exception 'invalid_subscription_period'; end if;
    update public.payments set status='paid', stripe_checkout_session_id=p_data->>'session_id',
      stripe_payment_intent_id=nullif(p_data->>'payment_intent_id',''), updated_at=now() where id=target_payment.id;
    insert into public.subscriptions(user_id,plan_id,checkout_payment_id,stripe_subscription_id,stripe_customer_id,status,current_period_start,current_period_end,cancel_at_period_end)
    values (target_payment.user_id,plan_uuid,target_payment.id,p_data->>'subscription_id',p_data->>'customer_id',p_data->>'subscription_status',
      to_timestamp((p_data->>'current_period_start')::double precision),period_end,coalesce((p_data->>'cancel_at_period_end')::boolean,false))
    on conflict (stripe_subscription_id) where stripe_subscription_id is not null do update set
      status=excluded.status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
      cancel_at_period_end=excluded.cancel_at_period_end,stripe_customer_id=excluded.stripe_customer_id,
      checkout_payment_id=coalesce(public.subscriptions.checkout_payment_id,excluded.checkout_payment_id),updated_at=now()
    returning id into new_subscription_id;
  elsif p_event_type = 'invoice.paid' then
    select * into target_subscription from public.subscriptions where stripe_subscription_id=p_data->>'subscription_id' for update;
    if target_subscription.id is null then raise exception 'subscription_not_found'; end if;
    period_end := to_timestamp((p_data->>'current_period_end')::double precision);
    update public.subscriptions set status='active',current_period_end=period_end,updated_at=now() where id=target_subscription.id;
    update public.server_listings set status='active',expires_at=period_end,updated_at=now() where id=target_subscription.listing_id and status <> 'rejected';
    insert into public.payments(user_id,listing_id,plan_id,stripe_invoice_id,stripe_payment_intent_id,amount_usd_cents,status)
    values(target_subscription.user_id,target_subscription.listing_id,target_subscription.plan_id,p_data->>'invoice_id',nullif(p_data->>'payment_intent_id',''),
      (p_data->>'amount_paid')::integer,'paid') on conflict (stripe_invoice_id) where stripe_invoice_id is not null do nothing;
  elsif p_event_type in ('customer.subscription.updated','customer.subscription.deleted') then
    select * into target_subscription from public.subscriptions where stripe_subscription_id=p_data->>'subscription_id' for update;
    if target_subscription.id is null then raise exception 'subscription_not_found'; end if;
    period_end := to_timestamp((p_data->>'current_period_end')::double precision);
    update public.subscriptions set status=p_data->>'subscription_status',current_period_end=period_end,
      cancel_at_period_end=coalesce((p_data->>'cancel_at_period_end')::boolean,false),updated_at=now() where id=target_subscription.id;
    update public.server_listings set expires_at=period_end,
      status=case when p_event_type='customer.subscription.deleted' and period_end <= now() then 'canceled'::public.listing_status else status end,
      updated_at=now() where id=target_subscription.listing_id;
  else
    update private.stripe_events set processed_at=now() where id=p_event_id;
    return true;
  end if;
  update private.stripe_events set processed_at=now() where id=p_event_id;
  return true;
exception when others then
  update private.stripe_events set error=left(sqlerrm,1000) where id=p_event_id;
  raise;
end;
$$;

create or replace function public.create_paid_server_listing(p_subscription_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sub public.subscriptions%rowtype; selected_plan public.plans%rowtype; new_listing_id uuid; selected_platforms text[]; selected_mods text[]; selected_maps text[]; selected_gallery text[]; selected_rates jsonb;
begin
  select * into sub from public.subscriptions where id=p_subscription_id and user_id=(select auth.uid()) for update;
  if sub.id is null or sub.status not in ('active','trialing') or sub.current_period_end <= now() or sub.listing_id is not null then raise exception 'subscription_not_available'; end if;
  select * into selected_plan from public.plans where id=sub.plan_id and code in ('normal','plus');
  selected_platforms := array(select jsonb_array_elements_text(coalesce(p_payload->'platforms','[]'::jsonb)));
  selected_mods := array(select jsonb_array_elements_text(coalesce(p_payload->'mods','[]'::jsonb)));
  selected_maps := array(select jsonb_array_elements_text(coalesce(p_payload->'maps','[]'::jsonb)));
  selected_gallery := array(select jsonb_array_elements_text(coalesce(p_payload->'gallery_urls','[]'::jsonb)));
  selected_rates := coalesce(p_payload->'rates','{}'::jsonb);
  if pg_column_size(p_payload)>65536 or char_length(trim(p_payload->>'title')) not between 2 and 100 or (p_payload->>'slug') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(p_payload->>'description')) not between 20 and 4000 or cardinality(selected_platforms) not between 1 and 8 or cardinality(selected_maps) not between 1 and 20
    or cardinality(selected_mods)>30 or cardinality(selected_gallery)>6 or jsonb_typeof(selected_rates)<>'object' or (p_payload->>'discord_invite_url') !~ '^https://(discord[.]gg|discord[.]com/invite)/'
    then raise exception 'invalid_listing_payload'; end if;
  insert into public.server_listings(owner_user_id,plan,status,title,slug,game,server_type,platforms,has_mods,mods,maps,rates,region,language,description,discord_invite_url,website_url,banner_url,gallery_urls,is_featured,is_verified,starts_at,expires_at,cluster_name,wipe_date,uses_propagators)
  values((select auth.uid()),selected_plan.code::public.listing_plan,'active',trim(p_payload->>'title'),lower(trim(p_payload->>'slug')),(p_payload->>'game')::public.game_mode,(p_payload->>'server_type')::public.server_type,
    selected_platforms,cardinality(selected_mods)>0,selected_mods,selected_maps,selected_rates,trim(p_payload->>'region'),trim(p_payload->>'language'),trim(p_payload->>'description'),trim(p_payload->>'discord_invite_url'),
    nullif(trim(p_payload->>'website_url'),''),nullif(trim(p_payload->>'banner_url'),''),selected_gallery,selected_plan.code='plus',false,now(),sub.current_period_end,nullif(trim(p_payload->>'cluster_name'),''),nullif(p_payload->>'wipe_date','')::date,coalesce((p_payload->>'uses_propagators')::boolean,false)) returning id into new_listing_id;
  update public.subscriptions set listing_id=new_listing_id,updated_at=now() where id=sub.id;
  update public.payments set listing_id=new_listing_id,updated_at=now() where id=sub.checkout_payment_id;
  return new_listing_id;
exception when unique_violation then raise exception 'listing_slug_taken';
end;
$$;

create or replace function public.get_my_server_billing()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'subscriptions',coalesce((select jsonb_agg(to_jsonb(x)) from (select s.id,s.listing_id,s.status,s.current_period_end,s.cancel_at_period_end,p.code as plan_code,p.name as plan_name from public.subscriptions s join public.plans p on p.id=s.plan_id where s.user_id=(select auth.uid()) order by s.created_at desc) x),'[]'::jsonb),
    'listings',coalesce((select jsonb_agg(to_jsonb(l)) from public.server_listings l where l.owner_user_id=(select auth.uid())),'[]'::jsonb)
  );
$$;

create or replace function public.expire_server_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.server_listings set status='expired',updated_at=now() where status='active' and expires_at is not null and expires_at<=now();
  get diagnostics affected = row_count;
  update public.subscriptions set status='expired',updated_at=now() where status in ('active','trialing','past_due','canceled') and current_period_end is not null and current_period_end<=now();
  return affected;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  if exists(select 1 from cron.job where jobname='expire-server-listings') then perform cron.unschedule('expire-server-listings'); end if;
  perform cron.schedule('expire-server-listings','15 * * * *','select public.expire_server_listings();');
end $$;

alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
drop policy if exists payments_owner_read on public.payments;
create policy payments_owner_read on public.payments for select to authenticated using (user_id=(select auth.uid()) or private.is_global_admin());
drop policy if exists subscriptions_owner_read on public.subscriptions;
create policy subscriptions_owner_read on public.subscriptions for select to authenticated using (user_id=(select auth.uid()) or private.is_global_admin());

revoke all on public.plans,public.payments,public.subscriptions,public.server_listings from anon,authenticated;
grant select on public.plans to anon,authenticated;
grant select on public.payments,public.subscriptions to authenticated;
grant select on public.server_listings to anon,authenticated;

revoke all on function public.prepare_server_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.attach_stripe_checkout_session(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.process_stripe_server_event(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_server_checkout(uuid,text) to service_role;
grant execute on function public.attach_stripe_checkout_session(uuid,uuid,text) to service_role;
grant execute on function public.process_stripe_server_event(text,text,jsonb) to service_role;
revoke all on function public.create_paid_server_listing(uuid,jsonb),public.get_my_server_billing(),public.expire_server_listings() from public,anon;
grant execute on function public.create_paid_server_listing(uuid,jsonb),public.get_my_server_billing() to authenticated;
revoke all on function public.expire_server_listings() from authenticated,anon;

update public.feature_flags set description='Stripe Checkout y webhooks implementados; requiere secretos del proveedor',updated_at=now() where key='stripe_payments';
