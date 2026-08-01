# ES/EN route design for a separate PR

ID 54 remains **En progreso**. Dictionaries and runtime language switching do not by themselves provide separately indexable language routes.

## Proposed route contract

- Spanish canonical routes: `/es/`, `/es/marketplace`, `/es/marketplace/:slug`, `/es/servers`, `/es/creatures`, `/es/maps-bosses`, `/es/inis` and all legal pages.
- English equivalents under `/en/`.
- Private `/app`, `/account/*`, `/admin/*`, Auth callbacks and payment return routes remain language-neutral initially; their UI follows the stored preference.
- Existing unprefixed public URLs remain compatible during rollout and issue a single deterministic redirect to the chosen/default language. Query strings and safe hashes must be preserved.

## SEO rules

1. Every prefixed public page emits a self-referencing canonical.
2. ES/EN equivalents emit reciprocal `hreflang="es"`, `hreflang="en"` and `x-default`.
3. Sitemap entries include only complete, canonical route pairs.
4. Structured data, Open Graph locale, document `lang` and visible copy must agree.
5. A route is not released until its metadata, legal copy, empty/error states and content are complete in both languages.

## Implementation sequence

1. Add a route-locale parser independent from the preference store.
2. Introduce locale-aware URL builders and internal-link tests.
3. Generate paired sitemap/canonical/hreflang metadata.
4. Add redirects for unprefixed public routes without redirect loops.
5. Prerender every public ES/EN pair.
6. Validate 404s, deep links, hashes, encoded slugs and browser back/forward.
7. Run accessibility, SEO, E2E and duplicate-content checks before changing canonicals.

## Explicit non-goals for PR #15

No duplicate route tree, canonical switch, sitemap expansion or production redirect is introduced here. Mixing those changes with community/RLS hardening would increase rollback and indexing risk.
