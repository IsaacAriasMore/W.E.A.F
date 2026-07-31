-- Private, opt-in marketplace recommendation signals and deterministic fair ranking.
-- No anonymous identities, IP addresses or browser fingerprints are persisted.

alter table public.marketplace_listings
  add column search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' ||
      coalesce(resource_name, '') || ' ' || coalesce(region, '') || ' ' || coalesce(platform, ''))
  ) stored;

create index marketplace_listings_search_idx
  on public.marketplace_listings using gin(search_vector);

create table public.marketplace_recommendation_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  personalization_enabled boolean not null default false,
  reset_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_recommendation_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  event_type text not null check (event_type in ('filter', 'search', 'detail', 'save', 'discord', 'hide')),
  weight smallint not null check (weight between -5 and 5),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 4096),
  client_event_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, client_event_id),
  check (
    (event_type in ('filter', 'search') and listing_id is null)
    or (event_type in ('detail', 'save', 'discord', 'hide') and listing_id is not null)
  )
);

create table public.marketplace_user_interest_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  affinities jsonb not null default '{}'::jsonb check (jsonb_typeof(affinities) = 'object'),
  source_event_count integer not null default 0 check (source_event_count >= 0),
  last_rebuilt_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_listing_impressions (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  session_id_hash text,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  bucket_key bigint not null,
  placement text not null check (placement in ('featured', 'organic')),
  position smallint not null check (position between 1 and 100),
  created_at timestamptz not null default now(),
  check ((user_id is not null)::integer + (session_id_hash is not null)::integer = 1),
  check (session_id_hash is null or session_id_hash ~ '^[a-f0-9]{64}$')
);

create unique index marketplace_impressions_user_dedupe_idx
  on public.marketplace_listing_impressions(user_id, listing_id, bucket_key, placement)
  where user_id is not null;
create unique index marketplace_impressions_session_dedupe_idx
  on public.marketplace_listing_impressions(session_id_hash, listing_id, bucket_key, placement)
  where session_id_hash is not null;
create index marketplace_events_user_recent_idx
  on public.marketplace_recommendation_events(user_id, created_at desc);
create index marketplace_events_listing_recent_idx
  on public.marketplace_recommendation_events(listing_id, created_at desc)
  where listing_id is not null;
create index marketplace_impressions_listing_recent_idx
  on public.marketplace_listing_impressions(listing_id, placement, created_at desc);

create trigger set_marketplace_recommendation_preferences_updated_at
before update on public.marketplace_recommendation_preferences
for each row execute function private.set_updated_at();

create trigger set_marketplace_user_interest_profiles_updated_at
before update on public.marketplace_user_interest_profiles
for each row execute function private.set_updated_at();

alter table public.marketplace_recommendation_preferences enable row level security;
alter table public.marketplace_recommendation_events enable row level security;
alter table public.marketplace_user_interest_profiles enable row level security;
alter table public.marketplace_listing_impressions enable row level security;

create policy marketplace_preferences_owner_read
  on public.marketplace_recommendation_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy marketplace_events_owner_read
  on public.marketplace_recommendation_events
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy marketplace_interest_profile_owner_read
  on public.marketplace_user_interest_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy marketplace_impressions_owner_read
  on public.marketplace_listing_impressions
  for select to authenticated
  using (user_id = (select auth.uid()));

create table private.marketplace_ranking_secrets (
  key text primary key check (key = 'catalog_cursor'),
  secret bytea not null check (octet_length(secret) = 32),
  created_at timestamptz not null default now()
);

insert into private.marketplace_ranking_secrets(key, secret)
values ('catalog_cursor', extensions.gen_random_bytes(32));

revoke all on table private.marketplace_ranking_secrets from public, anon, authenticated;

