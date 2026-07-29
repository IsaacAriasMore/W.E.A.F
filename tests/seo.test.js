import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('robots and sitemap are physical crawlable files', () => {
  const robots = read('../public/robots.txt');
  const sitemap = read('../public/sitemap.xml');
  assert.match(robots, /Sitemap: https:\/\/weaf\.vercel\.app\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(sitemap, /<urlset[^>]+sitemaps\.org/);
  assert.match(sitemap, /https:\/\/weaf\.vercel\.app\/servers/);
  assert.doesNotMatch(sitemap, /servers\/publish|account\/billing|\/admin/);
});

test('route metadata provides canonical, social cards, hreflang, and valid schema boundaries', () => {
  const metadata = read('../src/seo/metadata.js');
  assert.match(metadata, /link\[rel="alternate"\]\[hreflang\]/);
  assert.match(metadata, /twitter:card/);
  assert.match(metadata, /application\/ld\+json/);
  assert.match(metadata, /FAQPage/);
  assert.match(metadata, /BreadcrumbList/);
  assert.match(metadata, /noindex, nofollow, noarchive/);
  assert.match(metadata, /replaceAll\('<', '\\\\u003c'\)/);
});

test('the initial document exposes useful metadata before JavaScript', () => {
  const html = read('../index.html');
  assert.match(html, /rel="canonical" href="https:\/\/weaf\.vercel\.app\/"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /hreflang="es"/);
  assert.match(html, /hreflang="en"/);
});
