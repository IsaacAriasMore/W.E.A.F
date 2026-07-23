# Fase 10 — Contenido ARK, bosses e INIs

Fecha de corte: 22 de julio de 2026.

## Resultado

Fase 10 convierte Mapas & Bosses e INIs en catálogos editoriales alimentados por Supabase, con fallback local cuando la red o el proyecto no están disponibles. No se almacenan imágenes oficiales de ARK. Las cards sin imagen usan un asset original de W.E.A.F.

## Catálogo de mapas

La disponibilidad representa mapas publicados, no anuncios futuros.

| Juego | Mapas incluidos al corte |
| --- | --- |
| ASE | The Island, The Center, Scorched Earth, Ragnarok, Aberration, Extinction, Valguero, Genesis: Part 1, Crystal Isles, Genesis: Part 2, Lost Island, Fjordur y Aquatica |
| ASA | The Island, Scorched Earth, The Center, Aberration, Extinction, Astraeos, Ragnarok, Valguero y Genesis: Part 1 |

Aquatica se identifica como DLC de aniversario premium, no canónico y de ASE. Astraeos se identifica como mapa premium no canónico de ASA. Genesis: Part 1 se incluye en ASA porque su versión Ascended se publicó el 3 de julio de 2026. Genesis: Part 2, Crystal Isles, Lost Island y Fjordur no se presentan como disponibles en ASA a esta fecha.

Fuentes principales:

- [ARK: Survival Ascended — disponibilidad y roadmap](https://ark.wiki.gg/wiki/ARK:_Survival_Ascended)
- [Genesis Ascended Part 1 — Steam](https://store.steampowered.com/app/4558470/ARK_Genesis_Ascended_Part_1/)
- [ARK Aquatica — Steam](https://store.steampowered.com/app/3537070/ARK_Aquatica/)
- [ARK Astraeos — Steam](https://store.steampowered.com/app/3483400/ARK_Astraeos/)

## Bosses y requisitos

- El catálogo contiene 20 encuentros confirmados en The Island, Scorched Earth, Aberration, Extinction, Genesis y Fjordur.
- El piloto exhaustivo es The Island: Broodmother Lysrix, Megapithecus, Dragon y Overseer, cada uno con Gamma, Beta y Alpha.
- Las 12 dificultades de The Island incluyen nivel mínimo, máximo de jugadores, artefactos, tributos, fuente y fecha de revisión.
- Los bosses de otros mapas pueden aparecer con ficha y fuente, pero muestran “pendiente de verificación” mientras sus requisitos no estén publicados. No se inventan cantidades.
- El progreso vive en `localStorage` bajo `weaf:boss-checklist:v2`. La clave separa juego, mapa, boss, dificultad, tipo e ítem; reiniciar una dificultad no borra las demás.

Fuentes de requisitos: páginas individuales de [Broodmother Lysrix](https://ark.wiki.gg/wiki/Broodmother_Lysrix), [Megapithecus](https://ark.wiki.gg/wiki/Megapithecus), [Dragon](https://ark.wiki.gg/wiki/Dragon) y [Overseer](https://ark.wiki.gg/wiki/Overseer).

## Presets INI

Se publican tres candidatos editoriales con fuente, archivo destino, compatibilidad, riesgo, reversión y fecha. Ninguno se presenta como verificado: dos están marcados `experimental` y uno `pending`. “Publicado” significa visible; `verification_status` describe el grado de validación técnica.

El usuario puede copiar, inspeccionar y descargar un `.ini` con finales de línea CRLF. La interfaz recuerda hacer copia de seguridad y evita promesas universales de rendimiento.

## Modelo y seguridad

La migración `20260723000908_phase_10_content_bosses_inis.sql` extiende tablas existentes sin sustituir la arquitectura:

- contenido bilingüe ES/EN;
- `content_status` (`draft`, `reviewed`, `published`, `archived`);
- fuente, responsable y fecha de revisión;
- artefactos, tributos y unlocks como arrays estructurados;
- políticas RLS que solo exponen contenido publicado;
- RPC administrativas `SECURITY DEFINER` con `search_path` vacío y comprobación `private.is_global_admin()`;
- auditoría para altas, cambios y archivo.

No se conceden escrituras a `anon` ni se desactiva RLS.

## Reconciliación del historial

Antes de crear o empujar Fase 10 se ejecutó `npx supabase migration list --linked`. El remoto tenía 25 migraciones aplicadas, incluido el hotfix de Fase 9 registrado como `20260722234931_fix_tracking_service_role_check.sql`; el archivo local conservaba el mismo SQL con timestamp `20260722234732`.

Se renombraron 18 archivos locales a los timestamps ya registrados remotamente y se añadieron copias locales de las dos migraciones base que existían en remoto (`phase_0_schema` y `phase_0_rls`). No se ejecutó `migration repair`, no se borró historial remoto y no se reaplicó SQL. Una segunda lista confirmó 25 pares alineados antes de crear la migración de Fase 10.

El `dry-run` indicó una sola migración pendiente. Después de aplicarla, `npx supabase migration list --linked` confirmó 26 pares local/remoto alineados. La comprobación remota devolvió 14 mapas, 20 bosses, 12 requisitos, 3 INIs publicados, RLS activo y una política en cada tabla de contenido.
