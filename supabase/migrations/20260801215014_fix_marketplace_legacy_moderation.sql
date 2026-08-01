-- Allow status/moderation updates on legacy Marketplace rows without weakening
-- the ASA-only rule for new rows or game changes.
--
-- The previous NOT VALID check preserved old rows at migration time, but
-- PostgreSQL still re-evaluates CHECK constraints on every later UPDATE. That
-- made a legacy row with game='both' impossible to hide, reject or restore.

create or replace function private.enforce_marketplace_asa_game()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.game = 'ascended' then
    return new;
  end if;

  -- Existing legacy rows may change unrelated columns, but their game value
  -- cannot be changed to another non-ASA value.
  if tg_op = 'UPDATE' and new.game is not distinct from old.game then
    return new;
  end if;

  raise exception using
    errcode = '23514',
    message = 'marketplace_asa_only';
end;
$$;

revoke all on function private.enforce_marketplace_asa_game()
  from public, anon, authenticated;

drop trigger if exists enforce_marketplace_asa_game
  on public.marketplace_listings;

create trigger enforce_marketplace_asa_game
before insert or update of game on public.marketplace_listings
for each row execute function private.enforce_marketplace_asa_game();

alter table public.marketplace_listings
  drop constraint if exists marketplace_new_writes_asa_only;

comment on function private.enforce_marketplace_asa_game() is
  'Preserves legacy Marketplace rows while rejecting non-ASA inserts and game changes.';

-- Rollback (maintenance window only): recreate the original NOT VALID CHECK,
-- then drop the trigger and function. That also restores the legacy-update bug,
-- so rollback is intended only if the affected moderation flow is disabled.
