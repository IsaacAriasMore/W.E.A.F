import { createServerService } from '../../services/serverService.js';
import { escapeHtml } from '../../utils/sanitize.js';

const fallbackPlans = [
  { code: 'normal', name: 'Normal', price_usd_cents: 300, features: ['Ficha completa', 'Edición mientras esté activo', 'Analítica de clics'] },
  { code: 'plus', name: 'Plus', price_usd_cents: 700, features: ['Todo lo de Normal', 'Posición destacada', 'Insignia de destacado'] },
];

function plansMarkup(plans) {
  return plans.map((plan) => `<article class="owner-plan ${plan.code === 'plus' ? 'is-plus' : ''}"><div><span>${plan.code === 'plus' ? 'Mayor visibilidad' : 'Base esencial'}</span><h2>${escapeHtml(plan.name)}</h2><p>${plan.code === 'plus' ? 'Pensado para temporadas, wipes y lanzamientos.' : 'Presencia clara y estable en el directorio.'}</p></div><strong>$${(plan.price_usd_cents / 100).toFixed(0)}<small> USD / mes</small></strong><ul>${(plan.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul><a class="button ${plan.code === 'plus' ? 'button-primary' : 'button-secondary'}" href="/servers/publish?plan=${plan.code}" data-link>Elegir ${escapeHtml(plan.name)}</a></article>`).join('');
}

export function render() {
  return `<section class="owners-hero container"><a href="/servers" data-link>← Volver al directorio</a><div><p>Para dueños de servidores</p><h1>Publica primero. Administra sin fricción.</h1><span>El pago activa un mes de publicación; podrás completar y editar la ficha mientras el plan esté vigente.</span></div></section><section class="owner-plans container" data-owner-plans>${plansMarkup(fallbackPlans)}</section><section class="owner-process container"><h2>Un flujo corto y transparente.</h2><ol><li><span>01</span><div><strong>Elige el alcance</strong><p>Normal para presencia estable; Plus para destacar.</p></div></li><li><span>02</span><div><strong>Confirma el pago</strong><p>Stripe procesa la suscripción fuera de W.E.A.F.</p></div></li><li><span>03</span><div><strong>Completa la ficha</strong><p>Mapas, rates, mods, enlaces y banner desde tu cuenta.</p></div></li></ol><p class="owner-policy">Las publicaciones deben cumplir la <a href="/server-listing-policy" data-link>política de servidores</a>. El equipo puede pausar contenido engañoso o inseguro.</p></section>`;
}

export function bind({ authService }) {
  createServerService(authService.getClient()).listPlans().then(({ data }) => {
    const plans = data.filter((plan) => plan.is_active);
    if (plans.length) document.querySelector('[data-owner-plans]').innerHTML = plansMarkup(plans);
  });
}
