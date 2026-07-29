# Riesgos residuales

La auditoría reduce riesgos comprobados, pero no declara W.E.A.F “100 % seguro”. Los siguientes
puntos requieren entorno desplegado, identidades reales de desarrollo o decisiones operativas.

## Altos

- **Migraciones aún no aplicadas.** Las cuatro migraciones de esta rama existen localmente. El CLI
  no pudo completar el dry-run porque `.env.local` contiene BOM. Debe corregirse sin revelar secretos,
  repetir historial/dry-run y aplicar primero en desarrollo.
- **Matriz PayPal incompleta en Sandbox.** Normal tiene evidencia histórica, pero Plus, cancelación,
  suspensión, failure, refund, reversal, expiración, reconciliación y pago único marketplace necesitan
  pruebas end-to-end con webhook Sandbox desplegado.
- **RLS multiusuario no ejecutado contra remoto.** Las políticas, grants, ownership y RPCs tienen
  revisión estática y regresiones; falta probar con usuario A, usuario B y admin en una base de desarrollo.

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

- `supabase db lint` conserva un warning legacy: `new_subscription_id` no se usa en una función Stripe
  histórica. No se retiró porque Stripe permanece como rollback e historial.
- Admin conserva colores locales y tipografía legacy fuera de algunos tokens del sistema.
- Recuperación de contraseña depende de SMTP; la UI falla de forma clara, pero la entregabilidad necesita
  dominio, SPF, DKIM y DMARC válidos.
- Falta incorporar Search Console/Bing Webmaster Tools y datos de campo; no se inventaron tokens de verificación.

## Criterio para liberar

No habilitar pagos nuevos ni marketplace destacado hasta cerrar los tres riesgos altos, revisar Preview,
confirmar backups y aprobar manualmente el despliegue. Mantener siempre `PAYPAL_MODE=sandbox` durante QA.
