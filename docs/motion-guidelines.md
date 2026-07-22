# Motion público

## Utilidad

`src/utils/motion.js` inicia y limpia el motion por ruta pública:

- `initPublicMotion(root)` coordina la sesión.
- `observeRevealElements(root)` observa elementos una vez.
- `applyReducedMotionFallback(root)` muestra todo inmediatamente.

Clases disponibles: `reveal`, `reveal-up`, `reveal-left`, `reveal-right`, `reveal-scale`, `cinematic-card` y `glow-card`.

## Reglas

- Animar solo `transform` y `opacity`.
- Usar reveals para jerarquía, no para decorar cada bloque.
- No usar listeners de scroll. El parallax del hero depende de CSS scroll-driven y se omite donde no existe soporte.
- Mantener el formulario de pago y la zona privada sin animaciones pesadas.
- Cada observer debe desconectarse al cambiar de ruta.
- Con `prefers-reduced-motion: reduce`, el contenido queda estático y visible.
