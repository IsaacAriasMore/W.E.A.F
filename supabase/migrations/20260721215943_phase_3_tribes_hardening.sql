alter table public.tribe_members
  add constraint tribe_members_character_name_length_check
    check (character_name is null or char_length(trim(character_name)) between 2 and 80),
  add constraint tribe_members_steam_id_length_check
    check (steam_id is null or char_length(trim(steam_id)) between 1 and 40);

alter table public.tribe_invites
  add constraint tribe_invites_email_length_check
    check (invited_email is null or char_length(invited_email) between 3 and 320),
  add constraint tribe_invites_steam_id_length_check
    check (invited_steam_id is null or char_length(trim(invited_steam_id)) between 1 and 40);

create or replace function private.can_manage_tribe_member(
  target_tribe_id uuid,
  actor_id uuid,
  target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_current_user_active()
    and actor_id = (select auth.uid())
    and actor_id <> target_id
    and (
      private.is_tribe_owner(target_tribe_id)
      or (
        exists (
          select 1 from public.tribe_members as actor
          where actor.tribe_id = target_tribe_id
            and actor.user_id = actor_id
            and actor.role = 'admin'::public.tribe_role
            and actor.status = 'active'::public.membership_status
        )
        and exists (
          select 1 from public.tribe_members as target
          where target.tribe_id = target_tribe_id
            and target.user_id = target_id
            and target.role = 'member'::public.tribe_role
            and target.status = 'active'::public.membership_status
        )
      )
    )
$$;

revoke all on function private.can_manage_tribe_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_manage_tribe_member(uuid, uuid, uuid) to authenticated;
