-- W.E.A.F RLS and explicit Data API grants.
-- Apply after schema.sql. Review again when each later phase becomes active.

create or replace function private.current_user_global_role()
returns public.global_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.global_role
  from public.profiles as p
  where p.id = (select auth.uid())
    and not p.is_suspended
$$;

create or replace function private.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_global_role() = 'admin'::public.global_role, false)
$$;

create or replace function private.is_tribe_member(target_tribe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tribe_members as tm
    join public.tribes as t on t.id = tm.tribe_id
    where tm.tribe_id = target_tribe_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'::public.membership_status
      and t.is_active
  )
$$;

create or replace function private.is_tribe_owner(target_tribe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tribes as t
    where t.id = target_tribe_id
      and t.owner_user_id = (select auth.uid())
      and t.is_active
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
    or exists (
      select 1
      from public.tribe_members as tm
      join public.tribes as t on t.id = tm.tribe_id
      where tm.tribe_id = target_tribe_id
        and tm.user_id = (select auth.uid())
        and tm.role = 'admin'::public.tribe_role
        and tm.status = 'active'::public.membership_status
        and t.is_active
    )
$$;

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
  select actor_id = (select auth.uid())
    and actor_id <> target_id
    and (
      private.is_tribe_owner(target_tribe_id)
      or (
        exists (
          select 1 from public.tribe_members actor
          where actor.tribe_id = target_tribe_id
            and actor.user_id = actor_id
            and actor.role = 'admin'::public.tribe_role
            and actor.status = 'active'::public.membership_status
        )
        and exists (
          select 1 from public.tribe_members target
          where target.tribe_id = target_tribe_id
            and target.user_id = target_id
            and target.role = 'member'::public.tribe_role
        )
      )
    )
$$;

revoke all on function private.current_user_global_role() from public;
revoke all on function private.is_global_admin() from public;
revoke all on function private.is_tribe_member(uuid) from public;
revoke all on function private.is_tribe_owner(uuid) from public;
revoke all on function private.is_tribe_admin_or_owner(uuid) from public;
revoke all on function private.can_manage_tribe_member(uuid, uuid, uuid) from public;

grant usage on schema private to authenticated;
grant usage on schema private to anon;
grant execute on function private.is_global_admin() to anon;
grant execute on function private.current_user_global_role() to authenticated;
grant execute on function private.is_global_admin() to authenticated;
grant execute on function private.is_tribe_member(uuid) to authenticated;
grant execute on function private.is_tribe_owner(uuid) to authenticated;
grant execute on function private.is_tribe_admin_or_owner(uuid) to authenticated;
grant execute on function private.can_manage_tribe_member(uuid, uuid, uuid) to authenticated;

do $$
declare
  item text;
begin
  foreach item in array array[
    'profiles', 'tribes', 'tribe_members', 'tribe_invites', 'species', 'breeds',
    'mutations', 'propagator_alerts', 'ini_presets', 'maps', 'bosses',
    'boss_requirements', 'server_listings', 'server_listing_clicks', 'plans',
    'payments', 'subscriptions', 'ads_settings', 'legal_documents',
    'legal_acceptances', 'reports', 'feature_flags', 'analytics_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', item);
  end loop;
end;
$$;

alter table private.tribe_discord_webhooks enable row level security;
alter table private.stripe_events enable row level security;
alter table private.audit_logs enable row level security;

grant usage on schema public to anon, authenticated;

grant select on public.species, public.ini_presets, public.maps, public.bosses,
  public.boss_requirements, public.server_listings, public.plans,
  public.ads_settings, public.legal_documents to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, discord_username, default_game_mode, onboarding_completed)
  on public.profiles to authenticated;
grant select, insert, update, delete on public.tribes, public.tribe_members,
  public.tribe_invites, public.breeds, public.mutations, public.propagator_alerts to authenticated;
grant select, insert on public.legal_acceptances to authenticated;
grant select on public.payments, public.subscriptions to authenticated;

create policy profiles_read_own
on public.profiles for select to authenticated
using ((select auth.uid()) = id or private.is_global_admin());

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy tribes_read_members
on public.tribes for select to authenticated
using (private.is_tribe_member(id) or private.is_global_admin());

create policy tribes_create_owner
on public.tribes for insert to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy tribes_update_owner
on public.tribes for update to authenticated
using (private.is_tribe_owner(id) or private.is_global_admin())
with check (private.is_tribe_owner(id) or private.is_global_admin());

create policy tribes_delete_owner
on public.tribes for delete to authenticated
using (private.is_tribe_owner(id) or private.is_global_admin());

create policy tribe_members_read_tribe
on public.tribe_members for select to authenticated
using (private.is_tribe_member(tribe_id) or private.is_global_admin());

create policy tribe_members_manage_insert
on public.tribe_members for insert to authenticated
with check (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin());

