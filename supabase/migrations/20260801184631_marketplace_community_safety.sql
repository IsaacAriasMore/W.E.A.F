-- Free/local roadmap: Marketplace community safety, privacy and operations.
-- This migration is additive and remains unapplied remotely.

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text
    check (suspension_reason is null or char_length(suspension_reason) between 3 and 500);

alter table public.marketplace_reports
  add column if not exists reason_code text
    check (reason_code is null or reason_code in (
      'fraud','duplicate','prohibited_content','false_information',
      'dangerous_link','harassment','other'
    ));

alter table public.marketplace_audit_log
  add column if not exists target_type text
    check (target_type is null or char_length(target_type) between 3 and 40),
  add column if not exists reason text
    check (reason is null or char_length(reason) between 3 and 500),
  add column if not exists previous_status text,
  add column if not exists new_status text;

create table public.marketplace_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.marketplace_user_blocks (
  id uuid not null default gen_random_uuid() unique,
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table public.marketplace_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'moderation','report','restored','rejected','suspended',
    'reactivated','expired','listing_changed'
  )),
  entity_type text not null check (entity_type in ('listing','report','profile')),
  entity_id uuid,
  dedupe_key text not null check (char_length(dedupe_key) between 8 and 160),
  title_es text not null check (char_length(title_es) between 3 and 120),
  title_en text not null check (char_length(title_en) between 3 and 120),
  body_es text not null check (char_length(body_es) between 3 and 500),
  body_en text not null check (char_length(body_en) between 3 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table public.frontend_error_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{32,64}$'),
  kind text not null check (kind in ('window_error','unhandled_rejection','route','api','render')),
  route text not null check (route ~ '^/[A-Za-z0-9_./-]{0,180}$'),
  message text not null check (char_length(message) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096),
  event_day date not null default ((now() at time zone 'utc')::date),
  occurrences integer not null default 1 check (occurrences between 1 and 1000000),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index frontend_error_events_user_fingerprint_day_idx
  on public.frontend_error_events (
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fingerprint,
    event_day
  );
create index marketplace_favorites_user_created_idx
  on public.marketplace_favorites(user_id, created_at desc);
create index marketplace_blocks_user_created_idx
  on public.marketplace_user_blocks(blocker_user_id, created_at desc);
create index marketplace_notifications_user_unread_idx
  on public.marketplace_notifications(user_id, created_at desc) where read_at is null;
create index marketplace_reports_reporter_created_idx
  on public.marketplace_reports(reporter_user_id, created_at desc);
create index marketplace_reports_listing_created_idx
  on public.marketplace_reports(listing_id, created_at desc);
create index frontend_error_events_last_seen_idx
  on public.frontend_error_events(last_seen_at desc);

alter table public.marketplace_favorites enable row level security;
alter table public.marketplace_user_blocks enable row level security;
alter table public.marketplace_notifications enable row level security;
alter table public.frontend_error_events enable row level security;

create policy marketplace_favorites_read_own
  on public.marketplace_favorites for select to authenticated
  using ((select auth.uid()) = user_id);
create policy marketplace_blocks_read_own
  on public.marketplace_user_blocks for select to authenticated
  using ((select auth.uid()) = blocker_user_id);
create policy marketplace_notifications_read_own
  on public.marketplace_notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy marketplace_notifications_update_own
  on public.marketplace_notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy frontend_errors_admin_read
  on public.frontend_error_events for select to authenticated
  using (private.is_global_admin());

create or replace function private.marketplace_actor_suspended(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select p.is_suspended
      and (p.suspended_until is null or p.suspended_until > now())
    from public.profiles p where p.id = p_user_id
  ), false)
$$;

create or replace function private.enforce_marketplace_actor_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and private.marketplace_actor_suspended((select auth.uid())) then
    raise exception 'account_suspended';
  end if;
  return new;
end;
$$;

create trigger enforce_active_marketplace_listing_actor
before insert or update on public.marketplace_listings
for each row execute function private.enforce_marketplace_actor_active();
create trigger enforce_active_marketplace_reporter
before insert or update on public.marketplace_reports
for each row execute function private.enforce_marketplace_actor_active();
create trigger enforce_active_marketplace_favorite_actor
before insert or update on public.marketplace_favorites
for each row execute function private.enforce_marketplace_actor_active();
create trigger enforce_active_marketplace_block_actor
before insert or update on public.marketplace_user_blocks
for each row execute function private.enforce_marketplace_actor_active();

