# Stripe live readiness

Stripe debe permanecer en modo test hasta completar esta lista. Este documento no contiene claves ni autoriza el cambio a producción.

## Negocio y legal

- [ ] Identidad de la entidad o persona responsable confirmada.
- [ ] Términos, privacidad, cookies, reembolsos y política de servidores revisados profesionalmente.
- [ ] Moneda, impuestos, comprobantes y jurisdicciones documentados.
- [ ] Canal oficial `waefservice@outlook.com`, tiempos de respuesta y procedimiento de disputa probados.

## Cuenta e integración

- [ ] Cuenta Stripe verificada, datos bancarios y descriptor del cargo confirmados.
- [ ] Productos Normal USD 3/mes y Plus USD 7/mes creados en Live con IDs diferentes a Test.
- [ ] Customer Portal Live configurado para cancelación y método de pago.
- [ ] Crear secrets Live solo en Supabase; nunca en `VITE_*`, Git o Vercel público.
- [ ] Configurar clave secreta, price IDs y webhook secret Live en el proyecto correcto.
- [ ] Confirmar firma, idempotencia, reintentos y almacenamiento de eventos.
- [ ] Revisar success, cancel y portal con `PUBLIC_SITE_URL=https://weaf.vercel.app`.
- [ ] Ensayar pago, renovación, cancelación, reactivación, fallo y cobro duplicado con una publicación controlada.

## Operación y salida

- [ ] Alertas para webhooks fallidos, pagos fallidos y divergencias listing/suscripción.
- [ ] Procedimiento de conciliación entre Stripe y Supabase.
- [ ] Plan de rollback para deshabilitar billing sin perder estados.
- [ ] Aprobación explícita final antes de cambiar flags y secrets a Live.
