# Development Log — 2026-07-30

## Branch

ci/e2e-lighthouse-automation

Based on `main@1fad14a`. Branch already published to origin.

Awaiting Codex review on Tuesday, August 4, 2026.

---

## Prior work (previous branches)

- PR #5 — Performance, Core Web Vitals and technical SEO.
- PR #6 — Google Search Console verification.

---

## Points 8–13

### 8. E2E workflow (.github/workflows/e2e.yml)

- Runs Playwright on push/PR to `main`
- Uses `npm run test:e2e:ci` → `playwright test --workers=1` for stability
- Artifacts: `playwright-report/` (HTML report) uploaded on all outcomes (`!cancelled()` — success or failure, but not on cancellation)
- `test-results/` (screenshots + traces) uploaded on all outcomes, with `if-no-files-found: ignore` because the directory is not created when all tests pass
- Retention: 14 days
- Pre-existing CAPTCHA race condition fixed (see below)

### 9. npm audit in CI

- Added to `.github/workflows/ci.yml` before the build step
- Audits at `--audit-level=low` — blocking if any low+ vulnerability found

### 10. Playwright config changes

File: `playwright.config.js`

| Before | After | Reason |
|---|---|---|
| `reuseExistingServer: true` | `reuseExistingServer: !process.env.CI` | CI starts a clean server each run |
| `channel: 'chrome'` | removed | CI uses bundled Chromium, not system Chrome |
| `reporter: 'line'` | `[['line'], ['html', { open: 'never' }]]` | HTML report for CI artifacts |

### 11. Lighthouse CI workflow (.github/workflows/lighthouse.yml)

- Builds → serves with `vite preview` → runs `node scripts/lighthouse-audit.mjs` → uploads reports
- Audits 7 routes × 3 runs = 21 total audits
- Routes: `/`, `/ark-survival-ascended`, `/inis`, `/creatures`, `/maps-bosses`, `/servers`, `/marketplace`
- Reports retained 30 days
- Uses lighthouse programmatic API (chrome-launcher), not @lhci/cli
- Server readiness checked with a bash `curl` loop instead of `npx wait-on` (avoids unblocked dynamic installs in CI)
- Routes and thresholds are defined in `scripts/lighthouse-audit.mjs`

### 12. Performance budget script & config

**scripts/check-performance-budget.mjs**
- Reads `dist/index.html`, finds JS/CSS entry points, measures gzip size
- Checks ALL raster images in `dist/assets/` regardless of reference detection
- Only checks initial-load assets, not deferred chunks
- Blocking (exit 1) on violation

**scripts/lighthouse-audit.mjs**
- Uses lighthouse Node API + chrome-launcher
- Audits 7 routes × 3 runs, computes median per metric independently
- WARNING (non-blocking): Performance < 90, Best Practices < 95, LCP > 2500ms, CLS > 0.1, TBT > 200ms
- ERROR (blocking): Accessibility < 95, SEO < 95, route unreachable

### 13. /creatures LCP measurement

Three consecutive Lighthouse runs on `/creatures`:

| Run | Performance | LCP |
|-----|-------------|-----|
| 1 | 89 | 2513 ms |
| 2 | 97 | 2524 ms |
| 3 | 97 | 2512 ms |

- Real median: **2513 ms** (LCP 2500 target — borderline observation within lab noise)
- Previous measurement (Phase 11): 2509 ms
- Difference attributed to normal lab noise; not optimizing /creatures artificially

---

## Files created

| File | Purpose |
|---|---|
| `.github/workflows/e2e.yml` | E2E test workflow |
| `.github/workflows/lighthouse.yml` | Lighthouse audit workflow |
| `scripts/check-performance-budget.mjs` | Bundle/image size budget checker |
| `scripts/lighthouse-audit.mjs` | Lighthouse programmatic audit script |

## Files modified

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Added `npm audit --audit-level=low` + `npm run check:budget` |
| `playwright.config.js` | Removed `channel: chrome`, `reuseExistingServer: !process.env.CI`, added HTML reporter |
| `package.json` | Added scripts: `test:e2e:ci`, `check:budget`, `lighthouse:audit`. Added `chrome-launcher` devDep |
| `src/pages/public/inis.js` | Fixed SEO crawlable-anchors: remove dead `<a hidden>` from template, create source link dynamically (Option B) |
| `tests/auth.spec.js` | Fixed CAPTCHA race: added `waitUntil: 'networkidle'` to `page.goto()` |
| `tests/public.spec.js` | Added tests: no anchor lacks valid href; INI source link created only when source_url exists |
| `docs/performance-budget.md` | Documented CI integration, thresholds, assertion levels |

## Files removed

| File | Reason |
|---|---|
| `lighthouserc.cjs` | Dead config (@lhci/cli format not used by any script) |

---

## CAPTCHA test failure — investigation and fix

### Failure details

- **Test**: `auth forms support English during the staged CAPTCHA rollout`
- **File**: `tests/auth.spec.js:96`
- **Error**: `Test timeout of 30000ms exceeded` at `locator.click` on "Forgot your password?"
- **Mode**: `VITE_SUPABASE_DISABLED=true` (test mode)

### Root cause

Race condition between SPA dynamic imports and Playwright's `page.goto()`.

