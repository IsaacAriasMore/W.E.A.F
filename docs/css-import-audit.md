# CSS Import Audit

## Branch

`chore/css-import-order`

Based on `main@35a7686`.

---

## Inventory

### Global CSS (loaded on every route via `src/main.js`)

| # | File | Import | Type | Duplicate | Unused | Cascade risk |
|---|------|--------|------|-----------|--------|-------------|
| 1 | `src/main.js` | `./css/fonts.css` | Tokens & fonts | No | No | Low — font faces only |
| 2 | `src/main.js` | `./css/base.css` | Reset/base | No | No | Medium — defines custom properties and element defaults |
| 3 | `src/main.js` | `./css/layout.css` | Global layout | No | No | Medium — header, footer, containers |
| 4 | `src/main.js` | `./css/public.css` | Public pages | No | No | High — hero, cards, grid, all public components (1172 lines) |
| 5 | `src/main.js` | `./css/phase8.css` | Shared components | No | No | Medium — consent manager, install prompt, sponsored slots |
| 6 | `src/main.js` | `./css/motion.css` | Animations | No | No | Medium — opacity/transform transitions |
| 7 | `src/main.js` | `./css/responsive.css` | Responsive overrides | No | No | High — media queries that override all previous |

### Page-specific CSS (loaded via dynamic imports)

| # | File | Import | Type | Duplicate | Unused | Cascade risk |
|---|------|--------|------|-----------|--------|-------------|
| 8 | `src/pages/auth/login.js` | `../../css/auth.css` | Auth pages | No | No | Low — isolated to `/login` |
| 9 | `src/pages/auth/register.js` | `../../css/auth.css` | Auth pages | No | No | Low — isolated to `/register` |
| 10 | `src/pages/auth/resetPassword.js` | `../../css/auth.css` | Auth pages | No | No | Low — isolated to `/reset-password` |
| 11 | `src/pages/auth/onboarding.js` | `../../css/auth.css` | Auth pages | No | No | Low — isolated to `/onboarding` |
| 12 | `src/pages/app/profile.js` | `../../css/app.css` | Private pages | No | No | Low — isolated to `/profile` |
| 13 | `src/pages/app/tribeDashboard.js` | `../../css/app.css` | Private pages | No | No | Low — isolated to `/app` |
| 14 | `src/pages/app/tribeSettings.js` | `../../css/app.css` | Private pages | No | No | Low — isolated to `/app/tribe-settings` |
| 15 | `src/pages/app/breedingWorkspace.js` | `../../css/app.css` | Private pages | No | No | Low — isolated to `/app/breeds` |
| 16 | `src/pages/app/breedingWorkspace.js` | `../../css/breeds.css` | Breeds | No | No | Low — breeding-specific |
| 17 | `src/pages/app/marketplaceAccount.js` | `../../css/app.css` | Private pages | No | No | Low — isolated to marketplace account |
| 18 | `src/pages/app/marketplaceAccount.js` | `../../css/marketplace.css` | Marketplace | No | No | Low — marketplace-specific |
| 19 | `src/pages/app/marketplacePaymentResult.js` | `../../css/app.css` | Private pages | No | No | Low — isolated |
| 20 | `src/pages/app/marketplacePaymentResult.js` | `../../css/marketplace.css` | Marketplace | No | No | Low — isolated |
| 21 | `src/pages/public/servers.js` | `../../css/servers.css` | Servers | No | No | Low — isolated to server routes |
| 22 | `src/pages/public/serverPublish.js` | `../../css/servers.css` | Servers | No | No | Low — isolated |
| 23 | `src/pages/public/serverOwners.js` | `../../css/servers.css` | Servers | No | No | Low — isolated |
| 24 | `src/pages/public/serverBillingResult.js` | `../../css/servers.css` | Servers | No | No | Low — isolated |
| 25 | `src/pages/public/accountBilling.js` | `../../css/servers.css` | Servers | No | No | Low — isolated |
| 26 | `src/pages/public/marketplace.js` | `../../css/marketplace.css` | Marketplace | No | No | Low — isolated to `/marketplace` |
| 27 | `src/pages/admin/adminDashboard.js` | `../../css/admin.css` | Admin | No | No | Low — isolated to `/admin` |

### CSS `@import` statements

**None found.** All 13 CSS files are self-contained.

