import { featuredServers } from '../../data/publicData.js';

export function render() {
  return `
    <section class="hero">
      <div class="hero-inner container">
        <div class="hero-copy">
          <p class="hero-kicker">Coordinación para tribus</p>
          <h1>Convierte el progreso en un plan compartido.</h1>
          <p>Herramientas públicas y un espacio privado para preparar, criar y avanzar juntos.</p>
          <div class="hero-actions">
            <button class="button button-primary" type="button" data-coming-soon="Crear tribu estará disponible en la Fase 2.">Crear tribu</button>
            <a class="button button-secondary" href="/inis" data-link>Explorar INIs</a>
          </div>
        </div>
        <figure class="hero-visual">
          <img src="/assets/weaf-hero.webp" width="1536" height="1024" alt="Criaturas prehistóricas recorren una meseta volcánica al amanecer" fetchpriority="high" />
          <figcaption>
            <span>ASE + ASA</span>
            <strong>Una base para cada forma de jugar.</strong>
          </figcaption>
        </figure>
      </div>
    </section>

    <section class="tool-intro section container" aria-labelledby="tools-title">
      <div class="section-heading compact-heading">
        <h2 id="tools-title">Consulta antes de entrar.</h2>
        <p>La parte pública resuelve tareas concretas sin pedir una cuenta.</p>
      </div>
      <div class="tool-rail">
        <a class="tool-link tool-link-featured" href="/inis" data-link>
          <span class="tool-index">INI</span>
          <strong>Configuraciones listas para copiar</strong>
          <p>Filtra por objetivo, revisa el contenido y descarga un archivo limpio.</p>
          <span class="text-link">Abrir biblioteca</span>
        </a>
        <a class="tool-link" href="/maps-bosses" data-link>
          <span class="tool-index">BOSS</span>
          <strong>Requisitos sin perder el hilo</strong>
          <p>Elige mapa y dificultad. Tu checklist queda guardado en el navegador.</p>
          <span class="text-link">Preparar batalla</span>
        </a>
        <a class="tool-link" href="/creatures" data-link>
          <span class="tool-index">DEX</span>
          <strong>Criaturas por juego y función</strong>
          <p>Encuentra líneas útiles para boss, movilidad, farmeo o PvP.</p>
          <span class="text-link">Explorar criaturas</span>
        </a>
      </div>
    </section>

    <section class="game-compare section">
      <div class="container compare-layout">
        <div class="section-heading">
          <h2>Dos juegos. Una lógica clara.</h2>
          <p>W.E.A.F conserva el contexto de cada versión y evita mezclar criaturas o tiempos incompatibles.</p>
          <button class="button button-secondary" type="button" data-coming-soon="El comparador detallado llegará después de consolidar los datos públicos.">Ver comparación completa</button>
        </div>
        <div class="compare-board" aria-label="Comparación general entre ASE y ASA">
          <div class="compare-column">
            <span>ASE</span>
            <strong>Catálogo establecido</strong>
            <p>Contenido amplio, rutas conocidas y configuraciones maduras.</p>
          </div>
          <div class="compare-shared">
            <span>Compartido</span>
            <ul>
              <li>Objetivos de stats</li>
              <li>Preparación de bosses</li>
              <li>Organización por tribu</li>
            </ul>
          </div>
          <div class="compare-column">
            <span>ASA</span>
            <strong>Ecosistema en expansión</strong>
            <p>Nuevas criaturas, rendimiento distinto y contenido en evolución.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="tribe-story section container">
      <div class="tribe-story-copy">
        <h2>Lo público ayuda. La tribu coordina.</h2>
        <p>Cuando llegue el espacio privado, cada miembro verá solo breeds, mutaciones y actividad de sus tribus. Sin feed global.</p>
        <button class="button button-primary" type="button" data-coming-soon="El onboarding de tribus estará disponible en la Fase 2.">Crear tribu</button>
      </div>
      <div class="privacy-ledger" aria-label="Principios del espacio privado">
        <div><strong>Privacidad por diseño</strong><span>Cada registro depende de <code>tribe_id</code> y RLS.</span></div>
        <div><strong>Roles sin confusión</strong><span>Owner, admin de tribu y admin global son permisos distintos.</span></div>
        <div><strong>Discord seguro</strong><span>Las alertas salen desde Edge Functions, nunca desde el navegador.</span></div>
      </div>
    </section>

    <section class="server-owner section">
      <div class="container server-owner-layout">
        <div>
          <h2>Tu servidor frente a la comunidad correcta.</h2>
          <p>Publicaciones discretas para dueños que buscan jugadores de ASE o ASA. Planes desde $3 al mes en la futura Fase 6.</p>
          <button class="button button-secondary" type="button" data-coming-soon="El marketplace de servidores se implementará en la Fase 6.">Conocer planes</button>
        </div>
        <div class="server-preview-list" aria-label="Ejemplos de servidores destacados">
          ${featuredServers.map((server) => `
            <article class="server-preview">
              <div>
                <span>${server.tag}</span>
                <h3>${server.name}</h3>
              </div>
              <dl>
                <div><dt>Juego</dt><dd>${server.game}</dd></div>
                <div><dt>Modo</dt><dd>${server.type}</dd></div>
                <div><dt>Región</dt><dd>${server.region}</dd></div>
                <div><dt>Rates</dt><dd>${server.rate}</dd></div>
              </dl>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="final-cta section container">
      <div>
        <h2>Empieza con una herramienta.</h2>
        <p>No necesitas iniciar sesión para preparar tu siguiente sesión.</p>
      </div>
      <div>
        <a class="button button-primary" href="/maps-bosses" data-link>Preparar un boss</a>
        <a class="button button-quiet" href="/creatures" data-link>Buscar criatura</a>
      </div>
    </section>
  `;
}
