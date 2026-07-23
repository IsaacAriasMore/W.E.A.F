import { t } from '../../i18n/index.js';
import { OFFICIAL_DISCORD, SUPPORT_EMAIL } from '../../config/contact.js';

const pages = {
  '/terms': {
    title: 'Términos y condiciones',
    intro: 'Reglas base para usar W.E.A.F de forma segura y respetuosa.',
    sections: [
      ['Uso permitido', 'Puedes usar las herramientas públicas para fines personales y comunitarios. No puedes intentar vulnerar cuentas, automatizar abuso, distribuir malware ni interferir con otros usuarios.'],
      ['Cuentas y tribus', 'Cada persona es responsable de su cuenta y de las acciones realizadas con ella. Los roles de tribu no conceden privilegios globales sobre la plataforma.'],
      ['Contenido', 'Quien publique información conservará responsabilidad sobre su exactitud y derechos de uso. W.E.A.F podrá retirar contenido que incumpla las políticas de comunidad.'],
      ['Disponibilidad', 'El servicio puede cambiar durante su desarrollo. Se procurará avisar cuando una modificación afecte funciones o datos importantes.'],
    ],
  },
  '/privacy': {
    title: 'Política de privacidad',
    intro: 'Resumen preliminar de los datos que W.E.A.F trata y por qué.',
    sections: [
      ['Datos tratados', 'Cuenta, perfil, membresías de tribu, preferencias, actividad funcional y aceptaciones legales. Los pagos son procesados por Stripe y los secretos se gestionan fuera del navegador.'],
      ['Finalidad', 'Autenticar usuarios, aislar contenido por tribu, operar herramientas, prevenir abuso y mejorar estabilidad. No se venderán datos personales.'],
      ['Conservación y control', 'Las ventanas de conservación y el procedimiento formal de acceso o eliminación requieren revisión legal antes del lanzamiento comercial. Mientras tanto, las solicitudes se reciben por el canal de contacto.'],
      ['Seguridad', 'La arquitectura usa Row Level Security, privilegios mínimos, logs de auditoría y Edge Functions para operaciones con secretos.'],
    ],
  },
  '/cookies': {
    title: 'Política de cookies',
    intro: 'W.E.A.F separará almacenamiento necesario, analítica y publicidad.',
    sections: [
      ['Necesarias', 'Permitirán conservar sesión, seguridad y preferencias esenciales. No requerirán consentimiento cuando sean imprescindibles para prestar el servicio solicitado.'],
      ['Analíticas', 'Se activarán solo con consentimiento cuando corresponda y se usarán para entender rendimiento y uso agregado.'],
      ['Publicidad', 'Las promociones internas pueden mostrarse sin cookies publicitarias. Su medición y cualquier futuro proveedor externo permanecen desactivados hasta que aceptes publicidad o analítica.'],
      ['Preferencias actuales', 'La elección se guarda localmente en este navegador. Puedes cambiarla desde “Preferencias de privacidad” en el pie de página. También se usa almacenamiento local para checklists, seguridad y avisos de instalación.'],
    ],
  },
  '/disclaimer': {
    title: 'Disclaimer de independencia',
    intro: 'W.E.A.F es un proyecto de comunidad y no representa a los propietarios del juego.',
    sections: [
      ['No afiliación', 'W.E.A.F no está afiliada, aprobada ni patrocinada por Studio Wildcard, Snail Games, ARK: Survival Evolved o ARK: Survival Ascended.'],
      ['Marcas y contenido', 'Todos los nombres, marcas e imágenes de terceros pertenecen a sus respectivos propietarios. El arte de esta versión fue generado de forma original y no usa activos oficiales.'],
      ['Información comunitaria', 'Los datos de criaturas, tiempos, mapas e INIs pueden cambiar o contener errores. Verifica valores sensibles antes de aplicarlos.'],
      ['Marca W.E.A.F', 'Antes de un lanzamiento comercial se debe revisar la disponibilidad del nombre en WIPO, USPTO y las oficinas locales aplicables.'],
    ],
  },
  '/refund-policy': {
    title: 'Política de reembolsos',
    intro: 'Base preliminar para las publicaciones pagadas de servidores.',
    sections: [
      ['Estado actual', 'Stripe procesa las suscripciones cuando la facturación está habilitada. Estas condiciones aún requieren revisión profesional antes de considerarse definitivas.'],
      ['Servicios digitales', 'Los planes mensuales se renuevan mediante Stripe hasta su cancelación. La jurisdicción, los plazos y las excepciones de reembolso requieren revisión legal final.'],
      ['Revisión manual', 'El administrador podrá evaluar reembolsos por cobro duplicado, fallo técnico o retiro justificado de una publicación.'],
    ],
  },
  '/server-listing-policy': {
    title: 'Política de servidores publicados',
    intro: 'Criterios base para un directorio útil y seguro.',
    sections: [
      ['Contenido prohibido', 'No se permitirá contenido ilegal, odio, fraude, phishing, malware ni material sexual explícito.'],
      ['Información verificable', 'El propietario deberá mantener enlaces, rates, modalidad, región y estado de wipe razonablemente actualizados.'],
      ['Moderación', 'W.E.A.F podrá pausar, rechazar o eliminar una publicación y solicitar evidencia de propiedad o administración.'],
      ['Promoción', 'Un plan destacado mejora colocación, pero nunca exime de moderación ni garantiza jugadores o tráfico.'],
    ],
  },
  '/report-content': {
    title: 'Reportar contenido',
    intro: 'Canal inicial para señalar material dañino o una publicación incorrecta.',
    sections: [
      ['Qué incluir', 'Envía la URL, el nombre del servidor o contenido, el motivo del reporte y cualquier evidencia relevante.'],
      ['Privacidad', 'No compartas contraseñas, tokens, webhooks ni datos personales innecesarios.'],
      ['Contacto', `Mientras el formulario moderado se implementa, escribe a ${SUPPORT_EMAIL} con el asunto Reporte W.E.A.F.`],
    ],
  },
  '/contact': {
    title: 'Contacto',
    intro: 'Habla directamente con el creador de W.E.A.F.',
    sections: [
      ['Correo', `Para soporte, privacidad, reportes o colaboración: ${SUPPORT_EMAIL}.`],
      ['Discord', `Encuentra al creador como ${OFFICIAL_DISCORD}. No envíes secretos, contraseñas o webhooks por mensajes directos.`],
      ['Creador', 'W.E.A.F es creado y mantenido por Isaac Arias.'],
    ],
  },
};

