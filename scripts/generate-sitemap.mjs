import { writeFile } from 'node:fs/promises';
import { seoRoutes, siteUrl } from './seo-routes.mjs';

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const urls = seoRoutes.map(({ path }) => `  <url><loc>${escapeXml(`${siteUrl}${path}`)}</loc></url>`).join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

await writeFile(new URL('../public/sitemap.xml', import.meta.url), xml, 'utf8');
console.log(`Generated sitemap with ${seoRoutes.length} canonical URLs.`);
