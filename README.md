# W.E.A.F

[![CI](https://github.com/IsaacAriasMore/W.E.A.F/actions/workflows/ci.yml/badge.svg)](https://github.com/IsaacAriasMore/W.E.A.F/actions/workflows/ci.yml)

> **Cierre de Fase 10:** Fase 10 implementada y desplegada. El contenido verificado inicial cubre The Island y 3 INIs editoriales. El resto del catálogo queda como trabajo editorial progresivo.

> Fase 10 incorpora catálogos bilingües de mapas, bosses y presets INI alimentados por Supabase, checklist local por dificultad y un editor administrativo estructurado. Consulta [docs/phase-10-content-bosses-inis.md](docs/phase-10-content-bosses-inis.md).

> **Fase 11:** pulido premium, perfil directo, navegación autenticada, tribus múltiples, cuidadores, mutaciones calculadas y herramientas seguras de rename/archive/reset. Consulta [docs/phase-11-premium-polish-and-tribe-tools.md](docs/phase-11-premium-polish-and-tribe-tools.md).

Wild Evolution & Ascension Forge es una plataforma comunitaria independiente para jugadores y tribus de ARK: Survival Evolved y ARK: Survival Ascended.

Las Fases 0 a 10 están implementadas y la Fase 11 de preparación operativa está iniciada. La experiencia incluye el sitio público, Supabase Auth, tribus multi-tenant, breeding privado, administración global, marketplace de servidores, ciclo de pagos PayPal (sandbox), consentimiento granular, promociones internas Plus y una PWA instalable.

## Stack

- Vite
- JavaScript vanilla con módulos ES
- HTML semántico y CSS modular
- Supabase Auth, PostgreSQL, Vault y Edge Functions para identidad, datos privados y avisos Discord
- Manifest, service worker y promociones internas administrables
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
VITE_STRIPE_PUBLIC_KEY= # Legacy - Stripe deshabilitado, usar PayPal
```

Usa preferentemente la clave publicable `sb_publishable_...`. `VITE_SUPABASE_ANON_KEY` queda como compatibilidad con proyectos heredados. Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` o webhooks de Discord en variables `VITE_*`.

Antes de activar Auth en producción, registra la URL de `/onboarding` entre las Redirect URLs permitidas en Supabase. La configuración local equivalente vive en `supabase/config.toml`.

## Documentación

- [Overview](docs/overview.md)
- [Auditoría y plan](docs/phase-0-audit-and-plan.md)
- [Fase 2: Auth y onboarding](docs/phase-2-auth-and-onboarding.md)
- [Fase 3: tribus y miembros](docs/phase-3-tribes.md)
- [Fase 4: breeding privado](docs/phase-4-breeding.md)
- [Guía de tribu](docs/tribe-user-guide.md)
- [Fase 5: administración global](docs/phase-5-global-admin.md)
- [Fase 6: marketplace de servidores](docs/phase-6-server-marketplace.md)
- [Fase 7: Stripe y expiración](docs/phase-7-stripe-and-expiration.md)
- [Fase 8: privacidad, anuncios, PWA y checklist](docs/phase-8-pwa-ads-and-launch-checklist.md)
- [Fase 9: anuncios internos Plus](docs/internal-ads.md)
- [Fase 10: contenido ARK, bosses e INIs](docs/phase-10-content-bosses-inis.md)
- [Fase 11: pulido premium y herramientas de tribu](docs/phase-11-premium-polish-and-tribe-tools.md)
- [Fase 11: QA de producción](docs/phase-11-production-qa.md)
- [Checklist manual de Fase 11](docs/phase-11-manual-checklist.md)
- [Preparación para Stripe live](docs/stripe-live-readiness.md)
- [Auditoría técnica y editorial vigente](docs/repository-audit.md)
- [Autenticación y registro directo](docs/auth.md)
- [Guía del centro de comando](docs/admin-guide.md)
- [Arquitectura](docs/architecture.md)
- [Esquema de datos](docs/database-schema.md)
- [RLS](docs/rls-policies.md)

## Seguridad

El diseño multi-tenant depende de `tribe_id`, privilegios SQL mínimos, Row Level Security y RPCs transaccionales con comprobaciones explícitas de sesión y rol. Las migraciones incrementales están en `supabase/migrations`; los secretos solo serán utilizados por servicios de servidor o Edge Functions.

## Disclaimer

W.E.A.F es una herramienta independiente de comunidad. No está afiliada, aprobada ni patrocinada por Studio Wildcard, Snail Games, ARK: Survival Evolved o ARK: Survival Ascended. Los nombres y marcas pertenecen a sus respectivos propietarios.

Antes de un lanzamiento comercial se requiere revisión legal y búsqueda de disponibilidad de marca.
