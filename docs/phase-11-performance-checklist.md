# Fase 11 - Performance y Web Vitals

## Estado técnico

- El hero prioriza su imagen LCP; las cards usan carga diferida.
- Three.js se importa de forma diferida como mejora decorativa y no debe eliminarse sin medir.
- `prefers-reduced-motion` desactiva o reduce movimiento y tiene cobertura automatizada.
- El Service Worker excluye Auth, Supabase, Stripe, Edge Functions y rutas dinámicas de publicación/facturación.
- La salida de `npm run build` debe conservarse en cada release para vigilar cambios de chunks.

El build de inicio de Fase 11 transformó 125 módulos. CSS: 111.97 kB (22.32 kB gzip). El chunk de Three.js: 734.33 kB (189.46 kB gzip) y Vite mantiene el aviso de chunk mayor a 500 kB. Como la carga es diferida, se conserva en esta fase, pero su coste real queda como medición móvil prioritaria.

## Medición manual

- [ ] Ejecutar Lighthouse en modo móvil para `/`, `/maps-bosses`, `/inis`, `/servers` y `/app` autenticada.
- [ ] Registrar LCP, CLS e INP por ruta y dispositivo; no usar una sola corrida como tendencia.
- [ ] Revisar Vercel Speed Insights si está disponible y comparar p75 móvil.
- [ ] Probar 360 px, 390 px, tablet y escritorio sin overflow horizontal.
- [ ] Probar `prefers-reduced-motion: reduce` y navegación por teclado.
- [ ] Medir CPU/GPU y consumo de batería del hero Three.js en un teléfono de gama media.
- [ ] Comparar con Three.js deshabilitado antes de decidir un cambio.
- [ ] Validar instalación/actualización del Service Worker y una recarga offline del shell.
- [ ] Confirmar que Auth, Checkout, success/cancel y Billing Portal nunca reciben respuestas cacheadas.

## Umbrales operativos iniciales

Usar como objetivos de investigación, no como garantía contractual: LCP p75 menor o igual a 2.5 s, CLS p75 menor o igual a 0.1 e INP p75 menor o igual a 200 ms. Si una ruta falla, guardar dispositivo, red, build y waterfall antes de optimizar.
