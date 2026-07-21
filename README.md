# W.E.A.F

Wild Evolution & Ascension Forge es una plataforma comunitaria independiente para jugadores y tribus de ARK: Survival Evolved y ARK: Survival Ascended.

Las Fases 0, 1 y 2 están implementadas. La experiencia incluye el sitio público, registro e ingreso con Supabase Auth, perfil inicial, selección ASE/ASA y cierre de sesión por inactividad. Las funciones privadas por tribu comienzan en la Fase 3 descrita en [docs/phase-0-audit-and-plan.md](docs/phase-0-audit-and-plan.md).

## Stack

- Vite
- JavaScript vanilla con módulos ES
- HTML semántico y CSS modular
- Supabase Auth y PostgreSQL para identidad; Storage y Edge Functions se activan en fases posteriores
- Vercel como hosting inicial

## Desarrollo local

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run build
```

## Variables de entorno

Copia `.env.example` a `.env.local`. La Fase 1 funciona sin credenciales remotas.

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
VITE_APP_NAME=W.E.A.F
VITE_PUBLIC_SITE_URL=http://localhost:5173
VITE_STRIPE_PUBLIC_KEY=
VITE_ADS_ENABLED=false
```

Usa preferentemente la clave publicable `sb_publishable_...`. `VITE_SUPABASE_ANON_KEY` queda como compatibilidad con proyectos heredados. Nunca expongas `SUPABASE_SERVICE_ROLE_KEY`, secretos de Stripe o webhooks de Discord en variables `VITE_*`.

Antes de activar Auth en producción, registra la URL de `/onboarding` entre las Redirect URLs permitidas en Supabase. La configuración local equivalente vive en `supabase/config.toml`.

## Documentación

- [Overview](docs/overview.md)
- [Auditoría y plan](docs/phase-0-audit-and-plan.md)
- [Fase 2: Auth y onboarding](docs/phase-2-auth-and-onboarding.md)
- [Arquitectura](docs/architecture.md)
- [Esquema de datos](docs/database-schema.md)
- [RLS](docs/rls-policies.md)

## Seguridad

El diseño multi-tenant depende de `tribe_id` y Row Level Security. `supabase/schema.sql` y `supabase/rls.sql` son referencias de Fase 0; la migración incremental de Fase 2 está en `supabase/migrations`. Los secretos solo serán utilizados por Edge Functions.

## Disclaimer

W.E.A.F es una herramienta independiente de comunidad. No está afiliada, aprobada ni patrocinada por Studio Wildcard, Snail Games, ARK: Survival Evolved o ARK: Survival Ascended. Los nombres y marcas pertenecen a sus respectivos propietarios.

Antes de un lanzamiento comercial se requiere revisión legal y búsqueda de disponibilidad de marca.
