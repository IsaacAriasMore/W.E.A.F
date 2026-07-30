import { getLanguage, t } from '../i18n/index.js';

const SITE_URL = 'https://weaf.vercel.app';
const BRAND = 'W.E.A.F';
const OG_IMAGE = `${SITE_URL}/assets/wild-evolution-emblem.png`;

const publicMetadata = {
  '/': {
    es: ['W.E.A.F | Herramientas para tribus de ARK', 'Organiza breeding, mutaciones, bosses, INIs y servidores de ARK: Survival Evolved y Ascended con tu tribu.'],
    en: ['W.E.A.F | Tools for ARK tribes', 'Organize breeding, mutations, bosses, INIs, and ARK: Survival Evolved and Ascended servers with your tribe.'],
    schema: 'home',
  },
  '/inis': {
    es: ['INIs para ARK ASE y ASA | W.E.A.F', 'Explora configuraciones INI documentadas para ARK: Survival Evolved y Ascended, con notas de riesgo y reversión.'],
    en: ['ARK ASE and ASA INIs | W.E.A.F', 'Explore documented INI configurations for ARK: Survival Evolved and Ascended, including risk and rollback notes.'],
  },
  '/maps-bosses': {
    es: ['Mapas, bosses y requisitos de ARK | W.E.A.F', 'Consulta mapas de ASE y ASA, bosses por dificultad y requisitos de tributos para preparar cada combate.'],
    en: ['ARK maps, bosses, and requirements | W.E.A.F', 'Browse ASE and ASA maps, bosses by difficulty, and tribute requirements to prepare every encounter.'],
  },
  '/creatures': {
    es: ['Criaturas de ARK ASE y ASA | W.E.A.F', 'Filtra criaturas de ARK por juego, mapa y función para planificar breeding y progreso de tribu.'],
    en: ['ARK ASE and ASA creatures | W.E.A.F', 'Filter ARK creatures by game, map, and role to plan breeding and tribe progression.'],
  },
  '/servers': {
    es: ['Servidores ARK ASE y ASA | W.E.A.F', 'Encuentra servidores comunitarios de ARK por mapa, plataforma, región, rates y uso de mods.'],
    en: ['ARK ASE and ASA servers | W.E.A.F', 'Find community ARK servers by map, platform, region, rates, and mod support.'],
  },
  '/servers/owners': {
    es: ['Publica tu servidor ARK | W.E.A.F', 'Compara los planes Normal y Plus para publicar un servidor de ARK en el directorio de W.E.A.F.'],
    en: ['List your ARK server | W.E.A.F', 'Compare Normal and Plus plans to list an ARK server in the W.E.A.F directory.'],
  },
  '/marketplace': {
    es: ['Marketplace de recursos ASA | W.E.A.F', 'Compra, vende o intercambia recursos de ARK: Survival Ascended mediante anuncios comunitarios de siete días.'],
    en: ['ASA resource marketplace | W.E.A.F', 'Buy, sell, or trade ARK: Survival Ascended resources through seven-day community listings.'],
  },
  '/terms': { es: ['Términos de uso | W.E.A.F', 'Consulta los términos preliminares de uso de W.E.A.F.'], en: ['Terms of use | W.E.A.F', 'Read the preliminary W.E.A.F terms of use.'] },
  '/privacy': { es: ['Política de privacidad | W.E.A.F', 'Consulta cómo W.E.A.F trata datos personales y protege espacios privados.'], en: ['Privacy policy | W.E.A.F', 'Learn how W.E.A.F handles personal data and protects private spaces.'] },
  '/cookies': { es: ['Política de cookies | W.E.A.F', 'Revisa las preferencias y categorías de cookies utilizadas por W.E.A.F.'], en: ['Cookie policy | W.E.A.F', 'Review the cookie categories and preferences used by W.E.A.F.'] },
  '/disclaimer': { es: ['Aviso de independencia | W.E.A.F', 'W.E.A.F es una herramienta comunitaria independiente y no oficial de ARK.'], en: ['Independence disclaimer | W.E.A.F', 'W.E.A.F is an independent, unofficial community tool for ARK.'] },
  '/refund-policy': { es: ['Política de reembolsos | W.E.A.F', 'Consulta la política preliminar de reembolsos para servicios promocionales de W.E.A.F.'], en: ['Refund policy | W.E.A.F', 'Read the preliminary refund policy for W.E.A.F promotional services.'] },
  '/server-listing-policy': { es: ['Política de servidores | W.E.A.F', 'Reglas para publicar y mantener servidores comunitarios de ARK en W.E.A.F.'], en: ['Server listing policy | W.E.A.F', 'Rules for listing and maintaining community ARK servers on W.E.A.F.'] },
  '/report-content': { es: ['Reportar contenido | W.E.A.F', 'Informa contenido inseguro, engañoso o que incumple las reglas de W.E.A.F.'], en: ['Report content | W.E.A.F', 'Report unsafe, misleading content or content that breaks W.E.A.F rules.'] },
  '/contact': { es: ['Contacto y soporte | W.E.A.F', 'Contacta al equipo de W.E.A.F para soporte, reportes o consultas.'], en: ['Contact and support | W.E.A.F', 'Contact the W.E.A.F team for support, reports, or questions.'] },
};

