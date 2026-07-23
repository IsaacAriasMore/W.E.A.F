-- Phase 6: public server marketplace, manual administration and event tracking.

alter table public.server_listings
  add column if not exists cluster_name text,
  add column if not exists wipe_date date,
  add column if not exists uses_propagators boolean not null default false,
  add column if not exists click_count bigint not null default 0 check (click_count >= 0),
  add column if not exists impression_count bigint not null default 0 check (impression_count >= 0),
  add column if not exists moderation_notes text;

alter table public.server_listings
  add constraint server_listings_title_length_check check (char_length(trim(title)) between 2 and 100),
  add constraint server_listings_region_length_check check (char_length(trim(region)) between 2 and 40),
  add constraint server_listings_language_length_check check (char_length(trim(language)) between 2 and 40),
  add constraint server_listings_description_length_check check (char_length(trim(description)) between 20 and 4000),
  add constraint server_listings_platforms_limit_check check (cardinality(platforms) between 1 and 8),
  add constraint server_listings_mods_limit_check check (cardinality(mods) <= 30),
  add constraint server_listings_maps_limit_check check (cardinality(maps) between 1 and 20),
  add constraint server_listings_gallery_limit_check check (cardinality(gallery_urls) <= 6),
  add constraint server_listings_cluster_length_check check (cluster_name is null or char_length(trim(cluster_name)) between 2 and 80),
  add constraint server_listings_moderation_notes_check check (moderation_notes is null or char_length(moderation_notes) <= 2000);

create index if not exists server_listings_filter_idx
  on public.server_listings(game, server_type, region, language)
  where status = 'active';
create index if not exists server_listings_platforms_gin_idx
  on public.server_listings using gin(platforms);
create index if not exists server_listings_maps_gin_idx
  on public.server_listings using gin(maps);
create index if not exists server_listings_click_rank_idx
  on public.server_listings(click_count desc)
  where status = 'active';

create table private.server_listing_impressions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.server_listings(id) on delete cascade,
  ip_hash text not null,
  referrer text,
  viewed_at timestamptz not null default now()
);

create index server_listing_impressions_listing_idx
  on private.server_listing_impressions(listing_id, viewed_at desc);
create index server_listing_impressions_rate_idx
  on private.server_listing_impressions(ip_hash, listing_id, viewed_at desc);
alter table private.server_listing_impressions enable row level security;
revoke all on private.server_listing_impressions from public, anon, authenticated;