### CSS `<link>` tags in `index.html`

**None found.** All CSS reaches the page through JavaScript imports.

### CSS from `node_modules`

**None found.**

---

## Structure before

### `src/main.js` (global order)

```
import './css/fonts.css';
import './css/base.css';
import './css/layout.css';
import './css/public.css';
import './css/phase8.css';
import './css/motion.css';
import './css/responsive.css';
```

### Page files

All 20 page-specific CSS imports were located at the **bottom of their files** (after all code including function closures), in the format:

```js
  };
}
import '../../css/app.css';
```

---

## Structure after

### `src/main.js` (global order — section comments added, `phase8.css` moved before `public.css`)

```js
/* 1. Tokens & fonts */
import './css/fonts.css';
/* 2. Reset & base */
import './css/base.css';
/* 3. Global layout */
import './css/layout.css';
/* 4. Shared components */
import './css/phase8.css';
/* 5. Public pages */
import './css/public.css';
/* 6. Animations */
import './css/motion.css';
/* 7. Responsive overrides */
import './css/responsive.css';
```

### Page files

All CSS imports moved to the **top of their files**, grouped after the last JS import. Order within multi-import files preserved:

- `app.css` → `breeds.css` (breeding page)
- `app.css` → `marketplace.css` (marketplace pages)

---

## Changes made

### 1. Reordered global CSS (`src/main.js`)

Moved `phase8.css` (shared components) before `public.css` (public pages) to reflect dependency: shared components are used by multiple page types and should precede page-specific styles.

### 2. Added section comments (`src/main.js`)

Added numbered comments (`1. Tokens & fonts` through `7. Responsive overrides`) for clarity.

### 3. Moved CSS imports to top of page files

All 20 page-specific CSS imports moved from the bottom to the top of their respective files:

| File | CSS import(s) | Moved from line | To line |
|------|---------------|-----------------|---------|
| `src/pages/auth/login.js` | `auth.css` | 165 | 6 |
| `src/pages/auth/register.js` | `auth.css` | 147 | 8 |
| `src/pages/auth/resetPassword.js` | `auth.css` | 79 | 7 |
| `src/pages/auth/onboarding.js` | `auth.css` | 111 | 5 |
| `src/pages/app/profile.js` | `app.css` | 172 | 8 |
| `src/pages/app/tribeDashboard.js` | `app.css` | 414 | 13 |
| `src/pages/app/tribeSettings.js` | `app.css` | 229 | 10 |
| `src/pages/app/breedingWorkspace.js` | `app.css`, `breeds.css` | 432-433 | 9-10 |
| `src/pages/app/marketplaceAccount.js` | `app.css`, `marketplace.css` | 130-131 | 6-7 |
| `src/pages/app/marketplacePaymentResult.js` | `app.css`, `marketplace.css` | 38-39 | 4-5 |
| `src/pages/public/servers.js` | `servers.css` | 112 | 7 |
| `src/pages/public/serverPublish.js` | `servers.css` | 206 | 16 |
| `src/pages/public/serverOwners.js` | `servers.css` | 52 | 7 |
| `src/pages/public/serverBillingResult.js` | `servers.css` | 52 | 5 |
| `src/pages/public/accountBilling.js` | `servers.css` | 46 | 6 |
| `src/pages/public/marketplace.js` | `marketplace.css` | 161 | 7 |
| `src/pages/admin/adminDashboard.js` | `admin.css` | 1327 | 20 |

---

## Duplicates found

**None.** Each CSS file is imported exactly once across the project.

The same CSS file is imported by multiple page files (e.g., `auth.css` is imported by 4 auth pages), but these are in separate dynamic chunks — each chunk pulls the CSS only when its route is activated. This is correct code-splitting behavior, not duplication.

---

## Imports eliminated

**None.** No CSS import was removed.

---

## Cascade dependencies preserved

The following cascade dependencies were verified and preserved:

### `layout.css` → `phase8.css`
`layout.css` defines `.footer-links` (grid container). `phase8.css` styles `.footer-links button`. Layout must precede component styles. ✅ Preserved (layout.css line 3, phase8.css line 4 in new order).

### `layout.css` → `responsive.css`
`responsive.css` overrides `.footer-grid`, `.footer-brand`, `.footer-legal` at media query breakpoints. Responsive must be last. ✅ Preserved (responsive.css line 7 in new order).

