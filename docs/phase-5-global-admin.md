# Fase 5: administración global

## Alcance entregado

La ruta `/admin` es un centro de comando separado de `/app`. Requiere sesión, onboarding y `profiles.global_role = admin`; ser owner o admin de una tribu no concede acceso global.

El panel reúne siete áreas:

- Pulso: usuarios, actividad 30d, tribus, breeding, ingresos, reportes y fallos Discord.
- Usuarios: estado, último acceso, suspensión y restauración.
- Tribus: escala y pausa global del tenant.
- Contenido: creación y archivo de especies, presets INI, mapas y bosses.
- Operaciones: listings, planes y pagos; marketplace y Stripe permanecen desactivados hasta las Fases 6 y 7.
- Gobernanza: reportes, feature flags, placements publicitarios y versiones legales.
- Auditoría: actor, acción, entidad y momento de cada cambio sensible.

## Autoridad

La allowlist privada contiene inicialmente `jisaaccv053@gmail.com`. Si esa identidad ya existe, la migración eleva el perfil; si se registra después, el trigger de Auth asigna el rol global durante la creación. La allowlist no tiene grants para `anon` ni `authenticated`.

Todos los RPCs administrativos vuelven a comprobar `private.is_global_admin()`. Los datos de administración se entregan mediante `get_admin_workspace`; el navegador no obtiene acceso directo a `auth.users`, Vault, entregas Discord ni audit logs privados.

## Operación segura

- No se puede suspender la propia cuenta administradora.
- Suspender un perfil invalida los helpers de autorización de W.E.A.F.
- Pausar una tribu conserva datos e historial, pero sus miembros dejan de superar las comprobaciones de tenant activo.
- Archivar contenido cambia visibilidad y actividad en lugar de eliminar referencias históricas.
- Flags de marketplace, Stripe y publicidad nacen desactivados.
- Los pagos son de solo lectura en esta fase; Stripe será la autoridad en Fase 7.

## Migraciones

- `20260721225331_phase_5_global_admin.sql`: allowlist, autoridad, workspace, acciones, contenido, moderación y auditoría.
- `20260721231042_phase_5_admin_defaults.sql`: flags, placements y planes iniciales seguros.

La prueba remota creó dos identidades temporales dentro de una transacción. Verificó denegación al usuario normal, contrato del workspace, suspensión, catálogo, gobernanza y auditoría; la transacción fue revertida.
