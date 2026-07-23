# Fase 11 - Limpieza de datos test y demo

Fecha de auditoría: 22 de julio de 2026. Proyecto: `vwxqewpvtucygbaethkv`.

La revisión fue de solo lectura. No se borró, pausó ni modificó ninguna fila de producción.

## Hallazgos

| Entidad | Resultado | Decisión |
| --- | ---: | --- |
| Publicaciones de servidor | 0 | No existe un servidor `TEST`, Normal o Plus visible que pausar. |
| Suscripciones de servidor | 0 | Sin limpieza inmediata. |
| Pagos | 5 | Candidatos de QA: 4 `paid`, 1 `pending`, todos sin `listing_id`; los Checkout identificables usan modo test. |
| Customers de facturación | 2 | Revisar contra los dos usuarios de QA antes de archivar o eliminar. |
| Perfiles | 8 | Ningún nombre coincidió con `test/demo/prueba/placeholder/example`. |
| Tribus | 3 | Ningún nombre coincidió con los patrones de prueba. No inferir que sean demo solo por antigüedad. |
| Breeds, mutations y reports | 0 | Sin limpieza inmediata. |

Los cinco pagos fueron creados en una ventana corta el 22 de julio de 2026 y no están vinculados a listings. Esto los hace buenos candidatos de prueba, pero no autoriza borrarlos: primero hay que cotejarlos con Stripe test y con los usuarios propietarios.

## Acción segura desde Admin

- [ ] Confirmar en Admin que continúa habiendo cero listings públicos.
- [ ] Si aparece un listing de QA, cambiarlo a `paused`, `hidden` o `archived` según la acción disponible; dejar `is_featured=false`.
- [ ] No marcar un listing Stripe como `paid` manualmente. Usar el webhook o convertirlo explícitamente en listing manual mediante el flujo de admin.
- [ ] Verificar licencia y propiedad de cada banner antes de activar una ficha.
- [ ] Comparar los 5 pagos con Stripe Dashboard en modo test; conservar los necesarios para la prueba end-to-end.
- [ ] Eliminar datos de QA solo después de registrar propietario, tablas relacionadas y motivo.

## Datos que pueden mantenerse para QA

Los customers y pagos test pueden conservarse hasta completar las pruebas Normal, Plus, cancelación y fallo de pago. Deben permanecer fuera de cualquier métrica comercial. Después de la validación, preparar una operación SQL transaccional revisada o eliminarlos desde una herramienta administrativa; nunca borrar filas relacionadas a mano sin comprobar claves foráneas.
