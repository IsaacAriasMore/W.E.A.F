-- Final local hardening for recommendation abuse, directional discovery blocks,
-- community retention and privacy-minimized frontend monitoring.
-- This migration is intentionally local-only until separately authorized.

create index if not exists marketplace_events_user_type_recent_idx
  on public.marketplace_recommendation_events(user_id, event_type, created_at desc);
create index if not exists marketplace_notifications_created_idx
  on public.marketplace_notifications(created_at);
create index if not exists marketplace_notifications_read_retention_idx
  on public.marketplace_notifications(created_at)
  where read_at is not null;
create index if not exists profiles_marketplace_suspension_idx
  on public.profiles(suspended_until)
  where is_suspended;

alter table public.marketplace_notifications
  add constraint marketplace_notifications_plain_text_check check (
    title_es !~* '<[a-z!/]' and title_en !~* '<[a-z!/]' and
    body_es !~* '<[a-z!/]' and body_en !~* '<[a-z!/]' and
    title_es !~ '[[:cntrl:]]' and title_en !~ '[[:cntrl:]]' and
    body_es !~ '[[:cntrl:]]' and body_en !~ '[[:cntrl:]]'
  ),
  add constraint marketplace_notifications_dedupe_format_check check (
    dedupe_key ~ '^[A-Za-z0-9:_-]{8,160}$'
  );

-- Notification state changes remain behind the ownership-checking RPC.
revoke update on public.marketplace_notifications from authenticated;

create or replace function public.record_marketplace_recommendation_event(
  p_event_type text,
  p_listing_id uuid default null,
  p_context jsonb default '{}'::jsonb,
  p_client_event_id uuid default gen_random_uuid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  event_weight smallint;
  normalized jsonb := '{}'::jsonb;
  detail_views integer;
  event_type_daily_limit integer;
  selected_listing public.marketplace_listings%rowtype;
  utc_day_start timestamptz := (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if private.marketplace_actor_suspended(actor_id) then raise exception 'account_suspended'; end if;
  if not coalesce((
    select personalization_enabled
    from public.marketplace_recommendation_preferences
    where user_id = actor_id
  ), false) then
    raise exception 'marketplace_personalization_disabled';
  end if;
  if p_event_type not in ('filter', 'search', 'detail', 'save', 'discord', 'hide')
    or p_client_event_id is null
    or jsonb_typeof(coalesce(p_context, 'null'::jsonb)) <> 'object'
    or pg_column_size(p_context) > 4096
  then
    raise exception 'invalid_recommendation_event';
  end if;
  if p_context - array['category', 'region', 'platform', 'type', 'search'] <> '{}'::jsonb then
    raise exception 'invalid_recommendation_context';
  end if;

  if p_event_type in ('detail', 'save', 'discord', 'hide') then
    select * into selected_listing
    from public.marketplace_listings
    where id = p_listing_id
      and game = 'ascended'
      and status = 'active'
      and expires_at > now();
    if selected_listing.id is null then raise exception 'listing_not_available'; end if;
    if selected_listing.owner_user_id = actor_id then
      raise exception 'recommendation_event_not_allowed';
    end if;
    normalized := '{}'::jsonb;
  else
    if p_listing_id is not null then raise exception 'invalid_recommendation_event'; end if;
    normalized := jsonb_strip_nulls(jsonb_build_object(
      'category', nullif(lower(left(trim(p_context->>'category'), 60)), ''),
      'region', nullif(lower(left(trim(p_context->>'region'), 40)), ''),
      'platform', nullif(lower(left(trim(p_context->>'platform'), 30)), ''),
      'type', nullif(lower(left(trim(p_context->>'type'), 16)), ''),
      'search', nullif(lower(left(trim(p_context->>'search'), 80)), '')
    ));
    if p_event_type = 'filter' and normalized = '{}'::jsonb then
      raise exception 'invalid_recommendation_context';
    end if;
    if p_event_type = 'search' and not (normalized ? 'search') then
      raise exception 'invalid_recommendation_context';
    end if;
  end if;

  -- Serialize all quota checks and inserts for this authenticated actor.
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text || ':marketplace-recommendation', 0)
  );

  -- A replay is idempotent and does not consume another quota unit.
  if exists (
    select 1 from public.marketplace_recommendation_events e
    where e.user_id = actor_id and e.client_event_id = p_client_event_id
  ) then
    return false;
  end if;

  if (
    select count(*) from public.marketplace_recommendation_events e
    where e.user_id = actor_id and e.created_at > now() - interval '1 hour'
  ) >= 120 then
    raise exception 'marketplace_recommendation_rate_limit';
  end if;
  if (
    select count(*) from public.marketplace_recommendation_events e
    where e.user_id = actor_id and e.created_at >= utc_day_start
  ) >= 500 then
    raise exception 'marketplace_recommendation_rate_limit';
  end if;

  event_type_daily_limit := case p_event_type
    when 'filter' then 120
    when 'search' then 80
    when 'detail' then 240
    when 'save' then 60
    when 'discord' then 30
    when 'hide' then 60
  end;
  if (
    select count(*) from public.marketplace_recommendation_events e
    where e.user_id = actor_id
      and e.event_type = p_event_type
      and e.created_at >= utc_day_start
  ) >= event_type_daily_limit then
    raise exception 'marketplace_recommendation_rate_limit';
  end if;

  if p_event_type = 'detail' then
    select count(*) into detail_views
    from public.marketplace_recommendation_events e
    join public.marketplace_recommendation_preferences p on p.user_id = e.user_id
    where e.user_id = actor_id
      and e.listing_id = p_listing_id
      and e.event_type = 'detail'
      and e.created_at >= greatest(p.reset_at, now() - interval '90 days');
    event_weight := case detail_views when 0 then 2 when 1 then 1 else 0 end;
  else
    event_weight := case p_event_type
      when 'filter' then 1 when 'search' then 1 when 'save' then 4
      when 'discord' then 5 when 'hide' then -4 else 0 end;
  end if;

  insert into public.marketplace_recommendation_events(
    user_id, listing_id, event_type, weight, context, client_event_id
  ) values (
    actor_id, p_listing_id, p_event_type, event_weight, normalized, p_client_event_id
  );
  perform private.refresh_marketplace_interest_profile(actor_id);
  return true;
