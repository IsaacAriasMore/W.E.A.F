# Riesgos residuales

La auditoría reduce riesgos comprobados, pero no declara W.E.A.F “100 % seguro”. Los siguientes
puntos requieren entorno desplegado, identidades reales de desarrollo o decisiones operativas.

## Altos

- **Matriz PayPal incompleta en Sandbox.** Normal tiene evidencia histórica, pero Plus, cancelación,
  suspensión, failure, refund, reversal, expiración, reconciliación y pago único marketplace necesitan
  pruebas end-to-end con webhook Sandbox desplegado.

## Medios

- `adminDashboard.js` sigue siendo grande. Se redujo el trabajo síncrono del handler afectado, pero una
  extracción total habría ampliado innecesariamente el riesgo de esta entrega.
- `track-server-event`, webhooks, expiración y reconciliación usan `verify_jwt=false` por su naturaleza.
  Mantienen autenticación interna, firma o secreto; deben monitorizarse tras cada despliegue.
- URLs HTTPS de imágenes externas pueden quedar rotas o lentas. CSP limita protocolos, pero no garantiza
  disponibilidad/licencia del host aportado por el usuario.
- No existe todavía una política aprobada de retención/purga para anuncios, reportes y evidencia de disputas.
- Lighthouse/Core Web Vitals de Preview y dispositivo real siguen pendientes; la medición local solo valida
  bundles, layout, consola y comportamiento responsive.
- La SPA depende de ejecución JavaScript para contenido detallado. Se añadió metadata dinámica e
  infraestructura indexable, pero el prerender/SSR sigue siendo una mejora SEO futura.

## Bajos e informativos

- `supabase db lint` conserva el warning legacy de `new_subscription_id` y advierte que
  `private.validate_marketplace_payload` está marcada `IMMUTABLE` aunque contiene una expresión
  `STABLE`. No altera el despliegue actual; debe corregirse con una migración nueva revisada.
- Admin conserva colores locales y tipografía legacy fuera de algunos tokens del sistema.
- Recuperación de contraseña depende de SMTP; la UI falla de forma clara, pero la entregabilidad necesita
  dominio, SPF, DKIM y DMARC válidos.
- Falta incorporar Search Console/Bing Webmaster Tools y datos de campo; no se inventaron tokens de verificación.

## Riesgos reducidos por el hotfix

- La autorización de reportes se comprobó con una transacción remota y `ROLLBACK`: reportante normal
  y escritura directa bloqueados; admin permitido; estado inválido, inexistente y audit log verificados.
- CSP y caché de rutas privadas se comprobaron mediante requests reales al Preview protegido.
- El layout Admin se verificó con fixture no persistente a 390, 768 y 1280 px, y la consola de W.E.A.F
  quedó limpia. Aún conviene una pasada visual autenticada directamente sobre el Preview cuando el
  navegador de QA comparta la sesión SSO, especialmente con contenido de longitud máxima.

## Criterio para liberar

No habilitar pagos nuevos ni marketplace destacado hasta cerrar los riesgos altos y aprobar manualmente
la prueba. Los backups ya se confirmaron; mantener siempre `PAYPAL_MODE=sandbox` durante QA.

## Riesgos del rollout CAPTCHA

- **Alto hasta el paso post-merge:** el widget del navegador no es una barrera autoritativa mientras
  Supabase CAPTCHA global permanezca apagado. Estado: frontend preparado y validado; enforcement
  autoritativo pendiente de activación inmediata después del despliegue de `main`.
- La site key oficial de prueba sirve únicamente para Preview/QA. Producción necesita una site key
  real restringida al dominio y el secret guardado solo en Supabase.
- El smoke autenticado no mutante de las dos funciones legacy necesita una sesión QA disponible en el
  navegador de automatización. Debe ser un `GET` que termine en 405; un POST podría abrir checkout o
  portal y está fuera de alcance.
- Los rate limits remotos privados y MFA de admins requieren confirmación visual en Dashboard. Se
  auditaron los valores versionados y el comportamiento público, sin reducir límites.
- Confirmación de correo sigue apagada hasta contar con dominio propio, SMTP externo y pruebas de
  entrega, expiración y reenvío. La protección contra contraseñas filtradas no se activó porque exige
  Supabase Pro.
