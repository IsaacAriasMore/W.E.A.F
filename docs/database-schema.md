# Esquema de datos

La fuente SQL inicial está en `supabase/schema.sql`; la evolución aplicada al proyecto remoto se conserva en `supabase/migrations`. La base utiliza PostgreSQL 17.

## Dominios

- Identidad: `profiles`, `legal_acceptances`. `profiles.onboarding_completed` controla si el usuario terminó su configuración inicial.
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
- Una única membresía `owner` activa por tribu, protegida por índice único parcial.
- Tokens de invitación almacenados únicamente como hash SHA-256; el valor original se devuelve una sola vez.

## Relación multi-tenant

```text
auth.users -> profiles
auth.users -> tribe_members -> tribes
tribes -> breeds -> mutations
tribes -> tribe_discord_webhooks
species -> breeds
species -> mutations
```

La función privada `handle_new_user()` crea el perfil al registrarse. Solo acepta `display_name` y `default_game_mode` desde metadata editable; nunca deriva autorización desde `user_metadata`.

Toda fila privada incluye `tribe_id`, incluso si puede derivarse de otra relación. Esta duplicación controlada facilita RLS, consultas y auditoría, y se protege con foreign keys compuestas o triggers en la implementación final.

## Operaciones de tribu

La Fase 3 añade RPCs autenticados para crear tribus, crear y aceptar invitaciones, cambiar roles, expulsar miembros, abandonar una tribu y actualizar la identidad de juego. Cada operación sensible valida usuario activo, membresía y rol dentro de la misma transacción.
