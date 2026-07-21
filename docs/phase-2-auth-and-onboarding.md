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

La creación y unión a tribus se mantiene fuera de este alcance y comienza en Fase 3.

## Activación de Supabase

1. Confirma el proyecto correcto; no se aplicó la migración remotamente porque la cuenta conectada no contiene un proyecto inequívocamente llamado W.E.A.F.
2. Aplica primero `supabase/schema.sql` y `supabase/rls.sql` en una rama de desarrollo si el proyecto todavía no tiene la base de Fase 0.
3. Aplica `supabase/migrations/20260721212837_phase_2_auth_profiles.sql` con Supabase CLI.
4. Configura la Site URL y permite `https://tu-dominio/onboarding` como Redirect URL.
5. Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en local y Vercel.
6. Ejecuta Security y Performance Advisors después de la migración.

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
