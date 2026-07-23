-- Phase 10: bilingual editorial content for maps, bosses, requirements, and INI presets.
-- Existing Phase 5 columns stay in place for backwards compatibility.

alter table public.maps
  add column if not exists name_es text,
  add column if not exists name_en text,
  add column if not exists description_es text,
  add column if not exists description_en text,
  add column if not exists map_type text not null default 'other',
  add column if not exists release_order integer,
  add column if not exists release_order_evolved integer,
  add column if not exists release_order_ascended integer,
  add column if not exists is_canonical boolean not null default false,
  add column if not exists platform_notes text,
  add column if not exists icon_url text,
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists content_status text not null default 'draft';

update public.maps
set name_es = coalesce(name_es, name),
    name_en = coalesce(name_en, name),
    description_es = coalesce(description_es, description),
    description_en = coalesce(description_en, description),
    content_status = case when is_public then 'published' else content_status end;

alter table public.maps
  alter column name_es set not null,
  alter column name_en set not null,
  drop constraint if exists maps_map_type_check,
  add constraint maps_map_type_check check (map_type in ('story', 'official_mod', 'non_canonical', 'anniversary', 'premium', 'other')),
  drop constraint if exists maps_content_status_check,
  add constraint maps_content_status_check check (content_status in ('draft', 'reviewed', 'published', 'archived')),
  drop constraint if exists maps_release_order_evolved_check,
  add constraint maps_release_order_evolved_check check (release_order_evolved is null or release_order_evolved > 0),
  drop constraint if exists maps_release_order_ascended_check,
  add constraint maps_release_order_ascended_check check (release_order_ascended is null or release_order_ascended > 0);

alter table public.bosses
  add column if not exists name_es text,
  add column if not exists name_en text,
  add column if not exists description_es text,
  add column if not exists description_en text,
  add column if not exists game_availability public.game_mode not null default 'both',
  add column if not exists boss_type text not null default 'other',
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists content_status text not null default 'draft';

update public.bosses
set name_es = coalesce(name_es, name),
    name_en = coalesce(name_en, name),
    description_es = coalesce(description_es, notes),
    description_en = coalesce(description_en, notes),
    content_status = case when is_public then 'published' else content_status end;

alter table public.bosses
  alter column name_es set not null,
  alter column name_en set not null,
  drop constraint if exists bosses_boss_type_check,
  add constraint bosses_boss_type_check check (boss_type in ('main', 'mini', 'final', 'arena', 'mission', 'titan', 'other')),
  drop constraint if exists bosses_content_status_check,
  add constraint bosses_content_status_check check (content_status in ('draft', 'reviewed', 'published', 'archived')),
  drop constraint if exists bosses_slug_key;

create unique index if not exists bosses_map_game_slug_uidx
  on public.bosses(map_id, game_availability, slug);

alter table public.boss_requirements
  alter column item_name drop not null,
  alter column quantity drop not null,
  add column if not exists min_player_level integer,
  add column if not exists max_players integer,
  add column if not exists artifacts jsonb not null default '[]'::jsonb,
  add column if not exists tributes jsonb not null default '[]'::jsonb,
  add column if not exists unlocks jsonb not null default '[]'::jsonb,
  add column if not exists notes_es text,
  add column if not exists notes_en text,
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists content_status text not null default 'draft',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.boss_requirements
  drop constraint if exists boss_requirements_content_status_check,
  add constraint boss_requirements_content_status_check check (content_status in ('draft', 'reviewed', 'published', 'archived')),
  drop constraint if exists boss_requirements_min_level_check,
  add constraint boss_requirements_min_level_check check (min_player_level is null or min_player_level between 1 and 205),
  drop constraint if exists boss_requirements_max_players_check,
  add constraint boss_requirements_max_players_check check (max_players is null or max_players between 1 and 100),
  drop constraint if exists boss_requirements_artifacts_array_check,
  add constraint boss_requirements_artifacts_array_check check (jsonb_typeof(artifacts) = 'array'),
  drop constraint if exists boss_requirements_tributes_array_check,
  add constraint boss_requirements_tributes_array_check check (jsonb_typeof(tributes) = 'array'),
  drop constraint if exists boss_requirements_unlocks_array_check,
  add constraint boss_requirements_unlocks_array_check check (jsonb_typeof(unlocks) = 'array');

create unique index if not exists boss_requirements_boss_difficulty_uidx
  on public.boss_requirements(boss_id, difficulty);

alter table public.ini_presets
  add column if not exists title_es text,
  add column if not exists title_en text,
  add column if not exists description_es text,
  add column if not exists description_en text,
  add column if not exists file_target text not null default 'Engine.ini',
  add column if not exists risk_es text,
  add column if not exists risk_en text,
  add column if not exists rollback_es text,
  add column if not exists rollback_en text,
  add column if not exists compatibility_notes text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists content_status text not null default 'draft';

update public.ini_presets
set title_es = coalesce(title_es, title),
    title_en = coalesce(title_en, title),
    description_es = coalesce(description_es, description),
    description_en = coalesce(description_en, description),
    content_status = case when is_public then 'published' else content_status end;

alter table public.ini_presets
  alter column title_es set not null,
  alter column title_en set not null,
  drop constraint if exists ini_presets_category_check,
  add constraint ini_presets_category_check check (category in ('general', 'fps', 'pvp', 'farming', 'breeding', 'visibility', 'clean', 'server', 'client')),
  drop constraint if exists ini_presets_file_target_check,
  add constraint ini_presets_file_target_check check (file_target in ('GameUserSettings.ini', 'Game.ini', 'Engine.ini')),
  drop constraint if exists ini_presets_verification_status_check,
  add constraint ini_presets_verification_status_check check (verification_status in ('verified', 'pending', 'experimental')),
  drop constraint if exists ini_presets_content_status_check,
  add constraint ini_presets_content_status_check check (content_status in ('draft', 'reviewed', 'published', 'archived'));

create index if not exists maps_public_game_order_idx
  on public.maps(content_status, game_availability, release_order_evolved, release_order_ascended);
create index if not exists bosses_public_map_idx
  on public.bosses(content_status, map_id, game_availability, sort_order);
create index if not exists boss_requirements_public_boss_idx
  on public.boss_requirements(content_status, boss_id, difficulty);
