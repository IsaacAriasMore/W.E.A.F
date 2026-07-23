import { iniPresets as fallbackPresets } from '../../data/publicData.js';
import { createPublicContentService } from '../../services/publicContentService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { getLanguage, t } from '../../i18n/index.js';
import { OFFICIAL_DISCORD, SUPPORT_EMAIL } from '../../config/contact.js';

const mainCategories = ['all', 'general', 'pvp', 'farming', 'breeding', 'visibility'];
const advancedCategories = ['fps', 'clean', 'server', 'client'];
const categoryLabel = (category) => t(`inis.categories.${category}`);
const supportsGame = (preset, game) => ['both', game].includes(preset.game_availability || preset.game);
const copy = (row, field) => row?.[`${field}_${getLanguage()}`] || row?.[`${field}_es`] || row?.[`${field}_en`] || row?.[field] || '';

export function iniFilename(preset) {
  const stem = String(preset.slug || preset.id || 'preset').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `weaf-${stem}.ini`;
}

export function iniDownloadText(preset) {
  return String(preset?.content || '').replace(/\r?\n/g, '\r\n');
}

function verificationLabel(status) {
  return t(`inis.status.${['verified', 'pending', 'experimental'].includes(status) ? status : 'pending'}`);
}

function presetCard(preset) {
  const game = preset.game_availability || preset.game;
  return `<article class="ini-card premium-card-glow" data-preset-card="${escapeHtml(preset.id)}">
    <div class="ini-card-top"><span class="game-label">${game === 'both' ? 'ASE + ASA' : game === 'evolved' ? 'ASE' : 'ASA'}</span><span>${escapeHtml(preset.file_target || 'Engine.ini')}</span></div>
    <div><div class="ini-card-badges"><span>${categoryLabel(preset.category)}</span><span data-status="${escapeHtml(preset.verification_status || 'pending')}">${verificationLabel(preset.verification_status)}</span></div><h2>${escapeHtml(preset.title)}</h2><p>${escapeHtml(preset.description || copy(preset, 'description'))}</p></div>
    <pre aria-label="${escapeHtml(t('inis.preview', { title: preset.title }))}"><code>${escapeHtml(preset.content.split('\n').slice(0, 4).join('\n'))}</code></pre>
    <dl class="ini-metadata"><div><dt>${t('inis.fileTarget')}</dt><dd>${escapeHtml(preset.file_target || 'Engine.ini')}</dd></div><div><dt>${t('inis.reviewed')}</dt><dd>${escapeHtml(preset.reviewed_at?.slice(0, 10) || t('inis.pendingDate'))}</dd></div></dl>
    <div class="ini-actions"><button class="button button-primary button-small" type="button" data-copy="${escapeHtml(preset.id)}">${t('inis.copy')}</button><button class="button button-quiet button-small" type="button" data-view="${escapeHtml(preset.id)}">${t('inis.view')}</button><button class="text-button" type="button" data-download="${escapeHtml(preset.id)}">${t('inis.download')}</button></div>
  </article>`;
}

function filterControls(state) {
  return `<div class="ini-control-row">
    <div class="game-switch ini-game-switch" role="group" aria-label="${t('inis.chooseGame')}">
      <button type="button" data-ini-game="evolved" aria-pressed="${state.game === 'evolved'}">${t('bosses.evolved')}</button>
      <button type="button" data-ini-game="ascended" aria-pressed="${state.game === 'ascended'}">${t('bosses.ascended')}</button>
    </div>
    <div class="ini-category-controls">
      <div class="filter-bar" role="group" aria-label="${t('inis.filters')}">${mainCategories.map((value) => `<button class="filter-chip" type="button" data-category="${value}" aria-pressed="${state.category === value}">${categoryLabel(value)}</button>`).join('')}</div>
      <label class="ini-advanced-filter"><span>${t('inis.advanced')}</span><select data-advanced-category><option value="">${t('inis.moreCategories')}</option>${advancedCategories.map((value) => `<option value="${value}" ${state.category === value ? 'selected' : ''}>${categoryLabel(value)}</option>`).join('')}</select></label>
    </div>
  </div>`;
}

