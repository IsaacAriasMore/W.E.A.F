-- Phase 4: private breeding, mutations, cooldowns and encrypted Discord delivery.

create index if not exists breeds_species_idx on public.breeds(species_id);
create index if not exists breeds_created_by_idx on public.breeds(created_by);
create index if not exists mutations_species_idx on public.mutations(species_id);
create index if not exists mutations_created_by_idx on public.mutations(created_by);
create index if not exists propagator_alerts_tribe_idx on public.propagator_alerts(tribe_id);
create index if not exists propagator_alerts_breed_idx on public.propagator_alerts(breed_id);

alter table private.tribe_discord_webhooks
  alter column webhook_url_ciphertext drop not null,
  add column if not exists vault_secret_id uuid;

create table if not exists private.discord_deliveries (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'mutation_created', 'propagator_available', 'breed_completed', 'member_joined'
  )),
  entity_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists discord_deliveries_tribe_created_idx
  on private.discord_deliveries(tribe_id, created_at desc);
create index if not exists discord_deliveries_actor_created_idx
  on private.discord_deliveries(actor_user_id, created_at desc);

alter table private.discord_deliveries enable row level security;
revoke all on private.discord_deliveries from public, anon, authenticated;

insert into public.species (
  name, slug, game_availability, category, vanilla_mating_cooldown_hours,
  stats, notes, is_public, is_active, sort_order
)
values
  ('Rex', 'rex', 'both', 'Terrestre', 18, '["health","stamina","oxygen","food","weight","melee","speed"]', 'Catálogo base de breeding.', true, true, 10),
  ('Argentavis', 'argentavis', 'both', 'Volador', 18, '["health","stamina","oxygen","food","weight","melee","speed"]', 'Catálogo base de breeding.', true, true, 20),
  ('Therizinosaur', 'therizinosaur', 'both', 'Terrestre', 18, '["health","stamina","oxygen","food","weight","melee","speed"]', 'Catálogo base de breeding.', true, true, 30),
  ('Megatherium', 'megatherium', 'both', 'Terrestre', 18, '["health","stamina","oxygen","food","weight","melee","speed"]', 'Catálogo base de breeding.', true, true, 40)
on conflict (slug) do nothing;

revoke insert, update, delete on public.breeds from authenticated;
revoke insert, update, delete on public.mutations from authenticated;
revoke insert, update, delete on public.propagator_alerts from authenticated;

drop policy if exists propagator_alerts_manage_managers on public.propagator_alerts;