create or replace function private.notify_marketplace_listing_expired()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.marketplace_notifications(
    user_id,kind,entity_type,entity_id,dedupe_key,title_es,title_en,body_es,body_en
  ) values (
    new.owner_user_id,'expired','listing',new.id,'listing-expired:'||new.id::text,
    'Anuncio expirado','Listing expired',
    'Tu anuncio terminó su vigencia y ya no se muestra públicamente.',
    'Your listing reached its expiration and is no longer public.'
  ) on conflict (user_id,dedupe_key) do nothing;
  return new;
end;
$$;

create trigger notify_marketplace_listing_expired
after update of status on public.marketplace_listings
for each row when (new.status='expired' and old.status is distinct from new.status)
execute function private.notify_marketplace_listing_expired();

create or replace function public.set_marketplace_favorite(
  p_listing_id uuid,
  p_saved boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if private.marketplace_actor_suspended(actor) then raise exception 'account_suspended'; end if;
  if not exists (
    select 1 from public.marketplace_listings l
    where l.id = p_listing_id and l.status = 'active' and l.expires_at > now()
  ) then raise exception 'listing_not_available'; end if;

  if p_saved then
    insert into public.marketplace_favorites(user_id, listing_id)
    values(actor, p_listing_id) on conflict do nothing;
  else
    delete from public.marketplace_favorites
    where user_id = actor and listing_id = p_listing_id;
  end if;
  return p_saved;
end;
$$;

create or replace function public.set_marketplace_user_block(
  p_user_id uuid,
  p_blocked boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if private.marketplace_actor_suspended(actor) then raise exception 'account_suspended'; end if;
  if p_user_id is null or p_user_id = actor then raise exception 'invalid_block_target'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'seller_not_found';
  end if;
  if p_blocked then
    insert into public.marketplace_user_blocks(blocker_user_id, blocked_user_id)
    values(actor, p_user_id) on conflict do nothing;
  else
    delete from public.marketplace_user_blocks
    where blocker_user_id = actor and blocked_user_id = p_user_id;
  end if;
  return p_blocked;
end;
$$;

create or replace function public.block_marketplace_seller(p_listing_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); seller uuid; block_id uuid;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if private.marketplace_actor_suspended(actor) then raise exception 'account_suspended'; end if;
  select l.owner_user_id into seller from public.marketplace_listings l
  where l.slug = p_listing_slug and l.status = 'active' and l.expires_at > now();
  if seller is null then raise exception 'seller_not_found'; end if;
  if seller = actor then raise exception 'invalid_block_target'; end if;
  insert into public.marketplace_user_blocks(blocker_user_id, blocked_user_id)
  values(actor, seller)
  on conflict (blocker_user_id, blocked_user_id) do update
    set blocker_user_id = excluded.blocker_user_id
  returning id into block_id;
  return block_id;
end;
$$;

create or replace function public.unblock_marketplace_seller(p_block_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  delete from public.marketplace_user_blocks
  where id = p_block_id and blocker_user_id = (select auth.uid());
  if not found then raise exception 'block_not_found'; end if;
  return true;
end;
$$;

create or replace function public.get_marketplace_seller_profile(
  p_listing_slug text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare seller uuid; actor uuid := (select auth.uid()); result jsonb;
begin
  if p_limit not between 1 and 24 or p_offset not between 0 and 10000 then
    raise exception 'invalid_pagination';
  end if;
  select l.owner_user_id into seller
  from public.marketplace_listings l
  where l.slug = p_listing_slug and l.status = 'active' and l.expires_at > now();
  if seller is null then raise exception 'seller_not_found'; end if;
  if actor is not null and exists (
    select 1 from public.marketplace_user_blocks b
    where (b.blocker_user_id = actor and b.blocked_user_id = seller)
       or (b.blocker_user_id = seller and b.blocked_user_id = actor)
  ) then raise exception 'seller_blocked'; end if;

  select jsonb_build_object(
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'member_since', date_trunc('month', p.created_at),
    'active_count', (
      select count(*) from public.marketplace_listings x
      where x.owner_user_id = seller and x.status = 'active' and x.expires_at > now()
    ),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', x.slug, 'title', x.title, 'listing_type', x.listing_type,
        'resource_name', x.resource_name, 'region', x.region,
        'platform', x.platform, 'published_at', x.published_at,
        'expires_at', x.expires_at, 'image_url', x.image_url
      ) order by x.published_at desc)
      from (
        select * from public.marketplace_listings ml
        where ml.owner_user_id = seller and ml.status = 'active' and ml.expires_at > now()
        order by ml.published_at desc limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb),
    'next_offset', case when (
      select count(*) from public.marketplace_listings ml
      where ml.owner_user_id = seller and ml.status = 'active' and ml.expires_at > now()
    ) > p_offset + p_limit then p_offset + p_limit else null end,
    'blocked', false
  ) into result from public.profiles p where p.id = seller;
  return result;
end;
$$;

create or replace function public.get_my_marketplace_community(
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if p_limit not between 1 and 50 or p_offset not between 0 and 10000 then
    raise exception 'invalid_pagination';
  end if;
  return jsonb_build_object(
    'favorites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', l.slug, 'title', l.title, 'status', l.status,
        'resource_name', l.resource_name, 'saved_at', f.created_at
      ) order by f.created_at desc)
      from (
        select * from public.marketplace_favorites x where x.user_id = actor
        order by x.created_at desc limit p_limit offset p_offset
      ) f join public.marketplace_listings l on l.id = f.listing_id
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'listing_slug', l.slug, 'listing_title', l.title,
        'reason', coalesce(r.reason_code, r.reason), 'status', r.status,
        'created_at', r.created_at, 'updated_at', r.updated_at
      ) order by r.created_at desc)
      from (
        select * from public.marketplace_reports x where x.reporter_user_id = actor
        order by x.created_at desc limit p_limit offset p_offset
      ) r join public.marketplace_listings l on l.id = r.listing_id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'block_id', b.id, 'display_name', p.display_name,
        'avatar_url', p.avatar_url, 'created_at', b.created_at
      ) order by b.created_at desc)
      from public.marketplace_user_blocks b
      join public.profiles p on p.id = b.blocked_user_id
      where b.blocker_user_id = actor
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at desc)
      from (
        select * from public.marketplace_notifications x where x.user_id = actor
        order by x.created_at desc limit p_limit offset p_offset
      ) n
    ), '[]'::jsonb),
    'unread_notifications', (
      select count(*) from public.marketplace_notifications n
      where n.user_id = actor and n.read_at is null
    )
  );
