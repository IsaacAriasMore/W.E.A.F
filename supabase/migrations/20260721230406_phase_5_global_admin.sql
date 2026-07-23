-- Phase 5: global administration, governance and operational visibility.

create table private.global_admin_allowlist (
  email text primary key check (email = lower(trim(email))),
  note text,
  created_at timestamptz not null default now()
);

alter table private.global_admin_allowlist enable row level security;
revoke all on private.global_admin_allowlist from public, anon, authenticated;

insert into private.global_admin_allowlist (email, note)
values ('jisaaccv053@gmail.com', 'Initial W.E.A.F platform owner')
on conflict (email) do nothing;

update public.profiles
set global_role = 'admin'::public.global_role,
    updated_at = now()
where lower(email) in (select email from private.global_admin_allowlist);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  requested_game public.game_mode;
  assigned_role public.global_role;
begin
  requested_name := left(
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Survivor'),
    60
  );
  if char_length(requested_name) < 2 then requested_name := 'Survivor'; end if;

  requested_game := case new.raw_user_meta_data ->> 'default_game_mode'
    when 'evolved' then 'evolved'::public.game_mode
    when 'ascended' then 'ascended'::public.game_mode
    else 'both'::public.game_mode
  end;

  assigned_role := case when exists (
    select 1 from private.global_admin_allowlist a where a.email = lower(new.email)
  ) then 'admin'::public.global_role else 'user'::public.global_role end;

  insert into public.profiles (id, email, display_name, default_game_mode, global_role)
  values (new.id, new.email, requested_name, requested_game, assigned_role)
  on conflict (id) do nothing;

  if new.raw_user_meta_data ->> 'terms_version' = '2026-07-draft'
    and new.raw_user_meta_data ->> 'privacy_version' = '2026-07-draft' then
    insert into public.legal_acceptances (user_id, terms_version, privacy_version, accepted_at)
    values (new.id, '2026-07-draft', '2026-07-draft', coalesce(new.created_at, now()))
    on conflict (user_id, terms_version, privacy_version) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create index if not exists reports_reviewed_by_idx on public.reports(reviewed_by) where reviewed_by is not null;
create index if not exists analytics_events_tribe_created_idx on public.analytics_events(tribe_id, created_at desc) where tribe_id is not null;
create index if not exists payments_listing_idx on public.payments(listing_id) where listing_id is not null;
create index if not exists payments_plan_idx on public.payments(plan_id);

create or replace function private.write_admin_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, p_before, p_after)
$$;

