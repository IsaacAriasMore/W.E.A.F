# Esquema de datos propuesto

La fuente SQL ejecutable de referencia está en `supabase/schema.sql`. No se aplicó a un proyecto remoto en Fase 0 porque todavía no existe un `project_id` confirmado.

## Dominios

- Identidad: `profiles`, `legal_acceptances`.
- Tribus: `tribes`, `tribe_members`, `tribe_invites`, `tribe_discord_webhooks`.
- Breeding: `species`, `breeds`, `mutations`, `propagator_alerts`.
- Contenido público: `ini_presets`, `maps`, `bosses`, `boss_requirements`.
- Marketplace: `server_listings`, `server_listing_clicks`, `plans`, `payments`, `stripe_events`.
- Plataforma: `ads_settings`, `legal_documents`, `reports`, `feature_flags`, `analytics_events`, `audit_logs`.

## Reglas estructurales

- UUID como clave primaria.
- Enums PostgreSQL para estados cerrados.
- `created_at` y `updated_at` en UTC.
- Foreign keys con borrado restrictivo o en cascada según propiedad.
- Checks para multiplicadores, cooldowns y expiraciones.
- Índices en claves de tenant, estado, slug y fechas consultadas.
- Webhooks almacenados cifrados fuera de las tablas públicas de lectura.

## Relación multi-tenant

```text
auth.users -> profiles
auth.users -> tribe_members -> tribes
tribes -> breeds -> mutations
tribes -> tribe_discord_webhooks
species -> breeds
species -> mutations
```

Toda fila privada incluye `tribe_id`, incluso si puede derivarse de otra relación. Esta duplicación controlada facilita RLS, consultas y auditoría, y se protege con foreign keys compuestas o triggers en la implementación final.
