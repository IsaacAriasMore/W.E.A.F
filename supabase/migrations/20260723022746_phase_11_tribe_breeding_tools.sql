-- Phase 11: multi-tribe lifecycle and auditable breeding tools.
-- Additive by design: legacy mutation JSON and RPCs remain available.

alter table public.tribes
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.breeds
  add column if not exists base_stats jsonb not null default '{}'::jsonb check (jsonb_typeof(base_stats) = 'object'),
  add column if not exists current_stats jsonb not null default '{}'::jsonb check (jsonb_typeof(current_stats) = 'object'),
  add column if not exists caretaker_user_id uuid references auth.users(id) on delete set null,
  add column if not exists caretaker_display_name text,
  add column if not exists breeding_cycle integer not null default 1 check (breeding_cycle > 0);

update public.breeds
set base_stats = target_stats,
    current_stats = target_stats
where base_stats = '{}'::jsonb and current_stats = '{}'::jsonb and target_stats <> '{}'::jsonb;

alter table public.mutations
  add column if not exists stat_key text check (stat_key in ('health','stamina','oxygen','food','weight','melee','speed')),
  add column if not exists previous_value integer,
  add column if not exists new_value integer,
  add column if not exists delta integer,
  add column if not exists mutation_count integer check (mutation_count > 0),
  add column if not exists registered_by uuid references auth.users(id) on delete set null,
  add column if not exists registered_by_display_name text,
  add column if not exists line_owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists line_owner_display_name text,
  add column if not exists breeding_cycle integer not null default 1 check (breeding_cycle > 0);

update public.mutations mutation
set registered_by = mutation.created_by,
    registered_by_display_name = coalesce(profile.display_name, 'Survivor')
from public.profiles profile
where mutation.registered_by is null and profile.id = mutation.created_by;

create index if not exists mutations_breed_stat_created_idx
  on public.mutations(breed_id, stat_key, created_at desc);

