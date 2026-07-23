export const BOSS_CHECKLIST_STORAGE_KEY = 'weaf:boss-checklist:v2';

const segment = (value) => encodeURIComponent(String(value || '').trim().toLowerCase());

export function checklistPrefix({ game, mapSlug, bossSlug, difficulty }) {
  return [game, mapSlug, bossSlug, difficulty].map(segment).join(':');
}

export function checklistItemKey(context, itemType, itemId) {
  return `${checklistPrefix(context)}:${segment(itemType)}:${segment(itemId)}`;
}

export function readBossChecklist(storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(BOSS_CHECKLIST_STORAGE_KEY));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function writeBossChecklist(value, storage = window.localStorage) {
  storage.setItem(BOSS_CHECKLIST_STORAGE_KEY, JSON.stringify(value));
}

export function setChecklistItem(value, key, checked) {
  const next = { ...value };
  if (checked) next[key] = true;
  else delete next[key];
  return next;
}

export function resetBossChecklist(value, context) {
  const prefix = `${checklistPrefix(context)}:`;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith(prefix)));
}

export function bossChecklistProgress(value, context, requirements) {
  const items = ['artifacts', 'tributes'].flatMap((type) => (requirements?.[type] || []).map((item) => ({ type, item })));
  const complete = items.filter(({ type, item }) => value[checklistItemKey(context, type, item.id)]).length;
  return { complete, total: items.length, percent: items.length ? Math.round((complete / items.length) * 100) : 0 };
}
