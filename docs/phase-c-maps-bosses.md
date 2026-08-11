# Fase C — Catálogo completo de mapas, bosses y requisitos (ASE + ASA)

Fecha de corte: 11 de agosto de 2026.
Estado: implementada en rama `gemini/phase-c-maps-bosses`, **sin aplicar** contra Supabase.

> Objetivo: ampliar el piloto de Fase 10 a un catálogo por juego de ARK: Survival Evolved
> (ASE) y ARK: Survival Ascended (ASA), con dificultades por encuentro reales (no pestañas
> falsas), requisitos verificados solo donde hay fuente, e infraestructura de imágenes sin
> copyright.

## Fuentes y fecha

Investigación a 11 de agosto de 2026 sobre ARK Official Community Wiki (`ark.wiki.gg`),
roadmap oficial y listados de Steam. Los datos de requisitos publicados en esta fase se
extrajeron literalmente de las páginas:

- [Crystal Wyvern Queen](https://ark.wiki.gg/wiki/Crystal_Wyvern_Queen)
- [Dinopithecus King](https://ark.wiki.gg/wiki/Dinopithecus_King)
- [Valguero](https://ark.wiki.gg/wiki/Valguero) (roster por juego)
- [Ragnarok Arena (Ragnarok)](https://ark.wiki.gg/wiki/Ragnarok_Arena_(Ragnarok)) (ASE)
- [Nunatak](https://ark.wiki.gg/wiki/Nunatak) (ASA, Ragnarok)
- [The Center](https://ark.wiki.gg/wiki/The_Center) y
  [The Center Arena (The Center)](https://ark.wiki.gg/wiki/The_Center_Arena_(The_Center))
- [ARK: Survival Ascended](https://ark.wiki.gg/wiki/ARK:_Survival_Ascended) (orden de mapas)
- [Lost Colony](https://ark.wiki.gg/wiki/Lost_Colony)
- [Natrix](https://ark.wiki.gg/wiki/Natrix), [Thodes](https://ark.wiki.gg/wiki/Thodes) y
  [Hydraskos](https://ark.wiki.gg/wiki/Hydraskos) (guardianes de Astraeos, ASA)
- [Minotarchos](https://ark.wiki.gg/wiki/Minotarchos) y
  [Erymanthian & Kalydonios](https://ark.wiki.gg/wiki/Erymanthian_%26_Kalydonios)
  (mini-bosses de Astraeos con tributo de invocación, ASA)
- [Lava Elemental](https://ark.wiki.gg/wiki/Lava_Elemental),
  [Iceworm Queen](https://ark.wiki.gg/wiki/Iceworm_Queen) y
  [Spirit Direwolf & Spirit Dire Bear](https://ark.wiki.gg/wiki/Spirit_Direwolf_%26_Spirit_Dire_Bear)
  (mini-bosses de Ragnarok)
- [Aquatica](https://ark.wiki.gg/wiki/Aquatica),
  [Cymathoa](https://ark.wiki.gg/wiki/Cymathoa),
  [Fractalis](https://ark.wiki.gg/wiki/Fractalis),
  [Pygocentrus](https://ark.wiki.gg/wiki/Pygocentrus) y
  [Vulcanithys](https://ark.wiki.gg/wiki/Vulcanithys) (jefes con tributos) y
  [Alpha Tridacna](https://ark.wiki.gg/wiki/Alpha_Tridacna) (jefe de mundo)
- [Corrupted Master Controller](https://ark.wiki.gg/wiki/Corrupted_Master_Controller)
  (puerta de misiones de The Final Test en Genesis: Part 1)

## Cobertura resultante

| Métrica | Antes (Fase 10) | Después (Fase C) | Esperado | Cubierto |
| --- | --- | --- | --- | --- |
| Mapas ASE | 13 | 13 | 13 | 13 |
| Encuentros ASE | 20 | 34 | 34 | 34 |
| Mapas ASA | 9 | 10 | 10 | 10 |
| Encuentros ASA | 12 | 26 | 26 | 26 |

> Un **encuentro** es una fila de `bosses`: las arenas combinadas y la misión Red-Handed
> agrupan varios participantes en una sola invocación. Los participantes se listan en
> `name_es/name_en` y `description_es/description_en` (formato "X + Y", p. ej.
> "Broodmother Lysrix + Megapithecus"). Esta fase NO añade columnas de schema.

### ASE

| Mapa | Encuentros |
| --- | --- |
| The Island | Broodmother, Megapithecus, Dragon, Overseer |
| The Center | The Center Guardians (Broodmother + Megapithecus) |
| Scorched Earth | Manticore |
| Ragnarok | Ragnarok Guardians (ASE, Dragon + Manticore), Lava Elemental (mazmorra), Iceworm Queen (mazmorra), Spirit Direwolf & Dire Bear (Laberinto de la Vida) |
| Aberration | Rockwell |
| Extinction | Desert, Forest, Ice Titan, King Titan |
| Valguero | Valguero Guardians (Megapithecus + Dragon + Manticore), Broodmother salvaje (encuentro de mundo) |
| Genesis: Part 1 | Moeder, Corrupted Master Controller |
| Crystal Isles | Crystal Wyvern Queen |
| Genesis: Part 2 | Rockwell Prime |
| Lost Island | Dinopithecus King |
| Fjordur | Beyla, Hati & Sköll, Steinbjörn, Broodmother, Megapithecus, Dragon, Fenrisúlfr |
| Aquatica | Cymathoa, Fractalis, Pygocentrus, Vulcanithys (tributos verificados), Alpha Tridacna (jefe de mundo, sin requisitos) |

### ASA

| Mapa | Encuentros |
| --- | --- |
| The Island | Broodmother, Megapithecus, Dragon, Overseer |
| The Center | The Center Guardians (Broodmother + Megapithecus) |
| Scorched Earth | Manticore |
| Ragnarok | Nunatak (exclusivo ASA, guardiana de hielo), Iceworm Queen (mazmorra), Spirit Direwolf & Dire Bear (Laberinto de la Vida) |
| Aberration | Rockwell |
| Extinction | Desert, Forest, Ice Titan, King Titan |
| Valguero | Grendel (exclusivo ASA) |
| Genesis: Part 1 | Moeder, Corrupted Master Controller |
| Astraeos | Natrix, Thodes, Hydraskos (guardianes con tributos), Minotarchos, Erymanthian & Kalydonios (tributo de invocación), Pulmonoscorpius Monarch, Thanatos, Manticore |
| Lost Colony | Red-Handed (Lost King + Lost Queen) |

Valguero es el caso que demuestra roster por juego: ASE tiene Valguero Guardians (la
arena con Megapithecus + Dragon + Manticore, niveles 30/50/70) y la Broodmother salvaje
(encuentro de mundo/special sin dificultades ni requisitos de portal), y ASA solo Grendel
(70/80/90). Astraeos (ASA premium) tiene jefes confirmados: los tres guardianes Natrix
(30/50/70), Thodes y Hydraskos (90/90/90) con artefactos/tributos verificados (el nivel de
Thodes no está publicado por la fuente), los minis
Minotarchos y Erymanthian & Kalydonios con su tributo de invocación verificado (Gamma, sin
puerta de nivel), y Pulmonoscorpius Monarch, Thanatos y la Manticore del mapa pendientes
de verificación. Aquatica (ASE premium) cubre Cymathoa (45/65/85), Fractalis (10/50/70),
Vulcanithys (55/70/95) y Pygocentrus (55/75/100, exige los trofeos de los otros tres jefes
en la misma dificultad) con tributos verificados; Alpha Tridacna sigue siendo un jefe de
mundo sin requisitos de portal.

Ragnarok también se separa por juego, porque ASE y ASA no comparten el boss fight:

- **ASE** — `ragnarok-guardians` (Ragnarok Arena): Dragon + Manticore a la vez, niveles
  70/80/90. Fuente: Ragnarok Arena (Ragnarok).
- **ASA** — `nunatak`: la guardiana de hielo invocada en la Nunatak Arena, niveles
  70/80/90. Fuente: Nunatak. Sus requisitos NO se copian del arena ASE: usa los mismos
  10 artefactos pero con Basilosaurus Blubber 5 (Beta) / 10 (Alpha), frente a 10/25 en el
  Ragnarok Arena de ASE.
- **Mazmorras (sin requisitos de portal)** — `lava-elemental` es ASE-only (Arena de Lava,
  no presente en ASA); `iceworm-queen` y `spirit-direwolf-dire-bear` existen en ambos
  juegos (`both`). Ninguno tiene tributos ni artefactos que recopilar.

## Requisitos verificados

Se publican requisitos únicamente donde la fuente es explícita: 89 dificultades/portales
con `content_status='published'` (86 tablas de tributo/nivel más las 3 puertas de misión de
Corrupted Master Controller) sobre 35 encuentros con requisitos. Incluye los 12 de The
Island (Fase 10), los 9 de los guardianes de Astraeos (Natrix, Thodes, Hydraskos), los 12
de Aquatica (Cymathoa, Fractalis, Vulcanithys, Pygocentrus), los 2 tributos de invocación
Gamma sin puerta de nivel de los minis Minotarchos y Erymanthian & Kalydonios, las 3
puertas de misión del Corrupted Master Controller (58/116/168 misiones) y Ragnarok
Guardians, Nunatak, Valguero Guardians, Grendel, Red-Handed, Crystal Wyvern Queen,
Dinopithecus King, Fjordur y Extinction. El resto del catálogo (Moeder, Rockwell Prime,
Alpha Tridacna, minis de Ragnarok, minis restantes de Astraeos, Broodmother salvaje)
aparece con ficha verificada de existencia pero muestra "Pendiente de verificación" en los
requisitos; no se inventan cantidades.

The Island conserva intactos los 12 requisitos publicados en Fase 10 (mismos slugs,
mismos niveles, mismas claves de checklist). Los portales de Astraeos/Aquatica no reutilizan
los niveles de The Island: cada uno usa su banda wiki (p. ej. Fractalis 10/50/70).

### Corrección final (revisión externa) — Thodes y Corrupted Master Controller

Dos encuentros requieren aclaración editorial sobre la corrección final:

- **Corrupted Master Controller** (Genesis: Part 1) — The Final Test se inicia con un
  requisito de **misiones completadas** (58 Gamma, 116 Beta, 168 Alpha) publicado por la
  wiki. No son niveles de jugador, así que las tres variantes tienen
  `min_player_level = null` y el requisito se representa en `notes_es`/`notes_en`.
  Estado: **PARTIAL** (puerta documentada; Player Level no aplicable/no publicado).
- **Thodes** (Astraeos) — la fuente publica `?` como Player Level en las tres dificultades.
  Conserva sus artefactos (Artifact of the Brute/Pack/Devourer) y tributos verificados, pero
  el nivel queda desconocido: `min_player_level = null` en las tres variantes.
  Estado: **PARTIAL** (tributos verificados; Player Level no publicado).

Matriz real contabilizada contra los 45 encuentros del catálogo:

| Estado | Conteo | Encuentros |
| --- | --- | --- |
| VERIFIED | 33 | Niveles y tributos/artefactos publicados (incluye The Island, Astraeos Natrix/Hydraskos y minis de invocación, Aquatica, Ragnarok/Valguero/Lost Colony/Crystal Isles/Lost Island, Fjordur, Extinction, Scorched Earth, Aberration) |
| PARTIAL | 2 | Thodes (nivel no publicado), Corrupted Master Controller (reto de misiones, sin nivel) |
| NO REQUIREMENTS | 10 | Moeder, Rockwell Prime, Alpha Tridacna, Lava Elemental, Iceworm Queen, Spirit Direwolf & Dire Bear, Pulmonoscorpius Monarch, Thanatos, Manticore (Astraeos), Broodmother salvaje |
| UNKNOWN | 0 | — |

## Dificultades por encuentro

El cambio arquitectónico de la página `mapsBosses.js`:

- Se elimina la constante global `DIFFICULTIES = ['gamma','beta','alpha']` y el conmutador
  único por página.
- Las variantes de cada boss se derivan de las claves de `boss.requirements`
  (`src/utils/bossDifficulties.js` → `availableDifficulties` / `currentDifficulty`).
- Orden estable: `gamma`, `beta`, `alpha`, y luego el resto alfabético. Se usan
  `aria-pressed` y botones de tab por card solo cuando el boss tiene 2+ variantes.
- Si la dificultad preferida no existe para el encuentro actual (cambio de juego, de mapa
  o de boss), se auto-selecciona la primera variante disponible. Nunca se muestra una
  pestaña Gamma/Beta/Alpha falsa para un encuentro de una sola variante o pendiente.
- El checklist conserva la clave `weaf:boss-checklist:v2` y el prefijo
  `juego:mapa:boss:dificultad:tipo:item`. Reiniciar una dificultad no afecta a las demás.

Esto permite modelar en el futuro encuentros con variantes no Gamma/Beta/Alpha sin tocar
la capa de presentación: solo faltaría ampliar el CHECK de `difficulty` en
`boss_requirements` y la validación del RPC admin, que en esta fase NO se modifican.

## Cambios de datos y migración

`supabase/migrations/20260811000000_phase_c_maps_bosses_catalog.sql` (nueva, no aplicada):

- Añade el mapa **Lost Colony** (canónico, de pago, ASA, orden 9) y corrige el orden de
  **Genesis: Part 1** en ASA a 10 (7 dic 2025 vs 3 jul 2026).
- Inserta 25 encuentros con `game_availability` por juego: The Center Guardians en `both`
  (The Center Ascended conserva Broodmother + Megapithecus); Ragnarok Guardians (ASE),
  Nunatak (ASA) y los minis de mazmorra Lava Elemental (ASE), Iceworm Queen y Spirit
  Direwolf & Dire Bear (`both`); Valguero Guardians + Broodmother salvaje (ASE) y Grendel
  (ASA); Red-Handed (ASA); Crystal Wyvern Queen y Dinopithecus King (ASE); los 8 de
  Astraeos (Natrix, Thodes, Hydraskos, Minotarchos, Erymanthian & Kalydonios,
  Pulmonoscorpius Monarch, Thanatos, Manticore) y los 5 de Aquatica (Cymathoa, Fractalis,
  Pygocentrus, Vulcanithys, Alpha Tridacna).
- Inserta 89 requisitos con `content_status='published'` (los 12 de The Island de Fase 10,
  los de Ragnarok/Valguero/Lost Colony/Crystal Isles/Lost Island, Fjordur y Extinction, los
  9 de los guardianes de Astraeos, los 12 de Aquatica, los 2 tributos de invocación de los
  minis Minotarchos y Erymanthian & Kalydonios, y las 3 puertas de misión del Corrupted
  Master Controller). Thodes y Corrupted Master Controller mantienen `min_player_level =
  null` con la explicación del dato en notas (nivel no publicado y requisito de misiones).
- Es **DATA-ONLY** (solo INSERT + `on conflict ... do update`), sin cambios de schema:
  0 `ALTER TABLE`, 0 columnas nuevas, sin RLS/policies/grants. No borra, no toca pagos,
  marketplace, auth ni el historial de migraciones.

`src/data/publicData.js` (fallback local) se alinea con el modelo de encounters: los
participantes se exponen en `name_es/name_en` y `description_es/description_en` (formato
"X + Y"), y las arenas combinadas son una sola ficha (The Center Guardians, Ragnarok
Guardians, Valguero Guardians, Red-Handed). Ragnarok queda modelado como dos encuentros
separados: `ragnarok-guardians` (ASE) y `nunatak` (ASA). La UI de `mapsBosses.js` muestra
la descripción con los participantes; no hay lista estructurada nueva.

## Mejora de schema opcional (pendiente de decisión externa)

Este corte modela los participantes de cada encuentro en el texto localizado
(`name`/`description`). Si el owner quiere consultar/agrupar criaturas por encuentro de
forma estructurada, la vía futura sería una columna aditiva `public.bosses.creatures
text[]` (o una tabla de relación) en **una migración aparte**, con su propio rollback y
revisión. No se introduce en esta fase para mantener la migración DATA-ONLY.

## Imágenes

Sin capturas oficiales. Se reservan `public/assets/ark/maps/` y `public/assets/ark/bosses/`
(convención `slug.webp`) y el runtime usa `/assets/weaf-hero.webp` como fallback con un
handler `onError` que no entra en bucle. El manifest está en
[docs/phase-c-image-manifest.md](phase-c-image-manifest.md): 15 mapas y 45 slugs de boss
(encuentros), todos MISSING en este corte.

## Seguridad y límites

- Sin secretos, JWT, cookies ni `Authorization` en diffs/build.
- RLS intacto; solo `content_status='published'` sale por `publicContentService`.
- `paypal_payments=false` y Marketplace `payments_enabled=false` sin cambios.
- La migración no se ha aplicado ni se empujará: requiere revisión del owner.

## Verificación previa remota (antes de `db push`)

El remote solo tiene las filas de Fase 10 (nunca llegó la Phase C antigua con slugs
`broodmother-center`, `dragon-ragnarok`, `lost-king`, `lost-queen`, etc.). Antes de aplicar:

1. `npx supabase migration list --linked` y comparar historial local/remoto.
2. Confirmar que no existen filas huérfanas de slugs antiguos:
   `select slug from public.bosses where slug in ('broodmother-center','dragon-ragnarok','lost-king','lost-queen','dragon-valguero');`
   Si aparecen, revisar antes de `db push`; no se reparan ni borran sin evidencia.
3. `npx supabase db lint --linked --level warning` tras aplicar.

## Definición de hecho

- `npm run check`, unitarios y `npm run build` en verde.
- Migración nueva sin aplicar; `REMOTE AUTHORIZATION REQUIRED: YES`.
- Checklist v2 y slugs existentes estables; sin datos inventados; ES/EN coherentes.
