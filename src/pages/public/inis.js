import { iniPresets } from '../../data/publicData.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { showToast } from '../../utils/feedback.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';

const categories = [
  ['all', 'Todas'],
  ['farming', 'Farmeo'],
  ['pvp', 'PvP'],
  ['hard', 'Hard'],
  ['fps', 'FPS Boost'],
  ['visibility', 'Visibilidad'],
  ['clean', 'Clean'],
];

function formatNumber(value) {
  return new Intl.NumberFormat('es').format(value);
}

function presetCard(preset) {
  return `
    <article class="ini-card" data-preset-card="${preset.id}">
      <div class="ini-card-top">
        <span class="game-label">${preset.game === 'both' ? 'ASE + ASA' : preset.game.toUpperCase()}</span>
        <span>${preset.categoryLabel}</span>
      </div>
      <div>
        <h2>${preset.title}</h2>
        <p>${preset.description}</p>
      </div>
      <pre aria-label="Vista previa de ${preset.title}"><code>${escapeHtml(preset.content.split('\n').slice(0, 3).join('\n'))}</code></pre>
      <div class="ini-stats" aria-label="Uso de este preset">
        <span><strong data-copy-count>${formatNumber(preset.copies)}</strong> copias</span>
        <span><strong data-download-count>${formatNumber(preset.downloads)}</strong> descargas</span>
      </div>
      <div class="ini-actions">
        <button class="button button-primary button-small" type="button" data-copy="${preset.id}">Copiar</button>
        <button class="button button-quiet button-small" type="button" data-view="${preset.id}">Ver INI</button>
        <button class="text-button" type="button" data-download="${preset.id}">Descargar</button>
      </div>
    </article>
  `;
}

export function render() {
  return `
    <section class="page-hero compact-page-hero container">
      <p class="section-kicker">Biblioteca pública</p>
      <h1>INIs que puedes revisar antes de copiar.</h1>
      <p>Presets de demostración para ASE y ASA. Comprueba cada valor y adáptalo a tu equipo.</p>
    </section>
    <section class="tool-page container" aria-label="Presets INI">
      <div class="filter-bar" role="group" aria-label="Filtrar por categoría">
        ${categories.map(([value, label], index) => `
          <button class="filter-chip" type="button" data-category="${value}" aria-pressed="${index === 0}">${label}</button>
        `).join('')}
      </div>
      <div class="tool-layout">
        <div>
          <p class="results-summary" data-results-summary>${iniPresets.length} presets disponibles</p>
          <div class="ini-grid" data-ini-grid>
            ${iniPresets.map(presetCard).join('')}
          </div>
        </div>
        ${createSponsoredServerSlot('inis_sidebar', 'Servidor Plus')}
      </div>
    </section>

    <dialog class="content-dialog" data-ini-dialog aria-labelledby="ini-dialog-title">
      <div class="dialog-header">
        <div>
          <span data-dialog-category></span>
          <h2 id="ini-dialog-title" data-dialog-title></h2>
        </div>
        <button class="dialog-close" type="button" data-dialog-close aria-label="Cerrar">×</button>
      </div>
      <p data-dialog-description></p>
      <pre><code data-dialog-content></code></pre>
      <div class="dialog-actions">
        <button class="button button-primary" type="button" data-dialog-copy>Copiar INI</button>
        <button class="button button-secondary" type="button" data-dialog-download>Descargar</button>
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
  const counters = new Map(iniPresets.map((preset) => [preset.id, { copies: preset.copies, downloads: preset.downloads }]));

  function findPreset(id) {
    return iniPresets.find((preset) => preset.id === id);
  }

  function updateCounter(id, kind) {
    const values = counters.get(id);
    values[kind] += 1;
    const card = grid.querySelector(`[data-preset-card="${id}"]`);
    const selector = kind === 'copies' ? '[data-copy-count]' : '[data-download-count]';
    card?.querySelector(selector)?.replaceChildren(document.createTextNode(formatNumber(values[kind])));
  }

  async function copyPreset(preset) {
    try {
      await copyText(preset.content);
      updateCounter(preset.id, 'copies');
      showToast('INI copiada al portapapeles.');
    } catch {
      showToast('No se pudo copiar. Selecciona el contenido manualmente.', 'error');
    }
  }

  function download(preset) {
    downloadPreset(preset);
    updateCounter(preset.id, 'downloads');
    showToast('Descarga preparada.');
  }

  function openDialog(preset) {
    activePreset = preset;
    dialog.querySelector('[data-dialog-title]').textContent = preset.title;
    dialog.querySelector('[data-dialog-category]').textContent = `${preset.categoryLabel} / ${preset.game === 'both' ? 'ASE + ASA' : preset.game.toUpperCase()}`;
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
    summary.textContent = `${filtered.length} ${filtered.length === 1 ? 'preset disponible' : 'presets disponibles'}`;
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
