import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prerenderPaths, seoRoutes, siteUrl } from './seo-routes.mjs';

const dist = path.resolve('dist');
const template = await readFile(path.join(dist, 'index.html'), 'utf8');
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function metadata(html, route) {
  const canonical = `${siteUrl}${route.path}`;
  return html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(route.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`);
}

function shell(route) {
  const links = route.links.map((href) => {
    const target = seoRoutes.find((candidate) => candidate.path === href);
    return `<a href="${href}">${escapeHtml(target?.h1 || 'Inicio')}</a>`;
  }).join('');
  return `<main id="main-content"><section class="prerender-shell container"><p class="hero-kicker">W.E.A.F</p><h1>${escapeHtml(route.h1)}</h1><p>${escapeHtml(route.intro)}</p><nav aria-label="Herramientas relacionadas">${links}</nav></section></main>`;
}

function schema(route) {
  const canonical = `${siteUrl}${route.path}`;
  const graph = route.path === '/' ? [{ '@type': 'WebSite', name: 'W.E.A.F', url: canonical, inLanguage: 'es' }] : [{
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: route.h1, item: canonical },
    ],
  }];
  return `<script type="application/ld+json" data-prerender-schema>${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>`;
}

for (const route of seoRoutes.filter(({ path: routePath }) => prerenderPaths.has(routePath))) {
  let html = metadata(template, route)
    .replace('<div id="app"></div>', `<div id="app">${shell(route)}</div>`)
    .replace('</head>', `    ${schema(route)}\n  </head>`);
  const output = route.path === '/' ? path.join(dist, 'index.html') : path.join(dist, route.path.slice(1), 'index.html');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
}

const notFound = template
  .replace('<meta name="robots" content="index, follow, max-image-preview:large" />', '<meta name="robots" content="noindex, nofollow, noarchive" />')
  .replace(/<title>.*?<\/title>/s, '<title>Página no encontrada | W.E.A.F</title>')
  .replace('<div id="app"></div>', '<div id="app"><main id="main-content"><section class="prerender-shell container"><h1>Esta coordenada no existe.</h1><p>Regresa a las herramientas públicas de W.E.A.F.</p><a href="/">Volver al inicio</a></section></main></div>');
await writeFile(path.join(dist, '404.html'), notFound, 'utf8');

console.log(`Prerendered ${prerenderPaths.size} public routes and a noindex 404.`);
