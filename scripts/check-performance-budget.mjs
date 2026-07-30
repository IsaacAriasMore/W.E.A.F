import { readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGETS = {
  'initial-js': 40 * 1024,
  'initial-css': 15 * 1024,
  'image-max': 200 * 1024,
};

const IMAGE_RE = /["']\/assets\/([^"']+\.(?:avif|webp|jpe?g|png|gif))["' )]/gi;
const FULL_URL_RE = /https:\/\/weaf\.vercel\.app\/assets\/([^"']+\.(?:avif|webp|jpe?g|png|gif))/gi;
const CSS_URL_RE = /url\(["']?\/assets\/([^"')]+\.(?:avif|webp|jpe?g|png|gif))["']?\)/gi;

async function getGzipSize(filePath) {
  const content = await readFile(filePath);
  return gzipSync(content).length;
}

async function scanFile(filePath, re) {
  const names = [];
  try {
    const source = await readFile(filePath, 'utf8');
    for (const m of source.matchAll(re)) names.push(m[1]);
  } catch { }
  return names;
}

async function collectReferencedImages() {
  const referenced = new Set();

  const rootHtml = join(DIST, 'index.html');
  for (const name of await scanFile(rootHtml, IMAGE_RE)) referenced.add(name);
  for (const name of await scanFile(rootHtml, FULL_URL_RE)) referenced.add(name);

  const html = await readFile(rootHtml, 'utf8');
  for (const src of [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map(m => m[1])) {
    for (const name of await scanFile(join(DIST, src.replace(/\?.*/, '')), IMAGE_RE)) referenced.add(name);
  }

  for (const href of [...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"[^>]*rel="stylesheet"/g)].map(m => m[1])) {
    for (const name of await scanFile(join(DIST, href.replace(/\?.*/, '')), CSS_URL_RE)) referenced.add(name);
  }

  const dirs = await readdir(DIST, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory() || dir.name === 'assets') continue;
    const htmlPath = join(DIST, dir.name, 'index.html');
    for (const name of await scanFile(htmlPath, FULL_URL_RE)) referenced.add(name);
  }

  return referenced;
}

async function main() {
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  const jsSrcs = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
  const cssHrefs = [...html.matchAll(/<link[^>]*\shref="([^"]+\.css[^"]*)"[^>]*>/g)].map(m => m[1]);
  let failures = 0;

  let totalJsGzip = 0;
  for (const src of jsSrcs) {
    const filePath = join(DIST, src.replace(/\?.*/, ''));
    const size = await getGzipSize(filePath);
    totalJsGzip += size;
    console.log(`  JS ${src}: ${(size / 1024).toFixed(1)} KB gzip`);
  }
  console.log(`→ Total JS: ${(totalJsGzip / 1024).toFixed(1)} KB / ${(BUDGETS['initial-js'] / 1024).toFixed(0)} KB`);
  if (totalJsGzip > BUDGETS['initial-js']) {
    console.error(`  ✗ Exceeded by ${((totalJsGzip - BUDGETS['initial-js']) / 1024).toFixed(1)} KB`);
    failures++;
  }

  let totalCssGzip = 0;
  for (const href of cssHrefs) {
    const filePath = join(DIST, href.replace(/\?.*/, ''));
    const size = await getGzipSize(filePath);
    totalCssGzip += size;
    console.log(`  CSS ${href}: ${(size / 1024).toFixed(1)} KB gzip`);
  }
  console.log(`→ Total CSS: ${(totalCssGzip / 1024).toFixed(1)} KB / ${(BUDGETS['initial-css'] / 1024).toFixed(0)} KB`);
  if (totalCssGzip > BUDGETS['initial-css']) {
    console.error(`  ✗ Exceeded by ${((totalCssGzip - BUDGETS['initial-css']) / 1024).toFixed(1)} KB`);
    failures++;
  }

  const referenced = await collectReferencedImages();
  const assetsDir = join(DIST, 'assets');
  const entries = await readdir(assetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!/\.(avif|webp|jpe?g|png|gif)$/i.test(entry.name)) continue;
    if (!referenced.has(entry.name)) continue;

    const { size } = await stat(join(assetsDir, entry.name));
    const label = `${(size / 1024).toFixed(0)} KB`;
    if (size > BUDGETS['image-max']) {
      console.error(`  Image ${entry.name}: ${label} exceeds ${(BUDGETS['image-max'] / 1024).toFixed(0)} KB`);
      failures++;
    } else {
      console.log(`  Image ${entry.name}: ${label}`);
    }
  }

  if (failures) {
    console.error(`\n${failures} budget violation(s).`);
    process.exit(1);
  }
  console.log('\nAll budgets met.');
}

main();
