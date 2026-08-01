# Dynamic HTML security audit

Date: 2026-08-01. Scope: PR #15 Marketplace, seller, reports, moderation, notifications, favorites, blocks, profiles, frontend errors, legal copy and external URLs.

## Classification

- **A — static:** markup and localized labels controlled by the repository.
- **B — encoded/closed:** database text is passed through `escapeHtml`; identifiers, booleans, numbers and states are constrained server-side.
- **C — external/dynamic attribute:** URL, API or user value reaching a browser-sensitive attribute.
- **D — unknown:** provenance or encoding cannot be proved.

Only C/D sinks required conversion. Static templates were not mechanically rewritten because doing so would add complexity without reducing risk.

| Surface | Sink | Class after review | Evidence |
|---|---|---:|---|
| Public catalog cards/detail | `innerHTML`, append | B | title, description, resource, terms, server and region are context-escaped; UUID/state/numeric fields are schema constrained |
| Detail Discord action | DOM `href` assignment | A after validation | no raw URL exists in initial HTML; `safeDiscordInviteUrl` validates exact HTTPS hosts/path before `discordLink.href` |
| Catalog category options | HTML option template | B | slug/name escaped before insertion |
| Seller profile/listings | `innerHTML`, append | B | profile/listing text escaped; images pass `safeImageUrl`; dates are formatted text |
| Marketplace account/editor | `outerHTML` | B | listing/community text escaped; category values and labels now both escaped; IDs and states are constrained |
| Admin Marketplace moderation | `innerHTML`, row `outerHTML` | B | report details/reasons, names and transitions escaped; IDs/states come from closed server responses |
| Notifications | account template | B | table enforces plain text/control-character constraints; UI also escapes title/body |
| Frontend errors | no message rendering in public UI | A/B | Admin receives aggregate count only; RPC strips query strings, JWT-like text and non-allowlisted metadata |
| Legal routes | render template | A | repository-owned copy and centralized contact constants; no database/API/URL input |
| PayPal approval URL | DOM navigation | A after validation | exact Sandbox allowlist; Live and deceptive hosts rejected |

The repository-wide inventory also found static application shell, skeleton, i18n and controlled form templates. These are A. Non-Marketplace legacy pages remain outside ID 48 and should keep contextual encoding during future edits.

## Regression cases

Automated tests cover:

- HTML titles and descriptions containing `script`;
- event-handler attributes;
- malicious SVG/data URLs;
- `javascript:` and deceptive external hosts;
- quotes, ampersands and special characters;
- long content;
- Spanish/English text;
- JWT-shaped dummy text and sensitive query strings.

Result: no C or D sink remains in the stated ID 48 scope. CSP remains defense in depth; it is not treated as a substitute for encoding or URL validation.
