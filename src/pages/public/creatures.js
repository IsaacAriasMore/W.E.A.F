import { creatures } from '../../data/publicData.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';
import { getLanguage, t } from '../../i18n/index.js';

function unique(field) {
  return [...new Set(creatures.map((creature) => creature[field]))].sort();
}

function optionList(values) {
  return values.map((value) => `<option value="${value}">${value}</option>`).join('');
}

function creatureCard(creature) {
  const index = creatures.findIndex((item) => item.id === creature.id);
  const gameLabel = creature.game === 'both' ? 'ASE + ASA' : creature.game.toUpperCase();
  return `
    <article class="creature-card cinematic-card reveal-up">
      <div class="creature-image creature-cell-${index}" role="img" aria-label="${t('creatures.image', { name: creature.name })}"></div>
      <div class="creature-card-body">
        <div class="creature-title">
          <div><span>${gameLabel}</span><h2>${creature.name}</h2></div>
          <span class="use-tag">${creature.use}</span>
        </div>
        <p>${creature.note}</p>
        <dl>
          <div><dt>${t('creatures.type')}</dt><dd>${creature.type}</dd></div>
          <div><dt>${t('creatures.map')}</dt><dd>${creature.map}</dd></div>
          <div><dt>${t('creatures.cooldown')}</dt><dd>${creature.cooldown}</dd></div>
        </dl>
      </div>
    </article>
  `;
}

export function render() {
  return `
    <section class="page-hero creature-page-hero container reveal-up">
      <div>
        <p class="section-kicker">${t('creatures.eyebrow')}</p>
        <h1>${t('creatures.title')}</h1>
        <p>${t('creatures.body')}</p>
      </div>
      <div class="creature-count"><strong>${creatures.length}</strong><span>${t('creatures.cards')}</span></div>
    </section>

    <section class="creature-library container">
      <div class="creature-filter-layout">
        <details class="filter-drawer" open>
          <summary>${t('creatures.filters')}</summary>
          <form class="creature-filters" data-creature-filters>
          <label class="search-field">
            <span>${t('creatures.search')}</span>
            <input type="search" name="search" placeholder="${t('creatures.searchExample')}" autocomplete="off" />
          </label>
          <label>
            <span>${t('creatures.game')}</span>
            <select name="game">
              <option value="all">${t('common.all')}</option>
              <option value="evolved">ASE</option>
              <option value="ascended">ASA</option>
              <option value="both">${t('creatures.both')}</option>
            </select>
          </label>
          <label>
            <span>${t('creatures.type')}</span>
            <select name="type"><option value="all">${t('common.all')}</option>${optionList(unique('type'))}</select>
          </label>
          <label>
            <span>${t('creatures.map')}</span>
            <select name="map"><option value="all">${t('common.all')}</option>${optionList(unique('map'))}</select>
          </label>
          <label>
            <span>${t('creatures.use')}</span>
            <select name="use"><option value="all">${t('common.all')}</option>${optionList(unique('use'))}</select>
          </label>
          </form>
        </details>
        ${createSponsoredServerSlot('creatures_sidebar', { label: t('ads.plusServer'), variant: 'sidebar' })}
      </div>

      <div class="library-status">
        <p data-creature-summary>${t('creatures.many', { count: creatures.length })}</p>
        <p>${t('creatures.art')}</p>
      </div>
      <div class="creature-grid" data-creature-grid>${creatures.map(creatureCard).join('')}</div>
      <div class="empty-results" data-empty-results hidden>
        <h2>${t('creatures.emptyTitle')}</h2>
        <p>${t('creatures.emptyBody')}</p>
        <button class="button button-secondary" type="button" data-clear-filters>${t('creatures.clear')}</button>
      </div>
    </section>
  `;
}

export function bind() {
  const controller = new AbortController();
  const { signal } = controller;
  const form = document.querySelector('[data-creature-filters]');
  const grid = document.querySelector('[data-creature-grid]');
  const summary = document.querySelector('[data-creature-summary]');
  const empty = document.querySelector('[data-empty-results]');

  function applyFilters() {
    const values = Object.fromEntries(new FormData(form));
    const locale = getLanguage() === 'es' ? 'es' : 'en';
    const term = values.search.trim().toLocaleLowerCase(locale);
    const filtered = creatures.filter((creature) => {
      const matchesSearch = !term || creature.name.toLocaleLowerCase(locale).includes(term);
      const matchesGame = values.game === 'all'
        || creature.game === values.game
        || (values.game !== 'both' && creature.game === 'both');
      const matchesType = values.type === 'all' || creature.type === values.type;
      const matchesMap = values.map === 'all' || creature.map === values.map;
      const matchesUse = values.use === 'all' || creature.use === values.use;
      return matchesSearch && matchesGame && matchesType && matchesMap && matchesUse;
    });

    grid.innerHTML = filtered.map(creatureCard).join('');
    grid.hidden = filtered.length === 0;
    empty.hidden = filtered.length > 0;
    summary.textContent = t(filtered.length === 1 ? 'creatures.one' : 'creatures.many', { count: filtered.length });
  }

  form.addEventListener('input', applyFilters, { signal });
  form.addEventListener('change', applyFilters, { signal });
  document.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    form.reset();
    applyFilters();
    form.querySelector('input').focus();
  }, { signal });

  return () => controller.abort();
}
