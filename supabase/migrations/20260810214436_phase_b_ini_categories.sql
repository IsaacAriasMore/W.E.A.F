-- Phase B: retain every INI while consolidating public and editorial categories.
-- Rollback: restore the prior constraint/function, then reassign affected rows from audit data.

alter table public.ini_presets
  drop constraint if exists ini_presets_category_check;

update public.ini_presets
set category = 'other'
where category not in ('general', 'pvp', 'farming', 'other');

alter table public.ini_presets
  add constraint ini_presets_category_check
    check (category in ('general', 'pvp', 'farming', 'other'));

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
    or p_payload->>'category' not in ('general', 'pvp', 'farming', 'other')
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
