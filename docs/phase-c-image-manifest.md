# Fase C — Manifest de imágenes de mapas y bosses

Fecha de corte: 11 de agosto de 2026.

## Regla de activos

No se descargan ni versionan imágenes oficiales de ARK (copyright). Los directorios
`public/assets/ark/maps/` y `public/assets/ark/bosses/` son la ubicación reservada para
ilustraciones originales o licenciadas. Convención de nombre: `slug.webp`, en minúsculas.

En tiempo de ejecución, `mapsBosses.js` resuelve `image_url` y, si no existe o no es
`http(s)`, usa el fallback local `/assets/weaf-hero.webp`. El estado en este manifest
indica qué fichero existe ya en el repositorio; lo que no existe usa fallback sin romper
la card. No hay bucle infinito de `onError`: el handler solo reasigna al fallback si la
imagen actual no es ya el fallback.

## Estado

- **AVAILABLE**: el fichero existe en el working tree.
- **MISSING**: no existe todavía; la UI usa el fallback de W.E.A.F.
- **FALLBACK**: el fallback global se muestra por diseño (todos los MISSING en este corte).

## Mapas (`public/assets/ark/maps/`)

| slug | Fichero esperado | Estado |
| --- | --- | --- |
| the-island | the-island.webp | MISSING |
| the-center | the-center.webp | MISSING |
| scorched-earth | scorched-earth.webp | MISSING |
| ragnarok | ragnarok.webp | MISSING |
| aberration | aberration.webp | MISSING |
| extinction | extinction.webp | MISSING |
| valguero | valguero.webp | MISSING |
| genesis-part-1 | genesis-part-1.webp | MISSING |
| crystal-isles | crystal-isles.webp | MISSING |
| genesis-part-2 | genesis-part-2.webp | MISSING |
| lost-island | lost-island.webp | MISSING |
| fjordur | fjordur.webp | MISSING |
| aquatica | aquatica.webp | MISSING |
| astraeos | astraeos.webp | MISSING |
| lost-colony | lost-colony.webp | MISSING |

## Bosses (`public/assets/ark/bosses/`)

Un "boss" es un **encuentro**: una fila de `bosses` agrupa los participantes que se
convocan a la vez (arenas combinadas y la misión Red-Handed). Ragnarok se separa por
juego: `ragnarok-guardians.webp` es el arena ASE (Dragon + Manticore) y `nunatak.webp`
es el boss ASA (Nunatak); no se reutiliza la imagen del arena ASE para Nunatak.
Slugs vigentes: 45.

| slug | Fichero esperado | Estado |
| --- | --- | --- |
| alpha-tridacna | alpha-tridacna.webp | MISSING |
| beyla | beyla.webp | MISSING |
| broodmother-fjordur | broodmother-fjordur.webp | MISSING |
| broodmother-lysrix | broodmother-lysrix.webp | MISSING |
| corrupted-master-controller | corrupted-master-controller.webp | MISSING |
| crystal-wyvern-queen | crystal-wyvern-queen.webp | MISSING |
| cymathoa | cymathoa.webp | MISSING |
| desert-titan | desert-titan.webp | MISSING |
| dinopithecus-king | dinopithecus-king.webp | MISSING |
| dragon | dragon.webp | MISSING |
| dragon-fjordur | dragon-fjordur.webp | MISSING |
| erymanthian-kalydonios | erymanthian-kalydonios.webp | MISSING |
| fenrisulfr | fenrisulfr.webp | MISSING |
| forest-titan | forest-titan.webp | MISSING |
| fractalis | fractalis.webp | MISSING |
| grendel-valguero | grendel-valguero.webp | MISSING |
| hati-and-skoll | hati-and-skoll.webp | MISSING |
| hydraskos | hydraskos.webp | MISSING |
| ice-titan | ice-titan.webp | MISSING |
| iceworm-queen | iceworm-queen.webp | MISSING |
| king-titan | king-titan.webp | MISSING |
| lava-elemental | lava-elemental.webp | MISSING |
| manticore | manticore.webp | MISSING |
| manticore-astraeos | manticore-astraeos.webp | MISSING |
| megapithecus | megapithecus.webp | MISSING |
| megapithecus-fjordur | megapithecus-fjordur.webp | MISSING |
| minotarchos | minotarchos.webp | MISSING |
| moeder | moeder.webp | MISSING |
| natrix | natrix.webp | MISSING |
| nunatak | nunatak.webp | MISSING |
| overseer | overseer.webp | MISSING |
| pulmonoscorpius-monarch | pulmonoscorpius-monarch.webp | MISSING |
| pygocentrus | pygocentrus.webp | MISSING |
| ragnarok-guardians | ragnarok-guardians.webp | MISSING |
| red-handed | red-handed.webp | MISSING |
| rockwell | rockwell.webp | MISSING |
| rockwell-prime | rockwell-prime.webp | MISSING |
| spirit-direwolf-dire-bear | spirit-direwolf-dire-bear.webp | MISSING |
| steinbjorn | steinbjorn.webp | MISSING |
| thanatos | thanatos.webp | MISSING |
| the-center-guardians | the-center-guardians.webp | MISSING |
| thodes | thodes.webp | MISSING |
| valguero-broodmother | valguero-broodmother.webp | MISSING |
| valguero-guardians | valguero-guardians.webp | MISSING |
| vulcanithys | vulcanithys.webp | MISSING |

## Notas

- Cualquier imagen añadida debe pasar por `npm run assets:optimize` y no superar el
  presupuesto de rendimiento. Formato `.webp`, idealmente 1536×1024 (las cards ya fijan
  ese ancho/alto declarado).
- Antes de marcar un fichero AVAILABLE, debe existir en el working tree y estar libre de
  derechos. La fecha de revisión del contenido y del asset deben coincidir.
