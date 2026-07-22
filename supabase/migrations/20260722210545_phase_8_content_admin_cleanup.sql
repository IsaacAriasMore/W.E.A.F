-- Phase 8: align the manual server editor with the public listing contract.
-- RLS remains enabled; this RPC still requires a verified global admin.

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
  selected_maps text[];
  selected_gallery text[];
  selected_rates jsonb;
  selected_has_mods boolean;
  selected_expires timestamptz;
  generated_slug text;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then raise exception 'invalid_listing_payload'; end if;
  if p_duration_months is not null and p_duration_months not in (1, 3, 9, 12) then raise exception 'invalid_listing_duration'; end if;

  selected_plan := coalesce((p_payload->>'plan')::public.listing_plan, 'manual'::public.listing_plan);
  selected_game := (p_payload->>'game')::public.game_mode;
  selected_type := (p_payload->>'server_type')::public.server_type;
  selected_platforms := array(select jsonb_array_elements_text(coalesce(p_payload->'platforms', '[]'::jsonb)));
  selected_maps := array(select jsonb_array_elements_text(coalesce(p_payload->'maps', '[]'::jsonb)));
  selected_gallery := array(select jsonb_array_elements_text(coalesce(p_payload->'gallery_urls', '[]'::jsonb)));
  selected_rates := coalesce(p_payload->'rates', '{"preset":"not_specified"}'::jsonb);
  selected_has_mods := coalesce((p_payload->>'has_mods')::boolean, false);
  selected_expires := case when p_duration_months is null then null else now() + make_interval(months => p_duration_months) end;

  if char_length(trim(p_payload->>'title')) not between 2 and 100
    or char_length(trim(p_payload->>'description')) not between 20 and 4000
    or char_length(trim(p_payload->>'region')) not between 2 and 40
    or char_length(trim(p_payload->>'language')) not between 2 and 40
    or cardinality(selected_platforms) not between 1 and 8
    or cardinality(selected_maps) not between 1 and 20
    or cardinality(selected_gallery) > 6
    or jsonb_typeof(selected_rates) <> 'object'
    or (p_payload->>'discord_invite_url') !~ '^https://(discord[.]gg|discord[.]com/invite)/'
    or (nullif(trim(p_payload->>'website_url'), '') is not null and (p_payload->>'website_url') !~ '^https?://')
    or (nullif(trim(p_payload->>'banner_url'), '') is not null and (p_payload->>'banner_url') !~ '^https?://')
  then raise exception 'invalid_listing_payload'; end if;

  if p_listing_id is null then
    generated_slug := public.generate_server_listing_slug(p_payload->>'title');
    insert into public.server_listings (
      created_by_admin, plan, status, title, slug, game, server_type, platforms,
      has_mods, mods, maps, rates, region, language, description, discord_invite_url,
      website_url, banner_url, gallery_urls, is_featured, is_verified, starts_at,
      expires_at, cluster_name, wipe_date, uses_propagators, billing_source, payment_status
    ) values (
      (select auth.uid()), selected_plan, 'active', trim(p_payload->>'title'), generated_slug,
      selected_game, selected_type, selected_platforms, selected_has_mods, '{}'::text[],
      selected_maps, selected_rates, trim(p_payload->>'region'), trim(p_payload->>'language'),
      trim(p_payload->>'description'), trim(p_payload->>'discord_invite_url'), nullif(trim(p_payload->>'website_url'), ''),
      nullif(trim(p_payload->>'banner_url'), ''), selected_gallery,
      coalesce((p_payload->>'is_featured')::boolean, selected_plan = 'plus'),
      coalesce((p_payload->>'is_verified')::boolean, false), now(), selected_expires,
      nullif(trim(p_payload->>'cluster_name'), ''), nullif(p_payload->>'wipe_date', '')::date,
      coalesce((p_payload->>'uses_propagators')::boolean, false), 'manual', 'not_required'
    ) returning id into result_id;
  else
    select to_jsonb(s) into previous from public.server_listings s where s.id = p_listing_id for update;
    if previous is null then raise exception 'server_not_found'; end if;
    update public.server_listings set
      plan = selected_plan, title = trim(p_payload->>'title'), game = selected_game,
      server_type = selected_type, platforms = selected_platforms, has_mods = selected_has_mods,
      mods = '{}'::text[], maps = selected_maps, rates = selected_rates,
      region = trim(p_payload->>'region'), language = trim(p_payload->>'language'),
      description = trim(p_payload->>'description'), discord_invite_url = trim(p_payload->>'discord_invite_url'),
      website_url = nullif(trim(p_payload->>'website_url'), ''), banner_url = nullif(trim(p_payload->>'banner_url'), ''),
      gallery_urls = selected_gallery, is_featured = coalesce((p_payload->>'is_featured')::boolean, selected_plan = 'plus'),
      is_verified = coalesce((p_payload->>'is_verified')::boolean, false), expires_at = selected_expires,
      cluster_name = nullif(trim(p_payload->>'cluster_name'), ''), wipe_date = nullif(p_payload->>'wipe_date', '')::date,
      uses_propagators = coalesce((p_payload->>'uses_propagators')::boolean, false), updated_at = now()
    where id = p_listing_id returning id into result_id;
  end if;

  select to_jsonb(s) into updated from public.server_listings s where s.id = result_id;
  perform private.write_admin_audit(
    case when previous is null then 'admin.server.created' else 'admin.server.edited' end,
    'server_listing', result_id, previous, updated
  );
  return result_id;
end;
$$;

revoke all on function public.admin_upsert_server_listing(uuid, jsonb, integer) from public, anon;
grant execute on function public.admin_upsert_server_listing(uuid, jsonb, integer) to authenticated;