end;
$$;

revoke all on function public.record_marketplace_recommendation_event(text,uuid,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.record_marketplace_recommendation_event(text,uuid,jsonb,uuid)
  to authenticated;

-- Keep Marketplace keyset pagination stable across separate HTTP transactions.
-- The previous score used now(), so freshness changed between page requests and
-- the last row of page N could reappear on page N+1. Authenticated impressions
-- written by page N could also change the next page's fairness score.

create or replace function public.get_marketplace_catalog_v2(
  p_slug text default null,
  p_type text default null,
  p_category text default null,
  p_region text default null,
  p_platform text default null,
  p_search text default null,
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  snapshot_time timestamptz := statement_timestamp();
  featured_bucket bigint := floor(extract(epoch from statement_timestamp()) / 900)::bigint;
  organic_bucket bigint := floor(extract(epoch from statement_timestamp()) / 3600)::bigint;
  cursor_payload jsonb;
  cursor_score numeric;
  cursor_id uuid;
  query_hash text;
  personalization_enabled boolean := false;
  affinities jsonb := '{}'::jsonb;
  categories jsonb := '[]'::jsonb;
  featured_listings jsonb := '[]'::jsonb;
  organic_listings jsonb := '[]'::jsonb;
  next_cursor text;
  last_score numeric;
  last_id uuid;
  result_count integer := 0;
  normalized_search text := nullif(left(trim(coalesce(p_search, '')), 80), '');
  blocked_sellers_hash text := pg_catalog.md5('');
begin
  if p_limit is null or p_limit not between 1 and 24 then raise exception 'invalid_marketplace_limit'; end if;
  if p_type is not null and p_type not in ('buy', 'sell', 'trade') then raise exception 'invalid_marketplace_filter'; end if;
  if p_platform is not null and p_platform not in ('steam', 'epic', 'xbox', 'playstation', 'windows', 'crossplay', 'other') then
    raise exception 'invalid_marketplace_filter';
  end if;
  if char_length(coalesce(p_slug, '')) > 100
    or char_length(coalesce(p_category, '')) > 60
    or char_length(coalesce(p_region, '')) > 40
  then raise exception 'invalid_marketplace_filter'; end if;

  if actor_id is not null then
    select coalesce(p.personalization_enabled, false), coalesce(i.affinities, '{}'::jsonb)
      into personalization_enabled, affinities
    from (select actor_id as user_id) seed
    left join public.marketplace_recommendation_preferences p on p.user_id = seed.user_id
    left join public.marketplace_user_interest_profiles i on i.user_id = seed.user_id;
  end if;

  if actor_id is not null then
    select pg_catalog.md5(coalesce(pg_catalog.string_agg(
      b.blocked_user_id::text, ',' order by b.blocked_user_id::text
    ), ''))
    into blocked_sellers_hash
    from public.marketplace_user_blocks b
    where b.blocker_user_id = actor_id;
  end if;

  -- Bind the cursor to filters, caller, recommendation state and block snapshot.
  query_hash := pg_catalog.md5(
    private.marketplace_cursor_query_context_hash(
      p_slug, p_type, p_category, p_region, p_platform, p_search, p_limit
    ) || ':' || coalesce(actor_id::text, 'anonymous') || ':'
      || personalization_enabled::text || ':' || affinities::text || ':' || blocked_sellers_hash
  );

  if p_cursor is not null then
    cursor_payload := private.marketplace_decode_cursor(p_cursor);
    if (cursor_payload->>'v')::integer is distinct from 2
      or (cursor_payload->>'b')::bigint <> organic_bucket
      or nullif(cursor_payload->>'t', '') is null
      or nullif(cursor_payload->>'s', '') is null
      or nullif(cursor_payload->>'i', '') is null
      or nullif(cursor_payload->>'q', '') is null
      or cursor_payload->>'q' <> query_hash
    then raise exception 'marketplace_cursor_expired'; end if;
    snapshot_time := (cursor_payload->>'t')::timestamptz;
    if snapshot_time < to_timestamp(organic_bucket * 3600)
      or snapshot_time > statement_timestamp() + interval '1 minute'
    then raise exception 'marketplace_cursor_expired'; end if;
    cursor_score := (cursor_payload->>'s')::numeric;
    cursor_id := (cursor_payload->>'i')::uuid;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name_es', c.name_es, 'name_en', c.name_en
  ) order by c.sort_order), '[]'::jsonb)
  into categories from public.marketplace_categories c where c.is_active;

  if p_cursor is null and p_slug is null then
    with candidate as (
      select l.*,
        (case when p_type is not null then 10 else 0 end
          + case when p_category is not null then 10 else 0 end
          + case when p_region is not null then 10 else 0 end
          + case when p_platform is not null then 10 else 0 end
          + case when normalized_search is not null then
              10 * least(1, ts_rank_cd(l.search_vector, websearch_to_tsquery('simple', normalized_search)) + 0.25)
            else 0 end)::numeric as relevance_score,
        (30.0 / (1 + (select count(*) from public.marketplace_listing_impressions imp
          where imp.listing_id = l.id and imp.placement = 'featured'
            and imp.created_at > snapshot_time - interval '7 days'
            and imp.created_at < snapshot_time)))::numeric as exposure_score,
        (10 * greatest(0, 1 - extract(epoch from (snapshot_time - l.published_at)) / 604800))::numeric as freshness_score,
        (10.0 / (1 + (select count(*) from public.marketplace_listing_impressions seller_imp
          join public.marketplace_listings seller_listing on seller_listing.id = seller_imp.listing_id
          where seller_listing.owner_user_id = l.owner_user_id
            and seller_imp.placement = 'featured'
            and seller_imp.created_at > snapshot_time - interval '7 days'
            and seller_imp.created_at < snapshot_time)))::numeric as seller_diversity_score,
        private.marketplace_featured_rotation_score(l.id, featured_bucket) as rotation_score
      from public.marketplace_listings l
      join public.marketplace_categories c on c.id = l.category_id
      where l.status = 'active' and l.expires_at > snapshot_time and l.game = 'ascended'
        and (actor_id is null or not exists (
          select 1 from public.marketplace_user_blocks b
          where b.blocker_user_id = actor_id and b.blocked_user_id = l.owner_user_id
        ))
        and l.is_featured and l.featured_expires_at > snapshot_time
        and (p_type is null or l.listing_type = p_type)
        and (p_category is null or c.slug = lower(p_category))
        and (p_region is null or lower(l.region) = lower(p_region))
        and (p_platform is null or l.platform = lower(p_platform))
        and (normalized_search is null or l.search_vector @@ websearch_to_tsquery('simple', normalized_search))
    ), ranked as (
      select candidate.*,
        relevance_score + exposure_score + freshness_score + seller_diversity_score + (10 * rotation_score) as rank_score,
        row_number() over (partition by owner_user_id
          order by relevance_score + exposure_score + freshness_score + seller_diversity_score + (10 * rotation_score) desc, id desc) as seller_position
      from candidate
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'category_id', category_id, 'slug', slug, 'listing_type', listing_type,
      'title', title, 'description', description, 'game', game, 'resource_name', resource_name,
      'quantity', quantity, 'trade_terms', trade_terms, 'server_name', server_name,
      'region', region, 'platform', platform, 'language', language,
      'discord_invite_url', discord_invite_url, 'image_url', image_url,
      'is_featured', true, 'published_at', published_at, 'expires_at', expires_at,
      'featured_started_at', featured_started_at, 'featured_expires_at', featured_expires_at,
      'recommendation_reason', case when normalized_search is not null then 'search_match' else 'fair_featured_rotation' end
    ) order by rank_score desc, id desc), '[]'::jsonb)
    into featured_listings
    from (select * from ranked where seller_position = 1 order by rank_score desc, id desc limit 4) selected;
  end if;

  with candidate as (
    select l.*,
      (case when p_type is not null then 10 else 0 end
        + case when p_category is not null then 10 else 0 end
        + case when p_region is not null then 10 else 0 end
        + case when p_platform is not null then 10 else 0 end
        + case when normalized_search is not null then
            5 + 5 * least(1, ts_rank_cd(l.search_vector, websearch_to_tsquery('simple', normalized_search)) * 4)
          else 0 end)::numeric as context_score,
      case when personalization_enabled then
        25 * least(1, greatest(0, (
          coalesce((affinities->>('category:' || c.slug))::numeric, 0)
          + coalesce((affinities->>('region:' || lower(l.region)))::numeric, 0)
          + coalesce((affinities->>('platform:' || lower(l.platform)))::numeric, 0)
          + coalesce((affinities->>('type:' || l.listing_type))::numeric, 0)
        ) / 20)) else 0 end as affinity_score,
      (15.0 / (1 + (select count(*) from public.marketplace_listing_impressions imp
        where imp.listing_id = l.id and imp.placement = 'organic'
          and imp.created_at > snapshot_time - interval '7 days'
          and imp.created_at < snapshot_time)))::numeric as fairness_score,
      (10 * greatest(0, 1 - extract(epoch from (snapshot_time - l.published_at)) / 604800))::numeric as freshness_score,
      case when (hashtextextended(l.id::text, organic_bucket) & 2147483647) % 100 < 10 then 5 else 0 end::numeric as exploration_score
    from public.marketplace_listings l
    join public.marketplace_categories c on c.id = l.category_id
    where l.status = 'active' and l.expires_at > snapshot_time and l.game = 'ascended'
        and (actor_id is null or not exists (
          select 1 from public.marketplace_user_blocks b
          where b.blocker_user_id = actor_id and b.blocked_user_id = l.owner_user_id
        ))
      and (p_slug is not null or not (l.is_featured and l.featured_expires_at > snapshot_time))
      and (p_slug is null or l.slug = p_slug)
      and (p_type is null or l.listing_type = p_type)
      and (p_category is null or c.slug = lower(p_category))
      and (p_region is null or lower(l.region) = lower(p_region))
      and (p_platform is null or l.platform = lower(p_platform))
      and (normalized_search is null or l.search_vector @@ websearch_to_tsquery('simple', normalized_search))
  ), scored as (
    select candidate.*, context_score + affinity_score + fairness_score + freshness_score + exploration_score as rank_score from candidate
  ), positioned as (
    select scored.*,
      row_number() over (order by rank_score desc, id desc) as global_position,
      row_number() over (partition by owner_user_id order by rank_score desc, id desc) as seller_position
    from scored
  ), selected as (
    select * from positioned
    where (global_position > 20 or seller_position <= 2)
      and (cursor_score is null or rank_score < cursor_score or (rank_score = cursor_score and id < cursor_id))
    order by rank_score desc, id desc limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'category_id', category_id, 'slug', slug, 'listing_type', listing_type,
      'title', title, 'description', description, 'game', game, 'resource_name', resource_name,
      'quantity', quantity, 'trade_terms', trade_terms, 'server_name', server_name,
      'region', region, 'platform', platform, 'language', language,
      'discord_invite_url', discord_invite_url, 'image_url', image_url,
      'is_featured', false, 'published_at', published_at, 'expires_at', expires_at,
      'featured_started_at', featured_started_at, 'featured_expires_at', featured_expires_at,
      'recommendation_reason', case
        when normalized_search is not null then 'search_match'
        when personalization_enabled and affinity_score > 0 then 'matches_interests'
        when exploration_score > 0 then 'explore' else 'fair_rotation' end
    ) order by rank_score desc, id desc), '[]'::jsonb),
    (array_agg(rank_score order by rank_score asc, id asc))[1],
    (array_agg(id order by rank_score asc, id asc))[1], count(*)::integer
  into organic_listings, last_score, last_id, result_count from selected;

  if p_slug is null and result_count = p_limit and last_id is not null then
    next_cursor := private.marketplace_encode_cursor(jsonb_build_object(
      'v', 2, 'b', organic_bucket, 't', snapshot_time,
      's', last_score, 'i', last_id, 'q', query_hash
    ));
  end if;

  if actor_id is not null and personalization_enabled then
    insert into public.marketplace_listing_impressions(user_id, listing_id, bucket_key, placement, position, created_at)
    select actor_id, (item.value->>'id')::uuid, featured_bucket, 'featured', item.ordinality::smallint, clock_timestamp()
    from jsonb_array_elements(featured_listings) with ordinality as item(value, ordinality)
    on conflict do nothing;
    insert into public.marketplace_listing_impressions(user_id, listing_id, bucket_key, placement, position, created_at)
    select actor_id, (item.value->>'id')::uuid, organic_bucket, 'organic', item.ordinality::smallint, clock_timestamp()
    from jsonb_array_elements(organic_listings) with ordinality as item(value, ordinality)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'categories', categories, 'featured', featured_listings, 'listings', organic_listings,
    'next_cursor', next_cursor, 'personalization_enabled', personalization_enabled, 'bucket', organic_bucket
  );
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_marketplace_cursor';
end;
$$;

