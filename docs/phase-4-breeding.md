# Fase 4: breeding privado y Discord

## Alcance entregado

- Espacios `/app/breeds`, `/app/mutations` y `/app/tribe-settings`, siempre filtrados por la tribu activa.
- Líneas de breeding con especie, objetivo, mutaciones acumuladas, notas y estado `active`, `paused` o `completed`.
- Registro de mutaciones por cualquier miembro activo; creación y administración de líneas para owner y admins.
- Catálogo inicial para ASA y ASE con Rex, Argentavis, Therizinosaur y Megatherium.
- Cooldowns calculados con las reglas de cada tribu: horas fijas cuando usa propagators o cooldown vanilla dividido por el multiplicador de breeding.
- Resumen en dashboard de líneas activas, mutaciones recientes y próximas ventanas.
- Webhook Discord por tribu, editable solo por el owner y mostrado únicamente por sus últimos cuatro caracteres.

## Límite de seguridad

El navegador nunca lee ni almacena el webhook. `configure_tribe_discord_webhook` valida la URL y la entrega a Supabase Vault. La Edge Function `notify-discord-tribe` autentica nuevamente al usuario, pide una entrega preparada con `service_role`, publica un embed sin menciones y registra el resultado en la tabla privada `discord_deliveries`.

Las escrituras de breeds, mutaciones y alertas se realizan mediante RPCs. Cada una verifica sesión activa, membresía, rol y coincidencia entre `tribe_id`, breed y especie antes de cambiar datos.

## Reglas de especies

| Modo de la tribu | Especies visibles |
| --- | --- |
| ASA | `ascended` y `both` |
| ASE | `evolved` y `both` |
| Ambos | todas las activas y públicas |

## Operación

1. El owner abre Configuración y elige propagator o multiplicador.
2. El owner puede guardar un webhook de Discord; la aplicación nunca vuelve a mostrar la URL completa.
3. Owner o admin crea una línea y define sus stats objetivo.
4. Cualquier miembro registra mutaciones. La base acumula stats y crea el cooldown en la misma transacción.
5. Los avisos pueden enviarse desde el registro o desde una ventana disponible.

## Migraciones y función

- `20260721223051_phase_4_private_breeding.sql`: modelo, catálogo inicial, RPCs, Vault, permisos y auditoría.
- `20260721223704_phase_4_discord_url_fix.sql`: validación portable de URL Discord.
- `supabase/functions/notify-discord-tribe`: envío autenticado y registro de entregas.

La validación remota usó usuarios y tenants temporales dentro de una transacción revertida. Comprobó acumulación de mutaciones, aislamiento, revocación de DML directo, Vault y el ciclo de entrega de Discord.