create index if not exists ini_presets_public_game_category_idx
  on public.ini_presets(content_status, game_availability, category);

drop policy if exists ini_presets_public_read on public.ini_presets;
create policy ini_presets_public_read
on public.ini_presets for select to anon, authenticated
using (content_status = 'published' or private.is_global_admin());

drop policy if exists maps_public_read on public.maps;
create policy maps_public_read
on public.maps for select to anon, authenticated
using ((content_status = 'published' and is_active) or private.is_global_admin());

drop policy if exists bosses_public_read on public.bosses;
create policy bosses_public_read
on public.bosses for select to anon, authenticated
using ((content_status = 'published' and is_active) or private.is_global_admin());

drop policy if exists boss_requirements_public_read on public.boss_requirements;
create policy boss_requirements_public_read
on public.boss_requirements for select to anon, authenticated
using (
  (
    content_status = 'published'
    and exists (
      select 1 from public.bosses b
      join public.maps m on m.id = b.map_id
      where b.id = boss_id
        and b.content_status = 'published' and b.is_active
        and m.content_status = 'published' and m.is_active
    )
  )
  or private.is_global_admin()
);

grant select on public.maps, public.bosses, public.boss_requirements, public.ini_presets to anon, authenticated;

create or replace function public.admin_upsert_map(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid; previous jsonb; updated jsonb; selected_status text; selected_slug text;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then raise exception 'invalid_map_payload'; end if;
  selected_slug := lower(trim(p_payload->>'slug'));
  selected_status := coalesce(nullif(p_payload->>'content_status', ''), 'draft');
  if selected_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(p_payload->>'name_es')) not between 2 and 120
    or char_length(trim(p_payload->>'name_en')) not between 2 and 120
    or selected_status not in ('draft', 'reviewed', 'published', 'archived')
    or coalesce(p_payload->>'map_type', '') not in ('story', 'official_mod', 'non_canonical', 'anniversary', 'premium', 'other')
  then raise exception 'invalid_map_payload'; end if;

  if p_id is null then
    insert into public.maps(name, slug, name_es, name_en, description, description_es, description_en, game_availability,
      map_type, release_order, release_order_evolved, release_order_ascended, is_canonical, platform_notes,
      image_url, icon_url, source_url, source_name, reviewed_at, content_status, is_public, is_active, sort_order)
    values (trim(p_payload->>'name_en'), selected_slug, trim(p_payload->>'name_es'), trim(p_payload->>'name_en'),
      nullif(trim(p_payload->>'description_es'), ''), nullif(trim(p_payload->>'description_es'), ''), nullif(trim(p_payload->>'description_en'), ''),
      (p_payload->>'game_availability')::public.game_mode, p_payload->>'map_type', nullif(p_payload->>'release_order', '')::integer,
      nullif(p_payload->>'release_order_evolved', '')::integer, nullif(p_payload->>'release_order_ascended', '')::integer,
      coalesce((p_payload->>'is_canonical')::boolean, false), nullif(trim(p_payload->>'platform_notes'), ''),
      nullif(trim(p_payload->>'image_url'), ''), nullif(trim(p_payload->>'icon_url'), ''), nullif(trim(p_payload->>'source_url'), ''),
      nullif(trim(p_payload->>'source_name'), ''), nullif(p_payload->>'reviewed_at', '')::timestamptz, selected_status,
      selected_status = 'published', selected_status <> 'archived', coalesce((p_payload->>'sort_order')::integer, 0))
    returning id into result_id;
  else
    select to_jsonb(m) into previous from public.maps m where m.id = p_id for update;
    if previous is null then raise exception 'content_not_found'; end if;
    update public.maps set name = trim(p_payload->>'name_en'), slug = selected_slug,
      name_es = trim(p_payload->>'name_es'), name_en = trim(p_payload->>'name_en'),
      description = nullif(trim(p_payload->>'description_es'), ''), description_es = nullif(trim(p_payload->>'description_es'), ''),
      description_en = nullif(trim(p_payload->>'description_en'), ''), game_availability = (p_payload->>'game_availability')::public.game_mode,
      map_type = p_payload->>'map_type', release_order = nullif(p_payload->>'release_order', '')::integer,
      release_order_evolved = nullif(p_payload->>'release_order_evolved', '')::integer,
      release_order_ascended = nullif(p_payload->>'release_order_ascended', '')::integer,
      is_canonical = coalesce((p_payload->>'is_canonical')::boolean, false), platform_notes = nullif(trim(p_payload->>'platform_notes'), ''),
      image_url = nullif(trim(p_payload->>'image_url'), ''), icon_url = nullif(trim(p_payload->>'icon_url'), ''),
      source_url = nullif(trim(p_payload->>'source_url'), ''), source_name = nullif(trim(p_payload->>'source_name'), ''),
      reviewed_at = nullif(p_payload->>'reviewed_at', '')::timestamptz, content_status = selected_status,
      is_public = selected_status = 'published', is_active = selected_status <> 'archived',
      sort_order = coalesce((p_payload->>'sort_order')::integer, 0), updated_at = now()
    where id = p_id returning id into result_id;
  end if;
  select to_jsonb(m) into updated from public.maps m where m.id = result_id;
  perform private.write_admin_audit(case when previous is null then 'admin.map.created' else 'admin.map.updated' end, 'map', result_id, previous, updated);
  return result_id;
end;
$$;

