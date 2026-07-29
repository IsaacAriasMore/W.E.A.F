# W.E.A.F contributor guardrails

## Architecture

- Vite 7 + JavaScript ESM + HTML/CSS propios; no React ni PHP.
- Supabase Auth/PostgreSQL/RLS/Edge Functions es la frontera de identidad y datos.
- Vercel sirve la SPA y los assets; PayPal REST opera solo desde Edge Functions.
- Pagos nuevos: PayPal Sandbox. Stripe es histórico/rollback y no participa en la UI nueva.

## Commands

```bash
npm install
npm run check
npm run test:unit
npm run test:e2e
npm run build
npx supabase migration list --linked
npx supabase db lint --linked --level warning
```

## Security and payment limits

- Nunca registrar, exponer o versionar secretos, JWT, cookies ni encabezados `Authorization`.
- Nunca activar PayPal Live ni usar importes enviados por el navegador.
- Mantener RLS y ownership en toda operación de usuario; `service_role` solo en servidor.
- Un webhook no cambia estado antes de verificar firma e idempotencia.
- `paypal_payments=false` bloquea altas nuevas, pero no webhooks/reconciliación de clientes existentes.
- Stripe y sus datos históricos solo se retiran con migración, respaldo, pruebas y rollback aprobado.

## Migrations

- Crear migraciones con `npx supabase migration new <name>`.
- Comparar historial local/remoto antes de `db push`; no reparar ni borrar historial sin evidencia.
- Todo objeto `public` expuesto debe tener RLS/grants mínimos. Todo `SECURITY DEFINER` debe fijar
  `search_path`, validar actor y revocar `EXECUTE` a `PUBLIC` salvo API pública deliberada.
- Los cambios destructivos requieren rollback documentado y autorización.

## Definition of done

- Cambio pequeño y reversible, con ES/EN cuando sea visible.
- `check`, unitarios y build pasan; E2E relevante pasa o el bloqueo externo queda demostrado.
- Sin secretos en diff/build; RLS, ownership, idempotencia y estados de error tienen regresión.
- Documentación, despliegue manual y rollback quedan actualizados. No merge automático a producción.
