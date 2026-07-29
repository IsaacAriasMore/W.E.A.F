-- PayPal Orders v2 Sandbox para destacar anuncios durante siete días.
-- Ninguna URL de retorno activa featured; solo process_marketplace_paypal_event,
-- invocada después de verificar la firma del webhook, puede hacerlo.

create or replace function public.prepare_marketplace_paypal_order(p_user_id uuid,p_listing_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare listing public.marketplace_listings%rowtype; setting public.marketplace_settings%rowtype; payment public.marketplace_payments%rowtype;
begin
  if p_user_id is null or p_listing_id is null or p_idempotency_key is null then raise exception 'invalid_marketplace_order'; end if;
  select * into setting from public.marketplace_settings where key='featured_listing' for share;
  if not setting.marketplace_enabled or not setting.payments_enabled or setting.price_minor is null or setting.environment<>'sandbox' then raise exception 'marketplace_payments_disabled'; end if;
  select * into listing from public.marketplace_listings where id=p_listing_id and owner_user_id=p_user_id for update;
  if listing.id is null then raise exception 'listing_not_owned'; end if;
  if listing.status<>'active' or listing.expires_at<=now() then raise exception 'listing_not_available'; end if;
  select * into payment from public.marketplace_payments where idempotency_key=p_idempotency_key;
  if payment.id is not null then
    if payment.user_id<>p_user_id or payment.listing_id<>p_listing_id then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('payment_id',payment.id,'amount_minor',payment.amount_minor,'currency',payment.currency,'custom_id','weaf_marketplace:'||payment.id::text,'paypal_order_id',payment.paypal_order_id,'existing',true,'idempotency_key',payment.idempotency_key);
  end if;
  if exists(select 1 from public.marketplace_payments where listing_id=p_listing_id and status in ('created','approved','captured')) then raise exception 'marketplace_payment_in_progress'; end if;
  insert into public.marketplace_payments(listing_id,user_id,amount_minor,currency,idempotency_key)
  values(p_listing_id,p_user_id,setting.price_minor,setting.currency,p_idempotency_key) returning * into payment;
  insert into public.marketplace_audit_log(listing_id,payment_id,actor_user_id,action,details)
  values(p_listing_id,payment.id,p_user_id,'paypal_order_prepared',jsonb_build_object('amount_minor',payment.amount_minor,'currency',payment.currency,'environment','sandbox'));
  return jsonb_build_object('payment_id',payment.id,'amount_minor',payment.amount_minor,'currency',payment.currency,'custom_id','weaf_marketplace:'||payment.id::text,'paypal_order_id',null,'existing',false,'idempotency_key',payment.idempotency_key);
end;
$$;

create or replace function public.attach_marketplace_paypal_order(p_payment_id uuid,p_user_id uuid,p_paypal_order_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_paypal_order_id is null or char_length(p_paypal_order_id) not between 8 and 64 then raise exception 'invalid_paypal_order_id'; end if;
  update public.marketplace_payments set paypal_order_id=p_paypal_order_id
  where id=p_payment_id and user_id=p_user_id and status='created' and (paypal_order_id is null or paypal_order_id=p_paypal_order_id);
  if not found then raise exception 'marketplace_payment_not_available'; end if;
end;
$$;

create or replace function public.prepare_marketplace_paypal_capture(p_payment_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare payment public.marketplace_payments%rowtype;
begin
  select * into payment from public.marketplace_payments where id=p_payment_id and user_id=p_user_id for update;
  if payment.id is null then raise exception 'marketplace_payment_not_owned'; end if;
  if payment.paypal_order_id is null then raise exception 'paypal_order_not_attached'; end if;
  if payment.status in ('refunded','reversed','failed') then raise exception 'marketplace_payment_not_available'; end if;
  return jsonb_build_object('payment_id',payment.id,'listing_id',payment.listing_id,'paypal_order_id',payment.paypal_order_id,'idempotency_key',payment.idempotency_key,'already_captured',payment.status='captured');
end;
$$;

create or replace function public.record_marketplace_capture_response(p_payment_id uuid,p_user_id uuid,p_capture_id text,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.marketplace_payments where id=p_payment_id and user_id=p_user_id and status='captured') then return; end if;
  update public.marketplace_payments set paypal_capture_id=coalesce(nullif(p_capture_id,''),paypal_capture_id),
    status=case when upper(coalesce(p_status,''))='COMPLETED' then 'approved' else status end
  where id=p_payment_id and user_id=p_user_id and status in ('created','approved');
  if not found then raise exception 'marketplace_payment_not_available'; end if;
  insert into public.marketplace_audit_log(payment_id,actor_user_id,action,details)
  values(p_payment_id,p_user_id,'capture_response_received',jsonb_build_object('paypal_status',left(coalesce(p_status,''),40)));
end;
$$;

create or replace function public.process_marketplace_paypal_event(p_event_id text,p_event_type text,p_data jsonb,p_payload jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare payment public.marketplace_payments%rowtype; event_time timestamptz; amount_minor integer; currency text;
begin
  if p_event_id is null or char_length(p_event_id) not between 8 and 128 then raise exception 'invalid_event_id'; end if;
  if p_event_type not in ('CHECKOUT.ORDER.APPROVED','PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED') then raise exception 'invalid_event_type'; end if;
  if jsonb_typeof(p_data)<>'object' or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>1048576 then raise exception 'invalid_event_payload'; end if;
  event_time:=coalesce(nullif(p_data->>'event_time','')::timestamptz,now());
  amount_minor:=greatest(coalesce(nullif(p_data->>'amount_minor','')::integer,0),0);
  currency:=upper(coalesce(p_data->>'currency',''));
  insert into private.billing_events(provider,environment,event_id,event_type,resource_id,payload,event_created_at)
  values('paypal','sandbox',p_event_id,p_event_type,coalesce(p_data->>'order_id',p_data->>'capture_id',p_data->>'custom_id'),p_payload,event_time)
  on conflict(provider,environment,event_id) do nothing;
  if not found then return false; end if;
  select * into payment from public.marketplace_payments
  where (nullif(p_data->>'order_id','') is not null and paypal_order_id=p_data->>'order_id')
     or (nullif(p_data->>'capture_id','') is not null and paypal_capture_id=p_data->>'capture_id')
     or (coalesce(p_data->>'custom_id','')='weaf_marketplace:'||id::text)
  order by created_at desc limit 1 for update;
  if payment.id is null then
    update private.billing_events set processed_at=now(),processing_error='resource_not_found' where provider='paypal' and environment='sandbox' and event_id=p_event_id;
    return true;
  end if;
  if p_event_type='CHECKOUT.ORDER.APPROVED' then
    update public.marketplace_payments set status=case when status='created' then 'approved' else status end where id=payment.id;
  elsif p_event_type='PAYMENT.CAPTURE.COMPLETED' then
    if payment.status in ('refunded','reversed') then
      insert into public.marketplace_audit_log(listing_id,payment_id,action,details) values(payment.listing_id,payment.id,'stale_capture_ignored',jsonb_build_object('terminal_status',payment.status));
    elsif amount_minor<>payment.amount_minor or currency<>payment.currency then
      update public.marketplace_payments set status='failed' where id=payment.id;
      insert into public.marketplace_audit_log(listing_id,payment_id,action,details) values(payment.listing_id,payment.id,'capture_amount_mismatch',jsonb_build_object('expected_minor',payment.amount_minor,'received_minor',amount_minor,'expected_currency',payment.currency,'received_currency',currency));
    else
      update public.marketplace_payments set status='captured',paypal_capture_id=coalesce(nullif(p_data->>'capture_id',''),paypal_capture_id),external_event_id=p_event_id,paid_at=event_time where id=payment.id;
      update public.marketplace_listings set status='active',is_featured=true,published_at=event_time,expires_at=event_time+interval '7 days' where id=payment.listing_id;
      insert into public.marketplace_audit_log(listing_id,payment_id,action,details) values(payment.listing_id,payment.id,'featured_activated',jsonb_build_object('duration_days',7,'environment','sandbox'));
    end if;
  elsif p_event_type='PAYMENT.CAPTURE.DENIED' then
    update public.marketplace_payments set status='failed',external_event_id=p_event_id where id=payment.id and status<>'captured';
  elsif p_event_type='PAYMENT.CAPTURE.REFUNDED' then
    update public.marketplace_payments set status='refunded',external_event_id=p_event_id where id=payment.id;
    update public.marketplace_listings set status='refunded',is_featured=false where id=payment.listing_id;
  elsif p_event_type='PAYMENT.CAPTURE.REVERSED' then
    update public.marketplace_payments set status='reversed',external_event_id=p_event_id where id=payment.id;
    update public.marketplace_listings set status='reversed',is_featured=false where id=payment.listing_id;
  end if;
  update private.billing_events set processed_at=now(),processing_error=null where provider='paypal' and environment='sandbox' and event_id=p_event_id;
  return true;
exception when others then
  update private.billing_events set processed_at=now(),processing_error='marketplace_processing_failed' where provider='paypal' and environment='sandbox' and event_id=p_event_id;
  raise;
end;
$$;

revoke all on function public.prepare_marketplace_paypal_order(uuid,uuid,uuid),public.attach_marketplace_paypal_order(uuid,uuid,text),public.prepare_marketplace_paypal_capture(uuid,uuid),public.record_marketplace_capture_response(uuid,uuid,text,text),public.process_marketplace_paypal_event(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_marketplace_paypal_order(uuid,uuid,uuid),public.attach_marketplace_paypal_order(uuid,uuid,text),public.prepare_marketplace_paypal_capture(uuid,uuid),public.record_marketplace_capture_response(uuid,uuid,text,text),public.process_marketplace_paypal_event(text,text,jsonb,jsonb) to service_role;
