import { creatures } from '../../data/publicData.js';
import { createSponsoredServerSlot } from '../../components/ads/SponsoredServerSlot.js';

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
    <article class="creature-card">
      <div class="creature-image creature-cell-${index}" role="img" aria-label="Ilustración original de ${creature.name}"></div>
      <div class="creature-card-body">
        <div class="creature-title">
          <div><span>${gameLabel}</span><h2>${creature.name}</h2></div>
          <span class="use-tag">${creature.use}</span>
        </div>
        <p>${creature.note}</p>
        <dl>
          <div><dt>Tipo</dt><dd>${creature.type}</dd></div>
          <div><dt>Mapa</dt><dd>${creature.map}</dd></div>
          <div><dt>Cooldown vanilla</dt><dd>${creature.cooldown}</dd></div>
        </dl>
      </div>
    </article>
  `;
}

export function render() {
  return `
    <section class="page-hero creature-page-hero container">
      <div>
        <p class="section-kicker">Biblioteca pública</p>
        <h1>Encuentra la criatura que encaja en el plan.</h1>
        <p>Filtra por juego, tipo, mapa o uso. Los tiempos mostrados son referencias vanilla de demostración.</p>
      </div>
      <div class="creature-count"><strong>${creatures.length}</strong><span>fichas iniciales</span></div>
    </section>

    <section class="creature-library container">
      <details class="filter-drawer" open>
        <summary>Filtros de biblioteca</summary>
        <form class="creature-filters" data-creature-filters>
          <label class="search-field">
            <span>Buscar criatura</span>
            <input type="search" name="search" placeholder="Ej. Rex" autocomplete="off" />
          </label>
          <label>
            <span>Juego</span>
            <select name="game">
              <option value="all">Todos</option>
              <option value="evolved">ASE</option>
              <option value="ascended">ASA</option>
              <option value="both">Ambos</option>
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select name="type"><option value="all">Todos</option>${optionList(unique('type'))}</select>
          </label>
          <label>
            <span>Mapa</span>
            <select name="map"><option value="all">Todos</option>${optionList(unique('map'))}</select>
          </label>
          <label>
            <span>Uso</span>
            <select name="use"><option value="all">Todos</option>${optionList(unique('use'))}</select>
          </label>
        </form>
      </details>

      <div class="library-status">
        <p data-creature-summary>${creatures.length} criaturas encontradas</p>
        <p>Arte conceptual original, no oficial.</p>
      </div>
      <div class="creature-grid" data-creature-grid>${creatures.map(creatureCard).join('')}</div>
      <div class="empty-results" data-empty-results hidden>
        <h2>No encontramos esa combinación.</h2>
        <p>Prueba otro juego, mapa o término de búsqueda.</p>
        <button class="button button-secondary" type="button" data-clear-filters>Limpiar filtros</button>
      </div>
      <div class="sponsored-break">${createSponsoredServerSlot('servers_featured', 'Comunidad destacada')}</div>
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
    const term = values.search.trim().toLocaleLowerCase('es');
    const filtered = creatures.filter((creature) => {
      const matchesSearch = !term || creature.name.toLocaleLowerCase('es').includes(term);
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
    summary.textContent = `${filtered.length} ${filtered.length === 1 ? 'criatura encontrada' : 'criaturas encontradas'}`;
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