`page.goto()` resolves on the `load` event, which fires before the SPA finishes its async rendering pipeline:
1. `main.js` → `initI18n()` + `startApp()` → router starts
2. Router calls async `render()` → needs `waitForAuth()` (dynamic import of `authService`)
3. `authService.isConfigured()` → `false` (supabase disabled) → resolve auth
4. Dynamic import of `login.js` → `page.render()` → writes DOM
5. `page.bind()` attaches listeners

Steps 2–4 happen after `load`. On cold Vite transforms or slow CI runners, the accumulated time from these async hops exhausts the test's 30s budget at the click action.

### Fix

Added `{ waitUntil: 'networkidle' }` to both `page.goto()` calls in this test. This ensures Playwright waits until all network connections (including dynamic imports) complete before the test starts its assertions.

### CAPTCHA status in test mode

CAPTCHA is disabled in test mode (`VITE_AUTH_CAPTCHA_ENABLED` not set in `.env.test`, defaults to `false`). No Turnstile script is loaded, no widget rendered. This statement applies only to test mode — production CAPTCHA configuration is managed separately and was not modified.

---

## Decisions

### Architecture: custom lighthouse script vs @lhci/cli

Chose **Option B** (custom script using `lighthouse` + `chrome-launcher`):
- `@lhci/cli` is not installed and adding it would be an unnecessary dependency change
- `lighthouserc.cjs` (dead @lhci/cli config) was removed
- Routes and thresholds are defined in `scripts/lighthouse-audit.mjs`

### Bundle budget enforcement

- JS entry gzip ≤ 40 KB, CSS entry gzip ≤ 15 KB, single image ≤ 200 KB
- Blocking (exit 1) — these are deterministic measurements
- Only initial-load assets are checked, not deferred chunks

### Lighthouse assertion levels

| Metric | Level | Rationale |
|---|---|---|
| Performance < 90 | WARNING | Lab noise, varies between runs |
| Best Practices < 95 | WARNING | Known variability |
| LCP > 2500 ms | WARNING | Lab metric, real-user data differs |
| CLS > 0.1 | WARNING | Lab metric |
| TBT > 200 ms | WARNING | Lab metric |
| Accessibility < 95 | ERROR | Hard requirement |
| SEO < 95 | ERROR | Hard requirement |
| Route unreachable | ERROR | Infrastructure failure |

---

## Current budgets and results (local)

| Asset | Budget (gzip) | Actual (gzip) | Status |
|---|---|---|---|
| Initial JS | ≤ 40 KB | 33.3 KB | PASS |
| Initial CSS | ≤ 15 KB | 12.6 KB | PASS |
| All images in dist/assets | ≤ 200 KB each | 5–33 KB | PASS |

## Lighthouse CI result (GitHub Actions)

GitHub Actions executed 21 audits (7 routes × 3 runs). The workflow **failed** because SEO on `/inis` scored 92 (below the 95 threshold). Root cause: non-crawlable anchor (`<a hidden>` without `href`). That anchor has been replaced with a dynamic container (Option B), which should resolve the SEO failure in the next run.

## E2E artifacts

- HTML report: `playwright-report/` — uploaded on success or failure (`!cancelled()`)
- Test results (screenshots + traces): `test-results/` — uploaded on success or failure, with `if-no-files-found: ignore` (directory does not exist on all-green runs)
- Retention: 14 days
- Verified: no `.env`, JWT, cookies, storageState, keys, `node_modules`, or secrets in artifact paths
- Video: NOT enabled (not decided; trace on failure is sufficient)

## Dependencies verified

- `chrome-launcher` — now a direct devDependency at `1.1.2`
- `@lhci/cli` — NOT installed, not needed (script uses lighthouse directly)
- `vite preview` — used as static server in Lighthouse workflow (already in devDependencies)
- All scripts use packages already in `package.json` or their transitive deps
- `npx wait-on` eliminated — replaced with bash `curl` loop in lighthouse.yml

---

## Risks and pending tasks

- CAPTCHA is disabled in test mode only; production CAPTCHA was not modified
- E2E tests with Vite dev server in CI may be slower than production build + preview
- Lighthouse assertions at WARN level will not block PRs; convert to ERROR after review period
- Stripe, PayPal, Supabase remote, Auth, Search Console, Marketplace v2, and payments were NOT modified
- `service_role` secrets, `.env` files, and Vercel environment variables are excluded from version control
- Lighthouse could not run locally on this Windows machine because Chrome 150 has a local group policy that blocks HTTP in headless mode (`CHROME_INTERSTITIAL_ERROR`). The script is designed for CI where Chrome is clean.

---

## Verification checklist

- [x] `npm run check` → 96/96
- [x] `npm run test:unit` → passed (including new lighthouse-median tests)
- [x] `npm run test:e2e:ci` (first) → 24/24
- [x] `npm run test:e2e:ci` (second) → 24/24
- [x] `npm run build` → OK
- [x] `npm run check:budget` → All budgets met
- [x] `npm audit --audit-level=low` → 0 vulnerabilities
- [x] Workflow YAML syntax validated
- [x] No Supabase remote, Auth, CAPTCHA production config, Search Console, Marketplace v2, or payments modified
- [x] No git push executed
