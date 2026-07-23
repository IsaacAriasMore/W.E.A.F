import { mapBosses as fallbackMaps } from '../../data/publicData.js';
import { createPublicContentService } from '../../services/publicContentService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';
import {
  bossChecklistProgress,
  checklistItemKey,
  readBossChecklist,
  resetBossChecklist,
  setChecklistItem,
  writeBossChecklist,
} from '../../utils/bossChecklist.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { getLanguage, t } from '../../i18n/index.js';

const DIFFICULTIES = ['gamma', 'beta', 'alpha'];
const FALLBACK_IMAGE = '/assets/weaf-hero.webp';

const copy = (row, field) => row?.[`${field}_${getLanguage()}`] || row?.[`${field}_es`] || row?.[`${field}_en`] || row?.[field] || '';
const supportsGame = (row, game) => ['both', game].includes(row.game_availability || row.game);
const mapOrder = (map, game) => Number(map[`release_order_${game}`] ?? map.release_order ?? 999);

function imageUrl(value) {
  if (!value) return FALLBACK_IMAGE;
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function gameLabel(game) {
  return t(game === 'evolved' ? 'bosses.evolved' : 'bosses.ascended');
}

function statusBadge(map) {
  const key = ['story', 'official_mod', 'non_canonical', 'anniversary', 'premium'].includes(map.map_type) ? map.map_type : 'other';
  return `<span class="content-badge">${escapeHtml(t(`bosses.mapTypes.${key}`))}</span>`;
}

function mapSelector(maps, selectedSlug, game) {
  return maps.map((map) => {
    const bossCount = (map.bosses || []).filter((boss) => supportsGame(boss, game)).length;
    return `<button class="map-select-card" type="button" data-map-slug="${escapeHtml(map.slug)}" aria-pressed="${map.slug === selectedSlug}">
      <span class="map-select-index">${String(mapOrder(map, game)).padStart(2, '0')}</span>
      <span><strong>${escapeHtml(map.name)}</strong><small>${t('bosses.bossCount', { count: bossCount })}</small></span>
    </button>`;
  }).join('');
}

function requirementRows(items, context, type, checklist) {
  if (!items.length) return `<p class="requirements-empty">${t(type === 'artifacts' ? 'bosses.noArtifacts' : 'bosses.noTributes')}</p>`;
  return items.map((item) => {
    const key = checklistItemKey(context, type, item.id);
    const label = copy(item, 'name');
    return `<label class="requirement-row" data-checklist-item>
      <input type="checkbox" data-checklist-key="${escapeHtml(key)}" ${checklist[key] ? 'checked' : ''}>
      <span class="requirement-check" aria-hidden="true"></span>
      <span class="requirement-name">${escapeHtml(label)}</span>
      <strong aria-label="${t('bosses.quantity', { count: item.quantity })}">×${Number(item.quantity) || 1}</strong>
    </label>`;
  }).join('');
}

function bossCard(boss, map, game, difficulty, checklist) {
  const requirements = boss.requirements?.[difficulty];
  const context = { game, mapSlug: map.slug, bossSlug: boss.slug, difficulty };
  const progress = bossChecklistProgress(checklist, context, requirements);
  const source = requirements?.source_url || boss.source_url;
  const description = boss.description || copy(boss, 'description');

  return `<article class="boss-battle-card" data-boss-card="${escapeHtml(boss.slug)}">
    <div class="boss-portrait">
      <img src="${escapeHtml(imageUrl(boss.image_url))}" data-fallback-image="${FALLBACK_IMAGE}" alt="${escapeHtml(t('bosses.bossImageAlt', { boss: boss.name }))}" loading="lazy" width="1536" height="1024">
      <span>${escapeHtml(t(`bosses.bossTypes.${boss.boss_type || 'other'}`))}</span>
    </div>
    <div class="boss-briefing">
      <header class="boss-briefing-header">
        <div><h2>${escapeHtml(boss.name)}</h2><p>${escapeHtml(description)}</p></div>
        <button class="text-button" type="button" data-reset-boss="${escapeHtml(boss.slug)}" ${requirements ? '' : 'disabled'}>${t('bosses.reset')}</button>
      </header>
      ${requirements ? `
        <div class="boss-mission-meta">
          <span>${requirements.min_player_level ? t('bosses.minimumLevel', { level: requirements.min_player_level }) : t('bosses.noMinimumLevel')}</span>
          <span>${requirements.max_players ? t('bosses.maxPlayers', { count: requirements.max_players }) : ''}</span>
          <span>${requirements.reviewed_at ? t('bosses.reviewed', { date: requirements.reviewed_at.slice(0, 10) }) : t('bosses.pendingVerification')}</span>
        </div>
        <div class="boss-progress" data-checklist-progress aria-label="${t('bosses.progressPercent', { percent: progress.percent })}">
          <div><strong>${t('bosses.progress')}</strong><span>${progress.complete} / ${progress.total} · ${progress.percent}%</span></div>
          <div class="boss-progress-track"><span style="width:${progress.percent}%"></span></div>
        </div>
        <div class="requirements-columns">
          <section><h3>${t('bosses.artifacts')}</h3>${requirementRows(requirements.artifacts || [], context, 'artifacts', checklist)}</section>
          <section><h3>${t('bosses.tributes')}</h3>${requirementRows(requirements.tributes || [], context, 'tributes', checklist)}</section>
        </div>
        ${copy(requirements, 'notes') ? `<p class="boss-notes">${escapeHtml(copy(requirements, 'notes'))}</p>` : ''}
      ` : `<div class="boss-data-pending"><strong>${t('bosses.pendingVerification')}</strong><p>${t('bosses.pendingBossBody')}</p><a href="/report-content" data-link>${t('bosses.reportData')}</a></div>`}
      ${source ? `<a class="boss-source" href="${escapeHtml(source)}" target="_blank" rel="noreferrer">${t('bosses.source')}: ${escapeHtml(requirements?.source_name || boss.source_name || 'ARK Official Community Wiki')}</a>` : ''}
    </div>
  </article>`;
}

function workspace(state) {
  const maps = state.maps.filter((map) => supportsGame(map, state.game)).sort((a, b) => mapOrder(a, state.game) - mapOrder(b, state.game));
  const selectedMap = maps.find((map) => map.slug === state.mapSlug) || maps[0];
  if (!selectedMap) return `<div class="boss-empty-state"><h2>${t('bosses.noMaps')}</h2><p>${t('bosses.noMapsBody')}</p></div>`;
  state.mapSlug = selectedMap.slug;
  const bosses = (selectedMap.bosses || []).filter((boss) => supportsGame(boss, state.game));

  return `
    <div class="map-selector-head"><div><strong>${gameLabel(state.game)}</strong><span>${t('bosses.chooseMap')}</span></div><span>${t('bosses.mapCount', { count: maps.length })}</span></div>
    <div class="map-selector" data-map-selector>${mapSelector(maps, selectedMap.slug, state.game)}</div>
    <article class="selected-map-banner">
      <img src="${escapeHtml(imageUrl(selectedMap.image_url))}" data-fallback-image="${FALLBACK_IMAGE}" alt="${escapeHtml(t('bosses.mapImageAlt', { map: selectedMap.name }))}" loading="lazy" width="1536" height="1024">
      <div><div class="selected-map-badges">${statusBadge(selectedMap)}<span class="content-badge">${gameLabel(state.game)}</span>${selectedMap.is_canonical ? '<span class="content-badge">Canon</span>' : ''}</div><h2>${escapeHtml(selectedMap.name)}</h2><p>${escapeHtml(selectedMap.description || copy(selectedMap, 'description'))}</p><strong>${t('bosses.bossCount', { count: bosses.length })}</strong></div>
    </article>
    <div class="difficulty-switch" role="group" aria-label="${t('bosses.difficulty')}">
      ${DIFFICULTIES.map((value) => `<button type="button" data-difficulty="${value}" aria-pressed="${state.difficulty === value}">${t(`bosses.${value}`)}</button>`).join('')}
    </div>
    <div class="boss-list" data-boss-list>
      ${bosses.length ? bosses.map((boss) => bossCard(boss, selectedMap, state.game, state.difficulty, state.checklist)).join('') : `<div class="boss-empty-state"><h2>${t('bosses.pendingMap')}</h2><p>${t('bosses.pendingMapBody')}</p><a class="button button-secondary" href="/report-content" data-link>${t('bosses.reportData')}</a></div>`}
    </div>`;
}

export function render() {
  return `
    <section class="page-hero map-page-hero container reveal-up">
      <div><p class="section-kicker">${t('bosses.eyebrow')}</p><h1>${t('bosses.title')}</h1><p>${t('bosses.body')}</p></div>
      <p class="local-note"><strong>${t('bosses.local')}</strong><span>${t('bosses.localBody')}</span></p>
    </section>
    <section class="boss-command container">
      <div class="game-switch" role="group" aria-label="${t('bosses.chooseGame')}">
        <button type="button" data-game="evolved" aria-pressed="true"><span>ASE</span>${t('bosses.evolved')}</button>
        <button type="button" data-game="ascended" aria-pressed="false"><span>ASA</span>${t('bosses.ascended')}</button>
      </div>
      <div data-boss-workspace aria-live="polite"></div>
    </section>
    <div class="container sponsored-break">${createSponsoredServerSlot('maps_bosses_sidebar', { label: t('ads.communityPick'), variant: 'sidebar' })}</div>
    <section class="boss-callout container reveal-up"><div><h2>${t('bosses.callout')}</h2><p>${t('bosses.calloutBody')}</p></div><a class="button button-secondary" href="/creatures" data-link>${t('bosses.creatures')}</a></section>`;
}

export function bind({ authService }) {
  const controller = new AbortController();
  const { signal } = controller;
  const root = document.querySelector('[data-boss-workspace]');
  const command = document.querySelector('.boss-command');
  const state = { maps: fallbackMaps, game: 'evolved', mapSlug: 'the-island', difficulty: 'gamma', checklist: readBossChecklist() };

  const draw = () => {
    root.innerHTML = workspace(state);
    command.querySelectorAll('[data-game]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.game === state.game)));
  };

  const save = () => {
    try { writeBossChecklist(state.checklist); } catch { showToast(t('bosses.storageError'), 'error'); }
  };

  command.addEventListener('click', (event) => {
    const game = event.target.closest('[data-game]')?.dataset.game;
    if (game && game !== state.game) { state.game = game; state.mapSlug = ''; draw(); return; }
    const mapSlug = event.target.closest('[data-map-slug]')?.dataset.mapSlug;
    if (mapSlug && mapSlug !== state.mapSlug) { state.mapSlug = mapSlug; draw(); return; }
    const difficulty = event.target.closest('[data-difficulty]')?.dataset.difficulty;
    if (difficulty && difficulty !== state.difficulty) { state.difficulty = difficulty; draw(); return; }
    const bossSlug = event.target.closest('[data-reset-boss]')?.dataset.resetBoss;
    if (bossSlug) {
      state.checklist = resetBossChecklist(state.checklist, { game: state.game, mapSlug: state.mapSlug, bossSlug, difficulty: state.difficulty });
      save(); draw(); showToast(t('bosses.cleared'));
    }
  }, { signal });

  command.addEventListener('change', (event) => {
    const input = event.target.closest('[data-checklist-key]');
    if (!input) return;
    state.checklist = setChecklistItem(state.checklist, input.dataset.checklistKey, input.checked);
    save(); draw();
  }, { signal });

  command.addEventListener('error', (event) => {
    const image = event.target.closest('[data-fallback-image]');
    if (image && !image.src.endsWith(FALLBACK_IMAGE)) image.src = FALLBACK_IMAGE;
  }, { capture: true, signal });

  draw();
  createPublicContentService(authService.getClient()).getMapsBosses().then(({ data }) => {
    if (data?.length) { state.maps = data; draw(); }
  });

  return () => controller.abort();
}