revoke all on function private.write_admin_audit(text, text, uuid, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.get_admin_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'users_total', (select count(*) from public.profiles),
      'users_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'active_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
      'tribes_total', (select count(*) from public.tribes),
      'active_breeds', (select count(*) from public.breeds where status = 'active'),
      'mutations_30d', (select count(*) from public.mutations where created_at >= now() - interval '30 days'),
      'revenue_cents', (select coalesce(sum(amount_usd_cents), 0) from public.payments where status = 'paid'),
      'pending_reports', (select count(*) from public.reports where status in ('open', 'reviewing')),
      'webhook_failures_24h', (select count(*) from private.discord_deliveries where status = 'failed' and created_at >= now() - interval '24 hours')
    ),
    'users', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select p.id, p.email, p.display_name, p.global_role, p.default_game_mode,
        p.onboarding_completed, p.is_suspended, p.created_at, u.last_sign_in_at
      from public.profiles p join auth.users u on u.id = p.id
      order by p.created_at desc limit 100
    ) x),
    'tribes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select t.id, t.name, t.slug, t.game_mode, t.is_active, t.created_at,
        p.display_name as owner_name,
        (select count(*) from public.tribe_members tm where tm.tribe_id = t.id and tm.status = 'active') as member_count,
        (select count(*) from public.breeds b where b.tribe_id = t.id) as breed_count
      from public.tribes t join public.profiles p on p.id = t.owner_user_id
      order by t.created_at desc limit 100
    ) x),
    'species', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, name, slug, game_availability, image_url, category,
        vanilla_mating_cooldown_hours, stats, notes, is_public, is_active, sort_order
      from public.species order by sort_order, name
    ) x),
    'inis', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, title, slug, category, description, game_availability, is_public,
        copy_count, download_count, updated_at from public.ini_presets order by updated_at desc
    ) x),
    'maps', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, name, slug, game_availability, description, is_public, is_active, sort_order
      from public.maps order by sort_order, name
    ) x),
    'bosses', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select b.id, b.map_id, b.name, b.slug, b.notes, b.is_public, b.is_active, b.sort_order,
        m.name as map_name from public.bosses b join public.maps m on m.id = b.map_id
      order by m.sort_order, b.sort_order, b.name
    ) x),
    'servers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, title, slug, plan, status, game, server_type, region, is_featured,
        is_verified, starts_at, expires_at, created_at from public.server_listings order by created_at desc limit 100
    ) x),
    'plans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, code, name, price_usd_cents, duration_months, features, is_active
      from public.plans order by price_usd_cents, name
    ) x),
    'payments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select pay.id, pay.amount_usd_cents, pay.status, pay.created_at, p.email, pl.name as plan_name
      from public.payments pay join public.profiles p on p.id = pay.user_id join public.plans pl on pl.id = pay.plan_id
      order by pay.created_at desc limit 100
    ) x),
    'ads', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, placement, enabled, provider, configuration, updated_at from public.ads_settings order by placement
    ) x),
    'reports', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select r.id, r.entity_type, r.entity_id, r.reason, r.details, r.status, r.created_at,
        p.display_name as reporter_name from public.reports r left join public.profiles p on p.id = r.reporter_user_id
      order by r.created_at desc limit 100
    ) x),
    'flags', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, key, description, enabled, configuration, updated_at from public.feature_flags order by key
    ) x),
    'legal', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, document_type, version, title, is_published, published_at, updated_at
      from public.legal_documents order by updated_at desc
    ) x),
    'audit', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select a.id, a.action, a.entity_type, a.entity_id, a.created_at,
        p.display_name as actor_name from private.audit_logs a left join public.profiles p on p.id = a.actor_user_id
      order by a.created_at desc limit 100
    ) x)
  );
end;
$$;

