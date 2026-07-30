# Checklist final

## Git/seguridad
- [ ] Rama correcta, no main.
- [ ] WIP entendido.
- [ ] Sin env, secretos ni reportes temporales.
- [ ] Producción intacta.
- [ ] Pagos apagados y CAPTCHA intacto.

## Pruebas
- [ ] check
- [ ] unit
- [ ] E2E
- [ ] build
- [ ] audit
- [ ] consola sin errores
- [ ] sin HTTP 500

## Auth
- [ ] público anónimo/autenticado
- [ ] protegido anónimo/autenticado
- [ ] Admin sin/con rol
- [ ] login/register/reset/Turnstile/logout
- [ ] refresh/back/forward
- [ ] sin flash privado ni loops

## Lighthouse por ruta/dispositivo
- [ ] 3 ejecuciones
- [ ] mediana
- [ ] Performance/FCP/LCP/CLS/TBT/SI
- [ ] transferencia/requests
- [ ] JS/CSS sin usar
- [ ] LCP element/shifts/long tasks

## SEO
- [ ] HTML específico
- [ ] lang/title/description/canonical/robots
- [ ] H1 y contenido visible
- [ ] enlaces internos/JSON-LD
- [ ] hreflang/sitemap/404 noindex
- [ ] sin rutas privadas, localhost, Preview, fake ratings, meta keywords o cloaking

## Visual
- [ ] 390/768/escritorio
- [ ] header/hero/logo/tipografía/tarjetas/loading/footer
- [ ] teclado/reduced motion

## Entrega
- [ ] PR Draft
- [ ] commits
- [ ] resultados
- [ ] riesgos/rollback/Search Console
