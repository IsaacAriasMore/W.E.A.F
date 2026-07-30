# Marketplace v2 — Validation Report

## Branch

`test/marketplace-v2-validation`

## Base SHA

`602548663945cd8766311f4fcb14c2bdf44ce9d6`

## Defects Found and Corrected

### 1. Cursor extra segments silently accepted

**Before:** `private.marketplace_decode_cursor()` used `split_part` for the first two segments; `payload.signature.extra` parsed the first two parts and ignored the rest.

**Fix:** The function now verifies that the cursor contains exactly two segments separated by a single dot using string comparison. Extra segments, empty segments, invalid base64, non-hex signatures, and wrong-length signatures all raise `invalid_marketplace_cursor` with no detail leakage.

### 2. Cursor not bound to query context

**Before:** The cursor payload contained only `b` (bucket), `s` (score), `i` (listing id). A cursor from one set of filters (e.g. category=resources) could be reused with different filters (e.g. category=creatures).

**Fix:** A `q` field containing a SHA-256 fingerprint of the normalized query context is now included in the cursor payload. The context includes slug, type, category, region, platform, search, and limit, normalized via trim/lowercase/null/truncation and serialized as canonical JSONB. On cursor input, the same hash is recomputed and compared; mismatches raise `marketplace_cursor_expired`. A `v` (version) field set to 1 is also included and validated.

### 3. Featured ranking not bucket-aware

**Before:** `featured_bucket` was computed (15-minute window) but only used for impression recording. Featured listings were ranked purely by relevance, exposure, freshness, and seller diversity.

**Fix:** A new private function `private.marketplace_featured_rotation_score(listing_id, bucket)` computes a deterministic score between 0 and 1 using `hashtextextended`. The score is added to the featured ranking formula (`+ 10 * rotation_score`), giving weight to rotation without dominating relevance. This ensures:
- Same listing + same bucket = same score
- Same listing + different bucket = different score
- Anon and authenticated users both benefit
- No cookies, IP, or fingerprint involved

## Cursor Payload Format

```json
{
  "v": 1,
  "b": <organic_bucket>,
  "s": <last_score>,
  "i": <last_listing_id>,
  "q": "<sha256 hex of normalized query context>"
}
```

Encoded as `base64(payload).hex(HMAC-SHA-256(payload, secret))`.

## Files Versioned

| File | Purpose |
|---|---|
| `supabase/migrations/20260730193820_marketplace_cursor_context_and_rotation_hardening.sql` | Compensatory migration |
| `supabase/tests/01-seed-test-data.sql` | Seed data with 4 sellers, multiple listings |
| `supabase/tests/02-rls-full-matrix.sql` | RLS/RPC/Personalization/Kill-switch matrix |
| `supabase/tests/03-cursor-security.sql` | Cursor security + pagination (25 tests) |
| `supabase/tests/04-rotation-and-personalization.sql` | Rotation + fallback tests |
| `supabase/tests/05-maintain-investigation.sql` | Maintain function role investigation |
| `supabase/tests/06-api-rls-rpc.ps1` | API-based RLS/RPC matrix |
| `supabase/tests/marketplace-v2-validation.sql` | Compensatory SQL validation (18 tests) |
| `docs/marketplace-v2-validation.md` | This document |

## Validation Results

### SQL Tests

| Test File | Result |
|---|---|
| `02-rls-full-matrix` | All RLS/RPC/personalization pass |
| `03-cursor-security` | 25/25 pass |
| `04-rotation-and-personalization` | 21/21 pass |
| `05-maintain-investigation` | Low risk confirmed |
| `marketplace-v2-validation` | 18/18 pass |
| Seed data | 10 listings, 4 featured, 6 organic ASA, 1 expired, 1 hidden, 0 ASE |

### Node.js Tests

| Command | Result |
|---|---|
| `npm run check` | 96 files checked |
| `npm run test:unit` | 183/183 pass |
| `npm run build` | Build + 8 prerendered routes |
| `npm audit` | 0 vulnerabilities |

### Database

| Command | Result |
|---|---|
| `supabase db reset` | 39 migrations applied (38 existing + 1 compensatory) |
| `supabase db lint --local --level warning` | Only pre-existing Stripe warning |

### Git

| Check | Result |
|---|---|
| `git diff --check` | No whitespace errors |
| `git diff --stat` | Non-zero diff (tests + migration + docs) |
| `git status --short` | Clean working tree |
| Push | Not executed |
| Remote changes | Zero |
| Payments | `paypal_payments=false`, `PAYPAL_MODE=sandbox` |
| Auth/CAPTCHA | Intact |
| Supabase remote | Not touched |
| Vercel | Not deployed |

## Rotation Verification

- **Max 1 featured per seller:** Verified (4 sellers, at most 1 featured each)
- **Featured separated from organic:** Verified (no overlap between arrays)
- **Featured order stable within same bucket:** Verified (same 15-min bucket produces same order)
- **Featured order changes between buckets:** Verified (different bucket produces different rotation scores)
- **Organic exploration stable within same bucket:** Verified (same 1-hour bucket)
- **Anon receives rotation:** Verified
- **Authenticated without personalization:** Verified (affinity_score=0, fairness applies)
- **No anonymous tracking:** Verified (anon does not add `listing_impressions` rows)

## Cursor Security (25/25)

All tests pass: valid roundtrip, manipulated payload, bad signature, truncated, one extra segment, two extra segments, empty segment, invalid base64, non-hex signature, wrong-length signature, invalid UUID, invalid score, expired bucket, different search, different category, different region, different platform, different type, different limit, first page, second page, last page, no duplicates, consistent ordering, null cursor at end.

## Correct Rollback Procedure

`supabase migration repair --status reverted` does **not** revert SQL. It only corrects the migration history table. Using it as a schema rollback leaves database objects in place while pretending the migration never applied — a dangerous inconsistency.

### Safe rollback for featured expiration and QA gate changes

1. **Immediate kill-switch:** Set `paypal_payments = false` in `feature_flags` and `payments_enabled = false` in `marketplace_settings`. This stops all featured payment flows within seconds, no code deploy needed.
2. **Disable the cron job:** Run `select cron.unschedule('expire-marketplace-featured-benefits');`. This prevents expiration from running until the rollback is complete.
3. **Create a compensatory migration** that replaces `public.prepare_marketplace_paypal_order()` with the previous version and removes the cron schedule. Follow the same idempotent pattern (unschedule before schedule).
4. **Preserve all data:** Do not delete marketplace_payments, marketplace_audit_log, or any marketplace_listings columns. Historical featured records, events, and audit trails must remain readable.
5. **Run `supabase db reset` locally** to verify the new migration applies cleanly on top of the full history.
6. **Do not alter or repair remote history.** Apply the compensatory migration via `supabase db push` only after local validation passes. Never use `migration repair` in production.

This approach stops new payments instantly, maintains data integrity for existing featured records, and preserves a clean migration chain. The only operation that requires a code deploy is step 1 (setting kill switches), which can be done through Supabase SQL or the Dashboard.
