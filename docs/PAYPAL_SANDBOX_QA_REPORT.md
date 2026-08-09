# PayPal Sandbox QA report — blocked safely

Date: 2026-08-09
Main: `c233d05f9275c451a20c14b08407d4c5ada245f0`

## Backup and migration baseline

The prior zero-byte artifacts were preserved as evidence and not reused. A new,
read-only backup was created outside the repository with the official
`postgres:17` Docker client against the Supabase PostgreSQL server.

| Archive | Path | Bytes | SHA-256 | Validation |
| --- | --- | ---: | --- | --- |
| Schema | `E:\W.E.A.F_backups\20260809T192300Z\schema.dump` | 575,341 | `2F623C3B1F2CC956B5B97F25C9BB4BDB74CE3B99ADC0D96086EDEC4D117EB397` | `pg_restore --list` passed |
| Data | `E:\W.E.A.F_backups\20260809T192300Z\data.dump` | 66,307 | `D24BB679610F118AB8F30A24D62B9417B17E9EA4418E891C128629C5253ED2C4` | `pg_restore --list` passed |

Migration `20260809171235_marketplace_payment_retry_reuse.sql` was the only
pending migration and was applied to project `vwxqewpvtucygbaethkv`. The final
state was **50 local / 50 remote** with a clean dry-run. No migration repair,
Edge Function deployment, secret, webhook configuration, or unrelated schema
change occurred.

## QA execution

The QA listing was restored only through the supported Admin UI. Both payment
switches were enabled only for the approved Sandbox window and were disabled
again before the merchant refund was attempted.

- The existing QA payment/order was reused; no fourth Marketplace payment was
  created and the two historical payments were not changed.
- One Sandbox capture of **USD 3.00** completed for the QA listing.
- Exactly one featured benefit was granted for **7 days**.
- Reloading the return route did not create a duplicate capture, payment,
  benefit, or billing event.
- One full refund was issued in the PayPal Sandbox merchant UI for that new QA
  capture only. No Live account or real charge was used.

## Refund reconciliation blocker

PayPal delivered one signed `PAYMENT.CAPTURE.REFUNDED` webhook and W.E.A.F
recorded it, so Sandbox billing events increased from **5** to **6**. The event
was marked with the sanitized error class
`marketplace_capture_reconciliation_failed`; consequently the Marketplace
payment remained `captured` and the QA listing remained featured.

The recorded PayPal refund resource contains its own resource identifier but
does not include `supplementary_data.related_ids.capture_id`. The current
webhook normalizer forwards `resource.id` as `capture_id` for every
`PAYMENT.CAPTURE.*` event. That is correct for a capture-completed event, but
for a refund it is the refund identifier rather than the original capture
identifier. The database integrity function correctly rejects that mismatch and
therefore does not revoke the feature.

No direct database correction, second refund, second capture, or manual
benefit removal was performed, because any of those would mask the production
defect and invalidate this QA result.

## Final safe state

- `paypal_payments=false`
- Marketplace `payments_enabled=false`
- PayPal and Marketplace environment: `sandbox`
- Marketplace payments: **3** total; the two historical records remain
  unchanged.
- The QA payment retains its single Sandbox capture and no duplicate capture or
  duplicate benefit exists.
- Sandbox billing events: **6**; the final event is retained for audit with a
  sanitized processing error.
- PayPal Live was never used. Logs and report omit credentials, personal data,
  tokens, and external identifiers.

## Required remediation

**NO-GO for further PayPal Sandbox or production rollout.** Create a narrowly
scoped hotfix that preserves the original capture identifier for refund/reversal
events (or otherwise resolves it server-side), adds a regression test for the
actual refund webhook shape, and proves one refund changes the payment to
`refunded` and revokes exactly one feature without altering financial history.
The hotfix must be reviewed and deployed before any further payment QA.

## Hotfix proposed

The local draft hotfix resolves a Marketplace refund in this order: validated
`related_ids.capture_id`, then a validated Sandbox PayPal `rel=up` HATEOAS link
to the original capture, then a server-side PayPal refund lookup using the
existing server-only client. It never uses the refund identifier as a capture
identifier and fails closed when no valid capture link is available.

It also permits a signed resend of the *same* event only when its existing
audit row has `marketplace_capture_reconciliation_failed`; successful,
terminal, and unrelated failed events remain idempotent. No remote deployment,
webhook resend, payment operation, or switch activation has occurred. The real
refund remains unreconciled and the featured benefit remains active pending a
future post-deployment resend of that original event.

## Final Sandbox closure — 2026-08-09

The remediation was subsequently merged to `main`
(`358003ebd7a6f2af67af8aa000db23f1e4e9d828`) and applied through the
reviewed migration and deployment gates.

### Fresh recovery point

A separate, new PostgreSQL 17 custom-format backup was created outside the
repository before the final migration. Both archives were non-empty and passed
`pg_restore --list` validation.

| Archive | Path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Schema | `E:\\W.E.A.F_backups\\20260809T203538Z\\schema.dump` | 669,845 | `D87AEB4A452784C7E1F9D9B9B2CDE2CB147FB107A3D9AFA51F98B0AB56BEB637` |
| Data | `E:\\W.E.A.F_backups\\20260809T203538Z\\data.dump` | 67,997 | `63158250F26E9A9C05590717F081A21D9F3EF2F6CD696AF79EA6094E769F02FF` |

### Applied scope

- Applied only `20260809193432_marketplace_refund_original_capture_resolution.sql`.
- Confirmed Supabase history at **51 local / 51 remote** with no dry-run
  pending migrations.
- Deployed only `paypal-webhook`, which is active and keeps the intentional
  `verify_jwt=false` setting because it verifies the PayPal webhook signature
  inside the function.
- No secret, webhook URL, or PayPal configuration was changed.

### Real-event reconciliation result

One existing, signed PayPal Sandbox `PAYMENT.CAPTURE.REFUNDED` event was
identified from its prior sanitized reconciliation failure and resent exactly
once through the PayPal Developer Dashboard. The dashboard reported a
successful delivery. W.E.A.F accepted and processed the original event, which
is evidence that its in-function PayPal signature verification passed.

- The original capture was resolved through the validated Sandbox refund
  relationship; no new order, payment, capture, or refund was created.
- Marketplace payments remain **3**: two historical records unchanged and one
  QA record now `refunded`.
- QA captures remain **1** and QA refunds remain **1**, both for **USD 3.00**.
- Billing events remain **6**; the existing refund event was reconciled in
  place, with its processing error cleared and no duplicate event created.
- The featured benefit was revoked automatically. The QA listing is no longer
  featured and was then hidden through the supported Admin Marketplace UI for
  audit retention.
- `paypal_payments=false`, Marketplace `payments_enabled=false`, and both
  PayPal and Marketplace remain in `sandbox`.

### Final gate

- **PAYPAL-WEBHOOK DEPLOY: PASS**
- **ORIGINAL REFUND EVENT RESEND: PASS**
- **REFUND RECONCILIATION: PASS**
- **FEATURED BENEFIT REVOKED: PASS**
- **HISTORICAL PAYMENTS: INTACT**
- **MARKETPLACE SANDBOX QA: COMPLETE**

This closes the Sandbox regression. It is not authorization to enable
payments, use PayPal Live, or change the separate QA-table RLS hardening work.
The report intentionally omits credentials, personal data, tokens, and PayPal
identifiers.
