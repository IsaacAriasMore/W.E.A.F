import { readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGETS = {
  'initial-js': 40 * 1024,
  'initial-css': 15 * 1024,
  'image-max': 200 * 1024,
};

const RASTER_RE = /\.(avif|webp|jpe?g|png|gif)$/i;

async function getGzipSize(filePath) {
  const content = await readFile(filePath);
  return gzipSync(content).length;
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

  const assetsDir = join(DIST, 'assets');
  const entries = await readdir(assetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!RASTER_RE.test(entry.name)) continue;

    const filePath = join(assetsDir, entry.name);
    const { size } = await stat(filePath);
    const label = `${(size / 1024).toFixed(0)} KB`;
    const limit = `${(BUDGETS['image-max'] / 1024).toFixed(0)} KB`;
    if (size > BUDGETS['image-max']) {
      console.error(`  Image ${entry.name}: ${label} > ${limit} — FAIL`);
      failures++;
    } else {
      console.log(`  Image ${entry.name}: ${label} ≤ ${limit} — PASS`);
    }
  }

  if (failures) {
    console.error(`\n${failures} budget violation(s).`);
    process.exit(1);
  }
  console.log('\nAll budgets met.');
}

main();