create or replace function public.admin_upsert_boss(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid; previous jsonb; updated jsonb; selected_status text; selected_slug text; selected_map uuid;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then raise exception 'invalid_boss_payload'; end if;
  selected_slug := lower(trim(p_payload->>'slug')); selected_status := coalesce(nullif(p_payload->>'content_status', ''), 'draft');
  selected_map := nullif(p_payload->>'map_id', '')::uuid;
  if selected_map is null or not exists(select 1 from public.maps where id = selected_map)
    or selected_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(p_payload->>'name_es')) not between 2 and 120
    or char_length(trim(p_payload->>'name_en')) not between 2 and 120
    or selected_status not in ('draft', 'reviewed', 'published', 'archived')
    or coalesce(p_payload->>'boss_type', '') not in ('main', 'mini', 'final', 'arena', 'mission', 'titan', 'other')
  then raise exception 'invalid_boss_payload'; end if;
  if p_id is null then
    insert into public.bosses(map_id, name, slug, name_es, name_en, description_es, description_en, notes,
      game_availability, boss_type, image_url, source_url, source_name, reviewed_at, content_status, is_public, is_active, sort_order)
    values (selected_map, trim(p_payload->>'name_en'), selected_slug, trim(p_payload->>'name_es'), trim(p_payload->>'name_en'),
      nullif(trim(p_payload->>'description_es'), ''), nullif(trim(p_payload->>'description_en'), ''), nullif(trim(p_payload->>'description_es'), ''),
      (p_payload->>'game_availability')::public.game_mode, p_payload->>'boss_type', nullif(trim(p_payload->>'image_url'), ''),
      nullif(trim(p_payload->>'source_url'), ''), nullif(trim(p_payload->>'source_name'), ''), nullif(p_payload->>'reviewed_at', '')::timestamptz,
      selected_status, selected_status = 'published', selected_status <> 'archived', coalesce((p_payload->>'sort_order')::integer, 0))
    returning id into result_id;
  else
    select to_jsonb(b) into previous from public.bosses b where b.id = p_id for update;
    if previous is null then raise exception 'content_not_found'; end if;
    update public.bosses set map_id = selected_map, name = trim(p_payload->>'name_en'), slug = selected_slug,
      name_es = trim(p_payload->>'name_es'), name_en = trim(p_payload->>'name_en'),
      description_es = nullif(trim(p_payload->>'description_es'), ''), description_en = nullif(trim(p_payload->>'description_en'), ''),
      notes = nullif(trim(p_payload->>'description_es'), ''), game_availability = (p_payload->>'game_availability')::public.game_mode,
      boss_type = p_payload->>'boss_type', image_url = nullif(trim(p_payload->>'image_url'), ''),
      source_url = nullif(trim(p_payload->>'source_url'), ''), source_name = nullif(trim(p_payload->>'source_name'), ''),
      reviewed_at = nullif(p_payload->>'reviewed_at', '')::timestamptz, content_status = selected_status,
      is_public = selected_status = 'published', is_active = selected_status <> 'archived',
      sort_order = coalesce((p_payload->>'sort_order')::integer, 0), updated_at = now()
    where id = p_id returning id into result_id;
  end if;
  select to_jsonb(b) into updated from public.bosses b where b.id = result_id;
  perform private.write_admin_audit(case when previous is null then 'admin.boss.created' else 'admin.boss.updated' end, 'boss', result_id, previous, updated);
  return result_id;
end;
$$;

