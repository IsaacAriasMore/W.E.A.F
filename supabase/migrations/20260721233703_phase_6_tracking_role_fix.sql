-- Security-definer functions run as their owner. Check the caller JWT claim instead.
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
  if (select auth.role()) <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_event not in ('impression', 'discord_click') then raise exception 'invalid_server_event'; end if;
  if p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_ip_hash'; end if;
  if char_length(coalesce(p_referrer, '')) > 500 then raise exception 'invalid_referrer'; end if;
  if not exists (
    select 1 from public.server_listings s
    where s.id = p_listing_id and s.status = 'active'
      and coalesce(s.starts_at, now()) <= now()
      and (s.expires_at is null or s.expires_at > now())
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
    update public.server_listings set impression_count = impression_count + 1 where id = p_listing_id;
  else
    select exists (
      select 1 from public.server_listing_clicks c
      where c.listing_id = p_listing_id and c.ip_hash = p_ip_hash
        and c.clicked_at >= now() - interval '10 minutes'
    ) into recent_exists;
    if recent_exists then return false; end if;
    insert into public.server_listing_clicks (listing_id, user_id, ip_hash, referrer)
    values (p_listing_id, null, p_ip_hash, nullif(left(p_referrer, 500), ''));
    update public.server_listings set click_count = click_count + 1 where id = p_listing_id;
  end if;
  return true;
end;
$$;

revoke all on function public.record_server_listing_event(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_server_listing_event(uuid, text, text, text) to service_role;
