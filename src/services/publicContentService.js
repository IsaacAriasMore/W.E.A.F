import { getLanguage } from '../i18n/index.js';

function localized(row, field, language = getLanguage()) {
  return row?.[`${field}_${language}`] || row?.[`${field}_es`] || row?.[`${field}_en`] || row?.[field] || '';
}

function normalizeRequirement(row) {
  return {
    ...row,
    artifacts: Array.isArray(row.artifacts) ? row.artifacts : [],
    tributes: Array.isArray(row.tributes) ? row.tributes : [],
    unlocks: Array.isArray(row.unlocks) ? row.unlocks : [],
  };
}

export function createPublicContentService(client) {
  async function getMapsBosses() {
    if (!client) return { data: null, error: null };
    const [mapsResult, bossesResult, requirementsResult] = await Promise.all([
      client.from('maps').select('*').eq('content_status', 'published'),
      client.from('bosses').select('*').eq('content_status', 'published'),
      client.from('boss_requirements').select('*').eq('content_status', 'published'),
    ]);
    const error = mapsResult.error || bossesResult.error || requirementsResult.error;
    if (error) return { data: null, error };

    const requirements = new Map();
    (requirementsResult.data || []).forEach((row) => {
      if (!requirements.has(row.boss_id)) requirements.set(row.boss_id, {});
      requirements.get(row.boss_id)[row.difficulty] = normalizeRequirement(row);
    });
    const bosses = new Map();
    (bossesResult.data || []).forEach((row) => {
      if (!bosses.has(row.map_id)) bosses.set(row.map_id, []);
      bosses.get(row.map_id).push({
        ...row,
        name: localized(row, 'name'),
        description: localized(row, 'description'),
        requirements: requirements.get(row.id) || {},
      });
    });
    bosses.forEach((items) => items.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));

    return {
      data: (mapsResult.data || []).map((row) => ({
        ...row,
        game: row.game_availability,
        name: localized(row, 'name'),
        description: localized(row, 'description'),
        bosses: bosses.get(row.id) || [],
      })),
      error: null,
    };
  }

  async function getIniPresets() {
    if (!client) return { data: null, error: null };
    const { data, error } = await client.from('ini_presets').select('*').eq('content_status', 'published').order('updated_at', { ascending: false });
    if (error) return { data: null, error };
    return {
      data: data.map((row) => ({
        ...row,
        game: row.game_availability,
        title: localized(row, 'title'),
        description: localized(row, 'description'),
        risk: localized(row, 'risk'),
        rollback: localized(row, 'rollback'),
      })),
      error: null,
    };
  }

  return { getMapsBosses, getIniPresets };
}
