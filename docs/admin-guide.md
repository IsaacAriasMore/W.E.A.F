# Guía del centro de comando

## Acceso

Inicia sesión con la identidad autorizada y abre **Administración global** desde el espacio de tribu. El enlace solo aparece para un perfil global admin. Una cuenta de tribu, aunque sea owner, regresa a `/app` si intenta abrir `/admin`.

## Decisiones sensibles

Antes de suspender un usuario o pausar una tribu, confirma el objetivo. Ambas acciones son reversibles desde la misma fila y quedan registradas en Auditoría.

Para retirar una especie, INI, mapa o boss, usa **Archivar**. Esta operación evita romper breeds o referencias existentes. Las nuevas entradas pueden guardarse como borrador y publicarse después.

## Lanzamientos y monetización

Los feature flags controlan capacidades globales. No actives `server_marketplace`, `stripe_payments` o `community_ads` hasta completar y validar sus fases correspondientes.

Los placements publicitarios comienzan apagados. Activarlos solo cambia la configuración central; todavía deben tener un proveedor y creatividad válidos antes de mostrarse al público.

## Legal y moderación

Cada documento legal tiene tipo y versión. Guardar un borrador no reemplaza el documento público. Publicar debe hacerse después de revisión legal.

Los reportes se mueven entre abierto, revisando, resuelto o descartado. El cambio guarda quién revisó y cuándo.