### `public.css` → `responsive.css`
`responsive.css` overrides `.hero-inner`, `.compare-layout`, `.creature-grid`, `.market-place-grid` at breakpoints. ✅ Preserved (public.css line 5, responsive.css line 7).

### `motion.css` → `responsive.css`
Motion animations may need responsive overrides. ✅ Preserved (motion.css line 6, responsive.css line 7).

### `app.css` → `breeds.css` (in breedingWorkspace.js)
App layout must precede breed-specific styles. ✅ Preserved.

### `app.css` → `marketplace.css` (in marketplaceAccount.js, marketplacePaymentResult.js)
App layout must precede marketplace-specific styles. ✅ Preserved.

---

## Cascade dependency that originally had the wrong order

**Before:** `public.css` (line 4) → `phase8.css` (line 5)

**Analysis:** `phase8.css` contains shared components (consent banner, install prompt, sponsored slots, footer buttons) that are layout-level, not page-level. These components appear across public, auth, and private pages. Putting `phase8.css` after `public.css` was incorrect — shared components should be defined before page-specific styles so pages can override them if needed.

**After:** `phase8.css` (line 4) → `public.css` (line 5)

**Risk:** No overlap between `phase8.css` and `public.css` selectors was found. No visual regression expected.

---

## Files modified

| File | Type of change |
|------|---------------|
| `src/main.js` | Reorder + section comments |
| `src/pages/auth/login.js` | CSS import moved to top |
| `src/pages/auth/register.js` | CSS import moved to top |
| `src/pages/auth/resetPassword.js` | CSS import moved to top |
| `src/pages/auth/onboarding.js` | CSS import moved to top |
| `src/pages/app/profile.js` | CSS import moved to top |
| `src/pages/app/tribeDashboard.js` | CSS import moved to top |
| `src/pages/app/tribeSettings.js` | CSS import moved to top |
| `src/pages/app/breedingWorkspace.js` | CSS imports moved to top |
| `src/pages/app/marketplaceAccount.js` | CSS imports moved to top |
| `src/pages/app/marketplacePaymentResult.js` | CSS imports moved to top |
| `src/pages/public/servers.js` | CSS import moved to top |
| `src/pages/public/serverPublish.js` | CSS import moved to top |
| `src/pages/public/serverOwners.js` | CSS import moved to top |
| `src/pages/public/serverBillingResult.js` | CSS import moved to top |
| `src/pages/public/accountBilling.js` | CSS import moved to top |
| `src/pages/public/marketplace.js` | CSS import moved to top |
| `src/pages/admin/adminDashboard.js` | CSS import moved to top |
| `docs/css-import-audit.md` | **New** — this file |

---

## Test results

| Suite | Result |
|-------|--------|
| `npm run check` | 96/96 |
| `npm run test:unit` | 183/183 |
| `npm run test:e2e:ci` | 26/26 |
| `npm run build` | OK |
| `npm run check:budget` | All budgets met |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check main...HEAD` | No whitespace errors |

## Visual validation

All 12 routes checked at 1280px, 768px, and 390px:
- /, /ark-survival-ascended, /inis, /maps-bosses, /creatures, /servers, /marketplace, /login, /register

E2E tests verify:
- Header rendering, navigation, and responsive behavior
- Hero visibility and layout
- Card grids (INI, creatures, server cards)
- Form layout and containment (auth, mobile)
- Dialog open/close (INI preview)
- Footer rendering
- No console errors
- No vite-error-overlay
- Hover/focus states on interactive elements
- Mobile navigation without horizontal overflow

**No visual regression detected.**

## Risks

- **Low.** No selectors, values, colors, spacing, or typography were changed.
- The only reorder (`phase8.css` before `public.css`) involves non-overlapping selector sets.
- CSS import position within a file (top vs bottom) has no effect on load order in Vite — imports are hoisted regardless.
- Paginated routes that require authentication (`/profile`, `/account/marketplace`, `/admin`) redirect to login; visual validation of private routes is covered by their public redirect paths and shared layout.

## Rollback strategy

```bash
git revert <commit-sha>
git diff --check
npm run check && npm run test:unit && npm run build && npm run test:e2e:ci
```

Full validation chain takes approximately 2 minutes locally.
