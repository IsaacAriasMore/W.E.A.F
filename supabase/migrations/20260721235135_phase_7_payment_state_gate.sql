alter function public.process_stripe_server_event(text,text,jsonb)
  rename to process_stripe_server_event_verified_payload;

create or replace function public.process_stripe_server_event(p_event_id text, p_event_type text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_event_type='checkout.session.completed' and (
    coalesce(p_data->>'payment_status','') not in ('paid','no_payment_required')
    or nullif(p_data->>'amount_total','') is null
  ) then raise exception 'checkout_not_paid'; end if;
  if p_event_type='invoice.paid' and coalesce((p_data->>'amount_paid')::integer,-1) < 0
    then raise exception 'invalid_invoice_amount'; end if;
  return public.process_stripe_server_event_verified_payload(p_event_id,p_event_type,p_data);
end;
$$;

revoke all on function public.process_stripe_server_event_verified_payload(text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.process_stripe_server_event(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.process_stripe_server_event(text,text,jsonb) to service_role;
