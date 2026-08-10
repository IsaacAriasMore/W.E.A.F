# Phase A - Navigation and profile UX

## Audit

- The post-login fallback was decided in `src/pages/auth/login.js`; protected `next` destinations are validated by `safeInternalDestination`.
- The already-authenticated `/login` fallback was in `src/router.js`.
- The admin exit control was in `src/components/layout/AdminNavigation.js`.
- `profiles.avatar_url` is an optional text column guarded by the existing owner-only profile update policy.
- No Storage bucket, Storage object policy, or browser upload flow is versioned in this repository. The local Supabase configuration only contains a commented example bucket.
- A read-only remote Storage schema dump was attempted, but Supabase CLI required a Docker daemon that is unavailable on this workstation. No remote resource was changed.

## Local implementation

- Direct logins now go to `/`; valid protected `next` destinations still win.
- Admin exit now goes to `/` and is unchanged across responsive layouts.
- The Home featured-server heading no longer renders its secondary description.
- Profile supports local JPEG, PNG, and WebP selection, 5 MiB maximum, immediate local preview, replacement, removal, and an optional HTTPS external URL fallback.
- Uploaded avatars use the stable owner-only key `<user-id>/avatar`, avoiding duplicate objects on replacement.

## Storage preparation

`supabase/migrations/20260810120000_profile_avatar_storage.sql` creates a public `avatars` bucket with a 5 MiB raster-only allowlist and owner-only insert, update, and delete policies. It is intentionally not applied remotely.

## Remote authorization required

Before applying the migration, an authorized operator must inspect existing `storage.buckets` and `storage.objects` policies for the linked project, confirm that `avatars` is unused or compatible, then apply and validate the migration remotely. This will activate device upload in production. No PayPal, billing, Marketplace payment setting, or remote service was changed in this phase.

## Validation

- `npm run check`
- `npm run test:unit`
- `npm run test:e2e` (27 scenarios started and completed without a reported failure)
- Production compilation plus prerender completed with `vite build --emptyOutDir false` because the normal build could not remove a Windows-locked previous `dist/assets` directory.
