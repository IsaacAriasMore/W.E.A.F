import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { t } from '../../i18n/index.js';

const fallbackPlans = [
  { code: 'normal', name: 'Normal', price_usd_cents: 300 },
  { code: 'plus', name: 'Plus', price_usd_cents: 700 },
];

function plansMarkup(plans) {
  return plans.map((plan) => {
    const plus = plan.code === 'plus';
    const features = ['normal', 'plus'].includes(plan.code) ? t(`servers.owner.${plan.code}Features`).split('|') : (plan.features || []);
    return `<article class="owner-plan interactive-card ${plus ? 'is-plus' : ''}" data-gsap-item><div><span>${t(plus ? 'servers.owner.visibility' : 'servers.owner.essential')}</span><h2>${escapeHtml(plan.name)}</h2><p>${t(plus ? 'servers.owner.plusBody' : 'servers.owner.normalBody')}</p></div><strong>$${(plan.price_usd_cents / 100).toFixed(0)}<small> ${t('servers.owner.perMonth')}</small></strong><ul>${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul><a class="button ${plus ? 'button-primary' : 'button-secondary'}" href="/servers/publish?plan=${plan.code}" data-link>${t('servers.owner.choose', { plan: plan.name })}</a></article>`;
  }).join('');
}

export function render() {
  return `<div class="owners-fold"><section class="owners-hero container" data-gsap-hero><a href="/servers" data-link data-gsap-hero-item>← ${t('servers.owner.back')}</a><div data-gsap-hero-item><p>${t('servers.owner.eyebrow')}</p><h1>${t('servers.owner.title')}</h1><span>${t('servers.owner.body')}</span><a class="button button-secondary owners-plan-cue" href="#owner-plans" data-owner-plans-link>${t('servers.owner.viewPlans')} ↓</a></div></section><section id="owner-plans" class="owner-plans container" data-owner-plans data-gsap-stagger tabindex="-1" aria-label="${t('servers.owner.plansLabel')}">${plansMarkup(fallbackPlans)}</section></div><section class="owner-process container reveal-up"><h2>${t('servers.owner.processTitle')}</h2><ol><li><div><strong>${t('servers.owner.step1')}</strong><p>${t('servers.owner.step1Body')}</p></div></li><li><div><strong>${t('servers.owner.step2')}</strong><p>${t('servers.owner.step2Body')}</p></div></li><li><div><strong>${t('servers.owner.step3')}</strong><p>${t('servers.owner.step3Body')}</p></div></li></ol><p class="owner-policy">${t('servers.owner.policyBefore')} <a href="/server-listing-policy" data-link>${t('servers.owner.policyLink')}</a>. ${t('servers.owner.policyAfter')}</p></section>`;
}

export function bind({ authService }) {
  const plansSection = document.querySelector('#owner-plans');
  const scrollToPlans = (behavior = 'smooth') => {
    plansSection?.scrollIntoView({ behavior, block: 'start' });
    plansSection?.focus({ preventScroll: true });
  };

  document.querySelector('[data-owner-plans-link]')?.addEventListener('click', (event) => {
    event.preventDefault();
    if (window.location.hash !== '#owner-plans') window.history.pushState({}, '', '#owner-plans');
    scrollToPlans(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  });

  if (window.location.hash === '#owner-plans') {
    window.requestAnimationFrame(() => scrollToPlans('auto'));
  }

  createServerService(authService.getClient()).listPlans().then(({ data, error }) => {
    if (error || !plansSection?.isConnected || !Array.isArray(data)) return;
    const plans = data.filter((plan) => plan.is_active);
    if (!plans.length) return;
    plansSection.innerHTML = plansMarkup(plans);
    plansSection.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale')
      .forEach((element) => element.classList.add('reveal-visible'));
  }).catch(() => {
    // Keep the server-rendered fallback plans visible if Supabase is unavailable.
  });
}
