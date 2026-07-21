create index if not exists tribe_invites_creator_created_idx
  on public.tribe_invites(created_by, created_at desc);
create index if not exists tribe_invites_invited_user_idx
  on public.tribe_invites(invited_user_id)
  where invited_user_id is not null;
create unique index if not exists tribe_members_one_active_owner_idx
  on public.tribe_members(tribe_id)
  where role = 'owner'::public.tribe_role and status = 'active'::public.membership_status;

create or replace function private.is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and not profile.is_suspended
  )
$$;

create or replace function private.is_tribe_member(target_tribe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_current_user_active() and exists (
    select 1
    from public.tribe_members as membership
    join public.tribes as tribe on tribe.id = membership.tribe_id
    where membership.tribe_id = target_tribe_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'::public.membership_status
      and tribe.is_active
  )
$$;

create or replace function private.is_tribe_owner(target_tribe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_current_user_active() and exists (
    select 1
    from public.tribes as tribe
    where tribe.id = target_tribe_id
      and tribe.owner_user_id = (select auth.uid())
      and tribe.is_active
  )
$$;

create or replace function private.is_tribe_admin_or_owner(target_tribe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_tribe_owner(target_tribe_id)
    or (
      private.is_current_user_active()
      and exists (
        select 1
        from public.tribe_members as membership
        join public.tribes as tribe on tribe.id = membership.tribe_id
        where membership.tribe_id = target_tribe_id
          and membership.user_id = (select auth.uid())
          and membership.role = 'admin'::public.tribe_role
          and membership.status = 'active'::public.membership_status
          and tribe.is_active
      )
    )
$$;

revoke all on function private.is_current_user_active() from public, anon, authenticated;
grant execute on function private.is_current_user_active() to authenticated;

revoke insert, update, delete on public.tribe_members from authenticated;
revoke insert, update, delete on public.tribe_invites from authenticated;
revoke insert on public.tribes from authenticated;
revoke update on public.tribes from authenticated;
grant update (name, game_mode, uses_propagators, propagator_cooldown_hours, breeding_speed_multiplier)
  on public.tribes to authenticated;

create or replace function public.create_tribe(
  p_name text,
  p_game_mode public.game_mode,
  p_character_name text,
  p_steam_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  new_tribe_id uuid;
  base_slug text;
  candidate_slug text;
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
  if p_steam_id is not null and char_length(trim(p_steam_id)) > 40 then
    raise exception 'invalid_steam_id';
  end if;
  if (
    select count(*)
    from public.tribes as tribe
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
    name, slug, owner_user_id, game_mode, uses_propagators, breeding_speed_multiplier
  ) values (
    trim(p_name), candidate_slug, actor_id, p_game_mode, false, 1
  ) returning id into new_tribe_id;

  insert into public.tribe_members (
    tribe_id, user_id, role, character_name, steam_id, status, joined_at
  ) values (
    new_tribe_id, actor_id, 'owner'::public.tribe_role, trim(p_character_name),
    nullif(trim(coalesce(p_steam_id, '')), ''), 'active'::public.membership_status, now()
  );

  return new_tribe_id;
end;
$$;

create or replace function public.create_tribe_invite(
  p_tribe_id uuid,
  p_invited_email text default null,
  p_invited_steam_id text default null,
  p_role public.tribe_role default 'member'::public.tribe_role,
  p_expires_hours integer default 72
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  raw_token text;
begin
  if actor_id is null or not private.is_tribe_admin_or_owner(p_tribe_id) then
    raise exception 'not_authorized';
  end if;
  if num_nonnulls(nullif(trim(coalesce(p_invited_email, '')), ''), nullif(trim(coalesce(p_invited_steam_id, '')), '')) <> 1 then
    raise exception 'invite_requires_one_target';
  end if;
  if p_role = 'owner'::public.tribe_role then
    raise exception 'owner_role_forbidden';
  end if;
  if p_role = 'admin'::public.tribe_role and not private.is_tribe_owner(p_tribe_id) then
    raise exception 'owner_required_for_admin_invite';
  end if;
  if p_expires_hours not between 1 and 168 then
    raise exception 'invalid_invite_expiration';
  end if;
  if (
    select count(*)
    from public.tribe_invites as invite
    where invite.created_by = actor_id
      and invite.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'invite_rate_limit';
  end if;

  raw_token := encode(gen_random_bytes(24), 'hex');
  insert into public.tribe_invites (
    tribe_id, invited_email, invited_steam_id, token_hash, role, status, expires_at, created_by
  ) values (
    p_tribe_id,
    nullif(lower(trim(coalesce(p_invited_email, ''))), ''),
    nullif(trim(coalesce(p_invited_steam_id, '')), ''),
    encode(digest(raw_token, 'sha256'), 'hex'),
    p_role,
    'pending'::public.invite_status,
    now() + make_interval(hours => p_expires_hours),
    actor_id
  );
  return raw_token;
end;
$$;

create or replace function public.accept_tribe_invite(
  p_token text,
  p_character_name text,
  p_steam_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
  selected_invite public.tribe_invites%rowtype;
begin
  if actor_id is null or not private.is_current_user_active() then
    raise exception 'authentication_required';
  end if;
  if char_length(trim(coalesce(p_character_name, ''))) not between 2 and 80 then
    raise exception 'invalid_character_name';
  end if;

  select * into selected_invite
  from public.tribe_invites as invite
  where invite.token_hash = encode(digest(trim(coalesce(p_token, '')), 'sha256'), 'hex')
  for update;

  if selected_invite.id is null
    or selected_invite.status <> 'pending'::public.invite_status
    or selected_invite.expires_at <= now() then
    raise exception 'invite_invalid_or_expired';
  end if;
  if exists (
    select 1 from public.tribe_members as membership
    where membership.tribe_id = selected_invite.tribe_id
      and membership.user_id = actor_id
      and membership.status = 'active'::public.membership_status
  ) then
    raise exception 'already_a_member';
  end if;

  select lower(auth_user.email) into actor_email
  from auth.users as auth_user
  where auth_user.id = actor_id;

  if selected_invite.invited_user_id is not null and selected_invite.invited_user_id <> actor_id then
    raise exception 'invite_target_mismatch';
  end if;
  if selected_invite.invited_email is not null and lower(selected_invite.invited_email) <> actor_email then
    raise exception 'invite_target_mismatch';
  end if;
  if selected_invite.invited_steam_id is not null
    and selected_invite.invited_steam_id <> trim(coalesce(p_steam_id, '')) then
    raise exception 'invite_target_mismatch';
  end if;

  insert into public.tribe_members (
    tribe_id, user_id, role, character_name, steam_id, status, joined_at, invited_by
  ) values (
    selected_invite.tribe_id, actor_id, selected_invite.role, trim(p_character_name),
    nullif(trim(coalesce(p_steam_id, '')), ''), 'active'::public.membership_status, now(), selected_invite.created_by
  )
  on conflict (tribe_id, user_id) do update set
    role = excluded.role,
    character_name = excluded.character_name,
    steam_id = excluded.steam_id,
    status = 'active'::public.membership_status,
    joined_at = now(),
    invited_by = excluded.invited_by;

  update public.tribe_invites
  set status = 'accepted'::public.invite_status,
      invited_user_id = actor_id
  where id = selected_invite.id;

  return selected_invite.tribe_id;
end;
$$;

create or replace function public.change_tribe_member_role(
  p_tribe_id uuid,
  p_target_user_id uuid,
  p_role public.tribe_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_tribe_owner(p_tribe_id) then raise exception 'owner_required'; end if;
  if p_role not in ('admin'::public.tribe_role, 'member'::public.tribe_role) then
    raise exception 'invalid_member_role';
  end if;
  update public.tribe_members
  set role = p_role
  where tribe_id = p_tribe_id
    and user_id = p_target_user_id
    and role <> 'owner'::public.tribe_role
    and status = 'active'::public.membership_status;
  if not found then raise exception 'member_not_found_or_protected'; end if;
end;
$$;

create or replace function public.remove_tribe_member(p_tribe_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_tribe_member(p_tribe_id, (select auth.uid()), p_target_user_id) then
    raise exception 'not_authorized_or_protected_member';
  end if;
  update public.tribe_members
  set status = 'removed'::public.membership_status
  where tribe_id = p_tribe_id
    and user_id = p_target_user_id
    and role <> 'owner'::public.tribe_role;
  if not found then raise exception 'member_not_found_or_protected'; end if;
end;
$$;

create or replace function public.leave_tribe(p_tribe_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tribe_members
  set status = 'removed'::public.membership_status
  where tribe_id = p_tribe_id
    and user_id = (select auth.uid())
    and role <> 'owner'::public.tribe_role
    and status = 'active'::public.membership_status;
  if not found then raise exception 'owner_cannot_leave_or_membership_missing'; end if;
end;
$$;

create or replace function public.update_my_tribe_identity(
  p_tribe_id uuid,
  p_character_name text,
  p_steam_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_tribe_member(p_tribe_id) then raise exception 'not_a_tribe_member'; end if;
  if char_length(trim(coalesce(p_character_name, ''))) not between 2 and 80 then
    raise exception 'invalid_character_name';
  end if;
  update public.tribe_members
  set character_name = trim(p_character_name),
      steam_id = nullif(trim(coalesce(p_steam_id, '')), '')
  where tribe_id = p_tribe_id
    and user_id = (select auth.uid())
    and status = 'active'::public.membership_status;
end;
$$;

create or replace function public.get_tribe_members(p_tribe_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  discord_username text,
  role public.tribe_role,
  character_name text,
  steam_id text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_tribe_member(p_tribe_id) and not private.is_global_admin() then
    raise exception 'not_a_tribe_member';
  end if;
  return query
    select membership.id, membership.user_id, profile.display_name, profile.avatar_url,
      profile.discord_username, membership.role, membership.character_name,
      membership.steam_id, membership.joined_at
    from public.tribe_members as membership
    join public.profiles as profile on profile.id = membership.user_id
    where membership.tribe_id = p_tribe_id
      and membership.status = 'active'::public.membership_status
    order by
      case membership.role
        when 'owner'::public.tribe_role then 1
        when 'admin'::public.tribe_role then 2
        else 3
      end,
      lower(profile.display_name);
end;
$$;

revoke execute on function public.create_tribe(text, public.game_mode, text, text) from public, anon;
revoke execute on function public.create_tribe_invite(uuid, text, text, public.tribe_role, integer) from public, anon;
revoke execute on function public.accept_tribe_invite(text, text, text) from public, anon;
revoke execute on function public.change_tribe_member_role(uuid, uuid, public.tribe_role) from public, anon;
revoke execute on function public.remove_tribe_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_tribe(uuid) from public, anon;
revoke execute on function public.update_my_tribe_identity(uuid, text, text) from public, anon;
revoke execute on function public.get_tribe_members(uuid) from public, anon;

grant execute on function public.create_tribe(text, public.game_mode, text, text) to authenticated;
grant execute on function public.create_tribe_invite(uuid, text, text, public.tribe_role, integer) to authenticated;
grant execute on function public.accept_tribe_invite(text, text, text) to authenticated;
grant execute on function public.change_tribe_member_role(uuid, uuid, public.tribe_role) to authenticated;
grant execute on function public.remove_tribe_member(uuid, uuid) to authenticated;
grant execute on function public.leave_tribe(uuid) to authenticated;
grant execute on function public.update_my_tribe_identity(uuid, text, text) to authenticated;
grant execute on function public.get_tribe_members(uuid) to authenticated;
