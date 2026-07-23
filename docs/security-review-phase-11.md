# Revisión de seguridad - Fase 11

Fecha de corte: 22 de julio de 2026.

## Estado verificado

- Las tablas del esquema `public` auditadas tienen RLS activo; la consulta remota devolvió cero tablas públicas sin RLS.
- Las lecturas de tribu dependen de membresía y las mutaciones pasan por RPC que comprueban usuario, tribu y rol.
- Los listings públicos requieren estado activo y pago válido; propietario y admin conservan su lectura privada.
- Checkout comprueba la propiedad antes de crear una sesión y vuelve a validarla en la RPC de preparación.
- Las 20 RPC administrativas prioritarias revisadas son `SECURITY DEFINER`, usan `search_path=''`, rechazan `anon` y comprueban `private.is_global_admin()`.
- Los procesadores Stripe y tracking revocan ejecución a `public`, `anon` y `authenticated`; el trabajo privilegiado exige `service_role`.
- No se desactivó RLS ni se expusieron secrets al frontend.

## Advisors de Supabase

El advisor de seguridad reporta:

- 10 avisos informativos `rls_enabled_no_policy` en tablas privadas o de telemetría con acceso denegado por defecto. Es una decisión intencional, pero debe revisarse si alguna obtiene lectura de usuario.
- 42 advertencias de RPC `SECURITY DEFINER` ejecutables por `authenticated`. Muchas son la API transaccional intencional de la app; no deben ignorarse en bloque. Revisar cada nueva RPC para que tenga identidad/rol, `search_path` vacío, validación de entrada y grants mínimos.
- Protección contra contraseñas filtradas desactivada.

Referencias: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [password security](https://supabase.com/docs/guides/auth/password-security).

## Pruebas manuales de aislamiento

- [ ] Usuario A intenta leer tribu, miembros, breeds y mutations de Usuario B: debe fallar o devolver cero filas.
- [ ] Usuario A intenta actualizar/eliminar el listing de Usuario B: debe fallar.
- [ ] Usuario normal llama cada RPC `admin_*`: debe recibir `global_admin_required`.
- [ ] Usuario anónimo intenta ejecutar RPC privadas/administrativas: debe recibir 401/403 o función no accesible.
- [ ] Admin global puede operar Admin sin adquirir roles `owner/admin/member` de tribu por defecto.
- [ ] Repetir Advisors después de toda migración y clasificar cada hallazgo.

## Riesgos y acciones manuales

- [ ] Activar leaked password protection cuando el plan lo permita y repetir registro/login/reset.
- [ ] Revisar Redirect URLs exactas de producción y previews; evitar comodines amplios.
- [ ] Rotar cualquier secret que haya sido compartido fuera del gestor de secrets.
- [ ] Revisar periódicamente la allowlist de admin global y retirar cuentas no necesarias.
- [ ] Probar backup/restore y documentar retención antes de operación comercial.
- [ ] Revisar SMTP antes de activar confirmación de correo.
