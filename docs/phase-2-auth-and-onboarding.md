# Fase 2: Auth, perfiles y onboarding

## Alcance entregado

- Registro con nombre visible, correo, contraseña y preferencia ASE, ASA o ambos.
- Aceptación explícita de Términos y Privacidad, versionada en `legal_acceptances`.
- Confirmación de correo compatible con el redirect `/onboarding`.
- Ingreso con contraseña y mensajes de error en español sin filtrar detalles internos.
- Ruta protegida de onboarding y rutas de invitado para ingreso y registro.
- Perfil automático al crear `auth.users` mediante trigger `SECURITY DEFINER` con `search_path` vacío.
- Cierre de sesión tras 4 horas de inactividad y diálogo de sesión expirada.
- Diseño responsive y estados de configuración, carga, error, confirmación y finalización.

La creación y unión a tribus se entrega por separado en la Fase 3.

## Activación de Supabase

Las migraciones de Fase 0, RLS, Fase 2 y Fase 3 ya están aplicadas al proyecto remoto W.E.A.F. Para cada entorno desplegado aún se debe:

1. Configurar la Site URL y permitir `https://tu-dominio/onboarding` como Redirect URL.
2. Definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el proveedor de hosting.
3. Mantener fuera del frontend la contraseña de base de datos y cualquier clave `service_role`.

## Decisiones de seguridad

- La clave `service_role` no entra al bundle del navegador.
- El navegador no puede insertar perfiles ni actualizar rol, correo o suspensión.
- El trigger valida la preferencia de juego con una lista cerrada, limita el nombre a 60 caracteres y registra la aceptación legal incluso cuando el alta requiere confirmar el correo.
- Las consultas de perfil incluyen filtro explícito por `id`, además de RLS.
- La redirección `next` del ingreso solo acepta rutas internas que comienzan con `/` y rechaza `//`.
- La actividad entre pestañas guarda únicamente un timestamp, nunca tokens ni datos personales.

## Verificación local

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run build
```

Las pruebas sin credenciales comprueban formularios, consentimiento, selector de juego, guard de rutas, mensaje de configuración y responsive. La prueba unitaria valida la expiración por inactividad. El recorrido real de email y persistencia requiere un proyecto Supabase enlazado.
