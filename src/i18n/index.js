import es from './es.js';
import en from './en.js';

const STORAGE_KEY = 'weafLanguage';
const LEGACY_KEY = 'bossLanguage';
const dictionaries = { es, en };
const subscribers = new Set();
let currentLanguage = 'es';

function readPath(source, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], source);
}

function interpolate(value, params) {
  return Object.entries(params).reduce((text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)), value);
}

function normalizeStoredLanguage(value) {
  if (value in dictionaries) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed in dictionaries ? parsed : null;
  } catch {
    return null;
  }
}

export function getLanguage() {
  return currentLanguage;
}

export function t(key, params = {}) {
  const value = readPath(dictionaries[currentLanguage], key) ?? readPath(es, key);
  if (typeof value !== 'string') return import.meta.env.DEV ? key : '';
  return interpolate(value, params);
}

export function translateStaticDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => { element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel)); });
}

export function setLanguage(language) {
  if (!(language in dictionaries) || language === currentLanguage) return;
  currentLanguage = language;
  document.documentElement.lang = language;
  try { window.localStorage.setItem(STORAGE_KEY, language); } catch { /* Storage can be unavailable. */ }
  translateStaticDom();
  subscribers.forEach((callback) => callback(language));
}

export function subscribeLanguageChange(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function initI18n() {
  let saved;
  try { saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_KEY); } catch { saved = null; }
  currentLanguage = normalizeStoredLanguage(saved) || 'es';
  document.documentElement.lang = currentLanguage;
  if (saved && window.localStorage.getItem(STORAGE_KEY) !== currentLanguage) {
    try { window.localStorage.setItem(STORAGE_KEY, currentLanguage); } catch { /* Storage can be unavailable. */ }
  }
  return currentLanguage;
}
