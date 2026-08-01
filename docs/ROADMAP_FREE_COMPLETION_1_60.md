# W.E.A.F free and local roadmap, IDs 1-60

Updated: 2026-08-01. Branch: `codex/complete-free-roadmap-1-60`.

This ledger is deliberately conservative. `Realizado` means repository evidence and an automated check exist. External/manual work is not represented as complete. This branch made zero remote Supabase writes, zero direct Vercel deployments, zero PayPal calls and zero paid-service purchases.

| ID | Task | Status | Evidence / files | Test or dependency |
|---:|---|---|---|---|
| 1 | Git hygiene and traceability | Realizado | `repository-hygiene.test.js`, PR #14 | Secret/artifact detector |
| 2 | Auth flows and password policy | Realizado | shared validator, Turnstile, generic errors, legacy login | Auth/password unit and E2E suites |
| 3 | Architecture and trust boundaries | Realizado | `AGENTS.md`, security docs | service role remains server-only |
| 4 | Marketplace listing lifecycle | Realizado | Marketplace migrations and account UI | lifecycle unit/SQL tests |
| 5 | Register Search Console | Requiere acción manual externa | `docs/search-console-setup.md` | Google account/domain verification |
| 6 | Submit sitemap to search engines | Requiere acción manual externa | physical `public/sitemap.xml` | Search Console/Bing action |
| 7 | Request indexing | Requiere acción manual externa | crawlable public routes | search-engine action |
| 8 | PayPal approval URL boundary | Realizado | `src/utils/safeUrl.js` | exact Sandbox host tests |
| 9 | PayPal capture reconciliation | Realizado | pending local migration from PR #14 | 26 capture/webhook SQL cases |
| 10 | Webhook verification and failure audit | Realizado | signature-first implementation and audit RPC | webhook unit/SQL tests |
| 11 | Idempotency and concurrency | Realizado | unique keys, locks, UI submission locks | unit/SQL coverage |
| 12 | Monotonic terminal payment states | Realizado | webhook integrity migration | late DENIED/refund/reversal tests |
| 13 | Creature mobile LCP | Realizado | 168 KB explicit-ratio sprite; no extra eager cards | Lighthouse CI and budget; field CWV remains ID 55 |
| 14 | CSS import order and duplication | Realizado | `docs/css-import-audit.md` | check/build/E2E; no duplicate imports |
| 15 | Secrets, CORS and sanitized logs | Realizado | repository hygiene and security tests | no versioned credentials |
| 16 | RPC and SECURITY DEFINER hardening | Realizado | fixed search paths and explicit grants | local lint/static ACL tests |
| 17 | RLS, ownership and BOLA | Realizado | full RLS matrices plus new table policies | local SQL/API tests |
| 18 | Privacy-minimized audit | Realizado | Marketplace audit schema extensions | no secret/private-content fields |
| 19 | Featured fairness | Realizado | deterministic seller diversity | ranking tests |
| 20 | Organic ranking and exploration | Realizado | signed snapshot cursor and ranking | cursor/ranking tests |
| 21 | Recommendation consent | Realizado | opt-in controls and account reset | personalization tests |
| 22 | Recommendation event abuse limits | En progreso | hourly allowlist/dedupe already present | daily/per-action cap remains a documented follow-up |
| 23 | Recommendation privacy reset | Realizado | local pending reset migration | events/interests/impressions removed only for actor |
| 24 | Stable pagination cursor | Realizado | local pending cursor migration | 25 SQL cursor cases |
| 25 | Real PayPal Sandbox order | Requiere acción manual externa | deliberately not executed | separate QA window and deployed prerequisites |
| 26 | Real Sandbox refund/reversal/cancel | Requiere acción manual externa | deliberately not executed | separate QA window; payments remain off |
| 27 | Performance indexes and load validation | En progreso | indexes/budgets/Lighthouse complete | production-cardinality load test remains manual |
| 28 | Apply remote migrations | Requiere acción manual externa | dry-run only; six local migrations pending | backup and separate authorization required |
| 29 | Deploy Edge Functions | Requiere acción manual externa | no function changed/deployed here | after approved remote migrations |
| 30 | Production release gate | En progreso | technical local gates documented | remote deploy and manual QA deliberately excluded |
| 31 | Admin moderation panel | Realizado | search, filters, pagination, retry and metrics in existing Admin route | admin server-side RPC |
| 32 | Hide, reject and restore listings | Realizado | strict admin RPC with required reason | monotonic/idempotent checks |
| 33 | Administrative history | Realizado | actor/action/target/reason/transition/timestamp | admin-only read boundary |
| 34 | Marketplace reports | Realizado | closed reasons and visible-listing validation | unit/SQL coverage |
| 35 | Report dedupe and ownership | Realizado | unique report handling and auth actor | double-click/concurrency guards |
| 36 | Report anti-spam | Realizado | 5/hour, 20/day, 25/listing/day plus advisory lock | migration contract test |
| 37 | Temporal user suspension | Realizado | temporal/indefinite/reactivate RPC and Admin controls | local schema/ACL test; no real user changed |
| 38 | Public seller profile | Realizado | sanitized profile and approximate tenure | no email/UUID/admin data |
| 39 | Seller listings pagination | Realizado | seller-profile RPC and load-more UI | server-side visibility/block rules |
| 40 | Favorites | Realizado | table, RLS, idempotent RPC, account state | actor derived from `auth.uid()` |
| 41 | User blocks | En progreso | opaque block ID, safe slug-based block and own-list unblock | profile/contact blocked; catalog/recommendation exclusion remains follow-up |
| 42 | Marketplace account | Realizado | listings, favorites, reports, blocks and notifications | loading/error/empty account states |
| 43 | Recommendation controls/reset | Realizado | existing opt-in/reset preserved | reset excludes listings/payments/favorites |
| 44 | Internal notifications | Realizado | owned, deduped, paginated read/unread notifications | no email/external provider |
| 45 | Marketplace Admin integration | Realizado | existing panel extended, not duplicated | global-admin server check |
| 46 | Private aggregate analytics | Realizado | server-computed Admin metrics | no client-authoritative or sensitive metrics |
| 47 | URL security | Realizado | exact allowlists, HTTPS, no credentials/private hosts/control chars | deceptive-domain unit tests |
| 48 | Content/XSS hardening | En progreso | escaping, CSP, URL sanitizer and closed metadata | legacy escaped `innerHTML` render paths remain for later DOM-only refactor |
| 49 | Technical legal drafts | Realizado | Marketplace, moderation, reporting, retention, reset and Sandbox copy | explicitly requires professional review |
| 50 | Professional legal review | Requiere intervención humana | technical drafts only | qualified counsel |
| 51 | Buy a domain | No aplica - fase actual | no purchase made | future product decision |
| 52 | Configure owned domain | No aplica - fase actual | current Vercel URL retained | depends on ID 51 |
| 53 | Definitive-domain canonical | No aplica - fase actual | current canonical remains valid | depends on IDs 51-52 |
| 54 | Separate ES/EN URLs | En progreso | equivalent in-app dictionaries and `lang` preference work | URL split deferred to avoid incomplete duplicate/legal routes |
| 55 | Real-user Core Web Vitals | Requiere acción manual externa | lab Lighthouse exists | field traffic and Search Console/analytics |
| 56 | Privacy-safe frontend errors | Realizado | sampled/deduped monitor, controlled RPC/table and bounded 30-day purge | redaction/rate-limit/retention tests |
| 57 | Free failure alerts | Realizado | `.github/workflows/health-alerts.yml` | deduplicated GitHub issues; no secrets |
| 58 | Backup and rollback | Realizado | local dump/hash script and compensating rollback runbook | local reset/SQL test; remote backup not run |
| 59 | Deployment documentation | Realizado | `docs/DEPLOYMENT_FREE_ROADMAP.md` | future manual checklist only |
| 60 | Final validation | En progreso | automated local matrix executed for this Draft PR | final PR CI/Lighthouse and manual a11y/Sandbox gates remain |

## New local database surface

Migration `20260801184631_marketplace_community_safety.sql` adds favorites, user blocks, internal notifications and privacy-minimized frontend errors; suspension timestamps/reason; report reason codes; audit transition fields; indexes, RLS, minimal grants and controlled RPCs. It has been applied only to a disposable local Supabase stack.

## Residual gates

The Draft PR must remain unmerged while IDs 22, 27, 30, 41, 48, 54 and 60 are in progress. External/manual IDs remain honest dependencies. Any future remote rollout requires off-repository backups, exact migration reconciliation, a dry-run review, payments off and an independently authorized Sandbox window.
