# W.E.A.F

Wild Evolution & Ascension Forge es una plataforma comunitaria independiente para jugadores y tribus de ARK: Survival Evolved y ARK: Survival Ascended.

Las Fases 0 a 5 están implementadas. La experiencia incluye el sitio público, registro e ingreso con Supabase Auth, onboarding, tribus multi-tenant, breeding privado y un centro de administración global con moderación, contenido, gobernanza, métricas y auditoría.

## Stack

- Vite
- JavaScript vanilla con módulos ES
- HTML semántico y CSS modular
- Supabase Auth, PostgreSQL, Vault y Edge Functions para identidad, datos privados y avisos Discord
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

Copia `.env.example` a `.env.local`. El sitio público funciona sin credenciales remotas; Auth y el espacio privado requieren Supabase.

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
- [Fase 3: tribus y miembros](docs/phase-3-tribes.md)
- [Fase 4: breeding privado](docs/phase-4-breeding.md)
- [Guía de tribu](docs/tribe-user-guide.md)
- [Fase 5: administración global](docs/phase-5-global-admin.md)
- [Guía del centro de comando](docs/admin-guide.md)
- [Arquitectura](docs/architecture.md)
- [Esquema de datos](docs/database-schema.md)
- [RLS](docs/rls-policies.md)

## Seguridad

El diseño multi-tenant depende de `tribe_id`, privilegios SQL mínimos, Row Level Security y RPCs transaccionales con comprobaciones explícitas de sesión y rol. Las migraciones incrementales están en `supabase/migrations`; los secretos solo serán utilizados por servicios de servidor o Edge Functions.

## Disclaimer

W.E.A.F es una herramienta independiente de comunidad. No está afiliada, aprobada ni patrocinada por Studio Wildcard, Snail Games, ARK: Survival Evolved o ARK: Survival Ascended. Los nombres y marcas pertenecen a sus respectivos propietarios.

Antes de un lanzamiento comercial se requiere revisión legal y búsqueda de disponibilidad de marca.
