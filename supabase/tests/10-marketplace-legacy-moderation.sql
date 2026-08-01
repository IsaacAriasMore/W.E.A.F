-- Regression for 20260801215014_fix_marketplace_legacy_moderation.sql.
-- Run after 01-seed-test-data.sql against a disposable local stack.
begin;

do $$
declare
  legacy_listing constant uuid := 'a0000000-0000-0000-0000-000000000099';
  category_id uuid;
begin
  select id into category_id
  from public.marketplace_categories
  order by sort_order, id
  limit 1;

  if category_id is null then
    raise exception 'marketplace category fixture missing';
  end if;

  -- Reproduce a row that predates the ASA-only enforcement. This bypass is
  -- local-test-only and is reverted with the surrounding transaction.
  alter table public.marketplace_listings disable trigger enforce_marketplace_asa_game;
  insert into public.marketplace_listings(
    id, owner_user_id, category_id, slug, listing_type, title, description,
    game, resource_name, quantity, trade_terms, server_name, region, platform,
    language, discord_invite_url, status, rules_accepted_at, published_at,
    expires_at
  ) values (
    legacy_listing, '00000000-0000-0000-0000-0000000000a1', category_id,
    'legacy-moderation-regression', 'trade', 'Legacy moderation regression',
    'Local-only legacy row used to verify unrelated updates remain possible.',
    'both', 'Metal Ingots', 100, 'Local QA only', 'W.E.A.F local QA',
    'Costa Rica', 'crossplay', 'Español', 'https://discord.gg/WEAFQA',
    'hidden', now(), now(), now() + interval '7 days'
  );
  alter table public.marketplace_listings enable trigger enforce_marketplace_asa_game;

  update public.profiles
  set global_role = 'admin'
  where id = '00000000-0000-0000-0000-0000000000a5';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform public.admin_moderate_marketplace_listing(
    legacy_listing, 'rejected', 'local regression reject'
  );
  perform public.admin_moderate_marketplace_listing(
    legacy_listing, 'active', 'local regression restore'
  );
  perform public.admin_moderate_marketplace_listing(
    legacy_listing, 'hidden', 'local regression original state'
  );

  if (select status from public.marketplace_listings where id = legacy_listing) <> 'hidden' then
    raise exception 'legacy moderation sequence failed';
  end if;
  if (select count(*) from public.marketplace_audit_log
      where listing_id = legacy_listing and action = 'listing_moderated') <> 3 then
    raise exception 'legacy moderation audit is incomplete';
  end if;
  if (select count(*) from public.marketplace_notifications
      where entity_type = 'listing' and entity_id = legacy_listing) <> 3 then
    raise exception 'legacy moderation notifications are incomplete';
  end if;

  begin
    insert into public.marketplace_listings(
      owner_user_id, category_id, slug, listing_type, title, description,
      game, resource_name, trade_terms, region, platform, language,
      discord_invite_url, status, rules_accepted_at
    ) values (
      '00000000-0000-0000-0000-0000000000a1', category_id,
      'new-non-asa-regression', 'trade', 'New non ASA regression',
      'This insert must remain blocked by the Marketplace ASA-only trigger.',
      'both', 'Metal Ingots', 'Local QA only', 'Costa Rica', 'crossplay',
      'Español', 'https://discord.gg/WEAFQA', 'draft', now()
    );
    raise exception 'non-ASA insert was accepted';
  exception when check_violation then
    if sqlerrm <> 'marketplace_asa_only' then raise; end if;
  end;

  begin
    update public.marketplace_listings
    set game = 'evolved'
    where id = legacy_listing;
    raise exception 'legacy game mutation was accepted';
  exception when check_violation then
    if sqlerrm <> 'marketplace_asa_only' then raise; end if;
  end;

  insert into public.marketplace_listings(
    owner_user_id, category_id, slug, listing_type, title, description,
    game, resource_name, trade_terms, region, platform, language,
    discord_invite_url, status, rules_accepted_at
  ) values (
    '00000000-0000-0000-0000-0000000000a1', category_id,
    'new-asa-regression', 'trade', 'New ASA regression row',
    'This insert confirms that valid ASA Marketplace writes still succeed.',
    'ascended', 'Metal Ingots', 'Local QA only', 'Costa Rica', 'crossplay',
    'Español', 'https://discord.gg/WEAFQA', 'draft', now()
  );
end;
$$;

rollback;
