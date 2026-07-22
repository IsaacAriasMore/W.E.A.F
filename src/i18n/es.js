export default {
  common: {
    yes: 'Sí', no: 'No', all: 'Todos', loading: 'Cargando…', signIn: 'Ingresar', signUp: 'Crear cuenta',
    signOut: 'Salir', myTribe: 'Mi tribu', clear: 'Limpiar', optional: 'opcional', language: 'Idioma',
    edit: 'Editar', saveChanges: 'Guardar cambios', website: 'Sitio web', back: 'Volver', new: 'Nuevo', verified: 'Verificado',
  },
  nav: { home: 'Inicio', inis: 'INIs', mapsBosses: 'Mapas & Bosses', creatures: 'Criaturas', servers: 'Servidores', menuOpen: 'Abrir menú', menuClose: 'Cerrar menú' },
  home: {
    hero: {
      eyebrow: 'Coordinación para tribus', title: 'Convierte el progreso en un plan compartido.',
      subtitle: 'Herramientas públicas y espacios privados para organizar criaturas, mutaciones, bosses, INIs y servidores en ASE y ASA.',
      primary: 'Crear cuenta', secondary: 'Explorar INIs', servers: 'Ver servidores',
    },
    scroll: 'Explorar', heroAlt: 'Criaturas prehistóricas recorren una meseta volcánica al amanecer', heroCaption: 'Planifica. Cría. Progresa.',
    tools: {
      title: 'Herramientas útiles desde el primer minuto.', body: 'Consulta configuraciones, prepara bosses y encuentra criaturas o servidores sin crear una cuenta.',
      inisTitle: 'INIs listas para copiar', inisBody: 'Filtra por objetivo y descarga una configuración limpia.', inisLink: 'Abrir biblioteca',
      bossesTitle: 'Mapas & Bosses', bossesBody: 'Marca tributos por mapa, boss y dificultad.', bossesLink: 'Preparar batalla',
      creaturesTitle: 'Biblioteca de criaturas', creaturesBody: 'Encuentra especies por juego, mapa y función.', creaturesLink: 'Explorar criaturas',
      serversTitle: 'Servidores destacados', serversBody: 'Compara mapas, rates, plataformas y estilo de juego.', serversLink: 'Ver servidores',
    },
    private: {
      title: 'Tu tribu, su espacio privado.', body: 'Invita miembros, asigna roles y coordina breeds, mutaciones y alertas de Discord sin exponer el progreso.',
      roles: 'Roles claros', rolesValue: 'owner / admin / member', breeds: 'Breeds y mutaciones', breedsValue: 'aislados por tribu', discord: 'Discord', discordValue: 'alertas con webhook privado',
    },
    games: {
      title: 'ASE y ASA desde el inicio.', body: 'El catálogo mantiene separado el contexto de cada juego y filtra el contenido compatible.',
      evolved: 'Evolved', evolvedBody: 'Catálogo establecido, mapas clásicos y configuraciones maduras.', both: 'Ambos', bothBody: 'Objetivos, coordinación y privacidad con el contexto correcto.', ascended: 'Ascended', ascendedBody: 'Contenido compatible y un catálogo preparado para crecer.',
    },
    breeding: {
      title: 'Propagadores o breeding vanilla.', body: 'Configura cooldowns o multiplicadores y convierte cada cruce en una tarea visible para la tribu.',
      imageAlt: 'Criaturas prehistóricas en el entorno original de W.E.A.F', propagators: 'Con propagadores', cooldown: 'Cooldown configurable', vanilla: 'Breeding vanilla', multipliers: 'Multiplicador y tiempos reales',
    },
    servers: { title: 'Servidores destacados por la comunidad.', body: 'Compara mapas, plataformas, rates y mods antes de entrar.', view: 'Ver servidores', publish: 'Publicar mi servidor' },
    steps: { title: 'De la cuenta al primer breed.', account: 'Crea tu cuenta', tribe: 'Crea o únete a una tribu', config: 'Configura juego y Discord', breeds: 'Organiza tus breeds', alerts: 'Recibe alertas y comparte progreso' },
    community: { title: 'Diseñado para comunidades.', body: 'W.E.A.F es una herramienta independiente para tribus, breeders y propietarios de servidores.', independent: 'No es una app oficial.', independentBody: 'La independencia está documentada y visible en cada página.' },
    faq: {
      title: 'Preguntas frecuentes',
      q1: '¿Necesito cuenta para usar INIs?', a1: 'No. Las herramientas públicas se pueden consultar sin iniciar sesión.',
      q2: '¿Los breeds son públicos?', a2: 'No. Los breeds, mutaciones y actividad pertenecen al espacio privado de cada tribu.',
      q3: '¿Puedo usarlo para ASA?', a3: 'Sí. W.E.A.F separa contenido compatible con ASE, ASA o ambos.',
      q4: '¿El webhook de Discord es privado?', a4: 'Sí. La URL se guarda para la tribu y no se muestra en páginas públicas.',
      q5: '¿Puedo publicar mi servidor?', a5: 'Sí. Puedes elegir un plan mensual Normal o Plus y completar el pago con Stripe.',
      q6: '¿W.E.A.F está afiliado a ARK o Wildcard?', a6: 'No. Es una herramienta independiente creada para la comunidad.',
    },
    featuredEmpty: { title: 'El escaparate está listo.', body: 'Los servidores Plus aparecerán aquí cuando Stripe confirme su suscripción.' },
    final: { title: 'Organiza tu próxima línea de breeding con tu tribu.', servers: 'Explorar servidores' },
  },
  servers: {
    publish: 'Publicar servidor', maps: 'Mapas disponibles', mapsHelp: 'Marca todos los mapas que tiene tu servidor.',
    platforms: 'Plataformas disponibles', platformsHelp: 'Selecciona todas las plataformas desde las que se puede entrar al servidor.',
    modsQuestion: '¿Tiene mods?', rates: 'Rates del servidor', ratesHelp: 'Los rates son multiplicadores del servidor. Por ejemplo, 5x significa cinco veces más rápido que vanilla/oficial.',
    unsure: 'No estoy seguro / No especificar', vanilla: 'Vanilla / Oficial', custom: 'Personalizado', checkout: 'Continuar al pago',
    paymentReceived: 'Pago recibido', paymentCanceled: 'Pago cancelado', billing: 'Gestionar facturación', featured: 'Servidor destacado',
    mods: 'Mods', noSpecification: 'Sin especificar', available: 'Servidores disponibles', empty: 'No encontramos una coincidencia.',
    low: 'Bajo', medium: 'Medio', high: 'Alto', configuration: 'Configuración', modsHelp: 'Solo necesitamos saber si el servidor utiliza mods.',
    directory: {
      eyebrow: 'Directorio comunitario', title: 'Encuentra un servidor con tus reglas.', gameCoverage: 'ASE + ASA', directInfo: 'Información directa', noRankings: 'Sin rankings artificiales',
      filters: 'Filtros de servidores', filter: 'Filtrar', game: 'Juego', mode: 'Modo', withMods: 'Con mods', withoutMods: 'Sin mods', platform: 'Plataforma', console: 'Consola', region: 'Región', regionExample: 'Ej. LATAM', language: 'Idioma', languageExample: 'Ej. Español', cluster: 'Cluster', propagators: 'Propagadores', searching: 'Buscando servidores…', howItWorks: 'Ver cómo funciona', emptyHelp: 'Prueba una región más amplia o limpia los filtros.', one: '{count} servidor', many: '{count} servidores', discord: 'Entrar a Discord', website: 'Sitio web', wipe: 'Wipe', verified: 'Verificado', new: 'Nuevo',
    },
    owner: {
      back: 'Volver al directorio', eyebrow: 'Para dueños de servidores', title: 'Publica con control y cobro transparente.', body: 'Elige Normal o Plus, completa la ficha y activa tu anuncio mediante Stripe Checkout.', viewPlans: 'Ver planes', plansLabel: 'Planes para publicar servidores', essential: 'Base esencial', visibility: 'Mayor visibilidad', normalBody: 'Presencia clara y estable en el directorio.', plusBody: 'Pensado para temporadas, wipes y lanzamientos.', perMonth: 'USD / mes', choose: 'Elegir {plan}',
      normalFeatures: 'Ficha completa|Edición mientras esté activo|Analítica de clics', plusFeatures: 'Todo lo de Normal|Posición destacada|Insignia de destacado',
      processTitle: 'Un flujo corto y transparente.', step1: 'Elige el alcance', step1Body: 'Normal para presencia estable; Plus para destacar.', step2: 'Completa la ficha', step2Body: 'Mapas, plataformas, rates y enlaces quedan guardados como borrador.', step3: 'Confirma el pago', step3Body: 'Stripe procesa la suscripción y el webhook firmado activa la publicación.', policyBefore: 'Las publicaciones deben cumplir la', policyLink: 'política de servidores', policyAfter: 'El equipo puede pausar contenido engañoso o inseguro.',
    },
    form: {
      editEyebrow: 'Editar publicación', newEyebrow: 'Nueva publicación', activeUntil: 'Activa hasta {date}', activeNotice: 'nuevo aviso', paymentGate: 'La ficha se activa únicamente cuando Stripe confirma el pago.', basic: 'Información básica', name: 'Nombre del servidor', nameExample: 'Ej. Forja del Sur', description: 'Descripción', descriptionExample: 'Explica el estilo, reglas y comunidad del servidor.', game: 'Juego', mode: 'Modo', region: 'Región', language: 'Idioma', discord: 'Discord', website: 'Sitio web (opcional)', banner: 'Banner original o licenciado (opcional)', details: 'Detalles adicionales', cluster: 'Cluster (opcional)', wipe: 'Último wipe (opcional)', propagators: 'Este servidor usa propagadores', immediate: 'Los cambios se publican inmediatamente.', redirectStripe: 'Serás redirigido a Stripe Checkout.', adminPending: 'Se guardará como pendiente para activación administrativa.', saveDraft: 'Guardar borrador',
      noneTitle: 'Aún no tienes publicaciones.', noneBody: 'Elige Normal o Plus, completa la ficha y continúa al pago seguro.', viewPlans: 'Ver planes', yours: 'Tus publicaciones', yoursBody: 'Consulta su estado, edita la ficha o administra la suscripción.', newListing: 'Nueva publicación', selectorEyebrow: 'Elige cómo aparecer', selectorTitle: 'Selecciona un plan para comenzar.', selectorBody: 'Podrás revisar toda la ficha antes de abrir Stripe Checkout.', normalBody: 'Ficha completa y edición mientras esté activo.', plusBody: 'Posición destacada e insignia Plus.', plansBack: 'Planes', accountEyebrow: 'Cuenta de servidor', pageTitle: 'Publica con datos claros.', loading: 'Cargando tus publicaciones…', accountError: 'No pudimos abrir tu cuenta.', unavailable: 'Publicación no disponible.', ownershipError: 'Solo puedes editar publicaciones que te pertenecen.', openingStripe: 'Abriendo Stripe…', choicesError: 'Selecciona al menos un mapa y una plataforma.', saved: 'Cambios publicados.', draftSaved: 'Borrador guardado. La activación será administrativa.',
      statusCanceling: 'Cancelación programada', statusActive: 'Activo', statusCanceled: 'Cancelado', statusPaused: 'Pausado', statusExpired: 'Expirado', statusPending: 'Pago pendiente', statusDraft: 'Borrador', statusHidden: 'Oculto', statusRejected: 'Rechazado', statusUnknown: 'Sin estado',
    },
    result: {
      canceled: 'Pago cancelado', noCharge: 'No se realizó ningún cargo nuevo.', saved: 'Tu ficha quedó guardada y no será pública hasta que Stripe confirme un pago.', back: 'Volver a la publicación', plans: 'Ver planes', received: 'Pago recibido', confirming: 'Estamos confirmando tu suscripción.', webhook: 'La publicación se activará al recibir el webhook firmado de Stripe.', active: 'Suscripción activa', published: '{title} ya está publicado.', validUntil: 'Plan {plan} vigente hasta {date}.', directory: 'Ver en el directorio', billing: 'Administrar facturación', statusError: 'No pudimos consultar el estado.', pending: 'Confirmación pendiente', delayed: 'Stripe aún no envía el webhook.', delayedBody: 'No vuelvas a pagar. Revisa esta página en unos instantes.', myListings: 'Ver mis publicaciones.',
    },
  },
  legal: {
    eyebrow: 'Documento preliminar', version: 'Versión preliminar: 21 de julio de 2026', noticeTitle: 'Pendiente de revisión profesional', noticeBody: 'Este texto es una base informativa, no asesoría legal definitiva. Debe revisarse antes del lanzamiento comercial.', documents: 'Documentos', aria: 'Documentos legales', terms: 'Términos', privacy: 'Privacidad', cookies: 'Cookies', disclaimer: 'Disclaimer', refunds: 'Reembolsos', servers: 'Servidores', report: 'Reportar', contact: 'Contacto',
  },
  inis: {
    eyebrow: 'Biblioteca pública', title: 'INIs que puedes revisar antes de copiar.', body: 'Configuraciones iniciales para ASE y ASA. Revisa cada valor según tu versión, plataforma y equipo antes de aplicarlo.', aria: 'Presets INI', filters: 'Filtrar por categoría', all: 'Todas', farming: 'Farmeo', pvp: 'PvP', hard: 'Hard', fps: 'FPS Boost', visibility: 'Visibilidad', clean: 'Clean', one: '{count} preset disponible', many: '{count} presets disponibles', preview: 'Vista previa de {title}', copy: 'Copiar', view: 'Ver INI', download: 'Descargar', close: 'Cerrar', copyDialog: 'Copiar INI', copied: 'INI copiada al portapapeles.', copyError: 'No se pudo copiar. Selecciona el contenido manualmente.', downloadReady: 'Descarga preparada.',
  },
  creatures: {
    eyebrow: 'Biblioteca pública', title: 'Encuentra la criatura que encaja en el plan.', body: 'Filtra por juego, tipo, mapa o uso. Los tiempos son referencias iniciales y pueden variar por versión o configuración.', cards: 'fichas iniciales', filters: 'Filtros de biblioteca', search: 'Buscar criatura', searchExample: 'Ej. Rex', game: 'Juego', type: 'Tipo', map: 'Mapa', use: 'Uso', both: 'Ambos', cooldown: 'Cooldown vanilla', art: 'Arte conceptual original, no oficial.', emptyTitle: 'No encontramos esa combinación.', emptyBody: 'Prueba otro juego, mapa o término de búsqueda.', clear: 'Limpiar filtros', one: '{count} criatura encontrada', many: '{count} criaturas encontradas', image: 'Ilustración original de {name}',
  },
  bosses: {
    storageError: 'El navegador no permitió guardar el checklist.', eyebrow: 'Preparación local', title: 'Que el tributo no sea la sorpresa.', body: 'Selecciona mapa, boss y dificultad. Marca lo que ya tiene tu tribu.', local: 'Guardado local', localBody: 'El checklist permanece solo en este navegador.', encounter: 'Seleccionar enfrentamiento', map: 'Mapa', boss: 'Boss', difficulty: 'Dificultad', requirements: 'Tributos requeridos', clear: 'Limpiar selección', callout: 'Checklist listo. Estrategia en contexto.', calloutBody: 'La referencia es comunitaria y no exhaustiva. Confirma tributos, cantidades y estrategia para la versión de tu servidor.', creatures: 'Buscar criaturas', imageAlt: 'Paisaje prehistórico original usado como referencia visual', preparation: 'Preparación sugerida', progress: '{complete} de {total} listos', cleared: 'Checklist limpio.',
  },
  footer: {
    tagline: 'Herramientas para preparar, criar y progresar con tu tribu.', creator: 'Creador',
    terms: 'Términos', privacy: 'Privacidad', cookies: 'Cookies', disclaimer: 'Disclaimer', contact: 'Contacto',
    preferences: 'Preferencias de privacidad', install: 'Instalar W.E.A.F',
    legal: 'W.E.A.F es una herramienta independiente de comunidad. No está afiliada ni aprobada por Studio Wildcard, Snail Games, ARK: Survival Evolved o ARK: Survival Ascended.',
  },
};
