-- A recommendation reset is a privacy operation: remove every personalized
-- ranking input owned by the caller, including server-computed impressions.
-- Listings, favorites outside this subsystem, payments and reports are untouched.

create or replace function public.reset_marketplace_recommendations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;

  delete from public.marketplace_recommendation_events
  where user_id = actor_id;

  delete from public.marketplace_user_interest_profiles
  where user_id = actor_id;

  delete from public.marketplace_listing_impressions
  where user_id = actor_id;

  insert into public.marketplace_recommendation_preferences(
    user_id, personalization_enabled, reset_at
  ) values (
    actor_id, false, now()
  )
  on conflict(user_id) do update
  set personalization_enabled = false,
      reset_at = now();

  insert into public.marketplace_audit_log(actor_user_id, action, details)
  values (
    actor_id,
    'recommendations_reset',
    jsonb_build_object('scope', 'events_interests_and_impressions')
  );
end;
$$;

revoke all on function public.reset_marketplace_recommendations()
from public, anon, authenticated;
grant execute on function public.reset_marketplace_recommendations()
to authenticated;

comment on function public.reset_marketplace_recommendations() is
  'Authenticated privacy reset for recommendation events, aggregate interests and user-linked catalog impressions; disables personalization and preserves unrelated user data.';