function filteredPresets(state) {
  return state.presets.filter((preset) => supportsGame(preset, state.game) && (state.category === 'all' || preset.category === state.category));
}

function library(state) {
  const presets = filteredPresets(state);
  return `<p class="results-summary" data-results-summary>${t(presets.length === 1 ? 'inis.one' : 'inis.many', { count: presets.length })}</p><div class="ini-grid" data-ini-grid>${presets.length ? presets.map(presetCard).join('') : `<div class="ini-empty"><h2>${t('inis.empty')}</h2><p>${t('inis.emptyBody')}</p></div>`}</div>`;
}

export function render() {
  const state = { game: 'evolved', category: 'all' };
  return `<section class="page-hero compact-page-hero container reveal-up"><p class="section-kicker">${t('inis.eyebrow')}</p><h1>${t('inis.title')}</h1><p>${t('inis.body')}</p></section>
    <section class="tool-page ini-tool container" aria-label="${t('inis.aria')}">
      <aside class="ini-safety"><strong>${t('inis.warningTitle')}</strong><p>${t('inis.warningBody')}</p></aside>
      <div data-ini-controls>${filterControls(state)}</div>
      <div class="tool-layout"><div><div data-ini-library></div><aside class="ini-contribution premium-panel-glow"><div><strong>${t('inis.contributeTitle')}</strong><p>${t('inis.contributeBody')}</p><address><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><span>${OFFICIAL_DISCORD}</span></address><small>${t('inis.reviewNotice')}</small></div><div><button class="button button-secondary button-small" type="button" data-copy-contact="${SUPPORT_EMAIL}">${t('inis.copyEmail')}</button><button class="button button-quiet button-small" type="button" data-copy-contact="${OFFICIAL_DISCORD}">${t('inis.copyDiscord')}</button></div></aside></div>${createSponsoredServerSlot('inis_sidebar', { label: t('ads.plusServer'), variant: 'sidebar' })}</div>
    </section>
    <dialog class="content-dialog ini-dialog" data-ini-dialog aria-labelledby="ini-dialog-title">
      <div class="dialog-header"><div><span data-dialog-category></span><h2 id="ini-dialog-title" data-dialog-title></h2></div><button class="dialog-close" type="button" data-dialog-close aria-label="${t('inis.close')}">×</button></div>
      <p data-dialog-description></p>
      <dl class="ini-dialog-meta"><div><dt>${t('inis.fileTarget')}</dt><dd data-dialog-file></dd></div><div><dt>${t('inis.statusLabel')}</dt><dd data-dialog-status></dd></div></dl>
      <pre><code data-dialog-content></code></pre>
      <div class="ini-risk-grid"><section><h3>${t('inis.risk')}</h3><p data-dialog-risk></p></section><section><h3>${t('inis.rollback')}</h3><p data-dialog-rollback></p></section></div>
      <a data-dialog-source target="_blank" rel="noreferrer"></a>
      <div class="dialog-actions"><button class="button button-primary" type="button" data-dialog-copy>${t('inis.copyDialog')}</button><button class="button button-secondary" type="button" data-dialog-download>${t('inis.download')}</button></div>
    </dialog>`;
}

async function copyText(content) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(content);
  const field = document.createElement('textarea');
  field.value = content; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select();
  document.execCommand('copy'); field.remove();
}

