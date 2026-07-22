# UX de publicación de servidores

## Flujo actual

El propietario elige un plan, completa una ficha estructurada y guarda el borrador mediante `save_server_listing_draft`. Si Stripe está habilitado, la app abre Checkout después de que la base de datos valida y guarda la publicación.

El formulario no expone campos técnicos. El slug se genera en Postgres a partir del nombre del servidor y recibe un sufijo corto solo cuando existe una colisión.

## Campos

- Mapas: checklist múltiple filtrado por ASE, ASA o ambos.
- Plataformas: checklist múltiple filtrado por juego.
- Mods: una decisión Sí/No almacenada en `has_mods`. `mods` permanece como un array vacío por compatibilidad.
- Rates: preset no especificado, vanilla, bajo, medio, alto o personalizado. El preset no especificado guarda `{ "preset": "not_specified" }` y no bloquea el flujo.
- Discord: obligatorio y limitado a invitaciones `discord.gg` o `discord.com/invite`.
- Website y banner: URLs opcionales.

## Catálogos

Los mapas ya presentes en `src/data/publicData.js` se reutilizan. Las opciones adicionales y las plataformas viven en `src/config/serverListing.js`. Para agregar un mapa, se recomienda incorporarlo al catálogo público si también tendrá contenido de bosses. Si solo se necesita para publicaciones, puede agregarse a `EXTRA_MAPS` con `game: evolved`, `ascended` o `both`.

## Seguridad y validación

- El RPC usa `auth.uid()` y solo actualiza publicaciones del propietario.
- La selección de plan se limita a Normal o Plus.
- El cliente recomienda al menos un mapa y una plataforma. Postgres también exige ambos para impedir bypass del navegador.
- RLS sigue activa.
- Las claves de Stripe no participan en este formulario.

## Prueba manual

1. Abrir `/servers/owners` y elegir Normal o Plus.
2. Cambiar entre ASE, ASA y ambos. Confirmar que mapas y plataformas se filtran.
3. Elegir `No estoy seguro` en rates y guardar.
4. Confirmar que no aparece ningún campo slug ni lista de mods.
5. Revisar el borrador en facturación y continuar a Stripe.
