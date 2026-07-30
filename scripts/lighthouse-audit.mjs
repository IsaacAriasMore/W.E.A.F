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

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function pick(lhrs, key) {
  const parts = key.split('.');
  return lhrs.map(lhr => {
    let val = lhr;
    for (const part of parts) {
      if (val == null) return 0;
      val = val[part];
    }
    return val ?? 0;
  });
}

const isMain = process.argv[1] === import.meta.filename;
if (!isMain) {
  // Exported only for unit tests; skip execution when imported
} else {
  await main();
}

async function main() {
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

  const medianPerf = median(pick(validRuns, 'categories.performance.score'));
  const medianA11y = median(pick(validRuns, 'categories.accessibility.score'));
  const medianBp = median(pick(validRuns, 'categories.best-practices.score'));
  const medianSeo = median(pick(validRuns, 'categories.seo.score'));
  const medianLcp = median(pick(validRuns, 'audits.largest-contentful-paint.numericValue'));
  const medianCls = median(pick(validRuns, 'audits.cumulative-layout-shift.numericValue'));
  const medianTbt = median(pick(validRuns, 'audits.total-blocking-time.numericValue'));

  const row = {
    route: route || '/',
    performance: Math.round(medianPerf * 100),
    accessibility: Math.round(medianA11y * 100),
    'best-practices': Math.round(medianBp * 100),
    seo: Math.round(medianSeo * 100),
    lcp: Math.round(medianLcp),
    cls: medianCls,
    tbt: Math.round(medianTbt),
  };
  allResults.push(row);

  console.log(`  → median: Perf=${row.performance}  A11y=${row.accessibility}  BP=${row['best-practices']}  SEO=${row.seo}  ` +
    `LCP=${row.lcp}ms  CLS=${row.cls.toFixed(3)}  TBT=${row.tbt}ms`);

  if (medianPerf < WARN_THRESHOLDS['categories:performance']) {
    console.warn(`  ⚠ Performance ${row.performance} < ${WARN_THRESHOLDS['categories:performance'] * 100}`);
    warnings++;
  }
  if (medianBp < WARN_THRESHOLDS['categories:best-practices']) {
    console.warn(`  ⚠ Best Practices ${row['best-practices']} < ${WARN_THRESHOLDS['categories:best-practices'] * 100}`);
    warnings++;
  }
  if (medianLcp > WARN_THRESHOLDS.lcp) {
    console.warn(`  ⚠ LCP ${row.lcp}ms > ${WARN_THRESHOLDS.lcp}ms`);
    warnings++;
  }
  if (medianCls > WARN_THRESHOLDS.cls) {
    console.warn(`  ⚠ CLS ${row.cls.toFixed(3)} > ${WARN_THRESHOLDS.cls}`);
    warnings++;
  }
  if (medianTbt > WARN_THRESHOLDS.tbt) {
    console.warn(`  ⚠ TBT ${row.tbt}ms > ${WARN_THRESHOLDS.tbt}ms`);
    warnings++;
  }

  if (medianA11y < ERROR_THRESHOLDS['categories:accessibility']) {
    console.error(`  ✗ Accessibility ${row.accessibility} < ${ERROR_THRESHOLDS['categories:accessibility'] * 100}`);
    errors++;
  }
  if (medianSeo < ERROR_THRESHOLDS['categories:seo']) {
    console.error(`  ✗ SEO ${row.seo} < ${ERROR_THRESHOLDS['categories:seo'] * 100}`);
    errors++;
  }
}

await chrome.kill();

const summary = join(OUT, 'summary.json');
await writeFile(summary, JSON.stringify(allResults, null, 2));

if (warnings) console.log(`\n${warnings} warning(s).`);
if (errors) {
  console.error(`${errors} error(s).`);
  process.exit(1);
}
console.log('\nAll thresholds met.');
}