revoke all on function public.get_marketplace_catalog_v2(text,text,text,text,text,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_catalog_v2(text,text,text,text,text,text,text,integer)
  to anon, authenticated;

comment on function public.get_marketplace_catalog_v2(text,text,text,text,text,text,text,integer) is
  'ASA-only deterministic catalog; directional user blocks and v2 cursors bind filters, caller, recommendation and block snapshots.';

-- Keep the legacy rollout fallback consistent with the same directional block policy.
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
        and ((select auth.uid()) is null or not exists (
          select 1 from public.marketplace_user_blocks b
          where b.blocker_user_id = (select auth.uid())
            and b.blocked_user_id = l.owner_user_id
        ))
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_marketplace_catalog(text) from public, anon, authenticated;
grant execute on function public.get_marketplace_catalog(text) to anon, authenticated;

-- Seller visibility is directional: the actor's own block hides the seller.
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
    where b.blocker_user_id = actor and b.blocked_user_id = seller
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

revoke all on function public.get_marketplace_seller_profile(text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_seller_profile(text,integer,integer)
  to anon, authenticated;

-- Serialize frontend-error quotas so parallel reports cannot bypass the hourly cap.
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
  clean_message := left(coalesce(p_message,'error'),500);
  clean_message := regexp_replace(
    clean_message,
    '(bearer|token|password|authorization|secret|service[_-]?role|captcha|paypal)[^[:space:]]*',
    '[redacted]', 'gi'
  );
  clean_message := regexp_replace(
    clean_message,
    '[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}',
    '[redacted]', 'g'
  );
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

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text || ':frontend-error', 0)
  );
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

revoke all on function public.record_frontend_error(text,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_frontend_error(text,text,text,text,jsonb)
  to authenticated;

create or replace function public.maintain_marketplace_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  delete from public.marketplace_notifications n
  where n.id in (
    select stale.id
    from public.marketplace_notifications stale
    where (stale.read_at is not null and stale.created_at < now() - interval '90 days')
       or (stale.created_at < now() - interval '180 days')
    order by stale.created_at asc
    limit 5000
  );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.maintain_marketplace_notifications()
  from public, anon, authenticated;
grant execute on function public.maintain_marketplace_notifications() to service_role;

do $$
begin
  if exists(select 1 from cron.job where jobname='maintain-marketplace-notifications') then
    perform cron.unschedule('maintain-marketplace-notifications');
  end if;
  perform cron.schedule(
    'maintain-marketplace-notifications',
    '31 4 * * *',
    'select public.maintain_marketplace_notifications();'
  );
end;
$$;

comment on table public.marketplace_notifications is
  'Owned, plain-text internal notifications. Read rows retain 90 days; all rows retain at most 180 days.';
comment on table public.marketplace_user_blocks is
  'Directional user-controlled Marketplace blocks. The blocker excludes the blocked seller from discovery and profile/contact surfaces.';
