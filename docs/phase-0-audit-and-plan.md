# Fase 0: auditoría y plan

## Diagnóstico del repositorio

Estado al iniciar:

- Un commit inicial.
- Un único archivo `README.md` con el título del proyecto.
- Sin `package.json`, código fuente, estilos, tests, assets, migraciones o configuración de deploy.
- Sin una copia local de ArkBreed que permita reutilizar módulos.

Conclusión: la migración es conceptual. Se conservan los requisitos funcionales del brief, pero la implementación comienza como proyecto greenfield.

## Arquitectura propuesta

```text
Browser
  -> Vite SPA y router nativo
     -> páginas públicas y módulos de UI
     -> servicios de dominio
        -> Supabase Data API con publishable key
           -> PostgreSQL con RLS
           -> Storage con policies
        -> Edge Functions autenticadas
           -> secretos Discord y Stripe
```

Las páginas públicas usan datos locales en Fase 1 y la misma forma de datos que devolverá Supabase. Las fases posteriores sustituirán los adaptadores locales por servicios remotos sin reescribir componentes.

## Reutilización

No existen archivos funcionales reutilizables en el repositorio. Sí se reutiliza del brief:

- La taxonomía ASE, ASA y ambos.
- El modelo multi-tenant basado en tribus.
- Roles globales y de tribu separados.
- Categorías de INIs, filtros de criaturas y requisitos de bosses.
- Identidad, contacto, disclaimer y orden de fases.

## Estructura objetivo

```text
src/
  App.js
  main.js
  router.js
  components/
    layout/
    public/
    ui/
  data/
  pages/
    public/
  services/
  utils/
  css/
public/
  assets/
docs/
supabase/
  schema.sql
  rls.sql
```

Los módulos privados, auth y admin se incorporarán cuando su fase esté activa. No se enviará JavaScript de administración en rutas públicas.

## Rutas de Fase 1

| Ruta | Acceso | Propósito |
| --- | --- | --- |
| `/` | Público | Landing y descubrimiento |
| `/inis` | Público | Explorar, copiar y descargar presets |
| `/maps-bosses` | Público | Requisitos y checklist local |
| `/creatures` | Público | Biblioteca y filtros ASE/ASA |
| `/terms` | Público | Términos base |
| `/privacy` | Público | Privacidad base |
| `/cookies` | Público | Política de cookies base |
| `/disclaimer` | Público | No afiliación |
| `/contact` | Público | Contacto del creador |

`/servers` se reserva para la Fase 6. El CTA visible en Home se presenta como próxima función y no simula una página terminada.

## Plan por fases

1. Fase 0: auditoría, arquitectura, modelo de datos y seguridad.
2. Fase 1: experiencia pública funcional y responsive.
3. Fase 2: Auth, perfiles, onboarding e inactividad.
4. Fase 3: tribus, membresías, roles y dashboard privado.
5. Fase 4: breeding, mutaciones, propagators y Discord.
6. Fase 5: administración global y analíticas.
7. Fase 6: marketplace de servidores y tracking.
8. Fase 7: Stripe y expiraciones.
9. Fase 8: anuncios, consentimiento e instalación PWA.

Cada fase exige build de producción, revisión de accesibilidad, pruebas del dominio y un commit separado antes de comenzar la siguiente.

## Archivos de Fase 0 y Fase 1

Se crean o reemplazan:

- Contexto: `PRODUCT.md`, `DESIGN.md`, `README.md`.
- Plan: `docs/overview.md`, `docs/architecture.md`, `docs/database-schema.md`, `docs/rls-policies.md`, este documento.
- Seguridad propuesta: `supabase/schema.sql`, `supabase/rls.sql`.
- Frontend: `index.html`, `package.json`, `src/**`, `public/assets/**`.
- Calidad: configuración de Vite y scripts de verificación.

## Riesgos y mitigaciones

- Falta de datos reales: todo fixture se marca como demostración y vive en `src/data`.
- Uso de propiedad intelectual: arte original y disclaimer visible.
- RLS recursiva: helpers de autorización en esquema `private`, con `search_path` fijo y permisos de ejecución mínimos.
- Cambio de Supabase 2026: `GRANT` explícitos acompañan a cada política.
- Crecimiento del SPA: rutas con `import()` dinámico para separar páginas.