end;
$$;

create or replace function public.mark_marketplace_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  update public.marketplace_notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = (select auth.uid());
  if not found then raise exception 'notification_not_found'; end if;
  return true;
end;
$$;

create or replace function public.report_marketplace_listing(
  p_listing_id uuid,
  p_reason text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  report_id uuid;
  normalized_reason text := lower(trim(coalesce(p_reason, '')));
  legacy_reason text;
  clean_details text := trim(coalesce(p_details, ''));
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if private.marketplace_actor_suspended(actor) then raise exception 'account_suspended'; end if;
  if normalized_reason not in (
    'fraud','duplicate','prohibited_content','false_information',
    'dangerous_link','harassment','other'
  ) then raise exception 'invalid_report_reason'; end if;
  if char_length(clean_details) not between 10 and 1000
    or clean_details ~ '[[:cntrl:]]'
    or clean_details ~* '<[a-z!/]' then raise exception 'invalid_report_details'; end if;
  if not exists (
    select 1 from public.marketplace_listings l
    where l.id = p_listing_id and l.status = 'active' and l.expires_at > now()
  ) then raise exception 'listing_not_available'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':marketplace-report', 0));
  if (select count(*) from public.marketplace_reports r
      where r.reporter_user_id = actor and r.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'marketplace_report_hourly_limit';
  end if;
  if (select count(*) from public.marketplace_reports r
      where r.reporter_user_id = actor and r.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'marketplace_report_daily_limit';
  end if;
  if (select count(*) from public.marketplace_reports r
      where r.listing_id = p_listing_id and r.created_at > now() - interval '24 hours') >= 25 then
    raise exception 'marketplace_listing_report_limit';
  end if;

  legacy_reason := case normalized_reason
    when 'fraud' then 'fraud'
    when 'dangerous_link' then 'malicious_link'
    when 'harassment' then 'personal_data'
    when 'other' then 'other'
    when 'duplicate' then 'spam'
    else 'prohibited'
  end;
  insert into public.marketplace_reports(
    listing_id, reporter_user_id, reason, reason_code, details
  ) values (
    p_listing_id, actor, legacy_reason, normalized_reason, clean_details
  ) returning id into report_id;
  return report_id;
exception when unique_violation then
  raise exception 'marketplace_report_duplicate';
end;
$$;

create or replace function public.admin_moderate_marketplace_listing(
  p_listing_id uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  previous_status text;
  owner_id uuid;
  clean_reason text := trim(coalesce(p_reason, ''));
  valid_transition boolean := false;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_status not in ('active','hidden','rejected') then raise exception 'invalid_moderation_status'; end if;
  if char_length(clean_reason) not between 3 and 500 or clean_reason ~ '[[:cntrl:]]' then
    raise exception 'moderation_reason_required';
  end if;
  select l.status, l.owner_user_id into previous_status, owner_id
  from public.marketplace_listings l where l.id = p_listing_id for update;
  if previous_status is null then raise exception 'listing_not_available'; end if;
  if previous_status = p_status then return; end if;
  valid_transition :=
    (p_status = 'hidden' and previous_status in ('active','draft','pending_payment'))
    or (p_status = 'rejected' and previous_status in ('active','hidden','draft'))
    or (p_status = 'active' and previous_status in ('hidden','rejected'));
  if not valid_transition then raise exception 'invalid_moderation_transition'; end if;
  if p_status = 'active' and exists (
    select 1 from public.marketplace_listings where id = p_listing_id and expires_at <= now()
  ) then raise exception 'expired_listing_cannot_activate'; end if;

  update public.marketplace_listings l set
    status = p_status,
    is_featured = case when p_status = 'active' then exists (
      select 1 from public.marketplace_payments p
      where p.listing_id = l.id and p.status = 'captured'
        and l.featured_expires_at > now()
    ) else false end,
    moderated_at = now(),
    moderation_reason = clean_reason
  where l.id = p_listing_id;

  insert into public.marketplace_audit_log(
    listing_id, actor_user_id, action, target_type, reason,
    previous_status, new_status, details
  ) values (
    p_listing_id, actor, 'listing_moderated', 'listing', clean_reason,
    previous_status, p_status, jsonb_build_object('source', 'admin')
  );
  insert into public.marketplace_notifications(
    user_id, kind, entity_type, entity_id, dedupe_key,
    title_es, title_en, body_es, body_en
  ) values (
    owner_id,
    case when p_status = 'active' then 'restored' when p_status = 'rejected' then 'rejected' else 'moderation' end,
    'listing', p_listing_id,
    'moderation:' || p_listing_id::text || ':' || p_status || ':' || extract(epoch from now())::bigint,
    case when p_status = 'active' then 'Anuncio restaurado' when p_status = 'rejected' then 'Anuncio rechazado' else 'Anuncio ocultado' end,
    case when p_status = 'active' then 'Listing restored' when p_status = 'rejected' then 'Listing rejected' else 'Listing hidden' end,
    clean_reason, clean_reason
  );
end;
$$;

create or replace function public.admin_set_marketplace_user_suspension(
  p_user_id uuid,
  p_action text,
  p_suspended_until timestamptz,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid()); clean_reason text := trim(coalesce(p_reason,''));
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_user_id is null or p_user_id = actor then raise exception 'cannot_suspend_self'; end if;
  if p_action not in ('suspend','reactivate') then raise exception 'invalid_suspension_action'; end if;
  if char_length(clean_reason) not between 3 and 500 then raise exception 'suspension_reason_required'; end if;
  if p_action = 'suspend' and p_suspended_until is not null and p_suspended_until <= now() then
    raise exception 'invalid_suspension_end';
  end if;
  update public.profiles set
    is_suspended = p_action = 'suspend',
    suspended_at = case when p_action = 'suspend' then now() else null end,
    suspended_until = case when p_action = 'suspend' then p_suspended_until else null end,
    suspension_reason = case when p_action = 'suspend' then clean_reason else null end,
    updated_at = now()
  where id = p_user_id;
  if not found then raise exception 'user_not_found'; end if;
  update public.marketplace_listings set status = 'hidden', is_featured = false,
    moderated_at = now(), moderation_reason = clean_reason
  where owner_user_id = p_user_id and status = 'active' and p_action = 'suspend';
  insert into public.marketplace_audit_log(
    actor_user_id, action, target_type, reason, previous_status, new_status, details
  ) values (
    actor, 'seller_' || p_action, 'profile', clean_reason,
    case when p_action = 'suspend' then 'active' else 'suspended' end,
    case when p_action = 'suspend' then 'suspended' else 'active' end,
    jsonb_build_object('target_user_id', p_user_id, 'until', p_suspended_until)
  );
  insert into public.marketplace_notifications(
    user_id, kind, entity_type, entity_id, dedupe_key,
    title_es, title_en, body_es, body_en
  ) values (
    p_user_id,
    case when p_action = 'suspend' then 'suspended' else 'reactivated' end,
    'profile', p_user_id,
    'suspension:' || p_user_id::text || ':' || p_action || ':' || extract(epoch from now())::bigint,
    case when p_action = 'suspend' then 'Cuenta Marketplace suspendida' else 'Cuenta Marketplace reactivada' end,
    case when p_action = 'suspend' then 'Marketplace account suspended' else 'Marketplace account reactivated' end,
    clean_reason, clean_reason
  );
end;
$$;

create or replace function public.get_admin_marketplace_moderation(
  p_search text default null,
  p_listing_status text default null,
  p_report_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare search_text text := left(trim(coalesce(p_search,'')), 80);
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_limit not between 1 and 100 or p_offset not between 0 and 100000 then
    raise exception 'invalid_pagination';
  end if;
  return jsonb_build_object(
    'listings', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select l.id,l.title,l.slug,l.status,l.is_featured,l.created_at,l.published_at,
          l.expires_at,l.moderation_reason,l.owner_user_id as seller_id,
          p.display_name as seller_name,p.is_suspended,p.suspended_until,
          (select count(*) from public.marketplace_reports r where r.listing_id=l.id and r.status in ('open','reviewing')) as open_reports
        from public.marketplace_listings l join public.profiles p on p.id=l.owner_user_id
        where (p_listing_status is null or l.status=p_listing_status)
          and (search_text='' or l.title ilike '%'||search_text||'%' or p.display_name ilike '%'||search_text||'%')
        order by l.created_at desc limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select r.id,r.listing_id,coalesce(r.reason_code,r.reason) as reason,r.details,
          r.status,r.created_at,r.updated_at,l.title as listing_title,p.display_name as reporter_name
        from public.marketplace_reports r
        join public.marketplace_listings l on l.id=r.listing_id
        join public.profiles p on p.id=r.reporter_user_id
        where (p_report_status is null or r.status=p_report_status)
          and (search_text='' or l.title ilike '%'||search_text||'%')
        order by r.created_at desc limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb),
    'suspended_users', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.suspended_at desc) from (
        select p.id,p.display_name,p.suspended_at,p.suspended_until,p.suspension_reason,
          (select count(*) from public.marketplace_listings l where l.owner_user_id=p.id) as listing_count
        from public.profiles p
        where p.is_suspended
        order by p.suspended_at desc nulls last limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select a.action,a.target_type,a.reason,a.previous_status,a.new_status,a.created_at
        from public.marketplace_audit_log a
        where a.action in ('listing_moderated','seller_suspend','seller_reactivate')
        order by a.created_at desc limit 50
      ) x
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'matching_listings',(select count(*) from public.marketplace_listings l
        join public.profiles p on p.id=l.owner_user_id
        where (p_listing_status is null or l.status=p_listing_status)
          and (search_text='' or l.title ilike '%'||search_text||'%' or p.display_name ilike '%'||search_text||'%')),
      'matching_reports',(select count(*) from public.marketplace_reports r
        join public.marketplace_listings l on l.id=r.listing_id
        where (p_report_status is null or r.status=p_report_status)
          and (search_text='' or l.title ilike '%'||search_text||'%')),
      'active_listings',(select count(*) from public.marketplace_listings where status='active' and expires_at>now()),
      'open_reports',(select count(*) from public.marketplace_reports where status in ('open','reviewing')),
      'favorites',(select count(*) from public.marketplace_favorites),
      'blocks',(select count(*) from public.marketplace_user_blocks),
      'unread_notifications',(select count(*) from public.marketplace_notifications where read_at is null),
      'frontend_errors_24h',(select coalesce(sum(occurrences),0) from public.frontend_error_events where last_seen_at>now()-interval '24 hours')
    )
  );
end;
$$;

create or replace function public.record_frontend_error(
  p_fingerprint text,
  p_kind text,
  p_route text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  clean_route text;
  clean_message text;
  clean_metadata jsonb;
begin
  if actor is null then return false; end if;
  if p_fingerprint !~ '^[a-f0-9]{32,64}$'
    or p_kind not in ('window_error','unhandled_rejection','route','api','render') then return false; end if;
  clean_route := split_part(left(coalesce(p_route,'/'),180),'?',1);
  clean_message := left(regexp_replace(coalesce(p_message,'error'),
    '(bearer|token|password|authorization|service[_-]?role|paypal)[^[:space:]]*', '[redacted]', 'gi'),500);
  clean_metadata := jsonb_strip_nulls(jsonb_build_object(
    'code', left(coalesce(p_metadata->>'code',''),80),
    'source', left(coalesce(p_metadata->>'source',''),80),
    'online', case when coalesce(p_metadata->>'online','') in ('true','false')
      then (p_metadata->>'online')::boolean else null end,
    'viewport', case when coalesce(p_metadata->>'viewport','') ~ '^[0-9]{2,5}x[0-9]{2,5}$'
      then p_metadata->>'viewport' else null end
  ));
  if clean_route !~ '^/[A-Za-z0-9_./-]{0,180}$' or clean_message ~ '[[:cntrl:]]'
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_metadata,'{}'::jsonb)) > 4096 then return false; end if;
  if (select coalesce(sum(e.occurrences),0) from public.frontend_error_events e
      where e.user_id=actor and e.last_seen_at>now()-interval '1 hour') >= 30 then return false; end if;
  insert into public.frontend_error_events(user_id,fingerprint,kind,route,message,metadata)
  values(actor,p_fingerprint,p_kind,clean_route,clean_message,clean_metadata)
  on conflict (
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fingerprint,
    event_day
  ) do update set occurrences=frontend_error_events.occurrences+1,last_seen_at=now();
  return true;
