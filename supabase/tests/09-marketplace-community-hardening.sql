-- Final Marketplace community hardening regression suite. Run after 01-seed-test-data.sql.
begin;

create schema if not exists tests;
create or replace function tests.set_actor(p_user_id uuid)
returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user_id::text, ''), true),
         set_config('request.jwt.claim.role', case when p_user_id is null then '' else 'authenticated' end, true)
$$;

do $$
declare
  viewer constant uuid := '00000000-0000-0000-0000-0000000000a5';
  seller_a constant uuid := '00000000-0000-0000-0000-0000000000a1';
  seller_b constant uuid := '00000000-0000-0000-0000-0000000000a2';
  listing_a constant uuid := 'a0000000-0000-0000-0000-000000000001';
  listing_b constant uuid := 'b0000000-0000-0000-0000-000000000001';
  event_id uuid := gen_random_uuid();
  result jsonb; page_two jsonb; cursor_value text; notification_b uuid; ok boolean;
begin
  delete from public.marketplace_recommendation_events where user_id in (viewer,seller_a,seller_b);
  insert into public.marketplace_recommendation_preferences(user_id,personalization_enabled)
    values(viewer,true),(seller_a,true),(seller_b,true)
    on conflict(user_id) do update set personalization_enabled=true;

  perform tests.set_actor(viewer);
  if not public.record_marketplace_recommendation_event('filter',null,'{"category":"resources"}',event_id)
    or public.record_marketplace_recommendation_event('filter',null,'{"category":"resources"}',event_id)
  then raise exception 'recommendation dedupe failed'; end if;
  begin
    perform public.record_marketplace_recommendation_event('unknown',null,'{}',gen_random_uuid());
    raise exception 'unknown recommendation event accepted';
  exception when others then
    if sqlerrm not like '%invalid_recommendation_event%' then raise; end if;
  end;

  perform tests.set_actor(seller_a);
  begin
    perform public.record_marketplace_recommendation_event('detail',listing_a,'{}',gen_random_uuid());
    raise exception 'seller inflated own listing';
  exception when others then
    if sqlerrm not like '%recommendation_event_not_allowed%' then raise; end if;
  end;

  -- Per-type daily cap (30 discord actions) is below the hourly total cap.
  perform tests.set_actor(viewer);
  delete from public.marketplace_recommendation_events where user_id=viewer;
  insert into public.marketplace_recommendation_events(user_id,listing_id,event_type,weight,context,client_event_id,created_at)
  select viewer,listing_b,'discord',5,'{}',gen_random_uuid(),now()-interval '2 hours' from generate_series(1,30);
  begin
    perform public.record_marketplace_recommendation_event('discord',listing_b,'{}',gen_random_uuid());
    raise exception 'per-type recommendation cap bypassed';
  exception when others then
    if sqlerrm not like '%marketplace_recommendation_rate_limit%' then raise; end if;
  end;

  -- Total UTC-day cap is enforced and isolated per actor.
  delete from public.marketplace_recommendation_events where user_id=viewer;
  insert into public.marketplace_recommendation_events(user_id,listing_id,event_type,weight,context,client_event_id,created_at)
  select viewer,null,'filter',1,'{"category":"resources"}',gen_random_uuid(),now()-interval '2 hours'
  from generate_series(1,500);
  begin
    perform public.record_marketplace_recommendation_event('search',null,'{"search":"rex"}',gen_random_uuid());
    raise exception 'daily recommendation cap bypassed';
  exception when others then
    if sqlerrm not like '%marketplace_recommendation_rate_limit%' then raise; end if;
  end;
  perform tests.set_actor(seller_b);
  if not public.record_marketplace_recommendation_event('search',null,'{"search":"rex"}',gen_random_uuid()) then
    raise exception 'another actor inherited the quota';
  end if;

  -- Previous UTC-day events do not consume today's quota.
  delete from public.marketplace_recommendation_events where user_id=viewer;
  insert into public.marketplace_recommendation_events(user_id,listing_id,event_type,weight,context,client_event_id,created_at)
  select viewer,null,'filter',1,'{"category":"resources"}',gen_random_uuid(),
    (date_trunc('day',now() at time zone 'utc') at time zone 'utc')-interval '1 second'
  from generate_series(1,500);
  perform tests.set_actor(viewer);
  if not public.record_marketplace_recommendation_event('search',null,'{"search":"rex"}',gen_random_uuid()) then
    raise exception 'UTC day quota did not reset';
  end if;

  -- A blocks B. Filtering is directional, anonymous-safe and cursor-stable.
  delete from public.marketplace_user_blocks;
  insert into public.marketplace_user_blocks(blocker_user_id,blocked_user_id) values(viewer,seller_b);
  perform tests.set_actor(viewer);
  result := public.get_marketplace_catalog_v2(p_limit:=3);
  if result::text like '%seller-b-%' then raise exception 'blocked seller leaked into catalog'; end if;
  cursor_value := result->>'next_cursor';
  if cursor_value is not null then
    page_two := public.get_marketplace_catalog_v2(p_limit:=3,p_cursor:=cursor_value);
    if page_two::text like '%seller-b-%' then raise exception 'blocked seller leaked after cursor'; end if;
    if exists(select 1 from jsonb_array_elements(result->'listings') a
      join jsonb_array_elements(page_two->'listings') b on a->>'id'=b->>'id') then
      raise exception 'catalog cursor duplicated listing';
    end if;
  end if;
  perform tests.set_actor(seller_b);
  result := public.get_marketplace_catalog_v2(p_limit:=24);
  if result::text not like '%seller-a-%' then raise exception 'block became reciprocal'; end if;
  perform tests.set_actor(null);
  result := public.get_marketplace_catalog_v2(p_limit:=24);
  if result::text not like '%seller-b-%' then raise exception 'anonymous catalog changed'; end if;
  perform tests.set_actor(viewer);
  perform public.unblock_marketplace_seller((select id from public.marketplace_user_blocks
    where blocker_user_id=viewer and blocked_user_id=seller_b));
  if public.get_marketplace_catalog_v2(p_limit:=24)::text not like '%seller-b-%' then
    raise exception 'unblock did not restore discovery';
  end if;

  -- Suspended actors cannot mutate community state or recommendation data.
  update public.profiles set is_suspended=true,suspended_at=now(),suspended_until=now()+interval '1 day' where id=viewer;
  begin
    perform public.record_marketplace_recommendation_event('search',null,'{"search":"rex"}',gen_random_uuid());
    raise exception 'suspended actor recorded event';
  exception when others then if sqlerrm not like '%account_suspended%' then raise; end if; end;
  begin
    perform public.set_marketplace_favorite(listing_b,true);
    raise exception 'suspended actor saved favorite';
  exception when others then if sqlerrm not like '%account_suspended%' then raise; end if; end;
  update public.profiles set is_suspended=false,suspended_at=null,suspended_until=null where id=viewer;

  -- Notifications are owned, plain-text and bounded by retention.
  insert into public.marketplace_notifications(user_id,kind,entity_type,entity_id,dedupe_key,title_es,title_en,body_es,body_en)
  values(seller_b,'listing_changed','listing',listing_b,'test-owner-b','Cambio seguro','Safe change','Texto seguro','Safe text')
  returning id into notification_b;
  begin
    perform public.mark_marketplace_notification_read(notification_b);
    raise exception 'notification ownership bypassed';
  exception when others then if sqlerrm not like '%notification_not_found%' then raise; end if; end;
  begin
    insert into public.marketplace_notifications(user_id,kind,entity_type,entity_id,dedupe_key,title_es,title_en,body_es,body_en)
    values(viewer,'listing_changed','listing',listing_b,'bad-html-test','<script>','Safe','Safe','Safe');
    raise exception 'HTML notification accepted';
  exception when check_violation then null; end;
  insert into public.marketplace_notifications(user_id,kind,entity_type,entity_id,dedupe_key,title_es,title_en,body_es,body_en,read_at,created_at)
  values
    (viewer,'listing_changed','listing',listing_b,'old-read-test','Vieja leída','Old read','Texto','Text',now()-interval '91 days',now()-interval '91 days'),
    (viewer,'listing_changed','listing',listing_b,'old-unread-test','Vieja no leída','Old unread','Texto','Text',null,now()-interval '181 days');
  perform public.maintain_marketplace_notifications();
  if exists(select 1 from public.marketplace_notifications where dedupe_key in ('old-read-test','old-unread-test')) then
    raise exception 'notification cleanup failed';
  end if;

  -- Error ingestion removes queries, JWT-shaped text and open metadata.
  ok := public.record_frontend_error(repeat('a',64),'api','/marketplace?token=dummy',
    'failure '||repeat('a',24)||'.'||repeat('b',24)||'.'||repeat('c',24),
    '{"code":"E_TEST","source":"marketplace","extra":"discard"}');
  if not ok then raise exception 'valid frontend error rejected'; end if;
  if exists(select 1 from public.frontend_error_events where user_id=viewer
    and (message like '%.%' or metadata ? 'extra' or route like '%?%')) then
    raise exception 'frontend error was not minimized';
  end if;

  if has_table_privilege('authenticated','public.marketplace_notifications','UPDATE') then
    raise exception 'direct notification UPDATE remains granted';
  end if;
  if has_function_privilege('authenticated','public.maintain_marketplace_notifications()','EXECUTE')
    or not has_function_privilege('service_role','public.maintain_marketplace_notifications()','EXECUTE') then
    raise exception 'notification maintenance ACL is invalid';
  end if;
end;
$$;

-- RLS does not reveal blocks owned by another actor.
insert into public.marketplace_user_blocks(blocker_user_id,blocked_user_id)
values('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3') on conflict do nothing;
select tests.set_actor('00000000-0000-0000-0000-0000000000a5');
set local role authenticated;
do $$ begin
  if exists(select 1 from public.marketplace_user_blocks
    where blocker_user_id='00000000-0000-0000-0000-0000000000a2') then
    raise exception 'RLS exposed another actor block';
  end if;
end $$;
reset role;

rollback;
