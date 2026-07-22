# Autenticación de W.E.A.F

## Registro directo actual

W.E.A.F usa email y contraseña con Supabase Auth. La confirmación obligatoria de correo está desactivada durante esta etapa, por lo que el flujo esperado es:

1. La persona completa email, contraseña, nombre visible y juego principal.
2. `supabase.auth.signUp()` crea el usuario.
3. El trigger `private.handle_new_user()` crea `public.profiles` al insertar en `auth.users`.
4. Si Supabase devuelve una sesión, la app la adopta inmediatamente y abre onboarding.
5. Si no devuelve sesión, la app ofrece iniciar sesión sin afirmar que debe revisar el correo.

El trigger de perfil no consulta `email_confirmed_at`, `confirmed_at`, `email_verified` ni datos equivalentes. El rol global mantiene su valor seguro por defecto: `user`.

## Ajuste obligatorio en el proyecto alojado

En Supabase Dashboard:

1. Abrir **Authentication → Sign In / Providers → Email**.
2. Desactivar **Confirm email** o **Enable email confirmations**.
3. Guardar el cambio.

El archivo local `supabase/config.toml` también usa `enable_confirmations = false`, pero ese archivo no modifica automáticamente la configuración del proyecto alojado.

El frontend usa esta variable:

```text
VITE_REQUIRE_EMAIL_CONFIRMATION=false
```

La configuración del frontend y la de Supabase deben coincidir. La constante resultante es `REQUIRE_EMAIL_CONFIRMATION` en `src/config/auth.js`.

## Seguridad que permanece activa

- Row Level Security y privilegios SQL explícitos.
- Acceso a tribus únicamente mediante membresía activa.
- Separación entre admin global y roles owner, admin y member de tribu.
- Rol global `user` por defecto; nunca se recibe desde metadata del registro.
- Timeout por inactividad de cuatro horas.
- Contraseña mínima de ocho caracteres y controles de Supabase Auth.
- Protección contra contraseñas filtradas cuando esté activada en Supabase.

## Riesgos de usar correos no verificados

- Una persona puede registrar una dirección que no controla.
- No se puede confiar en el email como prueba de identidad o propiedad.
- Recuperar contraseña sigue dependiendo de que el buzón y SMTP funcionen.
- Soporte, disputas y cambios de correo requieren más comprobaciones manuales.

Por eso la interfaz muestra un aviso discreto y no bloqueante en la configuración del perfil. Los permisos siempre proceden de la base de datos, nunca de que el correo parezca válido.

## Recuperación de contraseña

El login llama a `resetPasswordForEmail()` y dirige el enlace a `/reset-password`. Después de abrir una sesión de recuperación, la nueva contraseña se guarda con `updateUser()`.

Si SMTP falla, la app muestra:

> No se pudo enviar el correo de recuperación. Inténtalo más tarde.

Cuando la solicitud funciona se usa un mensaje neutro para no revelar si una dirección está registrada.

## Volver a activar confirmación

Cuando exista dominio propio y SMTP autenticado:

1. Configurar el remitente con el dominio definitivo.
2. Publicar registros SPF y DKIM proporcionados por el servicio SMTP.
3. Publicar una política DMARC inicial y revisar sus reportes.
4. Validar Site URL, Redirect URLs y plantillas de Supabase Auth.
5. Probar confirmación y recuperación en Gmail, Yahoo, Microsoft y el dominio propio.
6. Activar **Confirm email** en Supabase.
7. Configurar `VITE_REQUIRE_EMAIL_CONFIRMATION=true` en Vercel.
8. Volver a desplegar y ejecutar las pruebas de registro, login y recuperación.

Con la bandera activa, el registro vuelve a mostrar la instrucción de confirmación y el cliente rechaza una sesión cuyo usuario no tenga `email_confirmed_at`.

## Pruebas de aceptación

- [ ] Crear un usuario nuevo en el proyecto configurado sin confirmación.
- [ ] Confirmar que `signUp()` devuelve una sesión.
- [ ] Confirmar que existe su fila en `public.profiles`.
- [ ] Completar onboarding y abrir el centro de tribu.
- [ ] Crear una tribu y comprobar la membresía owner.
- [ ] Intentar consultar una tribu ajena y confirmar que RLS devuelve cero filas.
- [ ] Cerrar sesión y volver a ingresar con email y contraseña.
- [ ] Verificar cierre por cuatro horas de inactividad.
- [ ] Simular fallo SMTP y comprobar el mensaje de recuperación.
- [ ] Ejecutar `npm run check`, `npm run test:unit`, `npm run test:e2e` y `npm run build`.