create or replace function public.admin_upsert_boss_requirement(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid; previous jsonb; updated jsonb; selected_status text; selected_boss uuid; selected_artifacts jsonb; selected_tributes jsonb;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 131072 then raise exception 'invalid_requirement_payload'; end if;
  selected_boss := nullif(p_payload->>'boss_id', '')::uuid; selected_status := coalesce(nullif(p_payload->>'content_status', ''), 'draft');
  selected_artifacts := coalesce(p_payload->'artifacts', '[]'::jsonb); selected_tributes := coalesce(p_payload->'tributes', '[]'::jsonb);
  if selected_boss is null or not exists(select 1 from public.bosses where id = selected_boss)
    or p_payload->>'difficulty' not in ('gamma', 'beta', 'alpha')
    or selected_status not in ('draft', 'reviewed', 'published', 'archived')
    or jsonb_typeof(selected_artifacts) <> 'array' or jsonb_typeof(selected_tributes) <> 'array'
    or exists(select 1 from jsonb_array_elements(selected_artifacts || selected_tributes) item where
      coalesce(item->>'id', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      or char_length(trim(item->>'name_es')) < 2 or char_length(trim(item->>'name_en')) < 2
      or coalesce((item->>'quantity')::integer, 0) <= 0)
  then raise exception 'invalid_requirement_payload'; end if;
  if p_id is null then
    insert into public.boss_requirements(boss_id, difficulty, item_name, quantity, min_player_level, max_players,
      artifacts, tributes, unlocks, notes, notes_es, notes_en, source_url, source_name, reviewed_at, content_status)
    values (selected_boss, p_payload->>'difficulty', null, null, nullif(p_payload->>'min_player_level', '')::integer,
      nullif(p_payload->>'max_players', '')::integer, selected_artifacts, selected_tributes, coalesce(p_payload->'unlocks', '[]'::jsonb),
      nullif(trim(p_payload->>'notes_es'), ''), nullif(trim(p_payload->>'notes_es'), ''), nullif(trim(p_payload->>'notes_en'), ''),
      nullif(trim(p_payload->>'source_url'), ''), nullif(trim(p_payload->>'source_name'), ''), nullif(p_payload->>'reviewed_at', '')::timestamptz,
      selected_status) returning id into result_id;
  else
    select to_jsonb(r) into previous from public.boss_requirements r where r.id = p_id for update;
    if previous is null then raise exception 'content_not_found'; end if;
    update public.boss_requirements set boss_id = selected_boss, difficulty = p_payload->>'difficulty',
      min_player_level = nullif(p_payload->>'min_player_level', '')::integer, max_players = nullif(p_payload->>'max_players', '')::integer,
      artifacts = selected_artifacts, tributes = selected_tributes, unlocks = coalesce(p_payload->'unlocks', '[]'::jsonb),
      notes = nullif(trim(p_payload->>'notes_es'), ''), notes_es = nullif(trim(p_payload->>'notes_es'), ''), notes_en = nullif(trim(p_payload->>'notes_en'), ''),
      source_url = nullif(trim(p_payload->>'source_url'), ''), source_name = nullif(trim(p_payload->>'source_name'), ''),
      reviewed_at = nullif(p_payload->>'reviewed_at', '')::timestamptz, content_status = selected_status, updated_at = now()
    where id = p_id returning id into result_id;
  end if;
  select to_jsonb(r) into updated from public.boss_requirements r where r.id = result_id;
  perform private.write_admin_audit(case when previous is null then 'admin.requirement.created' else 'admin.requirement.updated' end, 'boss_requirement', result_id, previous, updated);
  return result_id;
end;
$$;

create or replace function public.admin_upsert_ini_preset(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid; previous jsonb; updated jsonb; selected_status text; selected_slug text;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 262144 then raise exception 'invalid_ini_payload'; end if;
  selected_slug := lower(trim(p_payload->>'slug')); selected_status := coalesce(nullif(p_payload->>'content_status', ''), 'draft');
  if selected_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(p_payload->>'title_es')) not between 2 and 120
    or char_length(trim(p_payload->>'title_en')) not between 2 and 120
    or char_length(coalesce(p_payload->>'content', '')) not between 4 and 200000
    or p_payload->>'category' not in ('general', 'fps', 'pvp', 'farming', 'breeding', 'visibility', 'clean', 'server', 'client')
    or p_payload->>'file_target' not in ('GameUserSettings.ini', 'Game.ini', 'Engine.ini')
    or p_payload->>'verification_status' not in ('verified', 'pending', 'experimental')
    or selected_status not in ('draft', 'reviewed', 'published', 'archived')
  then raise exception 'invalid_ini_payload'; end if;
  if p_id is null then
    insert into public.ini_presets(title, slug, title_es, title_en, category, description, description_es, description_en,
      content, game_availability, file_target, risk_es, risk_en, rollback_es, rollback_en, compatibility_notes,
      verification_status, source_url, source_name, reviewed_at, content_status, is_public, created_by)
    values (trim(p_payload->>'title_en'), selected_slug, trim(p_payload->>'title_es'), trim(p_payload->>'title_en'), p_payload->>'category',
      trim(p_payload->>'description_es'), trim(p_payload->>'description_es'), trim(p_payload->>'description_en'), p_payload->>'content',
      (p_payload->>'game_availability')::public.game_mode, p_payload->>'file_target', nullif(trim(p_payload->>'risk_es'), ''),
      nullif(trim(p_payload->>'risk_en'), ''), nullif(trim(p_payload->>'rollback_es'), ''), nullif(trim(p_payload->>'rollback_en'), ''),
      nullif(trim(p_payload->>'compatibility_notes'), ''), p_payload->>'verification_status', nullif(trim(p_payload->>'source_url'), ''),
      nullif(trim(p_payload->>'source_name'), ''), nullif(p_payload->>'reviewed_at', '')::timestamptz, selected_status,
      selected_status = 'published', (select auth.uid())) returning id into result_id;
  else
    select to_jsonb(i) into previous from public.ini_presets i where i.id = p_id for update;
    if previous is null then raise exception 'content_not_found'; end if;
    update public.ini_presets set title = trim(p_payload->>'title_en'), slug = selected_slug,
      title_es = trim(p_payload->>'title_es'), title_en = trim(p_payload->>'title_en'), category = p_payload->>'category',
      description = trim(p_payload->>'description_es'), description_es = trim(p_payload->>'description_es'), description_en = trim(p_payload->>'description_en'),
      content = p_payload->>'content', game_availability = (p_payload->>'game_availability')::public.game_mode,
      file_target = p_payload->>'file_target', risk_es = nullif(trim(p_payload->>'risk_es'), ''), risk_en = nullif(trim(p_payload->>'risk_en'), ''),
      rollback_es = nullif(trim(p_payload->>'rollback_es'), ''), rollback_en = nullif(trim(p_payload->>'rollback_en'), ''),
      compatibility_notes = nullif(trim(p_payload->>'compatibility_notes'), ''), verification_status = p_payload->>'verification_status',
      source_url = nullif(trim(p_payload->>'source_url'), ''), source_name = nullif(trim(p_payload->>'source_name'), ''),
      reviewed_at = nullif(p_payload->>'reviewed_at', '')::timestamptz, content_status = selected_status,
      is_public = selected_status = 'published', updated_at = now()
    where id = p_id returning id into result_id;
  end if;
  select to_jsonb(i) into updated from public.ini_presets i where i.id = result_id;
  perform private.write_admin_audit(case when previous is null then 'admin.ini.created' else 'admin.ini.updated' end, 'ini', result_id, previous, updated);
  return result_id;
end;
$$;

create or replace function public.admin_archive_public_content(p_entity text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  case p_entity
    when 'map' then update public.maps set content_status = 'archived', is_public = false, is_active = false, updated_at = now() where id = p_id;
    when 'boss' then update public.bosses set content_status = 'archived', is_public = false, is_active = false, updated_at = now() where id = p_id;
    when 'boss_requirement' then update public.boss_requirements set content_status = 'archived', updated_at = now() where id = p_id;
    when 'ini' then update public.ini_presets set content_status = 'archived', is_public = false, updated_at = now() where id = p_id;
    else raise exception 'unsupported_content_entity';
  end case;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'content_not_found'; end if;
  perform private.write_admin_audit('admin.content.archived', p_entity, p_id, null, jsonb_build_object('content_status', 'archived'));
end;
$$;

create or replace function public.get_admin_content_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  return jsonb_build_object(
    'inis', (select coalesce(jsonb_agg(to_jsonb(i) order by i.updated_at desc), '[]'::jsonb) from public.ini_presets i),
    'maps', (select coalesce(jsonb_agg(to_jsonb(m) order by coalesce(m.release_order_evolved, m.release_order_ascended, 999), m.name), '[]'::jsonb) from public.maps m),
    'bosses', (select coalesce(jsonb_agg(to_jsonb(x) order by x.map_name, x.sort_order, x.name), '[]'::jsonb) from (
      select b.*, m.name as map_name from public.bosses b join public.maps m on m.id = b.map_id
    ) x),
    'requirements', (select coalesce(jsonb_agg(to_jsonb(x) order by x.map_name, x.boss_name, x.difficulty), '[]'::jsonb) from (
      select r.*, b.name as boss_name, m.name as map_name from public.boss_requirements r
      join public.bosses b on b.id = r.boss_id join public.maps m on m.id = b.map_id
    ) x)
  );
end;
$$;

revoke all on function public.admin_upsert_map(uuid, jsonb) from public, anon;
revoke all on function public.admin_upsert_boss(uuid, jsonb) from public, anon;
revoke all on function public.admin_upsert_boss_requirement(uuid, jsonb) from public, anon;
revoke all on function public.admin_upsert_ini_preset(uuid, jsonb) from public, anon;
revoke all on function public.admin_archive_public_content(text, uuid) from public, anon;
revoke all on function public.get_admin_content_workspace() from public, anon;
grant execute on function public.admin_upsert_map(uuid, jsonb) to authenticated;
grant execute on function public.admin_upsert_boss(uuid, jsonb) to authenticated;
grant execute on function public.admin_upsert_boss_requirement(uuid, jsonb) to authenticated;
grant execute on function public.admin_upsert_ini_preset(uuid, jsonb) to authenticated;
grant execute on function public.admin_archive_public_content(text, uuid) to authenticated;
grant execute on function public.get_admin_content_workspace() to authenticated;

drop trigger if exists set_boss_requirements_updated_at on public.boss_requirements;
create trigger set_boss_requirements_updated_at before update on public.boss_requirements
for each row execute function private.set_updated_at();

-- Verified map availability as of 2026-07-22. No copyrighted images are stored.
insert into public.maps(
  name, slug, name_es, name_en, description, description_es, description_en, game_availability,
  map_type, release_order_evolved, release_order_ascended, is_canonical, platform_notes,
  source_url, source_name, reviewed_at, content_status, is_public, is_active, sort_order
)
select name_en, slug, name_es, name_en, description_es, description_es, description_en, game_availability::public.game_mode,
  map_type, release_order_evolved, release_order_ascended, is_canonical, platform_notes,
  source_url, source_name, '2026-07-22 00:00:00+00'::timestamptz, 'published', true, true,
  coalesce(release_order_evolved, release_order_ascended, 999)
from (values
  ('the-island','The Island','The Island','La ruta original de guardianes y ascensión.','The original guardian and ascension route.','both','story',1,1,true,null,'https://ark.wiki.gg/wiki/The_Island','ARK Official Community Wiki'),
  ('the-center','The Center','The Center','Expansión oficial no canónica con múltiples biomas.','Official non-canonical expansion with multiple biomes.','both','official_mod',2,3,false,null,'https://ark.wiki.gg/wiki/The_Center','ARK Official Community Wiki'),
  ('scorched-earth','Scorched Earth','Scorched Earth','Supervivencia desértica y progresión hacia Manticore.','Desert survival and progression toward Manticore.','both','story',3,2,true,null,'https://ark.wiki.gg/wiki/Scorched_Earth','ARK Official Community Wiki'),
  ('ragnarok','Ragnarok','Ragnarok','Expansión oficial no canónica de escala amplia.','Large-scale official non-canonical expansion.','both','official_mod',4,7,false,null,'https://store.steampowered.com/app/3675020/ARK_Ragnarok_Ascended/','Steam'),
  ('aberration','Aberration','Aberration','ARK dañada con progresión subterránea hacia Rockwell.','Damaged ARK with underground progression toward Rockwell.','both','story',5,4,true,null,'https://ark.wiki.gg/wiki/Aberration','ARK Official Community Wiki'),
  ('extinction','Extinction','Extinction','Defensa orbital, titanes y cierre del arco terrestre.','Orbital defense, titans, and the Earth story finale.','both','story',6,5,true,null,'https://ark.wiki.gg/wiki/Extinction','ARK Official Community Wiki'),
  ('valguero','Valguero','Valguero','Expansión oficial no canónica con arenas distintas entre ASE y ASA.','Official non-canonical expansion with different ASE and ASA arenas.','both','official_mod',7,8,false,null,'https://ark.wiki.gg/wiki/Valguero','ARK Official Community Wiki'),
  ('genesis-part-1','Genesis: Part 1','Genesis: Part 1','Simulación por biomas con misiones y ascensión.','Biome simulation with missions and ascension.','both','story',8,9,true,null,'https://ark.wiki.gg/wiki/Genesis_1','ARK Official Community Wiki'),
  ('crystal-isles','Crystal Isles','Crystal Isles','Expansión oficial no canónica disponible en ASE.','Official non-canonical expansion available in ASE.','evolved','official_mod',9,null,false,null,'https://ark.wiki.gg/wiki/Crystal_Isles','ARK Official Community Wiki'),
  ('genesis-part-2','Genesis: Part 2','Genesis: Part 2','Cierre de la saga Genesis en ASE.','The Genesis saga finale in ASE.','evolved','story',10,null,true,null,'https://ark.wiki.gg/wiki/Genesis_2','ARK Official Community Wiki'),
  ('lost-island','Lost Island','Lost Island','Expansión oficial no canónica disponible en ASE.','Official non-canonical expansion available in ASE.','evolved','official_mod',11,null,false,null,'https://ark.wiki.gg/wiki/Lost_Island','ARK Official Community Wiki'),
  ('fjordur','Fjordur','Fjordur','Reinos nórdicos, mini-bosses, guardianes y Fenrisúlfr.','Norse realms, mini-bosses, guardians, and Fenrisúlfr.','evolved','official_mod',12,null,false,null,'https://ark.wiki.gg/wiki/Fjordur','ARK Official Community Wiki'),
  ('aquatica','Aquatica','Aquatica','DLC de aniversario no canónico centrado en exploración submarina.','Non-canonical anniversary DLC focused on underwater exploration.','evolved','anniversary',13,null,false,'PC / Steam; contenido premium no canónico.','https://store.steampowered.com/app/3537070/ARK_Aquatica/','Steam'),
  ('astraeos','Astraeos','Astraeos','Mapa premium no canónico inspirado en mitología griega.','Premium non-canonical map inspired by Greek mythology.','ascended','premium',null,6,false,'Contenido premium de ARK: Survival Ascended.','https://store.steampowered.com/app/3483400/ARK_Astraeos/','Steam')
) as seed(slug,name_es,name_en,description_es,description_en,game_availability,map_type,release_order_evolved,release_order_ascended,is_canonical,platform_notes,source_url,source_name)
on conflict (slug) do update set
  name = excluded.name, name_es = excluded.name_es, name_en = excluded.name_en,
  description = excluded.description, description_es = excluded.description_es, description_en = excluded.description_en,
  game_availability = excluded.game_availability, map_type = excluded.map_type,
  release_order_evolved = excluded.release_order_evolved, release_order_ascended = excluded.release_order_ascended,
  is_canonical = excluded.is_canonical, platform_notes = excluded.platform_notes,
  source_url = excluded.source_url, source_name = excluded.source_name, reviewed_at = excluded.reviewed_at,
  content_status = excluded.content_status, is_public = true, is_active = true, sort_order = excluded.sort_order, updated_at = now();

-- Confirmed boss catalog. Only The Island requirements are published in this pilot.
insert into public.bosses(
  map_id, name, slug, name_es, name_en, description_es, description_en, notes, game_availability,
  boss_type, source_url, source_name, reviewed_at, content_status, is_public, is_active, sort_order
)
select m.id, seed.name_en, seed.slug, seed.name_es, seed.name_en, seed.description_es, seed.description_en,
  seed.description_es, seed.game_availability::public.game_mode, seed.boss_type, seed.source_url,
  'ARK Official Community Wiki', '2026-07-22 00:00:00+00'::timestamptz, 'published', true, true, seed.sort_order
from (values
  ('the-island','broodmother-lysrix','Broodmother Lysrix','Broodmother Lysrix','Guardiana arácnida de The Island.','The Island spider guardian.','both','main','https://ark.wiki.gg/wiki/Broodmother_Lysrix',1),
  ('the-island','megapithecus','Megapithecus','Megapithecus','Guardián de clima extremo de The Island.','The Island cold-climate guardian.','both','main','https://ark.wiki.gg/wiki/Megapithecus',2),
  ('the-island','dragon','Dragon','Dragon','Guardián de fuego de The Island.','The Island fire guardian.','both','main','https://ark.wiki.gg/wiki/Dragon',3),
  ('the-island','overseer','Overseer','Overseer','Jefe final de The Island.','The Island final boss.','both','final','https://ark.wiki.gg/wiki/Overseer',4),
  ('scorched-earth','manticore','Manticore','Manticore','Guardiana final de Scorched Earth.','Scorched Earth final guardian.','both','final','https://ark.wiki.gg/wiki/Manticore',1),
  ('aberration','rockwell','Rockwell','Rockwell','Jefe de ascensión de Aberration.','Aberration ascension boss.','both','final','https://ark.wiki.gg/wiki/Rockwell',1),
  ('extinction','desert-titan','Desert Titan','Desert Titan','Titán del desierto.','Desert titan.','both','titan','https://ark.wiki.gg/wiki/Desert_Titan',1),
  ('extinction','forest-titan','Forest Titan','Forest Titan','Titán del bosque.','Forest titan.','both','titan','https://ark.wiki.gg/wiki/Forest_Titan',2),
  ('extinction','ice-titan','Ice Titan','Ice Titan','Titán del hielo.','Ice titan.','both','titan','https://ark.wiki.gg/wiki/Ice_Titan',3),
  ('extinction','king-titan','King Titan','King Titan','Encuentro final de Extinction.','Extinction final encounter.','both','final','https://ark.wiki.gg/wiki/King_Titan',4),
  ('genesis-part-1','moeder','Moeder','Moeder','Encuentro oceánico de Genesis: Part 1.','Genesis: Part 1 ocean encounter.','both','mission','https://ark.wiki.gg/wiki/Moeder',1),
  ('genesis-part-1','corrupted-master-controller','Corrupted Master Controller','Corrupted Master Controller','Jefe de ascensión de la simulación Genesis.','Genesis simulation ascension boss.','both','final','https://ark.wiki.gg/wiki/Corrupted_Master_Controller',2),
  ('genesis-part-2','rockwell-prime','Rockwell Prime','Rockwell Prime','Encuentro final de Genesis: Part 2.','Genesis: Part 2 final encounter.','evolved','final','https://ark.wiki.gg/wiki/Rockwell_Prime',1),
  ('fjordur','beyla','Beyla','Beyla','Mini-boss de Fjordur convocado con Runestones.','Fjordur mini-boss summoned with Runestones.','evolved','mini','https://ark.wiki.gg/wiki/Beyla',1),
  ('fjordur','hati-and-skoll','Hati & Sköll','Hati & Sköll','Dúo de mini-bosses de Fjordur.','Fjordur mini-boss pair.','evolved','mini','https://ark.wiki.gg/wiki/Hati_and_Sk%C3%B6ll',2),
  ('fjordur','steinbjorn','Steinbjörn','Steinbjörn','Mini-boss pétreo de Jotunheim.','Stone mini-boss found in Jotunheim.','evolved','mini','https://ark.wiki.gg/wiki/Steinbj%C3%B6rn',3),
  ('fjordur','broodmother-fjordur','Broodmother Lysrix','Broodmother Lysrix','Guardiana de Fjordur.','Fjordur guardian.','evolved','main','https://ark.wiki.gg/wiki/Broodmother_Lysrix',4),
  ('fjordur','megapithecus-fjordur','Megapithecus','Megapithecus','Guardián de Fjordur.','Fjordur guardian.','evolved','main','https://ark.wiki.gg/wiki/Megapithecus',5),
  ('fjordur','dragon-fjordur','Dragon','Dragon','Guardián de Fjordur.','Fjordur guardian.','evolved','main','https://ark.wiki.gg/wiki/Dragon',6),
  ('fjordur','fenrisulfr','Fenrisúlfr','Fenrisúlfr','Jefe final de Fjordur.','Fjordur final boss.','evolved','final','https://ark.wiki.gg/wiki/Fenris%C3%BAlfr',7)
) as seed(map_slug,slug,name_es,name_en,description_es,description_en,game_availability,boss_type,source_url,sort_order)
join public.maps m on m.slug = seed.map_slug
on conflict (map_id, game_availability, slug) do update set
  name = excluded.name, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, notes = excluded.notes,
  boss_type = excluded.boss_type, source_url = excluded.source_url, source_name = excluded.source_name,
  reviewed_at = excluded.reviewed_at, content_status = 'published', is_public = true, is_active = true,
  sort_order = excluded.sort_order, updated_at = now();

-- Structured, sourced The Island requirement pilot.
insert into public.boss_requirements(
  boss_id, difficulty, item_name, quantity, min_player_level, max_players, artifacts, tributes, unlocks,
  notes, notes_es, notes_en, source_url, source_name, reviewed_at, content_status
)
select b.id, seed.difficulty, null, null, seed.min_level, 10, seed.artifacts::jsonb, seed.tributes::jsonb, '[]'::jsonb,
  'Confirma multiplicadores, mods y reglas específicas de tu servidor.',
  'Confirma multiplicadores, mods y reglas específicas de tu servidor.',
  'Check your server multipliers, mods, and specific rules.', seed.source_url, 'ARK Official Community Wiki',
  '2026-07-22 00:00:00+00'::timestamptz, 'published'
from (values
  ('broodmother-lysrix','gamma',30,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[]','https://ark.wiki.gg/wiki/Broodmother_Lysrix'),
  ('broodmother-lysrix','beta',50,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":5},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":5},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":5},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":5}]','https://ark.wiki.gg/wiki/Broodmother_Lysrix'),
  ('broodmother-lysrix','alpha',70,
    '[{"id":"artifact-clever","name_es":"Artefacto del Astuto","name_en":"Artifact of the Clever","quantity":1},{"id":"artifact-hunter","name_es":"Artefacto del Cazador","name_en":"Artifact of the Hunter","quantity":1},{"id":"artifact-massive","name_es":"Artefacto del Colosal","name_en":"Artifact of the Massive","quantity":1}]',
    '[{"id":"argentavis-talon","name_es":"Garra de Argentavis","name_en":"Argentavis Talon","quantity":10},{"id":"sarcosuchus-skin","name_es":"Piel de Sarcosuchus","name_en":"Sarcosuchus Skin","quantity":10},{"id":"sauropod-vertebra","name_es":"Vértebra de saurópodo","name_en":"Sauropod Vertebra","quantity":10},{"id":"titanoboa-venom","name_es":"Veneno de Titanoboa","name_en":"Titanoboa Venom","quantity":10}]','https://ark.wiki.gg/wiki/Broodmother_Lysrix'),
  ('megapithecus','gamma',45,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[]','https://ark.wiki.gg/wiki/Megapithecus'),
  ('megapithecus','beta',65,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":5},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":5},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":5},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":5},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":5}]','https://ark.wiki.gg/wiki/Megapithecus'),
  ('megapithecus','alpha',85,
    '[{"id":"artifact-brute","name_es":"Artefacto del Bruto","name_en":"Artifact of the Brute","quantity":1},{"id":"artifact-devourer","name_es":"Artefacto del Devorador","name_en":"Artifact of the Devourer","quantity":1},{"id":"artifact-pack","name_es":"Artefacto de la Manada","name_en":"Artifact of the Pack","quantity":1}]',
    '[{"id":"megalania-toxin","name_es":"Toxina de Megalania","name_en":"Megalania Toxin","quantity":10},{"id":"megalodon-tooth","name_es":"Diente de Megalodon","name_en":"Megalodon Tooth","quantity":10},{"id":"spinosaurus-sail","name_es":"Vela de Spinosaurus","name_en":"Spinosaurus Sail","quantity":10},{"id":"therizino-claws","name_es":"Garras de Therizinosaur","name_en":"Therizino Claws","quantity":10},{"id":"thylacoleo-hook-claw","name_es":"Garra de Thylacoleo","name_en":"Thylacoleo Hook-Claw","quantity":10}]','https://ark.wiki.gg/wiki/Megapithecus'),
  ('dragon','gamma',55,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[]','https://ark.wiki.gg/wiki/Dragon'),
  ('dragon','beta',75,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":5},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":5},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":1},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":5},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":5},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":5}]','https://ark.wiki.gg/wiki/Dragon'),
  ('dragon','alpha',100,
    '[{"id":"artifact-cunning","name_es":"Artefacto de la Astucia","name_en":"Artifact of the Cunning","quantity":1},{"id":"artifact-immune","name_es":"Artefacto de la Inmunidad","name_en":"Artifact of the Immune","quantity":1},{"id":"artifact-skylord","name_es":"Artefacto del Señor del Cielo","name_en":"Artifact of the Skylord","quantity":1},{"id":"artifact-strong","name_es":"Artefacto del Fuerte","name_en":"Artifact of the Strong","quantity":1}]',
    '[{"id":"allosaurus-brain","name_es":"Cerebro de Allosaurus","name_en":"Allosaurus Brain","quantity":10},{"id":"basilosaurus-blubber","name_es":"Grasa de Basilosaurus","name_en":"Basilosaurus Blubber","quantity":10},{"id":"giganotosaurus-heart","name_es":"Corazón de Giganotosaurus","name_en":"Giganotosaurus Heart","quantity":2},{"id":"tusoteuthis-tentacle","name_es":"Tentáculo de Tusoteuthis","name_en":"Tusoteuthis Tentacle","quantity":10},{"id":"tyrannosaurus-arm","name_es":"Brazo de Tyrannosaurus","name_en":"Tyrannosaurus Arm","quantity":15},{"id":"yutyrannus-lungs","name_es":"Pulmones de Yutyrannus","name_en":"Yutyrannus Lungs","quantity":10}]','https://ark.wiki.gg/wiki/Dragon'),
  ('overseer','gamma',60,'[]',
    '[{"id":"gamma-broodmother-trophy","name_es":"Trofeo Gamma de Broodmother","name_en":"Gamma Broodmother Trophy","quantity":1},{"id":"gamma-megapithecus-trophy","name_es":"Trofeo Gamma de Megapithecus","name_en":"Gamma Megapithecus Trophy","quantity":1},{"id":"gamma-dragon-trophy","name_es":"Trofeo Gamma de Dragon","name_en":"Gamma Dragon Trophy","quantity":1}]','https://ark.wiki.gg/wiki/Overseer'),
  ('overseer','beta',80,'[]',
    '[{"id":"beta-broodmother-trophy","name_es":"Trofeo Beta de Broodmother","name_en":"Beta Broodmother Trophy","quantity":1},{"id":"beta-megapithecus-trophy","name_es":"Trofeo Beta de Megapithecus","name_en":"Beta Megapithecus Trophy","quantity":1},{"id":"beta-dragon-trophy","name_es":"Trofeo Beta de Dragon","name_en":"Beta Dragon Trophy","quantity":1},{"id":"alpha-raptor-claw","name_es":"Garra de Raptor Alfa","name_en":"Alpha Raptor Claw","quantity":1},{"id":"alpha-carnotaurus-arm","name_es":"Brazo de Carnotaurus Alfa","name_en":"Alpha Carnotaurus Arm","quantity":1},{"id":"alpha-tyrannosaur-tooth","name_es":"Diente de Tyrannosaurus Alfa","name_en":"Alpha Tyrannosaur Tooth","quantity":1}]','https://ark.wiki.gg/wiki/Overseer'),
  ('overseer','alpha',100,'[]',
    '[{"id":"alpha-broodmother-trophy","name_es":"Trofeo Alfa de Broodmother","name_en":"Alpha Broodmother Trophy","quantity":1},{"id":"alpha-megapithecus-trophy","name_es":"Trofeo Alfa de Megapithecus","name_en":"Alpha Megapithecus Trophy","quantity":1},{"id":"alpha-dragon-trophy","name_es":"Trofeo Alfa de Dragon","name_en":"Alpha Dragon Trophy","quantity":1},{"id":"alpha-raptor-claw","name_es":"Garra de Raptor Alfa","name_en":"Alpha Raptor Claw","quantity":1},{"id":"alpha-carnotaurus-arm","name_es":"Brazo de Carnotaurus Alfa","name_en":"Alpha Carnotaurus Arm","quantity":1},{"id":"alpha-tyrannosaur-tooth","name_es":"Diente de Tyrannosaurus Alfa","name_en":"Alpha Tyrannosaur Tooth","quantity":1},{"id":"alpha-megalodon-fin","name_es":"Aleta de Megalodon Alfa","name_en":"Alpha Megalodon Fin","quantity":1},{"id":"alpha-mosasaur-tooth","name_es":"Diente de Mosasaur Alfa","name_en":"Alpha Mosasaur Tooth","quantity":1},{"id":"alpha-tusoteuthis-eye","name_es":"Ojo de Tusoteuthis Alfa","name_en":"Alpha Tusoteuthis Eye","quantity":1},{"id":"alpha-leedsichthys-blubber","name_es":"Grasa de Leedsichthys Alfa","name_en":"Alpha Leedsichthys Blubber","quantity":1}]','https://ark.wiki.gg/wiki/Overseer')
) as seed(boss_slug,difficulty,min_level,artifacts,tributes,source_url)
join public.bosses b on b.slug = seed.boss_slug
join public.maps m on m.id = b.map_id and m.slug = 'the-island'
on conflict (boss_id, difficulty) do update set
  min_player_level = excluded.min_player_level, max_players = excluded.max_players,
  artifacts = excluded.artifacts, tributes = excluded.tributes, unlocks = excluded.unlocks,
  notes = excluded.notes, notes_es = excluded.notes_es, notes_en = excluded.notes_en,
  source_url = excluded.source_url, source_name = excluded.source_name, reviewed_at = excluded.reviewed_at,
  content_status = 'published', updated_at = now();

