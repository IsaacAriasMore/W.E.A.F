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

## Future CI Integration (not implemented)

1. **E2E workflow** — Add `.github/workflows/e2e.yml` that runs Playwright tests on push/PR.
2. **Lighthouse CI** — Add `.github/workflows/lighthouse.yml` using `@lhci/cli` or `lighthouse` directly.
3. **Artifacts** — Upload Lighthouse JSON reports as workflow artifacts.
4. **Non‑destructive thresholds** — Start with informational annotations, not blocking checks.
5. **Review period** — Run alongside manual testing before converting thresholds into required checks.