const privatePaths = new Set([
  '/login', '/register', '/reset-password', '/onboarding', '/profile', '/admin',
  '/servers/publish', '/servers/success', '/servers/cancel', '/account/billing',
]);

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel, href, hreflang = null) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.append(element);
  }
  element.href = href;
  if (hreflang) element.hreflang = hreflang;
}

function structuredData(path, schema) {
  const graph = [];
  if (schema === 'home') {
    graph.push({
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: BRAND,
      url: `${SITE_URL}/`,
      logo: OG_IMAGE,
    }, {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: BRAND,
      url: `${SITE_URL}/`,
      inLanguage: getLanguage() === 'es' ? 'es' : 'en',
      publisher: { '@id': `${SITE_URL}/#organization` },
    }, {
      '@type': 'FAQPage',
      mainEntity: [1, 2, 3, 4, 5, 6].map((number) => ({
        '@type': 'Question',
        name: t(`home.faq.q${number}`),
        acceptedAnswer: { '@type': 'Answer', text: t(`home.faq.a${number}`) },
      })),
    });
  } else if (path !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: getLanguage() === 'es' ? 'Inicio' : 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: document.title.split('|')[0].trim(), item: `${SITE_URL}${path}` },
      ],
    });
  }
  return graph.length ? { '@context': 'https://schema.org', '@graph': graph } : null;
}

export function applyRouteMetadata(path, { notFound = false } = {}) {
  const language = getLanguage();
  const marketplaceDetail = /^\/marketplace\/[^/]+$/.test(path) && path !== '/marketplace/new';
  const metadata = publicMetadata[path] || (marketplaceDetail ? {
    es: ['Anuncio de recursos ARK | W.E.A.F', 'Consulta un anuncio activo del marketplace comunitario de recursos ARK de W.E.A.F.'],
    en: ['ARK resource listing | W.E.A.F', 'View an active listing in the W.E.A.F community ARK resource marketplace.'],
  } : null);
  const indexable = Boolean(metadata) && !notFound;
  const [title, description] = metadata?.[language] || [
    notFound ? (language === 'es' ? 'Página no encontrada | W.E.A.F' : 'Page not found | W.E.A.F') : document.title,
    language === 'es' ? 'Espacio privado de W.E.A.F.' : 'Private W.E.A.F workspace.',
  ];
  const canonical = `${SITE_URL}${metadata ? path : '/'}`;
  const robots = indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive';

  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:image', OG_IMAGE);
  upsertMeta('property', 'og:site_name', BRAND);
  upsertMeta('property', 'og:locale', language === 'es' ? 'es_CR' : 'en_US');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', OG_IMAGE);
  upsertLink('canonical', canonical);

  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((element) => element.remove());
  if (indexable) {
    upsertLink('alternate', `${canonical}?lang=es`, 'es');
    upsertLink('alternate', `${canonical}?lang=en`, 'en');
    upsertLink('alternate', canonical, 'x-default');
  }

  document.head.querySelector('[data-route-schema]')?.remove();
  const schema = structuredData(path, metadata?.schema);
  if (indexable && schema) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.routeSchema = '';
    script.textContent = JSON.stringify(schema).replaceAll('<', '\\u003c');
    document.head.append(script);
  }
}

export function applyMarketplaceListingMetadata(path, title, description) {
  const canonical = `${SITE_URL}${path}`;
  const pageTitle = `${String(title).slice(0, 72)} | W.E.A.F`;
  const pageDescription = String(description).replace(/\s+/g, ' ').slice(0, 155);
  document.title = pageTitle;
  upsertMeta('name', 'description', pageDescription);
  upsertMeta('property', 'og:title', pageTitle);
  upsertMeta('property', 'og:description', pageDescription);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('name', 'twitter:title', pageTitle);
  upsertMeta('name', 'twitter:description', pageDescription);
  upsertLink('canonical', canonical);
}

export function isPrivateSeoPath(path) {
  return privatePaths.has(path) || path.startsWith('/app/');
}
