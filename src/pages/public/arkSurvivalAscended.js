import { getLanguage } from '../../i18n/index.js';

const copy = {
  es: {
    eyebrow: 'Centro de herramientas ASA',
    title: 'Herramientas para ARK: Survival Ascended.',
    intro: 'W.E.A.F reúne consultas públicas y coordinación privada para que una tribu pueda preparar servidores, criaturas y progresión desde un mismo lugar.',
    publicTitle: 'Consulta antes de entrar al servidor',
    privateTitle: 'Coordina sin exponer a tu tribu',
    privateBody: 'Las cuentas pueden organizar breeding, mutaciones y responsabilidades dentro de espacios protegidos por membresía. Esa información no forma parte del catálogo público.',
    cta: 'Explorar herramientas públicas',
    account: 'Crear mi espacio de tribu',
    notice: 'W.E.A.F es un proyecto comunitario independiente y no está afiliado ni respaldado oficialmente por Studio Wildcard.',
    tools: [
      ['/inis', 'Configuraciones INI', 'Revisa ajustes documentados antes de copiarlos a tu servidor.'],
      ['/maps-bosses', 'Mapas y requisitos de bosses', 'Organiza dificultades, tributos y progreso por mapa.'],
      ['/creatures', 'Criaturas por mapa y función', 'Filtra especies útiles para breeding y tareas de tribu.'],
      ['/servers', 'Servidores comunitarios', 'Busca opciones por plataforma, región, modalidad y rates.'],
      ['/marketplace', 'Marketplace de recursos ASA', 'Publica o encuentra intercambios comunitarios con contacto directo.'],
    ],
  },
  en: {
    eyebrow: 'ASA tools hub',
    title: 'Tools for ARK: Survival Ascended.',
    intro: 'W.E.A.F brings public references and private coordination together so tribes can prepare servers, creatures, and progression in one place.',
    publicTitle: 'Check the essentials before joining a server',
    privateTitle: 'Coordinate without exposing your tribe',
    privateBody: 'Accounts can organize breeding, mutations, and responsibilities inside membership-protected spaces. That information never becomes part of the public catalog.',
    cta: 'Explore public tools',
    account: 'Create my tribe workspace',
    notice: 'W.E.A.F is an independent community project and is not affiliated with or officially endorsed by Studio Wildcard.',
    tools: [
      ['/inis', 'INI configurations', 'Review documented settings before copying them to your server.'],
      ['/maps-bosses', 'Maps and boss requirements', 'Organize difficulties, tributes, and progression by map.'],
      ['/creatures', 'Creatures by map and role', 'Filter species useful for breeding and tribe tasks.'],
      ['/servers', 'Community servers', 'Search by platform, region, game mode, and rates.'],
      ['/marketplace', 'ASA resource marketplace', 'Publish or find community trades with direct contact.'],
    ],
  },
};

export function render() {
  const text = copy[getLanguage()] || copy.es;
  return `<section class="asa-hub-hero">
    <div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/" data-link>${getLanguage() === 'es' ? 'Inicio' : 'Home'}</a><span aria-hidden="true">/</span><span>ARK: Survival Ascended</span></nav>
      <p class="hero-kicker">${text.eyebrow}</p>
      <h1>${text.title}</h1>
      <p>${text.intro}</p>
      <div><a class="button button-primary" href="#asa-tools">${text.cta}</a><a class="button button-secondary" href="/register" data-link>${text.account}</a></div>
    </div>
  </section>
  <section id="asa-tools" class="asa-hub-tools container" aria-labelledby="asa-tools-title">
    <header><h2 id="asa-tools-title">${text.publicTitle}</h2></header>
    <div>${text.tools.map(([href, title, body]) => `<a href="${href}" data-link><h3>${title}</h3><p>${body}</p><span aria-hidden="true">→</span></a>`).join('')}</div>
  </section>
  <section class="asa-hub-private container"><div><h2>${text.privateTitle}</h2><p>${text.privateBody}</p></div><a class="button button-primary" href="/register" data-link>${text.account}</a></section>
  <aside class="asa-hub-notice container"><p>${text.notice}</p><a href="/disclaimer" data-link>${getLanguage() === 'es' ? 'Aviso de independencia' : 'Independence notice'}</a></aside>`;
}
