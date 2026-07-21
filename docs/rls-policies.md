# Estrategia RLS

La referencia ejecutable está en `supabase/rls.sql`.

## Acceso público

`anon` y `authenticated` reciben `SELECT` únicamente sobre:

- especies públicas y activas;
- presets INI públicos;
- mapas y bosses públicos y activos;
- listings activos dentro de su ventana de publicación;
- documentos legales publicados;
- configuración pública de ads habilitados.

Las policies filtran las filas aunque exista el privilegio SQL.

## Acceso privado

- Perfiles: el usuario lee su perfil y solo edita `display_name`, `avatar_url`, `discord_username`, `default_game_mode` y `onboarding_completed`.
- Tribus: un miembro activo puede leer su tribu.
- Configuración de tribu: owner o admin según sensibilidad.
- Breeds y mutaciones: solo miembros activos de la misma tribu.
- Webhooks: ninguna lectura directa desde el frontend.
- Admin global: validación desde `profiles.global_role`, nunca desde `user_metadata`.

La inserción de perfiles no está concedida al navegador. Un trigger sobre `auth.users` la ejecuta como función privada. Esto evita que un cliente construya una fila inicial con columnas administrativas.

## Helpers

Los helpers viven en esquema `private` y fijan `search_path`:

- `private.current_user_global_role()`
- `private.is_global_admin()`
- `private.is_tribe_member(uuid)`
- `private.is_tribe_owner(uuid)`
- `private.is_tribe_admin_or_owner(uuid)`
- `private.can_manage_tribe_member(uuid, uuid, uuid)`

Los helpers `SECURITY DEFINER` revocan ejecución de `PUBLIC` y solo conceden acceso a los roles necesarios. Se evita colocarlos en el esquema expuesto `public`.

## Cambio de plataforma 2026

Supabase ya no expone automáticamente nuevas tablas a Data API en proyectos nuevos. RLS y privilegios son capas separadas. Por eso `supabase/rls.sql` declara `GRANT` mínimos de forma explícita y no depende de defaults del proyecto.

## Verificación prevista

Al conectar un proyecto Supabase:

1. Aplicar schema en una rama de desarrollo.
2. Ejecutar casos `anon`, usuario sin tribu, miembro, admin, owner y global admin.
3. Probar que `UPDATE` tiene policy `SELECT` correspondiente.
4. Ejecutar Security y Performance Advisors.
5. Generar una migración limpia con CLI actual.
6. Confirmar que ningún webhook o secreto aparece en consultas del cliente.
