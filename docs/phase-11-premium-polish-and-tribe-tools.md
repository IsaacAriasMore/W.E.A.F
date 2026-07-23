# Fase 11 - Pulido premium y herramientas de tribu

## Estado

Implementación terminada. La migración aditiva `20260723022746_phase_11_tribe_breeding_tools.sql` se aplicó al proyecto vinculado el 22 de julio de 2026, después de comprobar que el historial local y remoto estaba alineado. No se reparó, eliminó ni reaplicó historial.

## Experiencia pública

- Home reemplaza la fotografía principal por una composición propia, ligera y progresiva con Three.js opcional, fallback CSS y respeto de `prefers-reduced-motion`.
- El emblema `wild-evolution-emblem.png` identifica navbar, hero y footer con dimensiones reservadas.
- El CTA principal abre registro para visitantes y la tribu activa para usuarios autenticados.
- Navbar muestra Perfil y, únicamente cuando `profiles.global_role = 'admin'` fue hidratado desde Supabase, Admin.
- El contacto oficial se centraliza en `src/config/contact.js`: `waefservice@outlook.com` y `@whiskyzc_`.
- INIs usan nombres completos de juego, categorías principales compactas, filtro avanzado y canales copiables para aportes sujetos a revisión.
- Mapas y bosses mantienen progreso aislado por juego, mapa, boss y dificultad, con controles propios y reset acotado.

## Perfil

`/profile` es una ruta autenticada. Permite editar únicamente `display_name`, `discord_username`, `avatar_url` y `default_game_mode`. Email, fecha de alta, tribu activa y rol global se muestran en solo lectura. Los grants de columnas y RLS existentes impiden modificar email, suspensión o rol global desde el cliente.

## Tribus y breeding

- El selector permite crear otra tribu sin abandonar ni eliminar la actual.
- `rename_tribe` requiere ser propietario y valida nombres de 2 a 60 caracteres.
- `archive_tribe` requiere propietario, nombre exacto y confirmación; desactiva la tribu sin borrar datos.
- Cada línea nueva conserva stats base y actuales, ciclo de breeding y cuidador opcional, validado como miembro activo.
- Las tarjetas muestran la especie como título principal; el nombre de línea queda como contexto secundario.
- `register_breed_stat_mutation` calcula `floor((nuevo - anterior) / 2)`. Rechaza mejoras no positivas o menores a dos, y una diferencia impar exige confirmación explícita.
- El registro conserva actor, snapshot del nombre del actor, cuidador de la línea, valores anterior/nuevo, delta, conteo y ciclo.
- `reset_tribe_breeding` está limitado a owner/admin, guarda snapshot, reinicia stats actuales y acumulados, incrementa ciclo y cancela cooldowns pendientes. No elimina especies, líneas ni historial.

## Seguridad y compatibilidad

- RLS permanece habilitado.
- Las RPC nuevas usan `security definer`, `search_path = ''`, `auth.uid()` y checks explícitos de rol de tribu.
- Ninguna RPC de tribu usa el rol admin global como atajo.
- Las mutaciones heredadas continúan visibles mediante `stats`; los campos estructurados nuevos son compatibles y opcionales para filas previas.
- `tribe_breeding_resets` permite lectura solo a miembros activos y no concede escrituras directas al cliente.

## Verificación

- `npm run check`: correcto, 77 archivos frontend.
- `npm run test:unit`: correcto, 82/82.
- `npm run build`: correcto.
- `npm run test:e2e`: correcto, 19/19.
- `supabase db lint --linked --level warning`: sin problemas de Fase 11; permanece una advertencia previa en `process_stripe_server_event_verified_payload` por una variable no leída.

Las comprobaciones que requieren cuentas, pagos test o consolas externas permanecen en `docs/phase-11-manual-checklist.md`.
