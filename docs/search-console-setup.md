# Google Search Console Setup

Manual steps for when the site is ready for indexing.

## Prerequisites

- Production domain verified in Google Search Console.
- Sitemap hosted at the production domain.

## Steps

1. **Confirm canonical domain** — `https://weaf.vercel.app` is the current canonical. Replace with a custom domain when available.

2. **Create property** — Use **Domain** property (DNS‑wide) or **URL prefix** (`https://weaf.vercel.app`).

3. **Verify ownership** — DNS TXT record, HTML file, or Google Analytics (if applicable).

4. **Submit sitemap:**
   ```
   https://weaf.vercel.app/sitemap.xml
   ```

5. **Inspect key public routes** (URL Inspection tool):
   - `/`
   - `/inis`
   - `/maps-bosses`
   - `/creatures`
   - `/servers`
   - `/marketplace`
   - `/ark-survival-ascended`

6. **Confirm private routes are not indexed** — Check that `/app/*`, `/admin`, `/login`, `/register`, `/reset-password`, `/onboarding`, `/profile`, `/servers/publish`, `/servers/success`, `/servers/cancel`, `/account/billing` return `noindex`.

7. **Review Coverage report** — Fix any unexpected `excluded`, `error`, or `soft 404` entries.

8. **Monitor Core Web Vitals** — Review the Core Web Vitals report once sufficient real‑user data accumulates.

9. **Review structured data** — Validate JSON‑LD (Organization, WebSite, WebApplication, BreadcrumbList, FAQPage) in the Rich Results report.

10. **Never request indexing for:**
    - Admin routes (`/admin*`)
    - Auth routes (`/login`, `/register`, `/reset-password`, `/onboarding`)
    - User profile (`/profile`)
    - Payment or billing routes (`/servers/success`, `/servers/cancel`, `/account/billing`, `/marketplace/payment/*`, `/marketplace/*/edit`)
    - Any `/app/*` workspace page

## hreflang Note

- hreflang is **not currently published**.
- The site uses a `?lang=` query parameter for language switching, not separate canonical URLs.
- **Do not add hreflang** until each language has a stable, independent, canonical URL that is prerendered.
- Once per‑language URLs exist (e.g. `/es/inis`, `/en/inis`), add reciprocal `rel="alternate"` + `x-default` links.

## Domain Note

- Search Console must be configured with the **production domain**, not a Vercel Preview URL.
- `weaf.vercel.app` is the current canonical. Replace with a custom domain when available.
