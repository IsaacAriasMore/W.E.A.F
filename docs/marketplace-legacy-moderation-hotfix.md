# Marketplace legacy moderation hotfix

## Scope

Migration `20260801215014_fix_marketplace_legacy_moderation.sql` fixes a
PostgreSQL constraint interaction detected during the post-deploy QA smoke.
The existing `marketplace_new_writes_asa_only` constraint was created as `NOT
VALID` to preserve historical `evolved`/`both` rows. PostgreSQL nevertheless
checks it whenever one of those rows is updated, so an administrator could not
hide, reject or restore a legacy listing.

The hotfix replaces that check with a private trigger that:

- accepts new `game='ascended'` rows;
- rejects new non-ASA rows with `marketplace_asa_only`;
- rejects changes from an existing game value to a non-ASA value;
- allows an existing legacy row to update unrelated moderation columns.

It does not rewrite listings, payment history, billing events, audit history,
RLS policies, grants, feature flags or Marketplace settings.

## Validation

- Rebuild the disposable local stack with `npx supabase db reset --local --no-seed`.
- Load `supabase/tests/01-seed-test-data.sql` locally.
- Run `supabase/tests/10-marketplace-legacy-moderation.sql` locally.
- Run `npm run check`, `npm run test:unit`, `npm run test:e2e` and `npm run build`.
- Run `npx supabase db lint --local --level warning --fail-on error`.
- Before deployment, confirm the linked dry-run lists only this migration.

The SQL regression creates a legacy row only inside a transaction, executes
`hidden -> rejected -> active -> hidden` through the real admin RPC, checks its
audit and notifications, verifies that non-ASA inserts/game changes remain
blocked, and rolls everything back.

## Controlled deployment

Do not apply this migration as part of the Draft PR review. After approval:

1. Verify remote/local migration history and create fresh non-empty backups.
2. Confirm `paypal_payments=false`, Marketplace `payments_enabled=false` and
   `environment=sandbox`.
3. Run `npx supabase db push --linked` once.
4. Confirm the dry-run is empty and execute the reversible moderation smoke on
   `TEST MARKETPLACE FREE QA` only.
5. Restore that listing to `hidden` and its owner to active.

No Edge Function deployment or PayPal request is required.

## Rollback

An emergency rollback can recreate the original `NOT VALID` check, then drop
`enforce_marketplace_asa_game` and its private trigger function in one
transaction. This intentionally restores the legacy-update limitation, so the
affected moderation controls must be disabled until the hotfix is reapplied.
No listing or payment row should be deleted or rewritten during rollback.

## Residual behavior

Legacy non-ASA listings remain preserved and excluded by the ASA-only public
catalog filters. Restoring one changes its moderation status but does not make
it discoverable until its game classification is reviewed separately. The
hotfix does not infer or rewrite that classification.