create or replace function public.create_tribe_with_breeding(
  p_name text,
  p_game_mode public.game_mode,
  p_character_name text,
  p_steam_id text default null,
  p_uses_propagators boolean default false,
  p_cooldown_hours numeric default null,
  p_breeding_multiplier numeric default 1
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions'
as $$
declare
  actor_id uuid := (select auth.uid());
  base_slug text;
  candidate_slug text;
  new_tribe_id uuid;
begin
  if actor_id is null or not private.is_current_user_active() then
    raise exception 'authentication_required';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'invalid_tribe_name';
  end if;
  if char_length(trim(coalesce(p_character_name, ''))) not between 2 and 80 then
    raise exception 'invalid_character_name';
  end if;
  if nullif(trim(coalesce(p_steam_id, '')), '') is not null
    and trim(p_steam_id) !~ '^[0-9]{5,40}$' then
    raise exception 'invalid_steam_id';
  end if;
  if p_uses_propagators and (p_cooldown_hours is null or p_cooldown_hours not between 0.25 and 720) then
    raise exception 'invalid_propagator_cooldown';
  end if;
  if not p_uses_propagators and (p_breeding_multiplier is null or p_breeding_multiplier not between 0.001 and 1000) then
    raise exception 'invalid_breeding_multiplier';
  end if;
  if (
    select count(*) from public.tribes tribe
    where tribe.owner_user_id = actor_id
      and tribe.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'tribe_creation_rate_limit';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'tribe'; end if;
  candidate_slug := base_slug;
  if exists (select 1 from public.tribes where slug = candidate_slug) then
    candidate_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.tribes (
    name, slug, owner_user_id, game_mode, uses_propagators,
    propagator_cooldown_hours, breeding_speed_multiplier
  ) values (
    trim(p_name), candidate_slug, actor_id, p_game_mode, p_uses_propagators,
    case when p_uses_propagators then p_cooldown_hours else null end,
    case when p_uses_propagators then null else p_breeding_multiplier end
  ) returning id into new_tribe_id;

  insert into public.tribe_members (
    tribe_id, user_id, role, character_name, steam_id, status, joined_at
  ) values (
    new_tribe_id, actor_id, 'owner', trim(p_character_name),
    nullif(trim(coalesce(p_steam_id, '')), ''), 'active', now()
  );

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id)
  values (actor_id, new_tribe_id, 'tribe.created', 'tribe', new_tribe_id);

  return new_tribe_id;
end;
$$;

create or replace function public.get_tribe_breeding_settings(p_tribe_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.is_tribe_member(p_tribe_id) then
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
    'game_mode', tribe.game_mode,
    'uses_propagators', tribe.uses_propagators,
    'propagator_cooldown_hours', tribe.propagator_cooldown_hours,
    'breeding_speed_multiplier', tribe.breeding_speed_multiplier,
    'webhook', jsonb_build_object(
      'configured', webhook.id is not null and webhook.vault_secret_id is not null,
      'enabled', coalesce(webhook.enabled, false),
      'last4', webhook.webhook_last4,
      'last_success_at', webhook.last_success_at,
      'last_error', webhook.last_error
    )
  ) into result
  from public.tribes tribe
  left join private.tribe_discord_webhooks webhook on webhook.tribe_id = tribe.id
  where tribe.id = p_tribe_id;

  return result;
end;
$$;

create or replace function public.configure_tribe_breeding(
  p_tribe_id uuid,
  p_uses_propagators boolean,
  p_cooldown_hours numeric default null,
  p_breeding_multiplier numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not private.is_tribe_owner(p_tribe_id) then
    raise exception 'owner_required';
  end if;
  if p_uses_propagators and (p_cooldown_hours is null or p_cooldown_hours not between 0.25 and 720) then
    raise exception 'invalid_propagator_cooldown';
  end if;
  if not p_uses_propagators and (p_breeding_multiplier is null or p_breeding_multiplier not between 0.001 and 1000) then
    raise exception 'invalid_breeding_multiplier';
  end if;

  update public.tribes
  set uses_propagators = p_uses_propagators,
      propagator_cooldown_hours = case when p_uses_propagators then p_cooldown_hours else null end,
      breeding_speed_multiplier = case when p_uses_propagators then null else p_breeding_multiplier end
  where id = p_tribe_id;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id)
  values (actor_id, p_tribe_id, 'tribe.breeding_configured', 'tribe', p_tribe_id);
end;
$$;

create or replace function public.create_breed(
  p_tribe_id uuid,
  p_species_id uuid,
  p_title text,
  p_target_stats jsonb default '{}'::jsonb,
  p_current_mutations jsonb default '{}'::jsonb,
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
begin
  if actor_id is null or not private.is_tribe_admin_or_owner(p_tribe_id) then
    raise exception 'not_authorized';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120 then
    raise exception 'invalid_breed_title';
  end if;
  if jsonb_typeof(p_target_stats) <> 'object' or octet_length(p_target_stats::text) > 10000
    or jsonb_typeof(p_current_mutations) <> 'object' or octet_length(p_current_mutations::text) > 10000 then
    raise exception 'invalid_breed_stats';
  end if;
  if char_length(coalesce(p_notes, '')) > 5000 then
    raise exception 'invalid_notes';
  end if;

  select game_mode into tribe_game from public.tribes where id = p_tribe_id and is_active;
  if not exists (
    select 1 from public.species species
    where species.id = p_species_id
      and species.is_active and species.is_public
      and (tribe_game = 'both' or species.game_availability in (tribe_game, 'both'))
  ) then
    raise exception 'species_not_available';
  end if;

  insert into public.breeds(
    tribe_id, species_id, title, target_stats, current_mutations, notes, created_by
  ) values (
    p_tribe_id, p_species_id, trim(p_title), p_target_stats, p_current_mutations,
    nullif(trim(coalesce(p_notes, '')), ''), actor_id
  ) returning id into new_id;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, after_data)
  values (actor_id, p_tribe_id, 'breed.created', 'breed', new_id, jsonb_build_object('title', trim(p_title)));
  return new_id;
end;
$$;

create or replace function public.update_breed(
  p_breed_id uuid,
  p_title text,
  p_status public.breed_status,
  p_target_stats jsonb,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_tribe_id uuid;
begin
  select tribe_id into target_tribe_id from public.breeds where id = p_breed_id;
  if actor_id is null or target_tribe_id is null or not private.is_tribe_admin_or_owner(target_tribe_id) then
    raise exception 'not_authorized';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120
    or jsonb_typeof(p_target_stats) <> 'object'
    or octet_length(p_target_stats::text) > 10000
    or char_length(coalesce(p_notes, '')) > 5000 then
    raise exception 'invalid_breed_data';
  end if;

  update public.breeds
  set title = trim(p_title), status = p_status, target_stats = p_target_stats,
      notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_breed_id;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, after_data)
  values (actor_id, target_tribe_id, 'breed.updated', 'breed', p_breed_id, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.delete_breed(p_breed_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_tribe_id uuid;
begin
  select tribe_id into target_tribe_id from public.breeds where id = p_breed_id;
  if actor_id is null or target_tribe_id is null or not private.is_tribe_admin_or_owner(target_tribe_id) then
    raise exception 'not_authorized';
  end if;
  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id)
  values (actor_id, target_tribe_id, 'breed.deleted', 'breed', p_breed_id);
  delete from public.breeds where id = p_breed_id;
end;
$$;

create or replace function public.register_breed_mutation(
  p_tribe_id uuid,
  p_breed_id uuid,
  p_stats jsonb,
  p_notes text default null
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
  species_cooldown numeric;
  mutation_id uuid;
  alert_id uuid;
  available_time timestamptz;
  merged_stats jsonb;
begin
  if actor_id is null or not private.is_tribe_member(p_tribe_id) then
    raise exception 'not_authorized';
  end if;
  if jsonb_typeof(p_stats) <> 'object' or p_stats = '{}'::jsonb or octet_length(p_stats::text) > 5000
    or exists (
      select 1 from jsonb_each(p_stats) stat
      where stat.key not in ('health','stamina','oxygen','food','weight','melee','speed')
        or jsonb_typeof(stat.value) <> 'number'
        or (stat.value #>> '{}')::numeric <> trunc((stat.value #>> '{}')::numeric)
        or (stat.value #>> '{}')::numeric not between 0 and 20
    ) then
    raise exception 'invalid_mutation_stats';
  end if;
  if char_length(coalesce(p_notes, '')) > 2000 then
    raise exception 'invalid_notes';
  end if;

  select * into selected_breed
  from public.breeds
  where id = p_breed_id and tribe_id = p_tribe_id
  for update;
  if selected_breed.id is null then raise exception 'breed_not_found'; end if;

  select * into selected_tribe from public.tribes where id = p_tribe_id and is_active;

  insert into public.mutations(tribe_id, breed_id, species_id, stats, notes, created_by)
  values (
    p_tribe_id, p_breed_id, selected_breed.species_id, p_stats,
    nullif(trim(coalesce(p_notes, '')), ''), actor_id
  ) returning id into mutation_id;

  select selected_breed.current_mutations || coalesce(
    jsonb_object_agg(
      stat.key,
      to_jsonb(coalesce((selected_breed.current_mutations ->> stat.key)::integer, 0)
        + (stat.value #>> '{}')::integer)
    ), '{}'::jsonb
  ) into merged_stats
  from jsonb_each(p_stats) stat;

  update public.breeds set current_mutations = merged_stats where id = p_breed_id;

  if selected_tribe.uses_propagators then
    available_time := now() + make_interval(secs => (selected_tribe.propagator_cooldown_hours * 3600)::double precision);
  else
    select vanilla_mating_cooldown_hours into species_cooldown
    from public.species where id = selected_breed.species_id;
    if species_cooldown is not null then
      available_time := now() + make_interval(secs =>
        (species_cooldown / selected_tribe.breeding_speed_multiplier * 3600)::double precision);
    end if;
  end if;

  if available_time is not null then
    insert into public.propagator_alerts(tribe_id, breed_id, available_at)
    values (p_tribe_id, p_breed_id, available_time)
    returning id into alert_id;
  end if;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id, after_data)
  values (
    actor_id, p_tribe_id, 'mutation.created', 'mutation', mutation_id,
    jsonb_build_object('breed_id', p_breed_id, 'stats', p_stats, 'alert_id', alert_id)
  );

  return jsonb_build_object(
    'mutation_id', mutation_id, 'alert_id', alert_id, 'available_at', available_time
  );
end;
$$;

create or replace function public.cancel_propagator_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_tribe_id uuid;
begin
  select tribe_id into target_tribe_id from public.propagator_alerts where id = p_alert_id;
  if actor_id is null or target_tribe_id is null or not private.is_tribe_admin_or_owner(target_tribe_id) then
    raise exception 'not_authorized';
  end if;
  update public.propagator_alerts
  set status = 'canceled'
  where id = p_alert_id and status = 'scheduled';
end;
$$;

create or replace function public.configure_tribe_discord_webhook(
  p_tribe_id uuid,
  p_webhook_url text,
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'vault'
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_url text := trim(coalesce(p_webhook_url, ''));
  secret_id uuid;
  last_four text;
begin
  if actor_id is null or not private.is_tribe_owner(p_tribe_id) then
    raise exception 'owner_required';
  end if;
  if clean_url !~ '^https://(canary\\.|ptb\\.)?discord\\.com/api/webhooks/[0-9]{5,30}/[A-Za-z0-9_-]{20,200}$' then
    raise exception 'invalid_discord_webhook';
  end if;
  last_four := right(clean_url, 4);

  select vault_secret_id into secret_id
  from private.tribe_discord_webhooks
  where tribe_id = p_tribe_id
  for update;

  if secret_id is null then
    secret_id := vault.create_secret(
      clean_url,
      'weaf_discord_' || replace(p_tribe_id::text, '-', ''),
      'W.E.A.F tribe Discord webhook',
      null
    );
    insert into private.tribe_discord_webhooks(
      tribe_id, webhook_url_ciphertext, webhook_last4, enabled, vault_secret_id
    ) values (p_tribe_id, null, last_four, p_enabled, secret_id)
    on conflict (tribe_id) do update
      set webhook_url_ciphertext = null, webhook_last4 = excluded.webhook_last4,
          enabled = excluded.enabled, vault_secret_id = excluded.vault_secret_id,
          last_error = null;
  else
    perform vault.update_secret(
      secret_id, clean_url, 'weaf_discord_' || replace(p_tribe_id::text, '-', ''),
      'W.E.A.F tribe Discord webhook', null
    );
    update private.tribe_discord_webhooks
    set webhook_last4 = last_four, enabled = p_enabled, last_error = null
    where tribe_id = p_tribe_id;
  end if;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id)
  values (actor_id, p_tribe_id, 'discord.configured', 'tribe', p_tribe_id);
  return jsonb_build_object('configured', true, 'enabled', p_enabled, 'last4', last_four);
end;
$$;

create or replace function public.set_tribe_discord_enabled(
  p_tribe_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_tribe_owner(p_tribe_id) then raise exception 'owner_required'; end if;
  update private.tribe_discord_webhooks
  set enabled = p_enabled
  where tribe_id = p_tribe_id and vault_secret_id is not null;
  if not found then raise exception 'webhook_not_configured'; end if;
end;
$$;

create or replace function public.prepare_discord_delivery(
  p_tribe_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_entity_id uuid
)
returns table (
  delivery_id uuid,
  webhook_url text,
  tribe_name text,
  event_title text,
  event_detail text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  title_value text;
  detail_value text;
  new_delivery_id uuid;
begin
  if p_event_type not in ('mutation_created','propagator_available','breed_completed','member_joined') then
    raise exception 'unsupported_discord_event';
  end if;
  if not exists (
    select 1
    from public.tribe_members member
    join public.tribes tribe on tribe.id = member.tribe_id
    join public.profiles profile on profile.id = member.user_id
    where member.tribe_id = p_tribe_id and member.user_id = p_actor_user_id
      and member.status = 'active' and tribe.is_active and not profile.is_suspended
  ) then raise exception 'not_authorized'; end if;
  if (
    select count(*) from private.discord_deliveries delivery
    where delivery.actor_user_id = p_actor_user_id
      and delivery.created_at > now() - interval '1 hour'
  ) >= 30 then raise exception 'discord_rate_limit'; end if;

  if p_event_type = 'mutation_created' then
    select 'Nueva mutación · ' || species.name,
      breed.title || ' · ' || mutation.stats::text
    into title_value, detail_value
    from public.mutations mutation
    join public.breeds breed on breed.id = mutation.breed_id and breed.tribe_id = mutation.tribe_id
    join public.species species on species.id = mutation.species_id
    where mutation.id = p_entity_id and mutation.tribe_id = p_tribe_id;
  elsif p_event_type = 'propagator_available' then
    select 'Propagator disponible · ' || species.name,
      breed.title || ' ya está disponible.'
    into title_value, detail_value
    from public.propagator_alerts alert
    join public.breeds breed on breed.id = alert.breed_id and breed.tribe_id = alert.tribe_id
    join public.species species on species.id = breed.species_id
    where alert.id = p_entity_id and alert.tribe_id = p_tribe_id
      and alert.status = 'scheduled' and alert.available_at <= now();
  elsif p_event_type = 'breed_completed' then
    select 'Línea completada · ' || species.name, breed.title
    into title_value, detail_value
    from public.breeds breed
    join public.species species on species.id = breed.species_id
    where breed.id = p_entity_id and breed.tribe_id = p_tribe_id and breed.status = 'completed';
  else
    select 'Nuevo miembro en la tribu', coalesce(profile.display_name, member.character_name)
    into title_value, detail_value
    from public.tribe_members member
    join public.profiles profile on profile.id = member.user_id
    where member.id = p_entity_id and member.tribe_id = p_tribe_id and member.status = 'active';
  end if;

  if title_value is null then raise exception 'discord_entity_not_available'; end if;

  insert into private.discord_deliveries(tribe_id, actor_user_id, event_type, entity_id)
  values (p_tribe_id, p_actor_user_id, p_event_type, p_entity_id)
  returning id into new_delivery_id;

  return query
  select new_delivery_id, secret.decrypted_secret, tribe.name, title_value, left(detail_value, 1500)
  from private.tribe_discord_webhooks webhook
  join vault.decrypted_secrets secret on secret.id = webhook.vault_secret_id
  join public.tribes tribe on tribe.id = webhook.tribe_id
  where webhook.tribe_id = p_tribe_id and webhook.enabled;

  if not found then
    update private.discord_deliveries
    set status = 'failed', error = 'webhook_not_configured', completed_at = now()
    where id = new_delivery_id;
    raise exception 'webhook_not_configured';
  end if;
end;
$$;

create or replace function public.complete_discord_delivery(
  p_delivery_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tribe_id uuid;
begin
  update private.discord_deliveries
  set status = case when p_success then 'sent' else 'failed' end,
      error = case when p_success then null else left(coalesce(p_error, 'discord_delivery_failed'), 1000) end,
      completed_at = now()
  where id = p_delivery_id and status = 'pending'
  returning tribe_id into target_tribe_id;

  if target_tribe_id is not null then
    update private.tribe_discord_webhooks
    set last_success_at = case when p_success then now() else last_success_at end,
        last_error = case when p_success then null else left(coalesce(p_error, 'discord_delivery_failed'), 1000) end
    where tribe_id = target_tribe_id;
  end if;
end;
$$;

revoke all on function public.create_tribe_with_breeding(text, public.game_mode, text, text, boolean, numeric, numeric) from public, anon;
revoke all on function public.get_tribe_breeding_settings(uuid) from public, anon;
revoke all on function public.configure_tribe_breeding(uuid, boolean, numeric, numeric) from public, anon;
revoke all on function public.create_breed(uuid, uuid, text, jsonb, jsonb, text) from public, anon;
revoke all on function public.update_breed(uuid, text, public.breed_status, jsonb, text) from public, anon;
revoke all on function public.delete_breed(uuid) from public, anon;
revoke all on function public.register_breed_mutation(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.cancel_propagator_alert(uuid) from public, anon;
revoke all on function public.configure_tribe_discord_webhook(uuid, text, boolean) from public, anon;
revoke all on function public.set_tribe_discord_enabled(uuid, boolean) from public, anon;
revoke all on function public.prepare_discord_delivery(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_discord_delivery(uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.create_tribe_with_breeding(text, public.game_mode, text, text, boolean, numeric, numeric) to authenticated;
grant execute on function public.get_tribe_breeding_settings(uuid) to authenticated;
grant execute on function public.configure_tribe_breeding(uuid, boolean, numeric, numeric) to authenticated;
grant execute on function public.create_breed(uuid, uuid, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.update_breed(uuid, text, public.breed_status, jsonb, text) to authenticated;
grant execute on function public.delete_breed(uuid) to authenticated;
grant execute on function public.register_breed_mutation(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.cancel_propagator_alert(uuid) to authenticated;
grant execute on function public.configure_tribe_discord_webhook(uuid, text, boolean) to authenticated;
grant execute on function public.set_tribe_discord_enabled(uuid, boolean) to authenticated;
grant execute on function public.prepare_discord_delivery(uuid, uuid, text, uuid) to service_role;
grant execute on function public.complete_discord_delivery(uuid, boolean, text) to service_role;