insert into public.ini_presets(
  title, slug, title_es, title_en, category, description, description_es, description_en, content,
  game_availability, file_target, risk_es, risk_en, rollback_es, rollback_en,
  verification_status, source_url, source_name, reviewed_at, content_status, is_public
)
values
  ('Clean visibility','clean-visibility','Visibilidad limpia','Clean visibility','visibility',
   'Reduce desenfoque, bloom y profundidad de campo para una lectura más estable.',
   'Reduce desenfoque, bloom y profundidad de campo para una lectura más estable.',
   'Reduces blur, bloom, and depth of field for steadier visual reading.',
   E'[SystemSettings]\nr.MotionBlurQuality=0\nr.DepthOfFieldQuality=0\nr.BloomQuality=0',
   'both','Engine.ini','Puede cambiar la intención visual y algunas versiones pueden ignorar variables.',
   'May change the intended look, and some versions may ignore variables.',
   'Elimina estas líneas de Engine.ini y reinicia el juego.','Remove these lines from Engine.ini and restart the game.',
   'experimental','https://ark.wiki.gg/wiki/Server_configuration','ARK Official Community Wiki','2026-07-22 00:00:00+00','published',true),
  ('Balanced ASA FPS','asa-fps-balanced','FPS equilibrado ASA','Balanced ASA FPS','fps',
   'Punto de partida conservador para reducir efectos costosos.','Punto de partida conservador para reducir efectos costosos.',
   'A conservative starting point that reduces expensive effects.',
   E'[SystemSettings]\nr.MotionBlurQuality=0\nr.Lumen.Reflections.Allow=0\nr.Nanite.MaxPixelsPerEdge=4',
   'ascended','Engine.ini','El rendimiento varía por GPU y versión. Prueba cada línea por separado.',
   'Performance varies by GPU and version. Test each line separately.',
   'Restaura una copia previa de Engine.ini.','Restore a previous Engine.ini backup.',
   'experimental','https://ark.wiki.gg/wiki/Console_commands','ARK Official Community Wiki','2026-07-22 00:00:00+00','published',true),
  ('Starter server breeding','breeding-starter-server','Breeding inicial de servidor','Starter server breeding','breeding',
   'Ejemplo moderado para pruebas privadas de crianza.','Ejemplo moderado para pruebas privadas de crianza.',
   'Moderate example for private breeding tests.',
   E'[/script/shootergame.shootergamemode]\nMatingIntervalMultiplier=0.5\nEggHatchSpeedMultiplier=5.0\nBabyMatureSpeedMultiplier=5.0',
   'both','Game.ini','Modificar rates afecta toda la progresión del servidor. Haz copia de seguridad.',
   'Changing rates affects the entire server progression. Back up first.',
   'Restaura los multiplicadores anteriores o elimina las líneas y reinicia.',
   'Restore previous multipliers or remove the lines and restart.',
   'pending','https://ark.wiki.gg/wiki/Server_configuration','ARK Official Community Wiki','2026-07-22 00:00:00+00','published',true)
on conflict (slug) do update set
  title = excluded.title, title_es = excluded.title_es, title_en = excluded.title_en,
  category = excluded.category, description = excluded.description, description_es = excluded.description_es,
  description_en = excluded.description_en, content = excluded.content, game_availability = excluded.game_availability,
  file_target = excluded.file_target, risk_es = excluded.risk_es, risk_en = excluded.risk_en,
  rollback_es = excluded.rollback_es, rollback_en = excluded.rollback_en,
  verification_status = excluded.verification_status, source_url = excluded.source_url, source_name = excluded.source_name,
  reviewed_at = excluded.reviewed_at, content_status = 'published', is_public = true, updated_at = now();
