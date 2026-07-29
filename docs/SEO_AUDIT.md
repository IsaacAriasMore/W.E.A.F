# Auditoría SEO técnica

Fecha: 29 de julio de 2026. Sitio canónico: `https://weaf.vercel.app`.

## Hallazgos corregidos

- `/robots.txt` y `/sitemap.xml` no existían como archivos físicos; Vercel respondía el HTML de la SPA. Ahora ambos existen en `public/` con tipos servibles estáticos y solo incluyen rutas públicas.
- La SPA solo cambiaba `document.title`. Ahora cada ruta pública define title, description, canonical, robots, Open Graph, Twitter Card y alternates ES/EN.
- Login, registro, recuperación, onboarding, perfil, tribu, Admin, checkout, success, cancel y billing quedan `noindex` tanto por meta dinámico como por `X-Robots-Tag` en Vercel.
- Home publica `Organization`, `WebSite` y `FAQPage`; el FAQ coincide con contenido visible. Las rutas públicas secundarias publican `BreadcrumbList`.
- Las rutas desconocidas se marcan `noindex` y no generan schema.
- El parámetro `?lang=en` ofrece una versión enlazable; la URL limpia permanece como canonical y `x-default`.

## Crawlability de la SPA

Google puede renderizar JavaScript, pero la segunda fase de render puede demorarse y otros bots pueden no ejecutarla. El HTML inicial ya contiene metadata completa de Home; las demás rutas la reciben tras cargar la aplicación. Antes de una estrategia editorial grande conviene incorporar prerender/SSG real por ruta. No se añadió una dependencia de prerender sin navegador porque podría producir HTML incompleto y una falsa sensación de cobertura.

## Contenido e indexación

- Home, INIs, Mapas & Bosses, Criaturas, Servidores y planes tienen intención distinta y enlaces internos visibles.
- No existen aún URLs individuales para INIs, criaturas, mapas o bosses; esto limita consultas long-tail. Deben añadirse cuando cada registro tenga contenido editorial suficiente y fuente revisada.
- Las páginas legales son preliminares. Pueden indexarse para transparencia, pero no deben tratarse como asesoría legal final.
- Los detalles futuros del marketplace solo deberán indexarse mientras estén `active`, tengan contenido suficiente y no hayan expirado.

## Pasos manuales

1. Verificar el dominio real en Google Search Console y Bing Webmaster Tools con el método oficial elegido; no inventar tokens.
2. Enviar `https://weaf.vercel.app/sitemap.xml` tras desplegar Preview y producción revisada.
3. Probar URL, canonical, robots y renderizado en ambas herramientas.
4. Medir indexación, cobertura, consultas, CTR y Core Web Vitals; no se garantiza una posición concreta.
5. Cuando exista dominio propio, convertirlo en canonical y mantener redirecciones 301 desde el dominio anterior.

## Riesgos restantes

- Falta prerender/SSR completo para contenido visible por ruta.
- Falta imagen social horizontal dedicada (la actual usa el emblema propio).
- Falta contenido individual profundo y revisado para crecer en búsquedas long-tail.
- El sitemap de marketplace deberá generarse desde datos activos; nunca incluir expirados, ocultos o rechazados.