create or replace function public.admin_set_user_suspension(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare previous jsonb; updated jsonb;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_user_id = (select auth.uid()) then raise exception 'cannot_suspend_self'; end if;
  if char_length(coalesce(p_reason, '')) > 500 then raise exception 'invalid_reason'; end if;
  select to_jsonb(p) into previous from public.profiles p where p.id = p_user_id for update;
  if previous is null then raise exception 'user_not_found'; end if;
  update public.profiles p set is_suspended = p_suspended, updated_at = now() where p.id = p_user_id returning to_jsonb(p) into updated;
  perform private.write_admin_audit(case when p_suspended then 'admin.user.suspended' else 'admin.user.restored' end, 'profile', p_user_id, previous, updated || jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_set_tribe_active(
  p_tribe_id uuid,
  p_active boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare previous jsonb; updated jsonb;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if char_length(coalesce(p_reason, '')) > 500 then raise exception 'invalid_reason'; end if;
  select to_jsonb(t) into previous from public.tribes t where t.id = p_tribe_id for update;
  if previous is null then raise exception 'tribe_not_found'; end if;
  update public.tribes t set is_active = p_active, updated_at = now() where t.id = p_tribe_id returning to_jsonb(t) into updated;
  perform private.write_admin_audit(case when p_active then 'admin.tribe.restored' else 'admin.tribe.paused' end, 'tribe', p_tribe_id, previous, updated || jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_upsert_content(
  p_entity text,
  p_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid; previous jsonb; updated jsonb;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then raise exception 'invalid_content_payload'; end if;

  if p_entity = 'species' then
    if p_id is null then
      insert into public.species (name, slug, game_availability, image_url, category, vanilla_mating_cooldown_hours, stats, notes, is_public, is_active, sort_order)
      values (trim(p_payload->>'name'), lower(trim(p_payload->>'slug')), (p_payload->>'game_availability')::public.game_mode,
        nullif(trim(p_payload->>'image_url'), ''), trim(p_payload->>'category'), (p_payload->>'cooldown_hours')::numeric,
        coalesce(p_payload->'stats', '[]'::jsonb), nullif(trim(p_payload->>'notes'), ''), coalesce((p_payload->>'is_public')::boolean, true),
        coalesce((p_payload->>'is_active')::boolean, true), coalesce((p_payload->>'sort_order')::integer, 0)) returning id into result_id;
    else
      select to_jsonb(s) into previous from public.species s where s.id = p_id for update;
      update public.species set name = trim(p_payload->>'name'), slug = lower(trim(p_payload->>'slug')),
        game_availability = (p_payload->>'game_availability')::public.game_mode,
        image_url = nullif(trim(p_payload->>'image_url'), ''), category = trim(p_payload->>'category'),
        vanilla_mating_cooldown_hours = (p_payload->>'cooldown_hours')::numeric, stats = coalesce(p_payload->'stats', '[]'::jsonb),
        notes = nullif(trim(p_payload->>'notes'), ''), is_public = coalesce((p_payload->>'is_public')::boolean, true),
        is_active = coalesce((p_payload->>'is_active')::boolean, true), sort_order = coalesce((p_payload->>'sort_order')::integer, 0), updated_at = now()
      where id = p_id returning id into result_id;
    end if;
  elsif p_entity = 'ini' then
    if p_id is null then
      insert into public.ini_presets (title, slug, category, description, content, image_url, game_availability, is_public, created_by)
      values (trim(p_payload->>'title'), lower(trim(p_payload->>'slug')), p_payload->>'category', p_payload->>'description', p_payload->>'content',
        nullif(trim(p_payload->>'image_url'), ''), (p_payload->>'game_availability')::public.game_mode, coalesce((p_payload->>'is_public')::boolean, false), (select auth.uid())) returning id into result_id;
    else
      select to_jsonb(i) into previous from public.ini_presets i where i.id = p_id for update;
      update public.ini_presets set title = trim(p_payload->>'title'), slug = lower(trim(p_payload->>'slug')), category = p_payload->>'category',
        description = p_payload->>'description', content = p_payload->>'content', image_url = nullif(trim(p_payload->>'image_url'), ''),
        game_availability = (p_payload->>'game_availability')::public.game_mode, is_public = coalesce((p_payload->>'is_public')::boolean, false), updated_at = now()
      where id = p_id returning id into result_id;
    end if;
  elsif p_entity = 'map' then
    if p_id is null then
      insert into public.maps (name, slug, game_availability, image_url, description, is_public, is_active, sort_order)
      values (trim(p_payload->>'name'), lower(trim(p_payload->>'slug')), (p_payload->>'game_availability')::public.game_mode, nullif(trim(p_payload->>'image_url'), ''),
        nullif(trim(p_payload->>'description'), ''), coalesce((p_payload->>'is_public')::boolean, false), coalesce((p_payload->>'is_active')::boolean, true), coalesce((p_payload->>'sort_order')::integer, 0)) returning id into result_id;
    else
      select to_jsonb(m) into previous from public.maps m where m.id = p_id for update;
      update public.maps set name = trim(p_payload->>'name'), slug = lower(trim(p_payload->>'slug')), game_availability = (p_payload->>'game_availability')::public.game_mode,
        image_url = nullif(trim(p_payload->>'image_url'), ''), description = nullif(trim(p_payload->>'description'), ''),
        is_public = coalesce((p_payload->>'is_public')::boolean, false), is_active = coalesce((p_payload->>'is_active')::boolean, true),
        sort_order = coalesce((p_payload->>'sort_order')::integer, 0), updated_at = now() where id = p_id returning id into result_id;
    end if;
  elsif p_entity = 'boss' then
    if p_id is null then
      insert into public.bosses (map_id, name, slug, image_url, notes, is_public, is_active, sort_order)
      values ((p_payload->>'map_id')::uuid, trim(p_payload->>'name'), lower(trim(p_payload->>'slug')), nullif(trim(p_payload->>'image_url'), ''),
        nullif(trim(p_payload->>'notes'), ''), coalesce((p_payload->>'is_public')::boolean, false), coalesce((p_payload->>'is_active')::boolean, true), coalesce((p_payload->>'sort_order')::integer, 0)) returning id into result_id;
    else
      select to_jsonb(b) into previous from public.bosses b where b.id = p_id for update;
      update public.bosses set map_id = (p_payload->>'map_id')::uuid, name = trim(p_payload->>'name'), slug = lower(trim(p_payload->>'slug')),
        image_url = nullif(trim(p_payload->>'image_url'), ''), notes = nullif(trim(p_payload->>'notes'), ''),
        is_public = coalesce((p_payload->>'is_public')::boolean, false), is_active = coalesce((p_payload->>'is_active')::boolean, true),
        sort_order = coalesce((p_payload->>'sort_order')::integer, 0), updated_at = now() where id = p_id returning id into result_id;
    end if;
  else
    raise exception 'unsupported_content_entity';
  end if;

  if result_id is null then raise exception 'content_not_found'; end if;
  execute format('select to_jsonb(x) from public.%I x where id = $1', case p_entity
    when 'ini' then 'ini_presets'
    when 'map' then 'maps'
    when 'boss' then 'bosses'
    else 'species'
  end)
    into updated using result_id;
  perform private.write_admin_audit(case when previous is null then 'admin.content.created' else 'admin.content.updated' end, p_entity, result_id, previous, updated);
  return result_id;
end;
$$;

create or replace function public.admin_archive_content(p_entity text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  case p_entity
    when 'species' then update public.species set is_public = false, is_active = false, updated_at = now() where id = p_id;
    when 'ini' then update public.ini_presets set is_public = false, updated_at = now() where id = p_id;
    when 'map' then update public.maps set is_public = false, is_active = false, updated_at = now() where id = p_id;
    when 'boss' then update public.bosses set is_public = false, is_active = false, updated_at = now() where id = p_id;
    else raise exception 'unsupported_content_entity';
  end case;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'content_not_found'; end if;
  perform private.write_admin_audit('admin.content.archived', p_entity, p_id, null, jsonb_build_object('archived', true));
end;
$$;

create or replace function public.admin_set_report_status(p_report_id uuid, p_status public.report_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  update public.reports set status = p_status, reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_report_id;
  if not found then raise exception 'report_not_found'; end if;
  perform private.write_admin_audit('admin.report.reviewed', 'report', p_report_id, null, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.admin_set_feature_flag(p_key text, p_description text, p_enabled boolean, p_configuration jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_key !~ '^[a-z][a-z0-9_]{1,63}$' or jsonb_typeof(p_configuration) <> 'object' then raise exception 'invalid_feature_flag'; end if;
  insert into public.feature_flags (key, description, enabled, configuration, updated_by)
  values (p_key, nullif(trim(p_description), ''), p_enabled, p_configuration, (select auth.uid()))
  on conflict (key) do update set description = excluded.description, enabled = excluded.enabled,
    configuration = excluded.configuration, updated_by = excluded.updated_by, updated_at = now()
  returning id into result_id;
  perform private.write_admin_audit('admin.feature_flag.updated', 'feature_flag', result_id, null, jsonb_build_object('key', p_key, 'enabled', p_enabled));
  return result_id;
end;
$$;

create or replace function public.admin_set_ads_placement(p_placement text, p_enabled boolean, p_provider text default 'internal', p_configuration jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_placement not in ('home_hero_secondary', 'inis_sidebar', 'bosses_footer', 'dashboard_carousel', 'servers_featured')
    or p_provider not in ('internal', 'external') or jsonb_typeof(p_configuration) <> 'object' then raise exception 'invalid_ads_setting'; end if;
  insert into public.ads_settings (placement, enabled, provider, configuration, updated_by)
  values (p_placement, p_enabled, p_provider, p_configuration, (select auth.uid()))
  on conflict (placement) do update set enabled = excluded.enabled, provider = excluded.provider,
    configuration = excluded.configuration, updated_by = excluded.updated_by, updated_at = now()
  returning id into result_id;
  perform private.write_admin_audit('admin.ads.updated', 'ads_setting', result_id, null, jsonb_build_object('placement', p_placement, 'enabled', p_enabled));
  return result_id;
end;
$$;

create or replace function public.admin_publish_legal_document(p_document_type text, p_version text, p_title text, p_content text, p_publish boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if char_length(trim(p_document_type)) not between 2 and 40 or char_length(trim(p_version)) not between 1 and 30
    or char_length(trim(p_title)) not between 2 and 160 or char_length(trim(p_content)) < 20 then raise exception 'invalid_legal_document'; end if;
  insert into public.legal_documents (document_type, version, title, content, is_published, published_at)
  values (trim(p_document_type), trim(p_version), trim(p_title), p_content, p_publish, case when p_publish then now() else null end)
  on conflict (document_type, version) do update set title = excluded.title, content = excluded.content,
    is_published = excluded.is_published, published_at = case when excluded.is_published then coalesce(legal_documents.published_at, now()) else null end, updated_at = now()
  returning id into result_id;
  perform private.write_admin_audit('admin.legal.updated', 'legal_document', result_id, null, jsonb_build_object('published', p_publish, 'version', p_version));
  return result_id;
end;
$$;

create or replace function public.admin_set_server_status(p_listing_id uuid, p_status public.listing_status, p_featured boolean, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  update public.server_listings set status = p_status, is_featured = p_featured, is_verified = p_verified, updated_at = now() where id = p_listing_id;
  if not found then raise exception 'server_not_found'; end if;
  perform private.write_admin_audit('admin.server.updated', 'server_listing', p_listing_id, null, jsonb_build_object('status', p_status, 'featured', p_featured, 'verified', p_verified));
end;
$$;

revoke all on function public.get_admin_workspace() from public, anon;
revoke all on function public.admin_set_user_suspension(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_tribe_active(uuid, boolean, text) from public, anon;
revoke all on function public.admin_upsert_content(text, uuid, jsonb) from public, anon;
revoke all on function public.admin_archive_content(text, uuid) from public, anon;
revoke all on function public.admin_set_report_status(uuid, public.report_status) from public, anon;
revoke all on function public.admin_set_feature_flag(text, text, boolean, jsonb) from public, anon;
revoke all on function public.admin_set_ads_placement(text, boolean, text, jsonb) from public, anon;
revoke all on function public.admin_publish_legal_document(text, text, text, text, boolean) from public, anon;
revoke all on function public.admin_set_server_status(uuid, public.listing_status, boolean, boolean) from public, anon;

grant execute on function public.get_admin_workspace() to authenticated;
grant execute on function public.admin_set_user_suspension(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_tribe_active(uuid, boolean, text) to authenticated;
grant execute on function public.admin_upsert_content(text, uuid, jsonb) to authenticated;
grant execute on function public.admin_archive_content(text, uuid) to authenticated;
grant execute on function public.admin_set_report_status(uuid, public.report_status) to authenticated;
grant execute on function public.admin_set_feature_flag(text, text, boolean, jsonb) to authenticated;
grant execute on function public.admin_set_ads_placement(text, boolean, text, jsonb) to authenticated;
grant execute on function public.admin_publish_legal_document(text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_set_server_status(uuid, public.listing_status, boolean, boolean) to authenticated;
