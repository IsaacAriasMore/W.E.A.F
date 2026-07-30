# Recommended Performance Budget

This document defines a **recommended** budget for manual or automated validation. It is not enforced by CI.

## Lighthouse Category Scores

| Category | Minimum |
|---|---|
| Performance | 90 |
| Accessibility | 95 |
| Best Practices | 95 |
| SEO | 95 |

## Laboratory Core Web Vitals

| Metric | Threshold |
|---|---|
| Largest Contentful Paint (LCP) | ≤ 2500 ms |
| Cumulative Layout Shift (CLS) | ≤ 0.1 |
| Total Blocking Time (TBT) | ≤ 200 ms (recommended) |

## Bundle Sizes (gzip)

| Asset | Target |
|---|---|
| Initial JS (entry point + vendor) | ≤ 40 KB gzip |
| Initial CSS | ≤ 15 KB gzip |
| Any single image asset | ≤ 200 KB |

## Asset Conventions

- Raster images use AVIF or WebP.
- Three.js (threeHeroRenderer) is excluded from the initial bundle.
- Supabase Auth and related services are deferred on public routes.
- Icon and emblem assets use `<picture>` with multiple resolutions.

## Measurement Protocol

- Run **3 consecutive** Lighthouse audits per route per device.
- Report the **median**.
- Use the same Chrome version and Lighthouse version across runs.
- Never select only the best run.
- Separate mobile and desktop measurements.
- Store raw JSON reports outside the repository (e.g. `$TEMP\weaf-lighthouse-<base-sha>\`).
- Laboratory metrics differ from real‑user Core Web Vitals; monitor both.

## CI Integration

The following workflows are now active:

| Workflow | File | Triggers |
|---|---|---|
| **CI** (check + unit + audit + build) | `.github/workflows/ci.yml` | push/PR to main |
| **E2E** (Playwright) | `.github/workflows/e2e.yml` | push/PR to main |
| **Lighthouse** | `.github/workflows/lighthouse.yml` | push/PR to main |

### Budget enforcement

- **Bundle sizes** are checked by `scripts/check-performance-budget.mjs` (BLOCKING — exit 1 on violation).
- **Lighthouse thresholds** are enforced by `scripts/lighthouse-audit.mjs`:
  - **WARNING** (non‑blocking): Performance < 90, Best Practices < 95, LCP > 2500 ms, CLS > 0.1, TBT > 200 ms.
  - **ERROR** (blocking — exit 1): Accessibility < 95, SEO < 95, route timeout/unreachable.
- Reports are stored as GitHub Actions artifacts (30‑day retention for Lighthouse, 14‑day for Playwright).

### Local commands

```bash
npm run check:budget        # verify bundle sizes against dist/
npm run lighthouse:audit    # run Lighthouse audits on local preview server
```

### Related scripts

| Script | Purpose |
|---|---|
| `scripts/lighthouse-audit.mjs` | Launches Chrome, runs 3 Lighthouse audits per route, computes median |
| `scripts/check-performance-budget.mjs` | Reads dist/ files, compares gzip sizes against budgets |
| (thresholds defined inline in `lighthouse-audit.mjs`) | |
