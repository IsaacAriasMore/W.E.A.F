import { mapBosses } from '../../data/publicData.js';
import { showToast } from '../../utils/feedback.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { t } from '../../i18n/index.js';

const STORAGE_KEY = 'weaf:boss-checklist:v1';

function bossOptions(map, selectedId) {
  return map.bosses.map((boss) => `<option value="${boss.id}" ${boss.id === selectedId ? 'selected' : ''}>${boss.name}</option>`).join('');
}

function readChecklist() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveChecklist(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    showToast(t('bosses.storageError'), 'error');
  }
}

export function render() {
  const initialMap = mapBosses[0];
  return `
    <section class="page-hero map-page-hero container reveal-up">
      <div>
        <p class="section-kicker">${t('bosses.eyebrow')}</p>
        <h1>${t('bosses.title')}</h1>
        <p>${t('bosses.body')}</p>
      </div>
      <p class="local-note"><strong>${t('bosses.local')}</strong><span>${t('bosses.localBody')}</span></p>
    </section>

    <section class="boss-tool container">
      <form class="boss-controls" aria-label="${t('bosses.encounter')}">
        <label>
          <span>${t('bosses.map')}</span>
          <select data-map-select>
            ${mapBosses.map((map) => `<option value="${map.id}">${map.name}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>${t('bosses.boss')}</span>
          <select data-boss-select>${bossOptions(initialMap, initialMap.bosses[0].id)}</select>
        </label>
        <label>
          <span>${t('bosses.difficulty')}</span>
          <select data-difficulty-select>
            <option value="gamma">Gamma</option>
            <option value="beta">Beta</option>
            <option value="alpha">Alpha</option>
          </select>
        </label>
      </form>

      <div class="boss-workspace">
        <article class="boss-summary cinematic-card reveal-left" data-boss-summary></article>
        <section class="checklist-panel cinematic-card reveal-right" aria-labelledby="checklist-title">
          <div class="checklist-header">
            <div>
              <span data-checklist-difficulty>Gamma</span>
              <h2 id="checklist-title">${t('bosses.requirements')}</h2>
            </div>
            <p data-checklist-progress aria-live="polite"></p>
          </div>
          <div class="checklist-items" data-checklist-items></div>
          <button class="text-button" type="button" data-reset-checklist>${t('bosses.clear')}</button>
        </section>
      </div>
    </section>

    <div class="container sponsored-break">${createSponsoredServerSlot('bosses_footer', 'Comunidad para tu próxima batalla')}</div>

    <section class="boss-callout container reveal-up">
      <div>
        <h2>${t('bosses.callout')}</h2>
        <p>${t('bosses.calloutBody')}</p>
      </div>
      <a class="button button-secondary" href="/creatures" data-link>${t('bosses.creatures')}</a>
    </section>
  `;
}

export function bind() {
  const controller = new AbortController();
  const { signal } = controller;
  const mapSelect = document.querySelector('[data-map-select]');
  const bossSelect = document.querySelector('[data-boss-select]');
  const difficultySelect = document.querySelector('[data-difficulty-select]');
  const summary = document.querySelector('[data-boss-summary]');
  const items = document.querySelector('[data-checklist-items]');
  const progress = document.querySelector('[data-checklist-progress]');
  const difficultyLabel = document.querySelector('[data-checklist-difficulty]');
  let checklist = readChecklist();

  function getSelection() {
    const map = mapBosses.find((item) => item.id === mapSelect.value) || mapBosses[0];
    const boss = map.bosses.find((item) => item.id === bossSelect.value) || map.bosses[0];
    const difficulty = difficultySelect.value;
    return { map, boss, difficulty };
  }

  function selectionKey({ map, boss, difficulty }) {
    return `${map.id}:${boss.id}:${difficulty}`;
  }

  function renderSelection() {
    const selection = getSelection();
    const required = selection.boss.requirements[selection.difficulty];
    const key = selectionKey(selection);
    const checked = new Set(checklist[key] || []);

    summary.innerHTML = `
      <div class="boss-art">
        <img src="/assets/weaf-hero.webp" width="1536" height="1024" alt="${t('bosses.imageAlt')}" loading="lazy" />
      </div>
      <div class="boss-summary-copy">
        <span>${selection.map.game === 'both' ? 'ASE + ASA' : selection.map.game.toUpperCase()}</span>
        <h2>${selection.boss.name}</h2>
        <p>${selection.map.description}</p>
        <strong>${t('bosses.preparation')}</strong>
        <p>${selection.boss.preparation}</p>
      </div>
    `;

    difficultyLabel.textContent = selection.difficulty[0].toUpperCase() + selection.difficulty.slice(1);
    items.innerHTML = required.map((requirement, index) => {
      const id = `${key}:${index}`;
      return `
        <label class="checklist-item">
          <input type="checkbox" value="${index}" ${checked.has(index) ? 'checked' : ''} />
          <span aria-hidden="true"></span>
          <strong>${requirement}</strong>
        </label>
      `;
    }).join('');

    updateProgress();
  }

  function updateProgress() {
    const total = items.querySelectorAll('input').length;
    const complete = items.querySelectorAll('input:checked').length;
    progress.textContent = t('bosses.progress', { complete, total });
  }

  mapSelect.addEventListener('change', () => {
    const map = mapBosses.find((item) => item.id === mapSelect.value) || mapBosses[0];
    bossSelect.innerHTML = bossOptions(map, map.bosses[0].id);
    renderSelection();
  }, { signal });
  bossSelect.addEventListener('change', renderSelection, { signal });
  difficultySelect.addEventListener('change', renderSelection, { signal });

  items.addEventListener('change', () => {
    const key = selectionKey(getSelection());
    checklist[key] = [...items.querySelectorAll('input:checked')].map((input) => Number(input.value));
    saveChecklist(checklist);
    updateProgress();
  }, { signal });

  document.querySelector('[data-reset-checklist]')?.addEventListener('click', () => {
    const key = selectionKey(getSelection());
    delete checklist[key];
    saveChecklist(checklist);
    renderSelection();
    showToast(t('bosses.cleared'));
  }, { signal });

  renderSelection();
  return () => controller.abort();
}