function downloadPreset(preset) {
  const url = URL.createObjectURL(new Blob([iniDownloadText(preset)], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = iniFilename(preset); link.click(); URL.revokeObjectURL(url);
}

export function bind({ authService }) {
  const controller = new AbortController();
  const { signal } = controller;
  const controls = document.querySelector('[data-ini-controls]');
  const libraryRoot = document.querySelector('[data-ini-library]');
  const dialog = document.querySelector('[data-ini-dialog]');
  const state = { presets: fallbackPresets, game: 'evolved', category: 'all' };
  let activePreset = null;

  const draw = () => { controls.innerHTML = filterControls(state); libraryRoot.innerHTML = library(state); };
  const findPreset = (id) => state.presets.find((preset) => preset.id === id);
  const copyPreset = async (preset) => {
    try { await copyText(preset.content); showToast(t('inis.copied')); } catch { showToast(t('inis.copyError'), 'error'); }
  };
  const download = (preset) => { downloadPreset(preset); showToast(t('inis.downloadReady')); };

  function openDialog(preset) {
    activePreset = preset;
    dialog.querySelector('[data-dialog-title]').textContent = preset.title;
    dialog.querySelector('[data-dialog-category]').textContent = `${categoryLabel(preset.category)} · ${(preset.game_availability || preset.game) === 'both' ? 'ASE + ASA' : (preset.game_availability || preset.game) === 'evolved' ? 'ASE' : 'ASA'}`;
    dialog.querySelector('[data-dialog-description]').textContent = preset.description || copy(preset, 'description');
    dialog.querySelector('[data-dialog-file]').textContent = preset.file_target || 'Engine.ini';
    dialog.querySelector('[data-dialog-status]').textContent = verificationLabel(preset.verification_status);
    dialog.querySelector('[data-dialog-content]').textContent = preset.content;
    dialog.querySelector('[data-dialog-risk]').textContent = preset.risk || copy(preset, 'risk') || t('inis.riskFallback');
    dialog.querySelector('[data-dialog-rollback]').textContent = preset.rollback || copy(preset, 'rollback') || t('inis.rollbackFallback');
    const source = dialog.querySelector('[data-dialog-source]');
    source.textContent = preset.source_name ? `${t('bosses.source')}: ${preset.source_name}` : '';
    source.href = preset.source_url || '#'; source.hidden = !preset.source_url;
    dialog.showModal();
  }

  controls.addEventListener('click', (event) => {
    const game = event.target.closest('[data-ini-game]')?.dataset.iniGame;
    if (game) { state.game = game; state.category = 'all'; draw(); return; }
    const category = event.target.closest('[data-category]')?.dataset.category;
    if (category) { state.category = category; draw(); }
  }, { signal });

  controls.addEventListener('change', (event) => {
    const category = event.target.closest('[data-advanced-category]')?.value;
    if (category) { state.category = category; draw(); }
  }, { signal });

  document.querySelector('.ini-tool')?.addEventListener('click', async (event) => {
    const value = event.target.closest('[data-copy-contact]')?.dataset.copyContact;
    if (!value) return;
    try { await copyText(value); showToast(t('inis.contactCopied')); } catch { showToast(t('inis.copyError'), 'error'); }
  }, { signal });

  libraryRoot.addEventListener('click', (event) => {
    const action = event.target.closest('[data-copy], [data-download], [data-view]');
    if (!action) return;
    const preset = findPreset(action.dataset.copy || action.dataset.download || action.dataset.view);
    if (!preset) return;
    if (action.dataset.copy) copyPreset(preset);
    if (action.dataset.download) download(preset);
    if (action.dataset.view) openDialog(preset);
  }, { signal });

  dialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog.close(), { signal });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }, { signal });
  dialog.querySelector('[data-dialog-copy]')?.addEventListener('click', () => activePreset && copyPreset(activePreset), { signal });
  dialog.querySelector('[data-dialog-download]')?.addEventListener('click', () => activePreset && download(activePreset), { signal });

  draw();
  createPublicContentService(authService.getClient()).getIniPresets().then(({ data }) => {
    if (data?.length) { state.presets = data; draw(); }
  });

  return () => { controller.abort(); if (dialog.open) dialog.close(); };
}