end;
$$;

create or replace function public.maintain_frontend_error_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  delete from public.frontend_error_events e
  where e.id in (
    select stale.id from public.frontend_error_events stale
    where stale.last_seen_at < now() - interval '30 days'
    order by stale.last_seen_at asc
    limit 5000
  );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

do $$
begin
  if exists(select 1 from cron.job where jobname='maintain-frontend-error-events') then
    perform cron.unschedule('maintain-frontend-error-events');
  end if;
  perform cron.schedule(
    'maintain-frontend-error-events',
    '23 4 * * *',
    'select public.maintain_frontend_error_events();'
  );
end;
$$;

revoke all on public.marketplace_favorites, public.marketplace_user_blocks,
  public.marketplace_notifications, public.frontend_error_events
  from public, anon, authenticated;
grant select on public.marketplace_favorites, public.marketplace_user_blocks,
  public.marketplace_notifications to authenticated;
grant update(read_at) on public.marketplace_notifications to authenticated;

revoke all on function private.marketplace_actor_suspended(uuid),
  private.enforce_marketplace_actor_active(),
  private.notify_marketplace_listing_expired() from public,anon,authenticated;
revoke all on function public.set_marketplace_favorite(uuid,boolean),
  public.set_marketplace_user_block(uuid,boolean),
  public.block_marketplace_seller(text),
  public.unblock_marketplace_seller(uuid),
  public.get_marketplace_seller_profile(text,integer,integer),
  public.get_my_marketplace_community(integer,integer),
  public.mark_marketplace_notification_read(uuid),
  public.report_marketplace_listing(uuid,text,text),
  public.admin_moderate_marketplace_listing(uuid,text,text),
  public.admin_set_marketplace_user_suspension(uuid,text,timestamptz,text),
  public.get_admin_marketplace_moderation(text,text,text,integer,integer),
  public.record_frontend_error(text,text,text,text,jsonb),
  public.maintain_frontend_error_events()
  from public,anon,authenticated;
grant execute on function public.get_marketplace_seller_profile(text,integer,integer)
  to anon,authenticated;
grant execute on function public.set_marketplace_favorite(uuid,boolean),
  public.block_marketplace_seller(text),
  public.unblock_marketplace_seller(uuid),
  public.get_my_marketplace_community(integer,integer),
  public.mark_marketplace_notification_read(uuid),
  public.report_marketplace_listing(uuid,text,text),
  public.record_frontend_error(text,text,text,text,jsonb)
  to authenticated;
grant execute on function public.admin_moderate_marketplace_listing(uuid,text,text),
  public.admin_set_marketplace_user_suspension(uuid,text,timestamptz,text),
  public.get_admin_marketplace_moderation(text,text,text,integer,integer)
  to authenticated;
grant execute on function public.maintain_frontend_error_events() to service_role;

comment on table public.frontend_error_events is
  'Privacy-minimized authenticated frontend error aggregates. Retain for 30 days.';
comment on table public.marketplace_user_blocks is
  'User-controlled Marketplace blocks. Blocks hide contact/profile interactions; historical records remain.';