create policy tribe_members_manage_update
on public.tribe_members for update to authenticated
using (
  role <> 'owner'::public.tribe_role
  and (
    private.can_manage_tribe_member(tribe_id, (select auth.uid()), user_id)
    or private.is_global_admin()
  )
)
with check (role <> 'owner'::public.tribe_role);

create policy tribe_members_manage_delete
on public.tribe_members for delete to authenticated
using (
  role <> 'owner'::public.tribe_role
  and (
    private.can_manage_tribe_member(tribe_id, (select auth.uid()), user_id)
    or private.is_global_admin()
  )
);

create policy tribe_invites_read_managers
on public.tribe_invites for select to authenticated
using (private.is_tribe_admin_or_owner(tribe_id) or invited_user_id = (select auth.uid()) or private.is_global_admin());

create policy tribe_invites_create_managers
on public.tribe_invites for insert to authenticated
with check (private.is_tribe_admin_or_owner(tribe_id) and created_by = (select auth.uid()));

create policy tribe_invites_update_managers
on public.tribe_invites for update to authenticated
using (private.is_tribe_admin_or_owner(tribe_id) or invited_user_id = (select auth.uid()))
with check (role <> 'owner'::public.tribe_role);

create policy tribe_invites_delete_managers
on public.tribe_invites for delete to authenticated
using (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin());

create policy species_public_read
on public.species for select to anon, authenticated
using (is_public and is_active or private.is_global_admin());

create policy ini_presets_public_read
on public.ini_presets for select to anon, authenticated
using (is_public or private.is_global_admin());

create policy maps_public_read
on public.maps for select to anon, authenticated
using (is_public and is_active or private.is_global_admin());

create policy bosses_public_read
on public.bosses for select to anon, authenticated
using (is_public and is_active or private.is_global_admin());

create policy boss_requirements_public_read
on public.boss_requirements for select to anon, authenticated
using (
  exists (
    select 1 from public.bosses b
    join public.maps m on m.id = b.map_id
    where b.id = boss_id and b.is_public and b.is_active and m.is_public and m.is_active
  )
  or private.is_global_admin()
);

create policy breeds_read_members
on public.breeds for select to authenticated
using (private.is_tribe_member(tribe_id) or private.is_global_admin());

create policy breeds_create_managers
on public.breeds for insert to authenticated
with check (private.is_tribe_admin_or_owner(tribe_id) and created_by = (select auth.uid()));

create policy breeds_update_managers
on public.breeds for update to authenticated
using (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin())
with check (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin());

create policy breeds_delete_managers
on public.breeds for delete to authenticated
using (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin());

create policy mutations_read_members
on public.mutations for select to authenticated
using (private.is_tribe_member(tribe_id) or private.is_global_admin());

create policy mutations_create_members
on public.mutations for insert to authenticated
with check (private.is_tribe_member(tribe_id) and created_by = (select auth.uid()));

create policy mutations_update_author_or_manager
on public.mutations for update to authenticated
using (created_by = (select auth.uid()) or private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin())
with check (private.is_tribe_member(tribe_id) or private.is_global_admin());

create policy mutations_delete_managers
on public.mutations for delete to authenticated
using (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin());

create policy propagator_alerts_read_members
on public.propagator_alerts for select to authenticated
using (private.is_tribe_member(tribe_id) or private.is_global_admin());

create policy propagator_alerts_manage_managers
on public.propagator_alerts for all to authenticated
using (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin())
with check (private.is_tribe_admin_or_owner(tribe_id) or private.is_global_admin());

create policy listings_public_or_owner_read
on public.server_listings for select to anon, authenticated
using (
  (
    status = 'active'::public.listing_status
    and coalesce(starts_at, now()) <= now()
    and (expires_at is null or expires_at > now())
  )
  or owner_user_id = (select auth.uid())
  or private.is_global_admin()
);

create policy plans_public_read
on public.plans for select to anon, authenticated
using (is_active or private.is_global_admin());

create policy ads_enabled_read
on public.ads_settings for select to anon, authenticated
using (enabled or private.is_global_admin());

create policy legal_documents_public_read
on public.legal_documents for select to anon, authenticated
using (is_published or private.is_global_admin());

create policy legal_acceptances_read_own
on public.legal_acceptances for select to authenticated
using (user_id = (select auth.uid()) or private.is_global_admin());

create policy legal_acceptances_insert_own
on public.legal_acceptances for insert to authenticated
with check (user_id = (select auth.uid()));

create policy payments_read_own
on public.payments for select to authenticated
using (user_id = (select auth.uid()) or private.is_global_admin());

create policy subscriptions_read_own
on public.subscriptions for select to authenticated
using (user_id = (select auth.uid()) or private.is_global_admin());

-- Deliberately no client policies for webhook secrets, Stripe events, audit logs,
-- click tracking, reports, analytics writes, feature flags, or listing activation.
-- Those operations go through authenticated and rate-limited Edge Functions.
