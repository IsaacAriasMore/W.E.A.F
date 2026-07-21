# Fase 3: tribus, invitaciones y miembros

## Alcance entregado

- Ruta privada `/app`, disponible después de completar el onboarding.
- Creación atómica de tribu y membresía del propietario.
- Pertenencia a múltiples tribus y selector de contexto activo.
- Invitaciones de un solo uso por correo o Steam ID, con expiración entre 1 y 168 horas.
- Aceptación desde un enlace tanto para usuarios sin tribu como para miembros existentes.
- Lista segura de miembros, nombre de personaje, Steam ID y rol.
- Promoción o degradación entre `member` y `admin` por el propietario.
- Expulsión según jerarquía y salida voluntaria; el propietario no puede abandonar su propia tribu.
- Navegación privada responsive con sidebar en escritorio y barra inferior en móvil.

## Modelo de permisos

| Acción | Owner | Admin | Member |
| --- | --- | --- | --- |
| Ver tribu y miembros | Sí | Sí | Sí |
| Invitar miembros | Sí | Sí | No |
| Invitar admins | Sí | No | No |
| Cambiar roles | Sí | No | No |
| Expulsar miembros | Sí | Sí | No |
| Expulsar owner o admins | No | No | No |
| Abandonar tribu | No | Sí | Sí |

La suspensión global invalida los helpers de membresía. El cliente no recibe una capacidad administrativa por enviar un `tribe_id`: PostgreSQL recalcula autorización para cada solicitud.

## Seguridad de invitaciones

El token aleatorio se entrega una sola vez al creador y la base almacena únicamente su hash SHA-256. Al aceptar, la operación bloquea la invitación, valida estado, vencimiento, destino y usuario, crea la membresía y marca el token como aceptado dentro de una transacción. Se limitan a 20 invitaciones por hora por usuario y 3 tribus creadas por hora.

## Migraciones

- `20260721215035_phase_3_tribes.sql`: RPCs, privilegios, índices y flujo principal.
- `20260721215906_phase_3_tribes_hardening.sql`: límites de entrada y comprobación de suspensión.
- `20260721220105_phase_3_invite_crypto_fix.sql`: resolución explícita de funciones criptográficas en `extensions`.
- `20260721221500_phase_3_member_inviter_index.sql`: índice de cobertura para la referencia al usuario que invitó al miembro.

## Validación remota

Se ejecutó una transacción multiusuario que verificó creación, invitación, aceptación, aislamiento entre tenants, promoción, protección del propietario, expulsión y revocación de DML directo. La transacción terminó con éxito y fue revertida para no conservar fixtures. Security y Performance Advisors se revisaron después de las migraciones.

Los avisos de seguridad que identifican RPCs `SECURITY DEFINER` ejecutables por `authenticated` corresponden a los puntos de entrada intencionales. Cada cuerpo valida `auth.uid()`, suspensión y rol, usa relaciones calificadas y rechaza `anon`. Las tablas internas sin policy permanecen cerradas al navegador por diseño.

## Operación

- Nunca guardes la contraseña de PostgreSQL ni `service_role` en archivos `VITE_*`.
- Conserva `.env.local` fuera de Git.
- Añade la URL real de `/onboarding` a las Redirect URLs de Auth antes de publicar.
- Ejecuta `npm run check`, `npm run test:unit`, `npm run test:e2e` y `npm run build` antes de cada entrega.

La Fase 4 puede construir breeding, mutaciones y automatizaciones de Discord sobre este límite de tenant ya establecido.
