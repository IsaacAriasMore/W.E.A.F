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
- Configuración de tribu: owner o admin según sensibilidad; solo columnas concedidas pueden actualizarse directamente.
- Membresías e invitaciones: lectura filtrada por tribu; altas, cambios y bajas se realizan mediante RPCs protegidos.
- Breeds, mutaciones y cooldowns: lectura para miembros activos de la misma tribu; cambios solo mediante RPCs con validación adicional de rol y pertenencia.
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

Los RPCs públicos de Fase 3 sí son puntos de entrada deliberados para `authenticated`, pero revocan `anon`, fijan `search_path` y vuelven a comprobar sesión activa, tribu y rol antes de cualquier cambio. Que sean ejecutables no equivale a acceso irrestricto a las tablas.

Los RPCs de Fase 4 siguen el mismo límite. Las funciones que descifran un webhook o completan una entrega solo conceden ejecución a `service_role`; `authenticated` no puede invocarlas ni leer las tablas privadas de configuración y entregas.

## Cambio de plataforma 2026

Supabase ya no expone automáticamente nuevas tablas a Data API en proyectos nuevos. RLS y privilegios son capas separadas. Por eso `supabase/rls.sql` declara `GRANT` mínimos de forma explícita y no depende de defaults del proyecto.

## Verificación aplicada

En el proyecto remoto se comprobó aislamiento entre dos tribus, creación atómica de owner, invitación y aceptación, promoción a admin, protección del owner, expulsión autorizada y ausencia de DML directo sobre membresías. La transacción de prueba se revirtió y los Advisors se revisaron después de las migraciones.
