# Fase 11 - Checklist Auth y SMTP

## Comportamiento actual

Con `VITE_REQUIRE_EMAIL_CONFIRMATION=false`, el registro crea la cuenta y usa la sesión inmediata que devuelve Supabase. El onboarding no exige `email_confirmed_at`; login, logout, rutas protegidas, recuperación y cierre por cuatro horas de inactividad conservan sus pruebas automatizadas.

Los logs recientes incluyen registros `/signup` 200 con `immediate_login_after_signup=true`, coherentes con el flujo directo actual. También hay intentos anteriores con `email_not_confirmed`; revisar cuentas creadas durante cambios de configuración si un usuario concreto no puede entrar.

## QA actual

- [ ] Registrar un email nuevo y confirmar entrada inmediata a onboarding.
- [ ] Confirmar creación de `profiles` y que el usuario sin tribu ve onboarding.
- [ ] Cerrar sesión y volver a entrar con credenciales correctas.
- [ ] Confirmar mensajes claros para credenciales incorrectas y cuenta heredada no confirmada.
- [ ] Confirmar que `/app` y `/admin` redirigen a login sin sesión.
- [ ] Confirmar que un usuario normal autenticado no accede a Admin.
- [ ] Probar cuatro horas de inactividad con reloj controlado y confirmar logout.
- [ ] Probar recuperación; si SMTP falla, la app debe mostrar un error recuperable.

## Cuando exista dominio propio

- [ ] Verificar un dominio de envío con Brevo u otro SMTP transaccional.
- [ ] Publicar SPF sin duplicar registros incompatibles.
- [ ] Publicar y validar DKIM.
- [ ] Publicar DMARC primero con política de observación y revisar reportes antes de endurecerla.
- [ ] Usar un remitente como `no-reply@dominio` y un canal real de soporte separado.
- [ ] Configurar SMTP en Supabase y probar registro, reset y entrega a Gmail, Outlook y Yahoo.
- [ ] Revisar [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) y plantillas.
- [ ] Solo entonces activar Confirm email en Supabase y `VITE_REQUIRE_EMAIL_CONFIRMATION=true` en Vercel en el mismo despliegue.

Guía de referencia: [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
