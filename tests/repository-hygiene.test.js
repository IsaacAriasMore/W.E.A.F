import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const allowedEnvFiles = new Set(['.env.example', '.env.test']);
const forbiddenDirectories = ['back' + 'ups/', 'du' + 'mps/', 'database-' + 'backups/'];

const trackedFiles = () => execFileSync('git', ['ls-files', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean);

const normalizePath = (path) => path.replaceAll('\\', '/');

export const isForbiddenTrackedPath = (path) => {
  const normalized = normalizePath(path).toLowerCase();
  if (forbiddenDirectories.some((directory) => normalized.startsWith(directory))) return true;
  if (/\.(?:backup|bak|dump)$/i.test(normalized) || /\.sql\.bak$/i.test(normalized)) return true;

  const name = normalized.split('/').at(-1);
  if (!name?.startsWith('.env')) return false;
  return !allowedEnvFiles.has(normalized);
};

const decodeBase64UrlJson = (value) => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const jwtCandidatePattern = () => new RegExp([
  '[A-Za-z0-9_-]{10,}',
  '\\.',
  '[A-Za-z0-9_-]{10,}',
  '\\.',
  '[A-Za-z0-9_-]{10,}',
].join(''), 'g');

export const looksLikeJwt = (candidate) => {
  const parts = candidate.split('.');
  if (parts.length !== 3) return false;
  const header = decodeBase64UrlJson(parts[0]);
  const payload = decodeBase64UrlJson(parts[1]);
  if (!header || !payload || typeof header.alg !== 'string') return false;
  return ['iss', 'role', 'exp', 'sub', 'aud'].some((claim) => Object.hasOwn(payload, claim));
};

const isObviouslyFake = (value) => {
  const normalized = value.trim().toLowerCase();
  return normalized.length < 12
    || /^(?:test|fake|dummy|example|placeholder|your[_-]|changeme|xxx)/.test(normalized)
    || normalized.includes('your_')
    || normalized.includes('<')
    || normalized.includes('${');
};

const lineAt = (content, offset) => content.slice(0, offset).split('\n').length;

export const inspectTextForSecrets = (content) => {
  const findings = [];
  for (const match of content.matchAll(jwtCandidatePattern())) {
    if (looksLikeJwt(match[0])) findings.push({ type: 'jwt', line: lineAt(content, match.index) });
  }

  const privateKeyMarker = ['BEGIN ', 'PRIVATE ', 'KEY'].join('');
  const privateKeyOffset = content.indexOf(privateKeyMarker);
  if (privateKeyOffset >= 0) findings.push({ type: 'private_key', line: lineAt(content, privateKeyOffset) });

  const bearerPattern = new RegExp([
    'Authoriz', 'ation\\s*[:=]\\s*["\\\']?',
    'Bear', 'er\\s+[A-Za-z0-9._~-]{16,}',
  ].join(''), 'gi');
  for (const match of content.matchAll(bearerPattern)) {
    findings.push({ type: 'literal_bearer', line: lineAt(content, match.index) });
  }

  const providerPrefixes = [
    ['gh', 'p_'].join(''),
    ['github_', 'pat_'].join(''),
    ['sk_', 'live_'].join(''),
    ['rk_', 'live_'].join(''),
    ['sb_', 'secret_'].join(''),
  ];
  for (const prefix of providerPrefixes) {
    const pattern = new RegExp(`${prefix}[A-Za-z0-9_-]{16,}`, 'g');
    for (const match of content.matchAll(pattern)) {
      findings.push({ type: 'provider_secret', line: lineAt(content, match.index) });
    }
  }

  const sensitiveNames = [
    'SERVICE_ROLE_KEY', 'JWT_SECRET', 'CLIENT_SECRET', 'STRIPE_SECRET_KEY',
    'PAYPAL_CLIENT_SECRET', 'TURNSTILE_SECRET_KEY',
  ].join('|');
  const assignmentPattern = new RegExp(`(?:${sensitiveNames})\\s*[:=]\\s*["']([^"']+)["']`, 'gi');
  for (const match of content.matchAll(assignmentPattern)) {
    if (!isObviouslyFake(match[1])) {
      findings.push({ type: 'literal_sensitive_assignment', line: lineAt(content, match.index) });
    }
  }

  return findings;
};

const isProbablyBinary = (buffer) => {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0)) return true;
  let controls = 0;
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32)) controls += 1;
  }
  return sample.length > 0 && controls / sample.length > 0.1;
};

test('JWT detector ignores invalid candidates and detects a realistic token built in memory', () => {
  assert.equal(looksLikeJwt('not.a.jwt'), false);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'local-test', role: 'anon', exp: 1 })).toString('base64url');
  const realistic = [header, payload, 'signature-built-for-test'].join('.');
  assert.equal(looksLikeJwt(realistic), true);
  assert.equal(inspectTextForSecrets(realistic)[0]?.type, 'jwt');
  assert.deepEqual(inspectTextForSecrets(jwtCandidatePattern().source), []);
});

test('path policy permits public env templates and rejects secret env or backup paths', () => {
  assert.equal(isForbiddenTrackedPath('.env.example'), false);
  assert.equal(isForbiddenTrackedPath('.env.test'), false);
  assert.equal(isForbiddenTrackedPath('.env'), true);
  assert.equal(isForbiddenTrackedPath('.env.local'), true);
  assert.equal(isForbiddenTrackedPath(['back', 'ups/example.sql'].join('')), true);
  assert.equal(isForbiddenTrackedPath('database.dump'), true);
  assert.equal(isForbiddenTrackedPath('supabase/migrations/20260101000000_valid.sql'), false);
});

test('tracked repository files contain no embedded credentials or forbidden artifacts', () => {
  const findings = [];
  for (const path of trackedFiles()) {
    if (!existsSync(new URL(`../${path}`, import.meta.url))) continue;
    if (isForbiddenTrackedPath(path)) {
      findings.push(`${path}:1:forbidden_path`);
      continue;
    }

    const buffer = readFileSync(new URL(`../${path}`, import.meta.url));
    if (isProbablyBinary(buffer)) continue;
    const content = buffer.toString('utf8');
    for (const finding of inspectTextForSecrets(content)) {
      findings.push(`${path}:${finding.line}:${finding.type}`);
    }
  }

  assert.deepEqual(findings, [], `Repository hygiene violations:\n${findings.join('\n')}`);
});
