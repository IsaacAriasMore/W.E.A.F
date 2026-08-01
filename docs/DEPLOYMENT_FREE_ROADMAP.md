# Free-roadmap deployment checklist

No deployment was performed by this roadmap branch. These are manual gates for a later authorized window.

## Prepare

- Review the Draft PR and exact commit SHA; require green CI, unit, E2E, Lighthouse, budget, audit and Supabase-local checks.
- Confirm PayPal mode is `sandbox`; `paypal_payments=false`; Marketplace `payments_enabled=false`.
- Produce and verify off-repository backups as described in `BACKUP_ROLLBACK_RUNBOOK.md`.
- Run `npx supabase migration list --linked` and `npx supabase db push --dry-run --linked`. Stop on divergence or unexpected SQL.
- Review every pending migration for destructive statements, grants, RLS, `SECURITY DEFINER`, fixed `search_path`, ownership and rollback.

## Database and API (future manual action)

Current read-only reconciliation: 41 remote migrations, 48 local migrations and no divergence. The seven pending local migrations are, in order:

1. `20260731233000_marketplace_capture_api_reconciliation.sql`
2. `20260731235900_marketplace_capture_reconciliation_failure_audit.sql`
3. `20260801173359_marketplace_catalog_cursor_snapshot.sql`
4. `20260801174140_marketplace_webhook_state_integrity.sql`
5. `20260801174910_marketplace_recommendation_reset_privacy.sql`
6. `20260801184631_marketplace_community_safety.sql`
7. `20260801193419_marketplace_recommendation_community_hardening.sql`

1. Apply approved migrations in timestamp order only.
2. Re-run migration list and validate every new table, constraint, index, policy and function grant.
3. Verify user RPCs reject anonymous or cross-user access; verify admin RPCs enforce `private.is_global_admin()` server-side.
4. Deploy only the Edge Functions named in the approved release record. Verify `verify_jwt=true` for user checkout/portal functions and internal trust boundaries for public workers/webhooks.
5. Configure secrets by name only; never paste values into issues, logs or Git.
6. Review sanitized logs and execute no PayPal call until a separate Sandbox QA window is approved.

## Post-deploy

- Smoke test home, Auth, creatures, Marketplace, seller profile, account and Admin.
- Confirm no 500 errors, no RLS leakage, no duplicate reports and no unsafe external redirect.
- Confirm payment switches remain off and no PayPal order/payment was created.
- If any gate fails, stop and follow the compensating rollback runbook.