create or replace function public.record_server_listing_event(
  p_listing_id uuid,
  p_event text,
  p_ip_hash text,
  p_referrer text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_exists boolean;
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_event not in ('impression', 'discord_click') then raise exception 'invalid_server_event'; end if;
  if p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_ip_hash'; end if;
  if char_length(coalesce(p_referrer, '')) > 500 then raise exception 'invalid_referrer'; end if;
  if not exists (
    select 1 from public.server_listings s
    where s.id = p_listing_id and s.status = 'active'
      and coalesce(s.starts_at, now()) <= now()
      and (s.expires_at is null or s.expires_at > now())
  ) then raise exception 'listing_not_available'; end if;

  if p_event = 'impression' then
    select exists (
      select 1 from private.server_listing_impressions i
      where i.listing_id = p_listing_id and i.ip_hash = p_ip_hash
        and i.viewed_at >= now() - interval '1 hour'
    ) into recent_exists;
    if recent_exists then return false; end if;
    insert into private.server_listing_impressions (listing_id, ip_hash, referrer)
    values (p_listing_id, p_ip_hash, nullif(left(p_referrer, 500), ''));
    update public.server_listings set impression_count = impression_count + 1 where id = p_listing_id;
  else
    select exists (
      select 1 from public.server_listing_clicks c
      where c.listing_id = p_listing_id and c.ip_hash = p_ip_hash
        and c.clicked_at >= now() - interval '10 minutes'
    ) into recent_exists;
    if recent_exists then return false; end if;
    insert into public.server_listing_clicks (listing_id, user_id, ip_hash, referrer)
    values (p_listing_id, null, p_ip_hash, nullif(left(p_referrer, 500), ''));
    update public.server_listings set click_count = click_count + 1 where id = p_listing_id;
  end if;
  return true;
end;
$$;

create or replace function public.admin_upsert_server_listing(
  p_listing_id uuid,
  p_payload jsonb,
  p_duration_months integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  previous jsonb;
  updated jsonb;
  selected_plan public.listing_plan;
  selected_game public.game_mode;
  selected_type public.server_type;
  selected_platforms text[];
  selected_mods text[];
  selected_maps text[];
  selected_gallery text[];
  selected_rates jsonb;
  selected_expires timestamptz;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then raise exception 'invalid_listing_payload'; end if;
  if p_duration_months is not null and p_duration_months not in (1, 3, 9, 12) then raise exception 'invalid_listing_duration'; end if;

  selected_plan := coalesce((p_payload->>'plan')::public.listing_plan, 'manual'::public.listing_plan);
  selected_game := (p_payload->>'game')::public.game_mode;
  selected_type := (p_payload->>'server_type')::public.server_type;
  selected_platforms := array(select jsonb_array_elements_text(coalesce(p_payload->'platforms', '[]'::jsonb)));
  selected_mods := array(select jsonb_array_elements_text(coalesce(p_payload->'mods', '[]'::jsonb)));
  selected_maps := array(select jsonb_array_elements_text(coalesce(p_payload->'maps', '[]'::jsonb)));
  selected_gallery := array(select jsonb_array_elements_text(coalesce(p_payload->'gallery_urls', '[]'::jsonb)));
  selected_rates := coalesce(p_payload->'rates', '{}'::jsonb);
  selected_expires := case when p_duration_months is null then null else now() + make_interval(months => p_duration_months) end;

  if char_length(trim(p_payload->>'title')) not between 2 and 100
    or (p_payload->>'slug') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(p_payload->>'description')) not between 20 and 4000
    or cardinality(selected_platforms) not between 1 and 8
    or cardinality(selected_maps) not between 1 and 20
    or cardinality(selected_mods) > 30
    or cardinality(selected_gallery) > 6
    or jsonb_typeof(selected_rates) <> 'object'
    or (p_payload->>'discord_invite_url') !~ '^https://(discord[.]gg|discord[.]com/invite)/'
  then raise exception 'invalid_listing_payload'; end if;

  if p_listing_id is null then
    insert into public.server_listings (
      created_by_admin, plan, status, title, slug, game, server_type, platforms,
      has_mods, mods, maps, rates, region, language, description, discord_invite_url,
      website_url, banner_url, gallery_urls, is_featured, is_verified, starts_at,
      expires_at, cluster_name, wipe_date, uses_propagators
    ) values (
      (select auth.uid()), selected_plan, 'active', trim(p_payload->>'title'), lower(trim(p_payload->>'slug')),
      selected_game, selected_type, selected_platforms, cardinality(selected_mods) > 0,
      selected_mods, selected_maps, selected_rates, trim(p_payload->>'region'), trim(p_payload->>'language'),
      trim(p_payload->>'description'), trim(p_payload->>'discord_invite_url'), nullif(trim(p_payload->>'website_url'), ''),
      nullif(trim(p_payload->>'banner_url'), ''), selected_gallery,
      coalesce((p_payload->>'is_featured')::boolean, selected_plan = 'plus'),
      coalesce((p_payload->>'is_verified')::boolean, false), now(), selected_expires,
      nullif(trim(p_payload->>'cluster_name'), ''), nullif(p_payload->>'wipe_date', '')::date,
      coalesce((p_payload->>'uses_propagators')::boolean, false)
    ) returning id into result_id;
  else
    select to_jsonb(s) into previous from public.server_listings s where s.id = p_listing_id for update;
    if previous is null then raise exception 'server_not_found'; end if;
    update public.server_listings set
      plan = selected_plan, title = trim(p_payload->>'title'), slug = lower(trim(p_payload->>'slug')),
      game = selected_game, server_type = selected_type, platforms = selected_platforms,
      has_mods = cardinality(selected_mods) > 0, mods = selected_mods, maps = selected_maps,
      rates = selected_rates, region = trim(p_payload->>'region'), language = trim(p_payload->>'language'),
      description = trim(p_payload->>'description'), discord_invite_url = trim(p_payload->>'discord_invite_url'),
      website_url = nullif(trim(p_payload->>'website_url'), ''), banner_url = nullif(trim(p_payload->>'banner_url'), ''),
      gallery_urls = selected_gallery, is_featured = coalesce((p_payload->>'is_featured')::boolean, selected_plan = 'plus'),
      is_verified = coalesce((p_payload->>'is_verified')::boolean, false), expires_at = selected_expires,
      cluster_name = nullif(trim(p_payload->>'cluster_name'), ''), wipe_date = nullif(p_payload->>'wipe_date', '')::date,
      uses_propagators = coalesce((p_payload->>'uses_propagators')::boolean, false), updated_at = now()
    where id = p_listing_id returning id into result_id;
  end if;

  select to_jsonb(s) into updated from public.server_listings s where s.id = result_id;
  perform private.write_admin_audit(case when previous is null then 'admin.server.created' else 'admin.server.edited' end,
    'server_listing', result_id, previous, updated);
  return result_id;
exception
  when unique_violation then raise exception 'listing_slug_taken';
end;
$$;

create or replace function public.admin_renew_server_listing(p_listing_id uuid, p_duration_months integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_duration_months not in (1, 3, 9, 12) then raise exception 'invalid_listing_duration'; end if;
  update public.server_listings set status = 'active', starts_at = coalesce(starts_at, now()),
    expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(months => p_duration_months), updated_at = now()
  where id = p_listing_id;
  if not found then raise exception 'server_not_found'; end if;
  perform private.write_admin_audit('admin.server.renewed', 'server_listing', p_listing_id, null,
    jsonb_build_object('duration_months', p_duration_months));
end;
$$;

create or replace function public.admin_delete_server_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare previous jsonb;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  select to_jsonb(s) into previous from public.server_listings s where s.id = p_listing_id for update;
  if previous is null then raise exception 'server_not_found'; end if;
  delete from public.server_listings where id = p_listing_id;
  perform private.write_admin_audit('admin.server.deleted', 'server_listing', p_listing_id, previous, null);
end;
$$;

create or replace function public.get_admin_server_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  return jsonb_build_object(
    'listings', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select s.*, p.email as owner_email, a.email as admin_email
      from public.server_listings s
      left join public.profiles p on p.id = s.owner_user_id
      left join public.profiles a on a.id = s.created_by_admin
      order by s.is_featured desc, s.created_at desc limit 200
    ) x),
    'totals', jsonb_build_object(
      'active', (select count(*) from public.server_listings where status = 'active' and (expires_at is null or expires_at > now())),
      'clicks', (select coalesce(sum(click_count), 0) from public.server_listings),
      'impressions', (select coalesce(sum(impression_count), 0) from public.server_listings),
      'conversion_rate', (select case when coalesce(sum(impression_count), 0) = 0 then 0
        else round(sum(click_count)::numeric * 100 / sum(impression_count), 2) end from public.server_listings)
    )
  );
end;
$$;

update public.feature_flags set enabled = true, updated_at = now()
where key = 'server_marketplace';

revoke all on function public.record_server_listing_event(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_server_listing_event(uuid, text, text, text) to service_role;

revoke all on function public.admin_upsert_server_listing(uuid, jsonb, integer) from public, anon;
revoke all on function public.admin_renew_server_listing(uuid, integer) from public, anon;
revoke all on function public.admin_delete_server_listing(uuid) from public, anon;
revoke all on function public.get_admin_server_workspace() from public, anon;
grant execute on function public.admin_upsert_server_listing(uuid, jsonb, integer) to authenticated;
grant execute on function public.admin_renew_server_listing(uuid, integer) to authenticated;
grant execute on function public.admin_delete_server_listing(uuid) to authenticated;
grant execute on function public.get_admin_server_workspace() to authenticated;