create table if not exists public.tribe_breeding_resets (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  reset_by uuid not null references auth.users(id) on delete restrict,
  reset_reason text not null check (char_length(reset_reason) between 3 and 500),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists tribe_breeding_resets_tribe_created_idx
  on public.tribe_breeding_resets(tribe_id, created_at desc);

alter table public.tribe_breeding_resets enable row level security;
revoke all on public.tribe_breeding_resets from public, anon, authenticated;
grant select on public.tribe_breeding_resets to authenticated;

drop policy if exists tribe_breeding_resets_read_members on public.tribe_breeding_resets;
create policy tribe_breeding_resets_read_members
on public.tribe_breeding_resets for select to authenticated
using (private.is_tribe_member(tribe_id));

create or replace function public.rename_tribe(p_tribe_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_name text := trim(coalesce(p_name, ''));
  old_name text;
begin
  select name into old_name from public.tribes
  where id = p_tribe_id and owner_user_id = actor_id and is_active
  for update;
  if old_name is null then raise exception 'owner_required'; end if;
  if char_length(clean_name) not between 2 and 60 then raise exception 'invalid_tribe_name'; end if;

  update public.tribes set name = clean_name where id = p_tribe_id;
  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, before_data, after_data)
  values (actor_id, p_tribe_id, 'tribe.renamed', 'tribe', p_tribe_id,
    jsonb_build_object('name', old_name), jsonb_build_object('name', clean_name));
  return clean_name;
end;
$$;

create or replace function public.archive_tribe(
  p_tribe_id uuid,
  p_confirmation_name text,
  p_acknowledged boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  selected_name text;
begin
  select name into selected_name from public.tribes
  where id = p_tribe_id and owner_user_id = actor_id and is_active
  for update;
  if selected_name is null then raise exception 'owner_required'; end if;
  if not p_acknowledged or p_confirmation_name is distinct from selected_name then
    raise exception 'archive_confirmation_mismatch';
  end if;

  update public.tribes
  set is_active = false, archived_at = now(), archived_by = actor_id
  where id = p_tribe_id;
  update public.propagator_alerts set status = 'canceled'
  where tribe_id = p_tribe_id and status = 'scheduled';
  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, before_data, after_data)
  values (actor_id, p_tribe_id, 'tribe.archived', 'tribe', p_tribe_id,
    jsonb_build_object('is_active', true), jsonb_build_object('is_active', false, 'name', selected_name));
end;
$$;

create or replace function public.create_breed_v2(
  p_tribe_id uuid,
  p_species_id uuid,
  p_title text,
  p_base_stats jsonb default '{}'::jsonb,
  p_caretaker_user_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  tribe_game public.game_mode;
  new_id uuid;
  caretaker_name text;
begin
  if actor_id is null or not private.is_tribe_admin_or_owner(p_tribe_id) then raise exception 'not_authorized'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120 then raise exception 'invalid_breed_title'; end if;
  if jsonb_typeof(p_base_stats) <> 'object' or p_base_stats = '{}'::jsonb or octet_length(p_base_stats::text) > 10000
    or exists (
      select 1
      from jsonb_each(p_base_stats) stat
      where stat.key not in ('health','stamina','oxygen','food','weight','melee','speed')
        or jsonb_typeof(stat.value) <> 'number'
        or (stat.value #>> '{}')::numeric < 0
        or (stat.value #>> '{}')::numeric <> trunc((stat.value #>> '{}')::numeric)
    ) then
    raise exception 'invalid_breed_stats';
  end if;
  if char_length(coalesce(p_notes, '')) > 5000 then raise exception 'invalid_notes'; end if;

  select game_mode into tribe_game from public.tribes where id = p_tribe_id and is_active;
  if not exists (select 1 from public.species where id = p_species_id and is_active and is_public
    and (tribe_game = 'both' or game_availability in (tribe_game, 'both'))) then raise exception 'species_not_available'; end if;

  if p_caretaker_user_id is not null then
    select profile.display_name into caretaker_name
    from public.tribe_members member join public.profiles profile on profile.id = member.user_id
    where member.tribe_id = p_tribe_id and member.user_id = p_caretaker_user_id and member.status = 'active';
    if caretaker_name is null then raise exception 'caretaker_not_member'; end if;
  end if;

  insert into public.breeds(tribe_id, species_id, title, target_stats, base_stats, current_stats,
    current_mutations, caretaker_user_id, caretaker_display_name, notes, created_by)
  values (p_tribe_id, p_species_id, trim(p_title), p_base_stats, p_base_stats, p_base_stats,
    '{}'::jsonb, p_caretaker_user_id, caretaker_name, nullif(trim(coalesce(p_notes, '')), ''), actor_id)
  returning id into new_id;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, after_data)
  values (actor_id, p_tribe_id, 'breed.created_v2', 'breed', new_id,
    jsonb_build_object('title', trim(p_title), 'caretaker_user_id', p_caretaker_user_id));
  return new_id;
end;
$$;

create or replace function public.set_breed_caretaker(p_breed_id uuid, p_caretaker_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_tribe_id uuid;
  caretaker_name text;
begin
  select tribe_id into target_tribe_id from public.breeds where id = p_breed_id;
  if actor_id is null or target_tribe_id is null or not private.is_tribe_admin_or_owner(target_tribe_id) then raise exception 'not_authorized'; end if;
  if p_caretaker_user_id is not null then
    select profile.display_name into caretaker_name
    from public.tribe_members member join public.profiles profile on profile.id = member.user_id
    where member.tribe_id = target_tribe_id and member.user_id = p_caretaker_user_id and member.status = 'active';
    if caretaker_name is null then raise exception 'caretaker_not_member'; end if;
  end if;
  update public.breeds set caretaker_user_id = p_caretaker_user_id, caretaker_display_name = caretaker_name where id = p_breed_id;
  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, after_data)
  values (actor_id, target_tribe_id, 'breed.caretaker_changed', 'breed', p_breed_id,
    jsonb_build_object('caretaker_user_id', p_caretaker_user_id, 'caretaker_display_name', caretaker_name));
end;
$$;

create or replace function public.register_breed_stat_mutation(
  p_tribe_id uuid,
  p_breed_id uuid,
  p_stat_key text,
  p_new_value integer,
  p_notes text default null,
  p_allow_odd boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  selected_breed public.breeds%rowtype;
  selected_tribe public.tribes%rowtype;
  previous_value integer;
  stat_delta integer;
  count_value integer;
  actor_name text;
  mutation_id uuid;
  alert_id uuid;
  available_time timestamptz;
  species_cooldown numeric;
  merged_mutations jsonb;
begin
  if actor_id is null or not private.is_tribe_member(p_tribe_id) then raise exception 'not_authorized'; end if;
  if p_stat_key not in ('health','stamina','oxygen','food','weight','melee','speed') then raise exception 'invalid_stat'; end if;
  if char_length(coalesce(p_notes, '')) > 2000 then raise exception 'invalid_notes'; end if;

  select * into selected_breed from public.breeds
  where id = p_breed_id and tribe_id = p_tribe_id and status = 'active'
  for update;
  if selected_breed.id is null then raise exception 'breed_not_found'; end if;
  previous_value := (selected_breed.current_stats ->> p_stat_key)::integer;
  if previous_value is null then raise exception 'current_stat_missing'; end if;
  stat_delta := p_new_value - previous_value;
  if stat_delta <= 0 then raise exception 'mutation_not_improved'; end if;
  if mod(stat_delta, 2) <> 0 and not p_allow_odd then raise exception 'odd_mutation_requires_confirmation'; end if;
  count_value := floor(stat_delta::numeric / 2)::integer;
  if count_value < 1 then raise exception 'mutation_delta_too_small'; end if;

  select * into selected_tribe from public.tribes where id = p_tribe_id and is_active;
  if selected_tribe.id is null then raise exception 'tribe_not_found'; end if;
  select coalesce(display_name, 'Survivor') into actor_name from public.profiles where id = actor_id;

  insert into public.mutations(tribe_id, breed_id, species_id, stats, notes, created_by,
    stat_key, previous_value, new_value, delta, mutation_count, registered_by,
    registered_by_display_name, line_owner_user_id, line_owner_display_name, breeding_cycle)
  values (p_tribe_id, p_breed_id, selected_breed.species_id, jsonb_build_object(p_stat_key, count_value),
    nullif(trim(coalesce(p_notes, '')), ''), actor_id, p_stat_key, previous_value, p_new_value,
    stat_delta, count_value, actor_id, actor_name, selected_breed.caretaker_user_id,
    selected_breed.caretaker_display_name, selected_breed.breeding_cycle)
  returning id into mutation_id;

  merged_mutations := selected_breed.current_mutations || jsonb_build_object(
    p_stat_key, coalesce((selected_breed.current_mutations ->> p_stat_key)::integer, 0) + count_value);
  update public.breeds
  set current_stats = current_stats || jsonb_build_object(p_stat_key, p_new_value),
      current_mutations = merged_mutations
  where id = p_breed_id;

  if selected_tribe.uses_propagators then
    available_time := now() + make_interval(secs => (selected_tribe.propagator_cooldown_hours * 3600)::double precision);
  else
    select vanilla_mating_cooldown_hours into species_cooldown from public.species where id = selected_breed.species_id;
    if species_cooldown is not null then
      available_time := now() + make_interval(secs => (species_cooldown / selected_tribe.breeding_speed_multiplier * 3600)::double precision);
    end if;
  end if;
  if available_time is not null then
    insert into public.propagator_alerts(tribe_id, breed_id, available_at)
    values (p_tribe_id, p_breed_id, available_time) returning id into alert_id;
  end if;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, after_data)
  values (actor_id, p_tribe_id, 'mutation.stat_registered', 'mutation', mutation_id,
    jsonb_build_object('breed_id', p_breed_id, 'stat_key', p_stat_key, 'previous_value', previous_value,
      'new_value', p_new_value, 'delta', stat_delta, 'mutation_count', count_value, 'alert_id', alert_id));
  return jsonb_build_object('mutation_id', mutation_id, 'alert_id', alert_id, 'available_at', available_time,
    'previous_value', previous_value, 'new_value', p_new_value, 'delta', stat_delta,
    'mutation_count', count_value, 'odd_delta', mod(stat_delta, 2) <> 0);
end;
$$;

create or replace function public.reset_tribe_breeding(p_tribe_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  reset_id uuid;
  snapshot_data jsonb;
  affected_count integer;
begin
  if actor_id is null or not private.is_tribe_admin_or_owner(p_tribe_id) then raise exception 'not_authorized'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then raise exception 'invalid_reset_reason'; end if;

  select jsonb_build_object(
    'breeds', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'species_id', species_id, 'title', title,
      'base_stats', base_stats, 'current_stats', current_stats, 'current_mutations', current_mutations,
      'caretaker_user_id', caretaker_user_id, 'breeding_cycle', breeding_cycle))
      from public.breeds where tribe_id = p_tribe_id), '[]'::jsonb),
    'scheduled_alerts', coalesce((select jsonb_agg(to_jsonb(alert)) from public.propagator_alerts alert
      where tribe_id = p_tribe_id and status = 'scheduled'), '[]'::jsonb)
  ) into snapshot_data;

  insert into public.tribe_breeding_resets(tribe_id, reset_by, reset_reason, snapshot)
  values (p_tribe_id, actor_id, trim(p_reason), snapshot_data) returning id into reset_id;
  update public.breeds set current_stats = base_stats, current_mutations = '{}'::jsonb, breeding_cycle = breeding_cycle + 1
  where tribe_id = p_tribe_id;
  get diagnostics affected_count = row_count;
  update public.propagator_alerts set status = 'canceled'
  where tribe_id = p_tribe_id and status = 'scheduled';

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, after_data)
  values (actor_id, p_tribe_id, 'tribe.breeding_reset', 'tribe_breeding_reset', reset_id,
    jsonb_build_object('reason', trim(p_reason), 'affected_breeds', affected_count));
  return jsonb_build_object('reset_id', reset_id, 'affected_breeds', affected_count);
end;
$$;

revoke all on function public.rename_tribe(uuid, text) from public, anon;
revoke all on function public.archive_tribe(uuid, text, boolean) from public, anon;
revoke all on function public.create_breed_v2(uuid, uuid, text, jsonb, uuid, text) from public, anon;
revoke all on function public.set_breed_caretaker(uuid, uuid) from public, anon;
revoke all on function public.register_breed_stat_mutation(uuid, uuid, text, integer, text, boolean) from public, anon;
revoke all on function public.reset_tribe_breeding(uuid, text) from public, anon;

grant execute on function public.rename_tribe(uuid, text) to authenticated;
grant execute on function public.archive_tribe(uuid, text, boolean) to authenticated;
grant execute on function public.create_breed_v2(uuid, uuid, text, jsonb, uuid, text) to authenticated;
grant execute on function public.set_breed_caretaker(uuid, uuid) to authenticated;
grant execute on function public.register_breed_stat_mutation(uuid, uuid, text, integer, text, boolean) to authenticated;
grant execute on function public.reset_tribe_breeding(uuid, text) to authenticated;
