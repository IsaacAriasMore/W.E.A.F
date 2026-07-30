# Traspaso de Codex

## Estado

Codex reportó aproximadamente 39 archivos, 481 inserciones y 107 eliminaciones. El estado actual de Git es autoritativo.

## Baseline Inicio móvil

- Performance 65
- LCP 9.5 s
- CLS 0.189
- Accessibility 100
- Best Practices 100
- SEO 100

Problemas: PNG 1.47 MB, Auth/Supabase antes del render, CSS 134.2 KB, JS alto, H1 tardío, CLS, promociones en cadena crítica y animaciones.

## Implementación parcial

- AVIF/WebP, BrandEmblem, srcset/sizes, Sharp, OG 1200×630.
- Emblema reportado: 1,468,908 bytes → variantes 1.5–12 KB.
- App/main/router para render público temprano y Auth diferido.
- SponsoredServerSlot diferido.
- WeafThreeHero/GSAP ajustados.
- CSS por ruta.
- `/ark-survival-ascended`.
- metadata, sitemap, prerender, 404 noindex, service worker.
- Bundle reportado: CSS 134.2→60.8 KB; JS 336.2→106.9 KB; Supabase chunk 212.9 KB.
- Ocho rutas prerenderizadas.

Todo debe verificarse.

## Validación incompleta

Se ejecutaron check, unit y build antes de los últimos cambios. Falta estado final:

- check;
- unit;
- E2E;
- build;
- audit;
- Lighthouse 3×;
- CLS;
- pruebas SEO;
- visual;
- documentación;
- commits finales;
- push;
- PR Draft.

No empezar de cero, no borrar el WIP, no asumir que compila o que Auth/SEO/Lighthouse están correctos.
