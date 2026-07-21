# Fase 6 - Directorio de servidores

La Fase 6 abre un directorio público real para servidores de ARK: Survival Evolved y ARK: Survival Ascended. Las fichas se leen desde Supabase y solo son visibles cuando están activas y dentro de su periodo de publicación.

## Experiencia pública

- Ruta `/servers` con filtros de juego, modo, mods, plataforma, región, idioma, cluster y propagadores.
- Fichas con mapas, rates, enlaces, badges, wipe y datos de cluster.
- Ruta `/servers/owners` con planes Normal y Plus y explicación del proceso.
- Registro de impresiones y clics a Discord mediante una Edge Function; la IP se transforma en un hash antes de llegar a Postgres.
- Límite de una impresión por hora y un clic cada diez minutos por visitante y publicación.

## Operación administrativa

El área `Administración > Operaciones` permite crear publicaciones manuales de 1, 3, 9 o 12 meses, o sin vencimiento. También permite pausar, renovar y eliminar, además de consultar impresiones, clics y conversión.

Las altas y cambios pasan por funciones SQL `security definer` que vuelven a comprobar el rol global y escriben auditoría. El navegador no obtiene permisos directos sobre los eventos de analítica.

## Preparación para pagos

Los planes y estados necesarios ya existen. La Fase 7 conecta Checkout, webhooks, activación y vencimientos sin exponer claves privadas al frontend.
