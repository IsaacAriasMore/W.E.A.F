# Sistema de diseño y movimiento de W.E.A.F

## Objetivo

El movimiento refuerza la idea de una sala de planificación nocturna: superficies mineral-azules, una única señal ámbar para actuar y transiciones que explican jerarquía o estado. No debe retrasar una tarea, ocultar contenido crítico ni convertir W.E.A.F en un HUD decorativo.

## Capas del sistema

### CSS e Intersection Observer

`src/utils/motion.js` es la base compartida. Expone:

- `initPublicMotion()` para páginas públicas.
- `initUserMotion()` para autenticación y espacio privado.
- `initScrollAnimations()` para entradas de una sola ejecución.
- `initCardHoverEffects()` para luz localizada en dispositivos con puntero preciso.
- `cleanupMotion()` para desconectar observadores y eventos entre rutas.

Las clases admitidas son `reveal`, `reveal-up`, `reveal-left`, `reveal-right`, `reveal-scale`, `stagger-group`, `stagger-item`, `cinematic-card`, `glow-card`, `interactive-card`, `premium-panel`, `floating-soft` y `three-hero-layer`.

El contenido es visible en HTML y CSS por defecto. JavaScript agrega `pending` únicamente después de estar listo y `visible` cuando el elemento entra en el viewport. Si JavaScript falla, la información no desaparece.

### GSAP

`src/utils/gsapMotion.js` se importa de forma diferida. Solo se activa en:

- Home.
- Directorio de servidores.
- Página de planes para propietarios.
- Selector de plan de publicación.
- Resultados de Stripe.

GSAP orquesta el hero y grupos pequeños marcados con `data-gsap-*`. No usa scroll hijacking ni listeners globales de scroll. Su contexto se revierte al cambiar de ruta.

No se usa GSAP en Admin, formularios de publicación, formularios de tribu, configuración sensible, login ni registro. Esas superficies usan feedback CSS breve y mantienen interacción inmediata.

### Three.js

`src/components/visuals/WeafThreeHero.js` crea una capa abstracta de partículas y geometría wireframe únicamente en el hero de Home.

Controles de rendimiento:

- Three.js se descarga con `import()` después del primer render y durante tiempo inactivo.
- El hero conserva su imagen `eager` con `fetchpriority="high"`; WebGL no bloquea el LCP.
- DPR máximo de `1.5`.
- 96 partículas en escritorio y 54 en vistas compactas.
- Sin modelos 3D, texturas pesadas ni activos oficiales de ARK.
- Se desactiva con `prefers-reduced-motion`, ahorro de datos o móvil de recursos limitados.
- Pausa cuando la pestaña está oculta o el hero sale del viewport.
- Destruye geometrías, materiales, renderer, canvas y listeners al salir de Home.

El chunk de Three.js es independiente del bundle inicial. Su tamaño debe vigilarse en cada actualización de dependencia; no se debe convertir en una dependencia de rutas críticas.

### dotLottie

`src/components/visuals/LottieMotion.js` comprueba primero que el asset exista. Solo entonces importa `@lottiefiles/dotlottie-web`. Si el archivo falta, hay error de red o el usuario reduce movimiento, se mantiene un sello CSS funcional.

Rutas reservadas para assets finales:

- `public/animations/payment-success.lottie`
- `public/animations/payment-cancel.lottie`
- `public/animations/empty-tribe.lottie`
- `public/animations/server-featured.lottie`

Los tres primeros ya tienen puntos de montaje en la interfaz. `server-featured.lottie` queda reservado hasta contar con una animación licenciada y suficientemente ligera. Cada archivo añadido debe documentar autor, origen, licencia y fecha en el registro de assets.

## Zonas sin animación avanzada

- `/admin` completo.
- El cuerpo del formulario `/servers/publish`.
- Formularios de creación/unión de tribu.
- Formularios que guardan webhook, permisos o datos de facturación.
- Controles de cierre de sesión y expiración por inactividad.
- Cualquier contenido que deba estar disponible antes de una consulta o un pago.

Los botones pueden conservar feedback de presión de 100–180 ms y los campos pueden cambiar borde/color al enfocar. No se aplican timelines, parallax ni esperas artificiales.

## Accesibilidad

`prefers-reduced-motion: reduce` fuerza contenido visible, elimina desplazamientos, detiene animaciones automáticas y cambia scroll suave por inmediato. La capa Three.js no se monta y Lottie conserva su fallback estático. El canvas es decorativo, no recibe foco y lleva `aria-hidden`.

El movimiento nunca comunica por sí solo éxito, error, rol o estado. Texto, iconos, badges y regiones `aria-live` siguen siendo la fuente de verdad.

## Service Worker y ciclo de vida

El Service Worker no debe cachear Auth, Supabase, Stripe, Edge Functions ni las rutas dinámicas de publicación/facturación. Cuando se agreguen archivos `.lottie`, se tratarán como assets opcionales: un fallo de cache no puede bloquear el estado CSS.

Cada ruta debe ejecutar su cleanup antes de renderizar la siguiente. Las vistas privadas, que llegan después de consultas a Supabase, inicializan y limpian sus propios observadores después de reemplazar el DOM.

## Verificación

Antes de publicar cambios de motion:

1. Ejecutar `npm run check`.
2. Ejecutar `npm run test:unit`.
3. Ejecutar `npm run build`.
4. Verificar Home con movimiento normal y reducido.
5. Cambiar repetidamente entre Home, servidores, auth y tribu para detectar canvas/listeners residuales.
6. Confirmar que publicar, Checkout, Billing Portal, login y logout funcionan con animaciones deshabilitadas.

## Decisiones de dependencias

- Flutter animations no se instaló porque W.E.A.F es una aplicación web Vanilla JS, no Flutter.
- HyperFrames no se instaló porque no existe una necesidad concreta ni un flujo compatible aprobado; añadir otra capa de animación duplicaría responsabilidades.
- Rive no se instaló porque no hay archivos `.riv` reales, licenciados y optimizados. Se evaluará solo junto con un asset de producción y una medición de peso/CPU.
