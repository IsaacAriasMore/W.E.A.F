import { t } from '../../i18n/index.js';

export function createFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-grid container">
        <div class="footer-brand">
          <a class="brand" href="/" data-link>
            <img src="/assets/weaf-mark.svg" width="42" height="42" alt="" />
            <span><strong>W.E.A.F</strong><small>Wild Evolution & Ascension Forge</small></span>
          </a>
          <p data-i18n="footer.tagline">${t('footer.tagline')}</p>
        </div>
        <div class="creator-card" aria-label="Información del creador">
          <div class="creator-avatar" aria-hidden="true">IA<span></span></div>
          <div>
            <strong>Isaac Arias</strong>
            <span>@whiskyzc_</span>
          </div>
          <span class="creator-badge" data-i18n="footer.creator">${t('footer.creator')}</span>
        </div>
        <nav class="footer-links" aria-label="Enlaces legales">
          <a href="/terms" data-link data-i18n="footer.terms">${t('footer.terms')}</a>
          <a href="/privacy" data-link data-i18n="footer.privacy">${t('footer.privacy')}</a>
          <a href="/cookies" data-link data-i18n="footer.cookies">${t('footer.cookies')}</a>
          <a href="/disclaimer" data-link data-i18n="footer.disclaimer">${t('footer.disclaimer')}</a>
          <a href="/contact" data-link data-i18n="footer.contact">${t('footer.contact')}</a>
          <button type="button" data-open-consent data-i18n="footer.preferences">${t('footer.preferences')}</button>
          <button type="button" data-install-app hidden data-i18n="footer.install">${t('footer.install')}</button>
        </nav>
      </div>
      <div class="footer-legal container">
        <p data-i18n="footer.legal">${t('footer.legal')}</p>
        <span>© ${new Date().getFullYear()} W.E.A.F</span>
      </div>
    </footer>
  `;
}
