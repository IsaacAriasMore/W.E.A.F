---
name: weaf-performance-seo
description: Continúa y valida el WIP de rendimiento, Lighthouse, Core Web Vitals, prerender, Auth asíncrono y SEO técnico de W.E.A.F sin tocar producción, pagos, Supabase remoto ni secretos.
license: Proprietary project instructions
compatibility: opencode
metadata:
  project: W.E.A.F
  workflow: performance-seo
  risk: high
---

# W.E.A.F Performance & SEO Continuation Skill

## Uso

Solo para la rama `codex/performance-seo-lighthouse-90`.

No usar para Marketplace backend, migraciones, Edge Functions, pagos, Supabase Auth, despliegues ni `main`.

## Lecturas obligatorias

Antes de editar, lee:

1. `references/project-context.md`
2. `references/codex-handoff.md`
3. `references/validation-checklist.md`
4. `references/official-links.md`

Git y los archivos actuales son la fuente de verdad.

## Protocolo inicial

```bash
git branch --show-current
git status --short
git log -5 --oneline
git diff --check
git diff --stat
git ls-files --others --exclude-standard
```

Debe ser la rama correcta. No reset, clean, restore destructivo ni reimplementación.

Presenta: rama, HEAD, archivos, riesgos, plan y comandos necesarios antes de editar.

## Fase A — Auditoría WIP

Revisa todos los archivos modificados, especialmente:

- `index.html`, `package.json`, lockfile, Vite y Vercel;
- `public/sw.js`;
- `src/main.js`, `src/App.js`, `src/router.js`;
- `src/seo/metadata.js`;
- Header, Footer, BrandEmblem, SponsoredServerSlot;
- WeafThreeHero y gsapMotion;
- home y arkSurvivalAscended;
- CSS global/por ruta;
- scripts de imágenes, sitemap y prerender.

Busca errores, imports faltantes/circulares, CSS perdido, FOUC, doble render, flash privado, loops Auth, queries duplicadas, listeners sin limpiar, observers sin fallback, Three/GSAP sin cleanup, PWA obsoleta, rutas privadas prerenderizadas, metadatos falsos, secretos y rutas locales.

## Fase B — Auth y seguridad funcional

Valida:

- público anónimo y autenticado;
- protegido anónimo y autenticado;
- Admin sin/con rol;
- login, registro, reset y Turnstile;
- logout, refresh, back/forward y recuperación de sesión.

No flash privado, no H1 público bloqueado, no múltiples getSession ni loops onAuthStateChange.

## Fase C — Pruebas

```bash
npm run check
npm run test:unit
npm run test:e2e -- --workers=1
npm run build
npm audit --audit-level=low
```

No debilitar pruebas. Conservar y corregir causas reales.

## Fase D — Lighthouse

Rutas:

- `/`
- `/inis`
- `/maps-bosses`
- `/creatures`
- `/servers`
- `/marketplace`
- `/ark-survival-ascended`

Para cada ruta: 3 móvil, 3 escritorio, misma configuración, mediana, JSON fuera de Git o como artefactos.

Registrar Performance, Accessibility, Best Practices, SEO, FCP, LCP, CLS, TBT, Speed Index, transferencia, requests, JS/CSS sin usar, LCP element, layout shifts y long tasks.

Objetivos: Performance >=90; A/BP/SEO >=95; LCP <=2.5s; CLS <=0.1.

No manipular throttling ni seleccionar solo el mejor resultado.

## Fase E — Imágenes

Verifica que el PNG pesado no se descargue, AVIF/WebP funcionen, srcset/sizes y dimensiones sean correctos, exista fallback, alta densidad y que OG no se cargue visualmente.

## Fase F — JS/CSS/animaciones

Supabase/Auth diferidos sin romper seguridad; CSS por ruta; Three solo donde corresponde; GSAP después del contenido; H1 visible; animaciones transform/opacity; reduced motion; cleanup; sin tareas largas evitables.

## Fase G — Prerender/SEO

Validar HTML de las rutas públicas y 404.

Cada HTML: lang, title, description, canonical, robots, H1, introducción visible, enlaces, semántica, JSON-LD verdadero e imágenes dimensionadas.

No prerenderizar sesiones, datos privados, Admin, perfil, cuenta ni pagos.

Validar sitemap, hreflang correcto o ausente, 404 noindex, no localhost/Preview/rutas privadas, no fake ratings, no meta keywords, no cloaking.

## Fase H — Visual

Capturas 390, 768 y escritorio para rutas públicas, login y registro. Revisar header, hero, emblema, tipografía, tarjetas, loading, footer, teclado y reduced motion.

## Fase I — Documentación

Completar estrategia SEO, Search Console, baseline/final, presupuesto, bundles, riesgos, rollback y pasos pendientes.

## Fase J — Git

Pedir autorización antes de git add/commit/push. Commits temáticos cuando sea razonable. PR Draft. Nunca Ready, merge o deploy.

## Honestidad

Distingue terminado, probado, pendiente, bloqueado y requiere autorización.
