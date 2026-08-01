# PR #15 final community hardening audit

Date: 2026-08-01. Initial HEAD: `d0fe2de60308153c6dbabcfc8f5fbffd4c297829`.

This review made no remote Supabase write, no migration repair, no Edge Function deployment, no Auth/CAPTCHA change, no PayPal request and no payment mutation.

## Findings and resolution

### High / critical

None found.

### Medium — resolved locally

1. Recommendation events had only a rolling hourly cap and the quota check was raceable. A new migration adds an actor advisory lock, UTC-day total and per-event caps, replay dedupe, visible-listing validation, suspension enforcement and self-owner rejection.
2. Directional user blocks did not affect catalog/recommendation discovery. Both featured and organic candidate sets now filter before ranking/limit; cursor context binds the actor's sorted block snapshot. Anonymous and reverse-direction visibility stay unchanged. The legacy fallback follows the same policy.
3. Impression timestamps used transaction-start time, which could place a page-one impression before its own ranking snapshot and intermittently change page-two scores. Catalog writes now use wall-clock timestamps after the snapshot; the personalized blocked-catalog regression proves no duplicates.
4. Frontend error quotas could be exceeded concurrently. Ingestion now serializes per actor and redacts standalone JWT-shaped values in addition to named credentials.
5. Notification retention was undefined and authenticated users retained direct column update privilege. Notifications are now plain-text constrained, read-state mutation stays behind the owned RPC, and service-role-only cleanup removes read rows after 90 days and all rows after 180 days.
6. The failure-alert issue title included branch metadata. The workflow now maps only fixed trusted workflow names, never checks out PR code and uses constant bounded titles.

### Low — resolved locally

- The detail template briefly contained an unvalidated Discord URL before hydration. It now creates no `href` until exact-host validation succeeds.
- Marketplace category labels/values are context-escaped.
- A repository-scoped dynamic HTML inventory closes ID 48 without rewriting safe static/encoded templates.

## Community migration audit

The original migration creates four public tables with RLS enabled. Direct grants are read-only and actor-owned; frontend errors remain unavailable as raw user data. All privileged RPCs fix `search_path=''`, derive the actor from `auth.uid()`, revoke `PUBLIC`/anon by default and grant only the intended role. Internal cleanup/trigger functions are not browser callable.

- Favorites: composite ownership key, visible listing validation, idempotent mutation.
- Blocks: directional composite key, self-block check, opaque unblock ID with actor ownership.
- Reports: closed reasons, visible listing, 5/hour, 20/day, 25/listing/day and actor lock.
- Moderation/suspension: global-admin check, locked listing transition, required reason, audit/notification history.
- Notifications: owned RLS, server-only creation, dedupe key, plain text, bounded pagination and retention.
- Frontend errors: authenticated sampled input, closed kind/metadata, 4 KiB input cap, 500-character message, rate/dedupe and 30-day bounded purge.
- Profiles: public seller response excludes email, UUID and administrative fields.

No dynamic SQL is used. Ownership and global-admin decisions do not trust client metadata or user-supplied actor IDs.

## Suspension policy

Blocked while an effective suspension is active: listing insert/update, reports, favorites, new blocks and recommendation events, including direct RPC/REST paths.

Still permitted: sign-in, owned reads, notification reads, unblocking, recommendation reset/privacy operations, data export/deletion paths and historical billing visibility. No remote account was suspended.

## Remaining follow-ups

- ID 27: representative production-cardinality load test.
- ID 30: separately authorized remote migration/deployment and manual QA.
- ID 54: ES/EN indexed route rollout in its own PR.
- ID 55: real-user Core Web Vitals.
- IDs 25/26: real PayPal Sandbox lifecycle only in an independent authorized window; payments remain off.
- ID 60: final PR CI/Vercel and human review gates.
