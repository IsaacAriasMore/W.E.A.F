# Backup and rollback runbook

This runbook covers local validation and a future, separately authorized remote deployment. It does not authorize a remote database write, an Edge Function deployment, a payment, or a migration-history repair.

## Pre-migration backup

1. Keep `paypal_payments=false` and Marketplace `payments_enabled=false`.
2. Compare `npx supabase migration list --linked`; never infer that `migration repair` reverses SQL.
3. For the local stack, run `powershell -File scripts/backup-supabase-local.ps1`. The script refuses to write inside the repository, rejects a zero-byte dump and writes a SHA-256 manifest.
4. For production, create both schema and data backups using the approved Supabase procedure and store them outside Git. Verify their size and hash before any push.
5. Record the database version, repository SHA, operator, UTC time and restore owner without recording credentials.

## Local restore rehearsal

Use a disposable local stack. Verify the SHA-256 manifest, run `npx supabase db reset`, import the approved dump into that disposable database, then run RLS, RPC and smoke tests. Never restore a production dump into a shared or internet-accessible developer environment.

## Compensating rollback

- Database: create a new compensating migration. Preserve payments, listings, audit events and user-requested privacy deletions. Do not edit an applied migration and do not use `migration repair` as rollback.
- Edge Functions: deploy the last known-good source by repository SHA, retain `verify_jwt` boundaries and keep PayPal Sandbox.
- Frontend: revert the specific commit and redeploy through the normal PR pipeline.
- Kill switches: keep both payment switches off throughout the incident.
- Validation: migration list, grants, RLS, RPC ownership, health routes, logs, build and browser smoke test.

Escalate and stop for data loss, an unexpected remote change, a real secret, a possible Live payment or any HIGH/CRITICAL regression.
