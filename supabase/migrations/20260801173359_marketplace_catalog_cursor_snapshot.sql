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

  -- Bind the cursor to filters, the caller and the recommendation snapshot.
  query_hash := pg_catalog.md5(
    private.marketplace_cursor_query_context_hash(
      p_slug, p_type, p_category, p_region, p_platform, p_search, p_limit
    ) || ':' || coalesce(actor_id::text, 'anonymous') || ':'
      || personalization_enabled::text || ':' || affinities::text
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
    insert into public.marketplace_listing_impressions(user_id, listing_id, bucket_key, placement, position)
    select actor_id, (item.value->>'id')::uuid, featured_bucket, 'featured', item.ordinality::smallint
    from jsonb_array_elements(featured_listings) with ordinality as item(value, ordinality)
    on conflict do nothing;
    insert into public.marketplace_listing_impressions(user_id, listing_id, bucket_key, placement, position)
    select actor_id, (item.value->>'id')::uuid, organic_bucket, 'organic', item.ordinality::smallint
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
  'ASA-only deterministic catalog; v2 cursors bind filters, caller, recommendation state and a stable ranking snapshot.';
