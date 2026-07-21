create or replace function public.update_paid_server_listing(p_listing_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare selected_platforms text[]; selected_mods text[]; selected_maps text[]; selected_gallery text[]; selected_rates jsonb;
begin
  if not exists (
    select 1 from public.subscriptions s join public.server_listings l on l.id=s.listing_id
    where s.listing_id=p_listing_id and s.user_id=(select auth.uid()) and l.owner_user_id=(select auth.uid())
      and s.status in ('active','trialing') and s.current_period_end>now() and l.status in ('active','paused')
  ) then raise exception 'listing_not_editable'; end if;
  selected_platforms := array(select jsonb_array_elements_text(coalesce(p_payload->'platforms','[]'::jsonb)));
  selected_mods := array(select jsonb_array_elements_text(coalesce(p_payload->'mods','[]'::jsonb)));
  selected_maps := array(select jsonb_array_elements_text(coalesce(p_payload->'maps','[]'::jsonb)));
  selected_gallery := array(select jsonb_array_elements_text(coalesce(p_payload->'gallery_urls','[]'::jsonb)));
  selected_rates := coalesce(p_payload->'rates','{}'::jsonb);
  if pg_column_size(p_payload)>65536 or char_length(trim(p_payload->>'title')) not between 2 and 100 or (p_payload->>'slug') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(trim(p_payload->>'description')) not between 20 and 4000 or cardinality(selected_platforms) not between 1 and 8 or cardinality(selected_maps) not between 1 and 20
    or cardinality(selected_mods)>30 or cardinality(selected_gallery)>6 or jsonb_typeof(selected_rates)<>'object' or (p_payload->>'discord_invite_url') !~ '^https://(discord[.]gg|discord[.]com/invite)/'
    then raise exception 'invalid_listing_payload'; end if;
  update public.server_listings set title=trim(p_payload->>'title'),slug=lower(trim(p_payload->>'slug')),
    game=(p_payload->>'game')::public.game_mode,server_type=(p_payload->>'server_type')::public.server_type,
    platforms=selected_platforms,has_mods=cardinality(selected_mods)>0,mods=selected_mods,maps=selected_maps,rates=selected_rates,
    region=trim(p_payload->>'region'),language=trim(p_payload->>'language'),description=trim(p_payload->>'description'),
    discord_invite_url=trim(p_payload->>'discord_invite_url'),website_url=nullif(trim(p_payload->>'website_url'),''),banner_url=nullif(trim(p_payload->>'banner_url'),''),
    gallery_urls=selected_gallery,cluster_name=nullif(trim(p_payload->>'cluster_name'),''),wipe_date=nullif(p_payload->>'wipe_date','')::date,
    uses_propagators=coalesce((p_payload->>'uses_propagators')::boolean,false),updated_at=now()
  where id=p_listing_id;
  return p_listing_id;
exception when unique_violation then raise exception 'listing_slug_taken';
end;
$$;

revoke all on function public.update_paid_server_listing(uuid,jsonb) from public,anon;
grant execute on function public.update_paid_server_listing(uuid,jsonb) to authenticated;
