-- Phase 9: internal promotion placements for active Plus server listings.
-- No third-party provider, cookies or external scripts are introduced.

alter table public.ads_settings
  drop constraint if exists ads_settings_placement_check,
  drop constraint if exists ads_settings_provider_check;

-- Preserve any previous administrator choice while normalizing legacy names.
update public.ads_settings legacy
set placement = 'maps_bosses_sidebar', updated_at = now()
where legacy.placement = 'bosses_footer'
  and not exists (
    select 1 from public.ads_settings existing_setting
    where existing_setting.placement = 'maps_bosses_sidebar'
  );

update public.ads_settings legacy
set placement = 'tribe_dashboard_soft', updated_at = now()
where legacy.placement = 'dashboard_carousel'
  and not exists (
    select 1 from public.ads_settings existing_setting
    where existing_setting.placement = 'tribe_dashboard_soft'
  );

delete from public.ads_settings where placement in ('bosses_footer', 'dashboard_carousel');
update public.ads_settings set provider = 'internal' where provider <> 'internal';

alter table public.ads_settings
  add constraint ads_settings_placement_check check (placement in (
    'home_featured_servers',
    'home_hero_secondary',
    'inis_sidebar',
    'maps_bosses_sidebar',
    'creatures_sidebar',
    'servers_featured',
    'tribe_dashboard_soft',
    'empty_state_server_recommendation',
    'server_publish_example'
  )),
  add constraint ads_settings_provider_check check (provider = 'internal'),
  add constraint ads_settings_configuration_size_check check (pg_column_size(configuration) <= 8192);

insert into public.ads_settings (placement, enabled, provider, configuration)
values
  ('home_featured_servers', true, 'internal', '{"max_items":3,"layout":"rail"}'::jsonb),
  ('home_hero_secondary', false, 'internal', '{"max_items":1,"layout":"compact"}'::jsonb),
  ('inis_sidebar', true, 'internal', '{"max_items":1,"layout":"sidebar"}'::jsonb),
  ('maps_bosses_sidebar', true, 'internal', '{"max_items":1,"layout":"sidebar"}'::jsonb),
  ('creatures_sidebar', true, 'internal', '{"max_items":1,"layout":"sidebar"}'::jsonb),
  ('servers_featured', true, 'internal', '{"max_items":1,"layout":"featured"}'::jsonb),
  ('tribe_dashboard_soft', true, 'internal', '{"max_items":1,"layout":"soft","dismissible":true,"dismiss_days":7}'::jsonb),
  ('empty_state_server_recommendation', true, 'internal', '{"max_items":1,"layout":"compact"}'::jsonb),
  ('server_publish_example', true, 'internal', '{"max_items":1,"layout":"preview"}'::jsonb)
on conflict (placement) do update
set provider = 'internal',
    configuration = public.ads_settings.configuration || excluded.configuration,
    updated_at = now();

update public.ads_settings
set enabled = placement <> 'home_hero_secondary', updated_at = now()
where placement in (
  'home_featured_servers', 'home_hero_secondary', 'inis_sidebar',
  'maps_bosses_sidebar', 'creatures_sidebar', 'servers_featured',
  'tribe_dashboard_soft', 'empty_state_server_recommendation', 'server_publish_example'
);

update public.feature_flags
set enabled = true, description = 'Promoción interna de servidores Plus', updated_at = now()
where key = 'community_ads';

alter table public.server_listing_clicks
  add column if not exists event_type text not null default 'discord_click';

alter table public.server_listing_clicks
  drop constraint if exists server_listing_clicks_event_type_check,
  add constraint server_listing_clicks_event_type_check
    check (event_type in ('discord_click', 'website_click'));

create index if not exists server_listing_clicks_event_idx
  on public.server_listing_clicks(listing_id, event_type, clicked_at desc);

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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then raise exception 'service_role_required'; end if;
  if p_event not in ('impression', 'discord_click', 'website_click')
  then raise exception 'invalid_server_event'; end if;
  if p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_ip_hash'; end if;
  if char_length(coalesce(p_referrer, '')) > 500 then raise exception 'invalid_referrer'; end if;

  if not exists (
    select 1 from public.server_listings s
    where s.id = p_listing_id
      and s.status = 'active'
      and coalesce(s.starts_at, now()) <= now()
      and (s.expires_at is null or s.expires_at > now())
      and not s.cancel_at_period_end
      and (
        s.payment_status = 'paid'
        or (s.billing_source = 'manual' and s.payment_status in ('not_required', 'paid'))
      )
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
    update public.server_listings
    set impression_count = impression_count + 1
    where id = p_listing_id;
  else
    select exists (
      select 1 from public.server_listing_clicks c
      where c.listing_id = p_listing_id and c.ip_hash = p_ip_hash
        and c.event_type = p_event
        and c.clicked_at >= now() - interval '10 minutes'
    ) into recent_exists;
    if recent_exists then return false; end if;
    insert into public.server_listing_clicks (listing_id, user_id, ip_hash, referrer, event_type)
    values (p_listing_id, null, p_ip_hash, nullif(left(p_referrer, 500), ''), p_event);
    update public.server_listings
    set click_count = click_count + 1
    where id = p_listing_id;
  end if;
  return true;
end;
$$;

create or replace function public.admin_set_ads_placement(
  p_placement text,
  p_enabled boolean,
  p_provider text default 'internal',
  p_configuration jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_placement not in (
    'home_featured_servers', 'home_hero_secondary', 'inis_sidebar',
    'maps_bosses_sidebar', 'creatures_sidebar', 'servers_featured',
    'tribe_dashboard_soft', 'empty_state_server_recommendation', 'server_publish_example'
  ) or p_provider <> 'internal'
    or jsonb_typeof(p_configuration) <> 'object'
    or pg_column_size(p_configuration) > 8192
  then raise exception 'invalid_ads_setting'; end if;

  insert into public.ads_settings (placement, enabled, provider, configuration, updated_by)
  values (p_placement, p_enabled, 'internal', p_configuration, (select auth.uid()))
  on conflict (placement) do update
  set enabled = excluded.enabled,
      provider = 'internal',
      configuration = excluded.configuration,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning id into result_id;

  perform private.write_admin_audit(
    'admin.ads.updated', 'ads_setting', result_id, null,
    jsonb_build_object('placement', p_placement, 'enabled', p_enabled, 'provider', 'internal')
  );
  return result_id;
end;
$$;

revoke all on function public.record_server_listing_event(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_server_listing_event(uuid, text, text, text)
  to service_role;

revoke all on function public.admin_set_ads_placement(text, boolean, text, jsonb)
  from public, anon;
grant execute on function public.admin_set_ads_placement(text, boolean, text, jsonb)
  to authenticated;