const relatedLinks = [
  ['/terms', 'terms'],
  ['/privacy', 'privacy'],
  ['/cookies', 'cookies'],
  ['/disclaimer', 'disclaimer'],
  ['/refund-policy', 'refunds'],
  ['/server-listing-policy', 'servers'],
  ['/report-content', 'report'],
  ['/contact', 'contact'],
];

export function render({ path }) {
  const page = pages[path] || pages['/terms'];
  return `
    <article class="legal-page container reveal-up">
      <header class="legal-header">
        <p class="section-kicker">${t('legal.eyebrow')}</p>
        <h1>${page.title}</h1>
        <p>${page.intro}</p>
        <span>${t('legal.version')}</span>
      </header>
      <div class="legal-layout">
        <div class="legal-content">
          ${page.sections.map(([title, content]) => `
            <section class="reveal-up">
              <h2>${title}</h2>
              <p>${content}</p>
            </section>
          `).join('')}
          <aside class="legal-notice">
            <strong>${t('legal.noticeTitle')}</strong>
            <p>${t('legal.noticeBody')}</p>
          </aside>
        </div>
        <nav class="legal-nav" aria-label="${t('legal.aria')}">
          <strong>${t('legal.documents')}</strong>
          ${relatedLinks.map(([href, key]) => `<a href="${href}" data-link ${href === path ? 'aria-current="page"' : ''}>${t(`legal.${key}`)}</a>`).join('')}
        </nav>
      </div>
    </article>
  `;
}
