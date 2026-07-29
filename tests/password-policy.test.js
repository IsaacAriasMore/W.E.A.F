import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluatePassword, isStrongPassword, PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH, PASSWORD_SYMBOLS,
} from '../src/utils/passwordPolicy.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('shared password policy requires 8-64 chars and every character class', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(PASSWORD_MAX_LENGTH, 64);
  assert.equal(isStrongPassword('Forge9!A'), true);
  assert.equal(isStrongPassword('Aa1!aaa'), false);
  assert.equal(isStrongPassword(`Aa1!${'a'.repeat(61)}`), false);
  assert.equal(isStrongPassword(`Aa1!${'a'.repeat(60)}`), true);
});

test('each missing requirement fails independently', () => {
  assert.equal(evaluatePassword('forge9!a').requirements.uppercase, false);
  assert.equal(evaluatePassword('FORGE9!A').requirements.lowercase, false);
  assert.equal(evaluatePassword('Forge!!A').requirements.number, false);
  assert.equal(evaluatePassword('Forge99A').requirements.symbol, false);
  assert.ok(PASSWORD_SYMBOLS.includes('!'));
});

test('password values are preserved without trim, lowercase, or normalization', () => {
  const raw = ' ÅForge9! ';
  const result = evaluatePassword(raw);
  assert.equal(result.value, raw);
  assert.notEqual(result.value, raw.trim());
  assert.notEqual(result.value, raw.toLowerCase());
});

test('registration, recovery, and profile change use the shared accessible validator', () => {
  const register = read('../src/pages/auth/register.js');
  const reset = read('../src/pages/auth/resetPassword.js');
  const profile = read('../src/pages/app/profile.js');
  for (const source of [register, reset, profile]) {
    assert.match(source, /bindPasswordRequirements/);
    assert.match(source, /autocomplete="new-password"/);
    assert.match(source, /maxlength="64"/);
  }
  assert.match(read('../src/pages/auth/formUtils.js'), /aria-live="polite"/);
});

test('login preserves compatibility with legacy passwords', () => {
  const login = read('../src/pages/auth/login.js');
  const input = login.match(/<input id="login-password"[^>]+>/)?.[0] || '';
  assert.doesNotMatch(input, /minlength|maxlength|pattern=/);
  assert.match(input, /autocomplete="current-password"/);
});

test('provider weak-password details remain mapped to a generic localized error', () => {
  const service = read('../src/services/authService.js');
  const copyEs = read('../src/config/auth.js');
  assert.match(service, /error\.code === 'weak_password'/);
  assert.match(copyEs, /weakPassword: 'Usa una contraseña más segura\.'/);
  assert.doesNotMatch(service, /weak_password.*error\.message/);
});
