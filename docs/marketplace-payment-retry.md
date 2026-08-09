# Reintento seguro de PayPal Marketplace

`20260809171235_marketplace_payment_retry_reuse.sql` corrige el caso en que un
usuario abandona o cancela el navegador después de que W.E.A.F haya creado una
fila `created` y adjuntado una orden PayPal Sandbox. No modifica pagos
históricos, no llama a PayPal y no activa ningún interruptor.

## Contrato

`prepare_marketplace_paypal_order` bloquea primero el anuncio del propietario
con `FOR UPDATE`. Una idempotency key nueva reutiliza exactamente una fila con:

- mismo propietario y anuncio;
- `provider=paypal`, `environment=sandbox`, `status=created`;
- importe fijo `300` y moneda `USD`;
- orden adjunta, sin captura ni `paid_at`;
- anuncio ASA activo, no destacado y sin beneficio vigente.

La respuesta conserva el payment, la orden y la idempotency key originales. No
se inserta una segunda fila. Si hay dos candidatas, un pago incompleto o
incompatible, un estado terminal, un beneficio activo o un propietario distinto,
la función falla cerrada con `marketplace_payment_in_progress` (o el error de
ownership correspondiente). El bloqueo del anuncio serializa dos pestañas.

La Edge Function existente solo consulta la orden reutilizada y entrega una URL
oficial de aprobación si PayPal la considera aprobable; no crea una orden nueva.

## Interfaz

En `/account/marketplace`, el botón aparece únicamente cuando el servidor ya
indica que Featured, pagos y QA están habilitados. Muestra **Destacar anuncio**
sin intento previo o **Reintentar pago** para un único intento compatible. La UI
envía solo el identificador del anuncio y una idempotency key nueva; no muestra
IDs de pago, orden o captura. El botón se deshabilita mientras la llamada está
en curso. La ruta de cancelación es informativa y no invoca servicios.

## Verificación local y rollback

Ejecutar tras `supabase db reset` local:

```powershell
Get-Content .\supabase\tests\marketplace-payment-retry-reuse.sql -Raw |
  docker exec -i supabase_db_W.E.A.F psql -U postgres
npm run test:unit
```

La prueba SQL se ejecuta dentro de `BEGIN`/`ROLLBACK` y cubre idempotencia,
reuso exacto, ownership, valores incompatibles, terminales, doble pestaña
equivalente, grants y `search_path`. Las unitarias cubren los CTA, URL segura,
errores, cancelación y doble clic.

Para rollback remoto se requiere una migración compensatoria que restaure la
función anterior y sus grants; nunca se elimina ni normaliza una fila de pago.
Antes de cualquier aplicación remota, realizar backup, revisar historial y
dry-run, y mantener `paypal_payments=false`, Marketplace
`payments_enabled=false` y `environment=sandbox`.
