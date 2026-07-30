import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { default: lighthouse } = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

const ROOT = 'http://127.0.0.1:4173';
const ROUTES = ['', '/ark-survival-ascended', '/inis', '/creatures', '/maps-bosses', '/servers', '/marketplace'];
const RUNS = 3;
const OUT = 'lighthouse-reports';

const WARN_THRESHOLDS = {
  'categories:performance': 0.9,
  'categories:best-practices': 0.95,
  lcp: 2500,
  cls: 0.1,
  tbt: 200,
};

const ERROR_THRESHOLDS = {
  'categories:accessibility': 0.95,
  'categories:seo': 0.95,
};

const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
const flags = { port: chrome.port, logLevel: 'error', output: 'json' };
await mkdir(OUT, { recursive: true });

const allResults = [];
let errors = 0;
let warnings = 0;

for (const route of ROUTES) {
  const name = route.replace(/[/\\]/g, '_') || 'home';
  const url = `${ROOT}${route}`;
  console.log(`\n${route || '/'}`);
  const validRuns = [];

  for (let i = 0; i < RUNS; i++) {
    let runnerResult;
    try {
      runnerResult = await lighthouse(url, { ...flags }, null);
    } catch (err) {
      console.error(`  run ${i + 1}: ERROR — ${err.message}`);
      errors++;
      continue;
    }

    const lhr = runnerResult.lhr;
    if (lhr.runtimeError) {
      console.error(`  run ${i + 1}: ${lhr.runtimeError.code} — ${lhr.runtimeError.message}`);
      errors++;
      continue;
    }

    validRuns.push(lhr);
    await writeFile(join(OUT, `${name}-run${i + 1}.json`), JSON.stringify(lhr));
    const p = Math.round((lhr.categories.performance?.score ?? 0) * 100);
    const l = Math.round(lhr.audits['largest-contentful-paint']?.numericValue ?? 0);
    console.log(`  run ${i + 1}: Perf=${p}  LCP=${l}ms`);
  }

  if (validRuns.length < RUNS) {
    console.error(`  → SKIPPED (${validRuns.length}/${RUNS} valid runs)`);
    errors++;
    continue;
  }

  validRuns.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
  const m = validRuns[1];
  await writeFile(join(OUT, `${name}-median.json`), JSON.stringify(m));
  allResults.push({ route, median: m });

  const perf = Math.round((m.categories.performance?.score ?? 0) * 100);
  const a11y = Math.round((m.categories.accessibility?.score ?? 0) * 100);
  const bp = Math.round((m.categories['best-practices']?.score ?? 0) * 100);
  const seo = Math.round((m.categories.seo?.score ?? 0) * 100);
  const lcp = m.audits['largest-contentful-paint']?.numericValue ?? 0;
  const cls = m.audits['cumulative-layout-shift']?.numericValue ?? 0;
  const tbt = m.audits['total-blocking-time']?.numericValue ?? 0;

  console.log(`  → median: Perf=${perf}  A11y=${a11y}  BP=${bp}  SEO=${seo}  ` +
    `LCP=${Math.round(lcp)}ms  CLS=${cls.toFixed(3)}  TBT=${Math.round(tbt)}ms`);

  if (perf / 100 < WARN_THRESHOLDS['categories:performance']) {
    console.warn(`  ⚠ Performance ${perf} < ${WARN_THRESHOLDS['categories:performance'] * 100}`);
    warnings++;
  }
  if (bp / 100 < WARN_THRESHOLDS['categories:best-practices']) {
    console.warn(`  ⚠ Best Practices ${bp} < ${WARN_THRESHOLDS['categories:best-practices'] * 100}`);
    warnings++;
  }
  if (lcp > WARN_THRESHOLDS.lcp) {
    console.warn(`  ⚠ LCP ${Math.round(lcp)}ms > ${WARN_THRESHOLDS.lcp}ms`);
    warnings++;
  }
  if (cls > WARN_THRESHOLDS.cls) {
    console.warn(`  ⚠ CLS ${cls.toFixed(3)} > ${WARN_THRESHOLDS.cls}`);
    warnings++;
  }
  if (tbt > WARN_THRESHOLDS.tbt) {
    console.warn(`  ⚠ TBT ${Math.round(tbt)}ms > ${WARN_THRESHOLDS.tbt}ms`);
    warnings++;
  }

  if (a11y / 100 < ERROR_THRESHOLDS['categories:accessibility']) {
    console.error(`  ✗ Accessibility ${a11y} < ${ERROR_THRESHOLDS['categories:accessibility'] * 100}`);
    errors++;
  }
  if (seo / 100 < ERROR_THRESHOLDS['categories:seo']) {
    console.error(`  ✗ SEO ${seo} < ${ERROR_THRESHOLDS['categories:seo'] * 100}`);
    errors++;
  }
}

await chrome.kill();

const summary = join(OUT, 'summary.json');
await writeFile(summary, JSON.stringify(allResults.map(r => ({
  route: r.route || '/',
  performance: Math.round((r.median.categories.performance?.score ?? 0) * 100),
  accessibility: Math.round((r.median.categories.accessibility?.score ?? 0) * 100),
  'best-practices': Math.round((r.median.categories['best-practices']?.score ?? 0) * 100),
  seo: Math.round((r.median.categories.seo?.score ?? 0) * 100),
  lcp: Math.round(r.median.audits['largest-contentful-paint']?.numericValue ?? 0),
  cls: r.median.audits['cumulative-layout-shift']?.numericValue ?? 0,
  tbt: Math.round(r.median.audits['total-blocking-time']?.numericValue ?? 0),
})), null, 2));

if (warnings) console.log(`\n${warnings} warning(s).`);
if (errors) {
  console.error(`${errors} error(s).`);
  process.exit(1);
}
console.log('\nAll thresholds met.');
