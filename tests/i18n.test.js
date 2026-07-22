import test from 'node:test';
import assert from 'node:assert/strict';
import { getLanguage, initI18n, setLanguage, t } from '../src/i18n/index.js';
import es from '../src/i18n/es.js';
import en from '../src/i18n/en.js';

function browser(values = new Map()) {
  globalThis.document = { documentElement: { lang: '' }, querySelectorAll: () => [] };
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  return values;
}

test('i18n defaults to Spanish and persists a valid language change', () => {
  const values = browser();
  initI18n();
  assert.equal(getLanguage(), 'es');
  assert.equal(t('servers.publish'), 'Publicar servidor');
  setLanguage('en');
  assert.equal(t('servers.publish'), 'List your server');
  assert.equal(values.get('weafLanguage'), 'en');
  assert.equal(document.documentElement.lang, 'en');
});
test('legacy bossLanguage is used only as initial fallback', () => {
  const values = browser(new Map([['bossLanguage', 'en']]));
  initI18n();
  assert.equal(getLanguage(), 'en');
  assert.equal(values.get('weafLanguage'), 'en');
});

test('English falls back to Spanish for missing keys', () => {
  browser(new Map([['weafLanguage', 'en']]));
  initI18n();
  assert.equal(t('home.hero.title'), 'Turn progress into a shared plan.');
});

function keys(source, prefix = '') {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null ? keys(value, path) : [path];
  }).sort();
}

test('Spanish and English public dictionaries keep the same keys', () => {
  assert.deepEqual(keys(en), keys(es));
  browser(new Map([['weafLanguage', 'en']]));
  initI18n();
  assert.equal(t('home.faq.q1'), 'Do I need an account to use INIs?');
  assert.equal(t('servers.owner.viewPlans'), 'View plans');
  assert.equal(t('legal.noticeTitle'), 'Pending professional review');
});
