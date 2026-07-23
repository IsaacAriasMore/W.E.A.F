# Auditoría de contenido público - Fase 8

> Actualización Fase 10 (22 de julio de 2026): la migración de Fase 10 carga 14 mapas, 20 bosses, 12 dificultades verificadas de The Island y 3 presets INI editoriales. El Admin ya permite editar estas entidades con campos estructurados. El resto de este documento conserva el corte histórico de Fase 8; el estado vigente está en `docs/phase-10-content-bosses-inis.md`.

Fecha de corte: 22 de julio de 2026.

## Resumen ejecutivo

La estructura pública, autenticación, tribus, publicación de servidores y facturación están implementadas. El principal riesgo editorial no es la interfaz: es que Supabase aún no contiene el catálogo público necesario para INIs, mapas y bosses. En producción, las herramientas de consulta usan contenido local inicial mientras esas tablas permanecen vacías.

Consulta de solo lectura realizada al proyecto `vwxqewpvtucygbaethkv`:

| Entidad | Total remoto | Público y activo | Estado |
| --- | ---: | ---: | --- |
| Especies | 4 | 4 | Parcial |
| Presets INI | 0 | 0 | Falta cargar |
| Mapas | 0 | 0 | Falta cargar |
| Bosses | 0 | 0 | Falta cargar |
| Requisitos de boss | 0 | 0 | Falta cargar |
| Servidores | 3 | 2 activos | Operativo; revisar cada ficha antes de lanzamiento |

## Auditoría por superficie

### Home

- Listo: propuesta de valor, jerarquía, FAQ, CTA, imagen hero prioritaria y disclaimer de independencia.
- Corregido: FAQ y textos principales migrados a ES/EN; el escaparate vacío ya no simula servidores.
- Falta: sustituir la imagen repetida de la sección de breeding cuando exista una segunda pieza original con procedencia documentada.

### INIs

- Listo: filtros, vista previa, copiado y descarga.
- Corregido: se eliminaron contadores ficticios de copias y descargas y la etiqueta de demostración.
- Riesgo: los seis presets viven en `src/data/publicData.js`, no en Supabase. Cada línea debe probarse por juego, versión y plataforma antes de publicarse como recomendación estable.
- Falta: poblar `ini_presets`, añadir fuente, fecha de revisión, versión compatible y responsable editorial.

### Mapas & Bosses

- Listo: selector y checklist local por dificultad.
- Riesgo alto: el fallback solo cubre The Island, Scorched Earth y Aberration; The Island no contiene todos sus enfrentamientos y los requisitos actuales no deben considerarse exhaustivos.
- Falta: poblar mapas, bosses y requisitos estructurados en Supabase con fuentes y fechas de revisión.

### Criaturas

- Listo: filtros por juego, tipo, mapa y uso; arte conceptual original.
- Riesgo: el fallback contiene ocho fichas y valores genéricos de cooldown. No representa un catálogo completo.
- Corregido: se retiró el placeholder `Datos por validar` y se sustituyó por una advertencia explícita de versión.
- Falta: completar disponibilidad ASE/ASA, mapas, breeding, cooldown por sexo/configuración y fuente.

### Servidores

- Listo: directorio, filtros, planes, formulario público, Stripe Checkout, portal y estados de confirmación.
- Corregido: navegación, estados, errores, selector de planes y formularios prioritarios usan ES/EN.
- Corregido en Admin: slug automático, checklists de mapas/plataformas, mods Sí/No, rates explicados y duración manual clara.
- Riesgo: revisar las dos fichas activas remotas para confirmar propiedad, enlaces, licencia de banner y actualidad de rates/mapas.

### Legal y footer

- Listo: rutas de términos, privacidad, cookies, independencia, reembolsos, servidores, reportes y contacto.
- Corregido: todas se identifican como documentos preliminares y aclaran que no son asesoría legal definitiva.
- Falta: revisión profesional, versión efectiva, entidad responsable, jurisdicción y procedimiento formal de solicitudes.

### Admin de contenido

- Listo: creación y archivo de especies, INIs, mapas y bosses mediante RPC protegidas.
- Corregido: campos con nombres concretos, slug derivado, categorías controladas, stats seleccionables, URLs opcionales y validación contextual.
- Falta: edición de registros existentes y editor estructurado de requisitos de boss por dificultad.

## Datos demo o incompletos detectados

- Eliminados: servidores locales `Obsidian Coast` y `Valhalla Origins` marcados como ejemplo.
- Eliminados: métricas inventadas de uso de INIs.
- Eliminadas de copy pública: etiquetas de demostración que podían confundirse con contenido validado.
- Pendientes: catálogo local corto de criaturas, mapa/boss incompleto, clasificación ASA dependiente del calendario de lanzamientos y presets INI sin metadatos de verificación.

## Assets e imágenes

| Asset | Uso | Carga | Procedencia conocida | Acción |
| --- | --- | --- | --- | --- |
| `public/assets/weaf-hero.webp` | Hero y referencias visuales | Hero eager + `fetchpriority=high`; repeticiones lazy | Arte original generado para W.E.A.F según `DESIGN.md` | Conservar evidencia de generación y licencia interna |
| `public/assets/creature-sheet.webp` | Biblioteca de criaturas | CSS por cards | Arte conceptual original del proyecto | Conservar evidencia de generación y licencia interna |
| `public/assets/weaf-mark.svg` | Marca y navegación | Inline image local | Marca W.E.A.F | Registrar autor y fecha |
| Banners de servidores | Contenido de usuarios | lazy | Declarada por cada propietario | Añadir confirmación de derechos y moderación |

No se detectan archivos oficiales de ARK dentro de `public/assets`. Los nombres del juego se usan como referencia nominativa y el disclaimer de independencia permanece visible.

## Criterio de salida editorial

Una entidad se considera lista cuando tiene fuente, fecha de revisión, compatibilidad ASE/ASA, copy ES/EN o estrategia de fallback, imagen con procedencia si aplica y revisión de una segunda persona. Hasta entonces debe permanecer privada o identificada como referencia no exhaustiva.

## Cierre visual de Fase 8

- Home mantiene una imagen prioritaria para LCP y añade Three.js como capa decorativa diferida; no se usan modelos ni assets oficiales de ARK.
- INIs, mapas, criaturas, servidores, planes, Auth y legal comparten jerarquía, estados de entrada y feedback de cards sin ocultar contenido cuando falla JavaScript.
- Éxito/cancelación de Stripe y estados vacíos de tribu disponen de fallbacks visuales específicos mientras no existan `.lottie` finales licenciados.
- Los skeletons tienen barrido ligero y se congelan con `prefers-reduced-motion`.
- La auditoría local a 1440 px y 390 px no detectó overflow horizontal ni errores de consola en las rutas públicas prioritarias.
- Admin no recibió rediseño animado y mantiene sus permisos, formularios y servicios actuales.
