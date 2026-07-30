export const siteUrl = 'https://weaf.vercel.app';

export const seoRoutes = [
  ['/', 'Herramientas para ARK: Survival Ascended | W.E.A.F', 'Organiza INIs, bosses, criaturas, servidores y progreso de tribu con las herramientas públicas y privadas de W.E.A.F.', 'Convierte el progreso en un plan compartido.', 'Herramientas públicas y coordinación privada para tribus de ARK.', ['/ark-survival-ascended', '/inis', '/maps-bosses', '/creatures', '/servers', '/marketplace']],
  ['/ark-survival-ascended', 'Herramientas y recursos para ARK: Survival Ascended | W.E.A.F', 'Explora configuraciones INI, mapas, bosses, criaturas, servidores y recursos para coordinar tu tribu de ARK: Survival Ascended.', 'Herramientas para ARK: Survival Ascended.', 'Consulta las herramientas reales de W.E.A.F y entra rápidamente a la que necesita tu tribu.', ['/inis', '/maps-bosses', '/creatures', '/servers', '/marketplace']],
  ['/inis', 'Configuraciones INI para ARK: Survival Ascended | W.E.A.F', 'Explora configuraciones INI documentadas para ARK con notas de uso, riesgo y reversión antes de aplicarlas.', 'INIs que puedes revisar antes de copiar.', 'Consulta configuraciones públicas, entiende su efecto y conserva una ruta de reversión.', ['/ark-survival-ascended', '/servers']],
  ['/maps-bosses', 'Mapas, bosses y tributos de ARK: Survival Ascended | W.E.A.F', 'Consulta mapas, bosses por dificultad y requisitos de tributos para preparar cada combate de ARK.', 'Mapas, bosses y cada tributo bajo control.', 'Organiza requisitos por mapa y dificultad antes de comenzar una preparación.', ['/ark-survival-ascended', '/creatures']],
  ['/creatures', 'Criaturas de ARK: Survival Ascended por mapa | W.E.A.F', 'Filtra criaturas de ARK por juego, mapa y función para planificar breeding y progreso de tribu.', 'Criaturas con una función dentro de tu tribu.', 'Encuentra especies por mapa y uso sin recorrer listados genéricos.', ['/ark-survival-ascended', '/maps-bosses']],
  ['/servers', 'Servidores de ARK: Survival Ascended en español | W.E.A.F', 'Encuentra servidores comunitarios de ARK por mapa, plataforma, región, modalidad, rates y uso de mods.', 'Encuentra un servidor con tus reglas.', 'Filtra el directorio comunitario y revisa la información publicada por cada propietario.', ['/ark-survival-ascended', '/servers/owners']],
  ['/servers/owners', 'Publica tu servidor de ARK | W.E.A.F', 'Compara las opciones para publicar un servidor comunitario de ARK en el directorio de W.E.A.F.', 'Haz visible tu servidor ante una comunidad que ya busca jugar.', 'Conoce el proceso, la duración y las condiciones antes de publicar.', ['/servers', '/server-listing-policy']],
  ['/marketplace', 'Marketplace de recursos ARK: Survival Ascended | W.E.A.F', 'Compra, vende o intercambia recursos de ARK: Survival Ascended mediante anuncios comunitarios y contacto directo.', 'Encuentra lo que tu tribu necesita.', 'Explora anuncios ASA activos con filtros y contacto directo entre jugadores.', ['/ark-survival-ascended', '/report-content']],
  ['/terms', 'Términos de uso | W.E.A.F', 'Consulta los términos preliminares de uso de W.E.A.F.'],
  ['/privacy', 'Política de privacidad | W.E.A.F', 'Consulta cómo W.E.A.F trata datos personales y protege espacios privados.'],
  ['/cookies', 'Política de cookies | W.E.A.F', 'Revisa las preferencias y categorías de cookies utilizadas por W.E.A.F.'],
  ['/disclaimer', 'Aviso de independencia | W.E.A.F', 'W.E.A.F es una herramienta comunitaria independiente y no oficial de ARK.'],
  ['/refund-policy', 'Política de reembolsos | W.E.A.F', 'Consulta la política preliminar de reembolsos de W.E.A.F.'],
  ['/server-listing-policy', 'Política de servidores | W.E.A.F', 'Reglas para publicar servidores comunitarios de ARK en W.E.A.F.'],
  ['/report-content', 'Reportar contenido | W.E.A.F', 'Informa contenido inseguro, engañoso o contrario a las reglas de W.E.A.F.'],
  ['/contact', 'Contacto y soporte | W.E.A.F', 'Contacta al equipo de W.E.A.F para soporte, reportes o consultas.'],
].map(([path, title, description, h1 = title.split('|')[0].trim(), intro = description, links = ['/']]) => ({ path, title, description, h1, intro, links }));

export const prerenderPaths = new Set([
  '/', '/ark-survival-ascended', '/inis', '/maps-bosses', '/creatures', '/servers', '/servers/owners', '/marketplace',
]);
