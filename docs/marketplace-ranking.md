# Marketplace ASA: ranking, privacidad y operación

Estado: implementación local pendiente de migración y despliegue. Revisión legal humana pendiente.

## Alcance y compatibilidad

El catálogo v2 acepta y publica únicamente `game='ascended'`. Las filas históricas ASE/Both no se modifican ni eliminan; quedan fuera de las RPC públicas. `get_marketplace_catalog` permanece como compatibilidad/rollback y también filtra ASA después de aplicar la migración.

La UI llama `get_marketplace_catalog_v2(...)` y, durante el despliegue escalonado, puede degradar temporalmente a la RPC v1 filtrando ASA en cliente si v2 aún no existe. No se deben retirar la RPC ni las tablas legacy en esta fase.

## Ordenamiento determinista y justo

Los filtros de estado activo, vigencia, ASA, tipo, categoría, región, plataforma y búsqueda se aplican antes de puntuar. El servidor calcula los buckets; el navegador no puede establecer score, posición ni bucket.

- Destacados: máximo 4, un anuncio por vendedor, bucket de 15 minutos. Peso: 50 relevancia, 30 déficit de exposición, 10 frescura y 10 diversidad de vendedor.
- Orgánico: 45 búsqueda/filtros, 25 afinidad opcional, 15 déficit de exposición, 10 frescura y 5 exploración.
- Exploración: aproximadamente 10 %, determinada por hash de anuncio y bucket de una hora.
- Diversidad orgánica: máximo dos anuncios del mismo vendedor en los primeros 20 candidatos.
- Un anuncio destacado activo no se repite en la sección orgánica.
- Paginación: keyset con cursor opaco firmado, límite máximo 24 y bucket incluido. Un cursor de otro bucket se rechaza.

## Personalización y privacidad

La personalización persistente comienza apagada. Solo un usuario autenticado que la active puede generar eventos o impresiones persistentes. Las ponderaciones server-side son:

- filtro +1;
- búsqueda +1;
- primera vista de detalle +2;
- segunda vista +1; vistas posteriores +0;
- interés/guardar +4;
- contacto Discord +5;
- no me interesa -4.

Los scores usan una vida media de 30 días. `maintain_marketplace_recommendation_data()` elimina eventos e impresiones de más de 90 días, pero no se programa ningún cron remoto en esta fase. Reiniciar recomendaciones elimina eventos y el perfil de intereses, desactiva la preferencia y deja solo un registro de auditoría mínimo sin contenido privado.

No se guardan IP, fingerprint, contraseñas, JWT, cookies, cabeceras Authorization ni tokens CAPTCHA. Los visitantes sin sesión no crean usuarios anónimos ni registros persistentes; su resultado depende únicamente de filtros/búsqueda actuales y rotación general.

## Destacado PayPal Sandbox

Precio fijo server-side: USD 3 por siete días. La creación de orden exige simultáneamente:

1. `feature_flags.paypal_payments=true`;
2. `marketplace_settings.payments_enabled=true`;
3. `marketplace_settings.environment='sandbox'`;
4. `PAYPAL_MODE=sandbox` y endpoint oficial Sandbox;
5. anuncio activo ASA propiedad del usuario;
6. precio exacto de 300 centavos USD;
7. usuario admitido por la allowlist privada si el gate QA está activo.

La allowlist usa UUID de usuario en `private`, no correos hardcodeados ni datos visibles al frontend. Nunca omite los kill switches. El estado inicial del gate es `enforced=true` y la lista queda vacía hasta una autorización explícita.

Solo un webhook firmado e idempotente activa `featured_started_at` y `featured_expires_at`. `published_at` no cambia. `expires_at` solo se extiende cuando sea necesario para cubrir los siete días. Denegación, fallo, refund, reversal o expiración retiran el beneficio sin borrar anuncio, pago ni evento.

## Migraciones locales pendientes

- `20260729230048_marketplace_asa_featured_lifecycle.sql`
- `20260729230051_marketplace_personalized_fair_ranking.sql`
- `20260729230053_marketplace_sandbox_qa_allowlist.sql`

No aplicar en producción hasta completar backup, revisión SQL, `migration list`, lint, dry-run y autorización separada. No desplegar Edge Functions ni configurar cron en este PR.

## Rollback funcional

1. Mantener `paypal_payments=false` y `payments_enabled=false`.
2. Volver el frontend a `get_marketplace_catalog` si v2 presenta un problema.
3. Desactivar personalización desde la UI; los filtros contextuales siguen operando.
4. Conservar tablas, pagos, eventos y auditoría para investigación; no ejecutar `DROP` ni hard delete.
5. Revertir Edge Functions a su versión previa solo después de confirmar que no hay una captura/webhook en curso.
