# Fase B — Contenido ARK e INIs ASE/ASA

## Auditoría B0

- **Files:** `src/i18n/es.js`, `src/i18n/en.js`, `src/pages/public/home.js`,
  `src/pages/public/inis.js`, `src/data/publicData.js`,
  `src/services/publicContentService.js`, `src/pages/admin/adminDashboard.js`,
  `supabase/migrations/20260723000908_phase_10_content_bosses_inis.sql`.
- **Data source:** `public.ini_presets`; la página pública consulta los registros
  con `content_status = 'published'`. `src/data/publicData.js` es el fallback.
- **ASE categories before:** `breeding` (1) y `visibility` (1), ambos con
  `game_availability = both`.
- **ASA categories before:** `fps` (1), `breeding` (1) y `visibility` (1).
- **Records affected:** `asa-fps-balanced`, `breeding-starter-server` y
  `clean-visibility`. No hay registros sin categoría ni duplicados exactos:
  3 filas, 3 slugs y 3 contenidos distintos.

No existe un sistema independiente de tags para FPS, Cliente, Servidor, Claw u
otras etiquetas: son valores de la única columna `category`. En los datos
remotos auditados solo existe `fps`; Claw, Cliente y Servidor no tienen filas.

## Cambio local preparado

- Copy ARK: `De la cuenta al primer breed.` → `Mejora tus breeds con W.E.A.F.`
- FAQ: aclara que tribus, breeds, mutaciones y actividad son privadas para
  invitados o personas autorizadas por el owner.
- UI: solo muestra `Todas`, `General`, `PvP`, `Farmeo` y `Otros` para ASE y ASA.
- UI: normaliza categorías heredadas a `other`, de modo que los tres presets
  permanecen localizables incluso antes de aplicar la migración.
- Admin: limita nuevas/ediciones de presets a las cuatro categorías almacenadas:
  `general`, `pvp`, `farming`, `other`.

## Migración remota aplicada

La migración `20260810214436_phase_b_ini_categories.sql` se aplicó al proyecto
vinculado `vwxqewpvtucygbaethkv` después de un dry-run que mostró únicamente
esa migración pendiente:

1. Reclasifica a `other` toda fila con categoría fuera de `general`, `pvp`,
   `farming`, `other` (3 filas auditadas: FPS, Breeding y Visibilidad).
2. Reemplaza el `CHECK` de categorías por esos cuatro valores.
3. Actualiza `admin_upsert_ini_preset` para validar el mismo conjunto, sin
   alterar RLS, grants ni ownership.

**Before:** 3 INIs únicos; ASE muestra 2 y ASA muestra 3 por compatibilidad.

**After verificado:** los mismos 3 INIs; ASE muestra 2 y ASA muestra 3, todos
en `Otros`. No se borraron filas ni contenidos, no se introdujeron duplicados y
el historial local/remoto quedó en 55/55.

**Rollback:** restaurar el `CHECK` y la validación anterior, después reasignar
las tres filas desde el inventario de auditoría (`fps`, `breeding`,
`visibility`).

No se aplicaron otras escrituras remotas ni se tocó PayPal.
