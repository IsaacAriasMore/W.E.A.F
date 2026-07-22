import { iniPresets } from '../../data/publicData.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { t } from '../../i18n/index.js';

const categories = [
  'all', 'farming', 'pvp', 'hard', 'fps', 'visibility', 'clean',
];

const categoryLabel = (category) => t(`inis.${category}`);

function presetCard(preset) {
  return `
    <article class="ini-card cinematic-card reveal-up" data-preset-card="${preset.id}">
      <div class="ini-card-top">
        <span class="game-label">${preset.game === 'both' ? 'ASE + ASA' : preset.game.toUpperCase()}</span>
        <span>${categoryLabel(preset.category)}</span>
      </div>
      <div>
        <h2>${preset.title}</h2>
        <p>${preset.description}</p>
      </div>
      <pre aria-label="${t('inis.preview', { title: preset.title })}"><code>${escapeHtml(preset.content.split('\n').slice(0, 3).join('\n'))}</code></pre>
      <div class="ini-actions">
        <button class="button button-primary button-small" type="button" data-copy="${preset.id}">${t('inis.copy')}</button>
        <button class="button button-quiet button-small" type="button" data-view="${preset.id}">${t('inis.view')}</button>
        <button class="text-button" type="button" data-download="${preset.id}">${t('inis.download')}</button>
      </div>
    </article>
  `;
}

export function render() {
  return `
    <section class="page-hero compact-page-hero container reveal-up">
      <p class="section-kicker">${t('inis.eyebrow')}</p>
      <h1>${t('inis.title')}</h1>
      <p>${t('inis.body')}</p>
    </section>
    <section class="tool-page container" aria-label="${t('inis.aria')}">
      <div class="filter-bar" role="group" aria-label="${t('inis.filters')}">
        ${categories.map((value, index) => `
          <button class="filter-chip" type="button" data-category="${value}" aria-pressed="${index === 0}">${categoryLabel(value)}</button>
        `).join('')}
      </div>
      <div class="tool-layout">
        <div>
          <p class="results-summary" data-results-summary>${t('inis.many', { count: iniPresets.length })}</p>
          <div class="ini-grid" data-ini-grid>
            ${iniPresets.map(presetCard).join('')}
          </div>
        </div>
        ${createSponsoredServerSlot('inis_sidebar', { label: t('ads.plusServer'), variant: 'sidebar' })}
      </div>
    </section>

    <dialog class="content-dialog" data-ini-dialog aria-labelledby="ini-dialog-title">
      <div class="dialog-header">
        <div>
          <span data-dialog-category></span>
          <h2 id="ini-dialog-title" data-dialog-title></h2>
        </div>
        <button class="dialog-close" type="button" data-dialog-close aria-label="${t('inis.close')}">×</button>
      </div>
      <p data-dialog-description></p>
      <pre><code data-dialog-content></code></pre>
      <div class="dialog-actions">
        <button class="button button-primary" type="button" data-dialog-copy>${t('inis.copyDialog')}</button>
        <button class="button button-secondary" type="button" data-dialog-download>${t('inis.download')}</button>
      </div>
    </dialog>
  `;
}

async function copyText(content) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const field = document.createElement('textarea');
  field.value = content;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}

function downloadPreset(preset) {
  const blob = new Blob([preset.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `weaf-${preset.id}.ini`;
  link.click();
  URL.revokeObjectURL(url);
}

export function bind() {
  const controller = new AbortController();
  const { signal } = controller;
  const grid = document.querySelector('[data-ini-grid]');
  const summary = document.querySelector('[data-results-summary]');
  const dialog = document.querySelector('[data-ini-dialog]');
  let activePreset = null;

  function findPreset(id) {
    return iniPresets.find((preset) => preset.id === id);
  }

  async function copyPreset(preset) {
    try {
      await copyText(preset.content);
      showToast(t('inis.copied'));
    } catch {
      showToast(t('inis.copyError'), 'error');
    }
  }

  function download(preset) {
    downloadPreset(preset);
    showToast(t('inis.downloadReady'));
  }

  function openDialog(preset) {
    activePreset = preset;
    dialog.querySelector('[data-dialog-title]').textContent = preset.title;
    dialog.querySelector('[data-dialog-category]').textContent = `${categoryLabel(preset.category)} / ${preset.game === 'both' ? 'ASE + ASA' : preset.game.toUpperCase()}`;
    dialog.querySelector('[data-dialog-description]').textContent = preset.description;
    dialog.querySelector('[data-dialog-content]').textContent = preset.content;
    dialog.showModal();
  }

  document.querySelector('.filter-bar')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    const category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip === button)));
    const filtered = category === 'all' ? iniPresets : iniPresets.filter((preset) => preset.category === category);
    grid.innerHTML = filtered.map(presetCard).join('');
    summary.textContent = t(filtered.length === 1 ? 'inis.one' : 'inis.many', { count: filtered.length });
  }, { signal });

  grid?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-copy], [data-download], [data-view]');
    if (!action) return;
    const id = action.dataset.copy || action.dataset.download || action.dataset.view;
    const preset = findPreset(id);
    if (action.dataset.copy) copyPreset(preset);
    if (action.dataset.download) download(preset);
    if (action.dataset.view) openDialog(preset);
  }, { signal });

  dialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog.close(), { signal });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  }, { signal });
  dialog.querySelector('[data-dialog-copy]')?.addEventListener('click', () => copyPreset(activePreset), { signal });
  dialog.querySelector('[data-dialog-download]')?.addEventListener('click', () => download(activePreset), { signal });

  return () => {
    controller.abort();
    if (dialog.open) dialog.close();
  };
}