create or replace function private.marketplace_encode_cursor(p_payload jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select replace(encode(convert_to(p_payload::text, 'utf8'), 'base64'), E'\n', '')
    || '.' || encode(extensions.hmac(convert_to(p_payload::text, 'utf8'), secret, 'sha256'), 'hex')
  from private.marketplace_ranking_secrets
  where key = 'catalog_cursor'
$$;

create or replace function private.marketplace_decode_cursor(p_cursor text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  encoded text;
  signature text;
  payload_text text;
  expected text;
begin
  if p_cursor is null or char_length(p_cursor) not between 10 and 512 or position('.' in p_cursor) = 0 then
    raise exception 'invalid_marketplace_cursor';
  end if;
  encoded := split_part(p_cursor, '.', 1);
  signature := split_part(p_cursor, '.', 2);
  payload_text := convert_from(decode(encoded, 'base64'), 'utf8');
  select encode(extensions.hmac(convert_to(payload_text, 'utf8'), secret, 'sha256'), 'hex')
    into expected
  from private.marketplace_ranking_secrets
  where key = 'catalog_cursor';
  if expected is null or signature <> expected then
    raise exception 'invalid_marketplace_cursor';
  end if;
  return payload_text::jsonb;
exception when others then
  raise exception 'invalid_marketplace_cursor';
end;
$$;

create or replace function private.refresh_marketplace_interest_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_affinities jsonb;
  event_count integer;
begin
  if p_user_id is null then raise exception 'authentication_required'; end if;
  with eligible_events as (
    select
      e.*,
      e.weight::numeric * power(
        0.5::numeric,
        extract(epoch from (now() - e.created_at))::numeric / 2592000::numeric
      ) as decayed_weight,
      c.slug as listing_category,
      lower(l.region) as listing_region,
      lower(l.platform) as listing_platform,
      l.listing_type as listing_type
    from public.marketplace_recommendation_events e
    left join public.marketplace_listings l on l.id = e.listing_id
    left join public.marketplace_categories c on c.id = l.category_id
    join public.marketplace_recommendation_preferences p on p.user_id = e.user_id
    where e.user_id = p_user_id
      and e.created_at >= greatest(p.reset_at, now() - interval '90 days')
  ), signals as (
    select 'category:' || coalesce(listing_category, nullif(context->>'category', '')) as signal, decayed_weight from eligible_events
    union all
    select 'region:' || coalesce(listing_region, nullif(context->>'region', '')), decayed_weight from eligible_events
    union all
    select 'platform:' || coalesce(listing_platform, nullif(context->>'platform', '')), decayed_weight from eligible_events
    union all
    select 'type:' || coalesce(listing_type, nullif(context->>'type', '')), decayed_weight from eligible_events
  ), totals as (
    select signal, round(sum(decayed_weight), 6) as score
    from signals
    where signal is not null
      and signal !~ ':$'
    group by signal
  )
  select coalesce(jsonb_object_agg(signal, score), '{}'::jsonb)
    into profile_affinities
  from totals;

  select count(*) into event_count
  from public.marketplace_recommendation_events e
  join public.marketplace_recommendation_preferences p on p.user_id = e.user_id
  where e.user_id = p_user_id
    and e.created_at >= greatest(p.reset_at, now() - interval '90 days');

  insert into public.marketplace_user_interest_profiles(
    user_id, affinities, source_event_count, last_rebuilt_at
  ) values (p_user_id, profile_affinities, event_count, now())
  on conflict(user_id) do update
  set affinities = excluded.affinities,
      source_event_count = excluded.source_event_count,
      last_rebuilt_at = excluded.last_rebuilt_at;
end;
$$;

create or replace function public.get_marketplace_recommendation_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then
    jsonb_build_object('personalization_enabled', false, 'authenticated', false)
  else jsonb_build_object(
    'personalization_enabled', coalesce(p.personalization_enabled, false),
    'authenticated', true,
    'reset_at', p.reset_at
  ) end
  from (select 1) seed
  left join public.marketplace_recommendation_preferences p
    on p.user_id = (select auth.uid())
$$;

create or replace function public.set_marketplace_personalization(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  preference public.marketplace_recommendation_preferences%rowtype;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if p_enabled is null then raise exception 'invalid_personalization_preference'; end if;
  insert into public.marketplace_recommendation_preferences(user_id, personalization_enabled)
  values (actor_id, p_enabled)
  on conflict(user_id) do update set personalization_enabled = excluded.personalization_enabled
  returning * into preference;
  return jsonb_build_object(
    'personalization_enabled', preference.personalization_enabled,
    'reset_at', preference.reset_at
  );
end;
$$;

create or replace function public.reset_marketplace_recommendations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  delete from public.marketplace_recommendation_events where user_id = actor_id;
  delete from public.marketplace_user_interest_profiles where user_id = actor_id;
  insert into public.marketplace_recommendation_preferences(user_id, personalization_enabled, reset_at)
  values (actor_id, false, now())
  on conflict(user_id) do update
  set personalization_enabled = false, reset_at = now();
  insert into public.marketplace_audit_log(actor_user_id, action, details)
  values (actor_id, 'recommendations_reset', jsonb_build_object('scope', 'events_and_interests'));
end;
$$;

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
  selected_listing public.marketplace_listings%rowtype;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if not coalesce((
    select personalization_enabled
    from public.marketplace_recommendation_preferences
    where user_id = actor_id
  ), false) then
    raise exception 'marketplace_personalization_disabled';
  end if;
  if p_event_type not in ('filter', 'search', 'detail', 'save', 'discord', 'hide')
    or p_client_event_id is null
    or jsonb_typeof(p_context) <> 'object'
    or pg_column_size(p_context) > 4096
  then
    raise exception 'invalid_recommendation_event';
  end if;
  if p_context - array['category', 'region', 'platform', 'type', 'search'] <> '{}'::jsonb then
    raise exception 'invalid_recommendation_context';
  end if;
  if (
    select count(*)
    from public.marketplace_recommendation_events
    where user_id = actor_id and created_at > now() - interval '1 hour'
  ) >= 120 then
    raise exception 'marketplace_recommendation_rate_limit';
  end if;

  if p_event_type in ('detail', 'save', 'discord', 'hide') then
    select * into selected_listing
    from public.marketplace_listings
    where id = p_listing_id
      and game = 'ascended'
      and status = 'active'
      and expires_at > now();
    if selected_listing.id is null then raise exception 'listing_not_available'; end if;
    normalized := jsonb_build_object();
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
  ) on conflict(user_id, client_event_id) do nothing;
  if not found then return false; end if;
  perform private.refresh_marketplace_interest_profile(actor_id);
  return true;
end;
$$;

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
  featured_bucket bigint := floor(extract(epoch from now()) / 900)::bigint;
  organic_bucket bigint := floor(extract(epoch from now()) / 3600)::bigint;
  cursor_payload jsonb;
  cursor_score numeric;
  cursor_id uuid;
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
  if p_limit is null or p_limit not between 1 and 24 then
    raise exception 'invalid_marketplace_limit';
  end if;
  if p_type is not null and p_type not in ('buy', 'sell', 'trade') then
    raise exception 'invalid_marketplace_filter';
  end if;
  if p_platform is not null and p_platform not in ('steam', 'epic', 'xbox', 'playstation', 'windows', 'crossplay', 'other') then
    raise exception 'invalid_marketplace_filter';
  end if;
  if char_length(coalesce(p_slug, '')) > 100
    or char_length(coalesce(p_category, '')) > 60
    or char_length(coalesce(p_region, '')) > 40
  then
    raise exception 'invalid_marketplace_filter';
  end if;

  if p_cursor is not null then
    cursor_payload := private.marketplace_decode_cursor(p_cursor);
    if (cursor_payload->>'b')::bigint <> organic_bucket
      or nullif(cursor_payload->>'s', '') is null
      or nullif(cursor_payload->>'i', '') is null
    then
      raise exception 'marketplace_cursor_expired';
    end if;
    cursor_score := (cursor_payload->>'s')::numeric;
    cursor_id := (cursor_payload->>'i')::uuid;
  end if;

  if actor_id is not null then
    select coalesce(p.personalization_enabled, false), coalesce(i.affinities, '{}'::jsonb)
      into personalization_enabled, affinities
    from (select actor_id as user_id) seed
    left join public.marketplace_recommendation_preferences p on p.user_id = seed.user_id
    left join public.marketplace_user_interest_profiles i on i.user_id = seed.user_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name_es', c.name_es, 'name_en', c.name_en
  ) order by c.sort_order), '[]'::jsonb)
  into categories
  from public.marketplace_categories c
  where c.is_active;

  if p_cursor is null and p_slug is null then
    with candidate as (
      select l.*,
        (
          case when p_type is not null then 10 else 0 end
          + case when p_category is not null then 10 else 0 end
          + case when p_region is not null then 10 else 0 end
          + case when p_platform is not null then 10 else 0 end
          + case when normalized_search is not null then
              10 * least(1, ts_rank_cd(l.search_vector, websearch_to_tsquery('simple', normalized_search)) + 0.25)
            else 0 end
        )::numeric as relevance_score,
        (30.0 / (1 + (
          select count(*) from public.marketplace_listing_impressions imp
          where imp.listing_id = l.id and imp.placement = 'featured'
            and imp.created_at > now() - interval '7 days'
        )))::numeric as exposure_score,
        (10 * greatest(0, 1 - extract(epoch from (now() - l.published_at)) / 604800))::numeric as freshness_score,
        (10.0 / (1 + (
          select count(*) from public.marketplace_listing_impressions seller_imp
          join public.marketplace_listings seller_listing on seller_listing.id = seller_imp.listing_id
          where seller_listing.owner_user_id = l.owner_user_id
            and seller_imp.placement = 'featured'
            and seller_imp.created_at > now() - interval '7 days'
        )))::numeric as seller_diversity_score
      from public.marketplace_listings l
      join public.marketplace_categories c on c.id = l.category_id
      where l.status = 'active' and l.expires_at > now() and l.game = 'ascended'
        and l.is_featured and l.featured_expires_at > now()
        and (p_type is null or l.listing_type = p_type)
        and (p_category is null or c.slug = lower(p_category))
        and (p_region is null or lower(l.region) = lower(p_region))
        and (p_platform is null or l.platform = lower(p_platform))
        and (normalized_search is null or l.search_vector @@ websearch_to_tsquery('simple', normalized_search))
    ), ranked as (
      select candidate.*,
        relevance_score + exposure_score + freshness_score + seller_diversity_score as rank_score,
        row_number() over (
          partition by owner_user_id
          order by relevance_score + exposure_score + freshness_score + seller_diversity_score desc, id desc
        ) as seller_position
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
      (
        case when p_type is not null then 10 else 0 end
        + case when p_category is not null then 10 else 0 end
        + case when p_region is not null then 10 else 0 end
        + case when p_platform is not null then 10 else 0 end
        + case when normalized_search is not null then
            5 + 5 * least(1, ts_rank_cd(l.search_vector, websearch_to_tsquery('simple', normalized_search)) * 4)
          else 0 end
      )::numeric as context_score,
      case when personalization_enabled then
        25 * least(1, greatest(0, (
          coalesce((affinities->>('category:' || c.slug))::numeric, 0)
          + coalesce((affinities->>('region:' || lower(l.region)))::numeric, 0)
          + coalesce((affinities->>('platform:' || lower(l.platform)))::numeric, 0)
          + coalesce((affinities->>('type:' || l.listing_type))::numeric, 0)
        ) / 20))
      else 0 end as affinity_score,
      (15.0 / (1 + (
        select count(*) from public.marketplace_listing_impressions imp
        where imp.listing_id = l.id and imp.placement = 'organic'
          and imp.created_at > now() - interval '7 days'
      )))::numeric as fairness_score,
      (10 * greatest(0, 1 - extract(epoch from (now() - l.published_at)) / 604800))::numeric as freshness_score,
      case when (hashtextextended(l.id::text, organic_bucket) & 2147483647) % 100 < 10 then 5 else 0 end::numeric as exploration_score
    from public.marketplace_listings l
    join public.marketplace_categories c on c.id = l.category_id
    where l.status = 'active' and l.expires_at > now() and l.game = 'ascended'
      and (p_slug is not null or not (l.is_featured and l.featured_expires_at > now()))
      and (p_slug is null or l.slug = p_slug)
      and (p_type is null or l.listing_type = p_type)
      and (p_category is null or c.slug = lower(p_category))
      and (p_region is null or lower(l.region) = lower(p_region))
      and (p_platform is null or l.platform = lower(p_platform))
      and (normalized_search is null or l.search_vector @@ websearch_to_tsquery('simple', normalized_search))
  ), scored as (
    select candidate.*, context_score + affinity_score + fairness_score + freshness_score + exploration_score as rank_score
    from candidate
  ), positioned as (
    select scored.*,
      row_number() over (order by rank_score desc, id desc) as global_position,
      row_number() over (partition by owner_user_id order by rank_score desc, id desc) as seller_position
    from scored
  ), selected as (
    select * from positioned
    where (global_position > 20 or seller_position <= 2)
      and (cursor_score is null or rank_score < cursor_score or (rank_score = cursor_score and id < cursor_id))
    order by rank_score desc, id desc
    limit p_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
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
        when exploration_score > 0 then 'explore'
        else 'fair_rotation' end
    ) order by rank_score desc, id desc), '[]'::jsonb),
    (array_agg(rank_score order by rank_score asc, id asc))[1],
    (array_agg(id order by rank_score asc, id asc))[1],
    count(*)::integer
  into organic_listings, last_score, last_id, result_count
  from selected;

  if p_slug is null and result_count = p_limit and last_id is not null then
    next_cursor := private.marketplace_encode_cursor(jsonb_build_object(
      'b', organic_bucket, 's', last_score, 'i', last_id
    ));
  end if;

  if actor_id is not null and personalization_enabled then
    insert into public.marketplace_listing_impressions(
      user_id, listing_id, bucket_key, placement, position
    )
    select actor_id, (item.value->>'id')::uuid, featured_bucket, 'featured', item.ordinality::smallint
    from jsonb_array_elements(featured_listings) with ordinality as item(value, ordinality)
    on conflict do nothing;

    insert into public.marketplace_listing_impressions(
      user_id, listing_id, bucket_key, placement, position
    )
    select actor_id, (item.value->>'id')::uuid, organic_bucket, 'organic', item.ordinality::smallint
    from jsonb_array_elements(organic_listings) with ordinality as item(value, ordinality)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'categories', categories,
    'featured', featured_listings,
    'listings', organic_listings,
    'next_cursor', next_cursor,
    'personalization_enabled', personalization_enabled,
    'bucket', organic_bucket
  );
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_marketplace_cursor';
end;
$$;

