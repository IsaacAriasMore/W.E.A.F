import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['index.html', 'src'];
const files = [];

async function collect(path) {
  if (extname(path)) {
    files.push(path);
    return;
  }

  for (const entry of await readdir(path, { withFileTypes: true })) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) await collect(next);
    else if (['.js', '.css', '.html'].includes(extname(entry.name))) files.push(next);
  }
}

for (const root of roots) await collect(root);

const forbidden = [
  { pattern: /[—–]/u, message: 'usa un guion normal en copy visible' },
  { pattern: /href=["']#["']/u, message: 'contiene un enlace vacío' },
  { pattern: /console\.log\(/u, message: 'contiene console.log' },
];

let failures = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) {
      console.error(`${file}: ${rule.message}`);
      failures += 1;
    }
  }
}

if (failures) process.exit(1);
console.info(`Checked ${files.length} frontend files.`);
