export function createFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-grid container">
        <div class="footer-brand">
          <a class="brand" href="/" data-link>
            <img src="/assets/weaf-mark.svg" width="42" height="42" alt="" />
            <span><strong>W.E.A.F</strong><small>Wild Evolution & Ascension Forge</small></span>
          </a>
          <p>Herramientas para preparar, criar y progresar con tu tribu.</p>
        </div>
        <div class="creator-card" aria-label="Información del creador">
          <div class="creator-avatar" aria-hidden="true">IA<span></span></div>
          <div>
            <strong>Isaac Arias</strong>
            <span>@whiskyzc_</span>
          </div>
          <span class="creator-badge">Creator</span>
        </div>
        <nav class="footer-links" aria-label="Enlaces legales">
          <a href="/terms" data-link>Términos</a>
          <a href="/privacy" data-link>Privacidad</a>
          <a href="/cookies" data-link>Cookies</a>
          <a href="/disclaimer" data-link>Disclaimer</a>
          <a href="/contact" data-link>Contacto</a>
        </nav>
      </div>
      <div class="footer-legal container">
        <p>W.E.A.F es una herramienta independiente de comunidad. No está afiliada, aprobada ni patrocinada por Studio Wildcard, Snail Games, ARK: Survival Evolved o ARK: Survival Ascended.</p>
        <span>© ${new Date().getFullYear()} W.E.A.F</span>
      </div>
    </footer>
  `;
}