create or replace function public.maintain_marketplace_recommendation_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_events integer;
  deleted_impressions integer;
begin
  if (select auth.role()) <> 'service_role' and not private.is_global_admin() then
    raise exception 'service_role_or_admin_required';
  end if;
  delete from public.marketplace_recommendation_events
  where created_at < now() - interval '90 days';
  get diagnostics deleted_events = row_count;
  delete from public.marketplace_listing_impressions
  where created_at < now() - interval '90 days';
  get diagnostics deleted_impressions = row_count;
  insert into public.marketplace_audit_log(actor_user_id, action, details)
  values ((select auth.uid()), 'recommendation_retention_maintenance', jsonb_build_object(
    'events_deleted', deleted_events, 'impressions_deleted', deleted_impressions,
    'retention_days', 90
  ));
  return jsonb_build_object('events_deleted', deleted_events, 'impressions_deleted', deleted_impressions);
end;
$$;

revoke all on table
  public.marketplace_recommendation_preferences,
  public.marketplace_recommendation_events,
  public.marketplace_user_interest_profiles,
  public.marketplace_listing_impressions
from public, anon, authenticated;

grant select on table
  public.marketplace_recommendation_preferences,
  public.marketplace_recommendation_events,
  public.marketplace_user_interest_profiles,
  public.marketplace_listing_impressions
to authenticated;

revoke all on function
  private.marketplace_encode_cursor(jsonb),
  private.marketplace_decode_cursor(text),
  private.refresh_marketplace_interest_profile(uuid)
from public, anon, authenticated;

revoke all on function
  public.get_marketplace_recommendation_settings(),
  public.set_marketplace_personalization(boolean),
  public.reset_marketplace_recommendations(),
  public.record_marketplace_recommendation_event(text, uuid, jsonb, uuid),
  public.get_marketplace_catalog_v2(text, text, text, text, text, text, text, integer),
  public.maintain_marketplace_recommendation_data()
from public, anon, authenticated;

grant execute on function public.get_marketplace_catalog_v2(text, text, text, text, text, text, text, integer)
  to anon, authenticated;
grant execute on function public.get_marketplace_recommendation_settings()
  to anon, authenticated;
grant execute on function
  public.set_marketplace_personalization(boolean),
  public.reset_marketplace_recommendations(),
  public.record_marketplace_recommendation_event(text, uuid, jsonb, uuid)
to authenticated;
grant execute on function public.maintain_marketplace_recommendation_data()
  to service_role;

comment on function public.get_marketplace_catalog_v2(text, text, text, text, text, text, text, integer) is
  'ASA-only catalog: separate featured rotation, private opt-in affinity, deterministic exploration and signed keyset cursor.';
comment on table public.marketplace_recommendation_events is
  'Opt-in first-party marketplace signals retained for at most 90 days; never stores IPs, credentials or CAPTCHA tokens.';
