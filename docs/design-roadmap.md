# Roadmap de diseño de W.E.A.F

## Estado de cierre de Fase 8

La base visual de Fase 8 queda integrada y verificada localmente en escritorio y móvil: Three.js en Home, GSAP solo en rutas públicas permitidas, motion CSS en contenido y usuario, fallbacks dotLottie diferenciados, estados de carga animados y `prefers-reduced-motion`. Admin conserva su interfaz operativa sin timelines ni WebGL. La siguiente fase no se inicia desde este documento.

Los `.lottie` finales pasan a ser una mejora editorial opcional, no un bloqueo técnico: los fallbacks actuales son ligeros, accesibles y están listos para producción. Si se incorporan assets, deberán reemplazar esos estados sin cambiar contratos de negocio.

## Aplicado en la fase de diseño y animación

### Fundamentos

- Sistema de motion compartido para rutas públicas, autenticación y usuario.
- Contenido visible por defecto, Intersection Observer y cleanup por ruta.
- Staggers limitados y feedback de cards solo en dispositivos apropiados.
- Soporte integral de `prefers-reduced-motion`.
- GSAP cargado de forma diferida y excluido de Admin/formularios críticos.

### Superficies públicas

- Hero de Home con una escena Three.js abstracta, ligera y opcional.
- Entrada orquestada para hero y herramientas públicas.
- Cards de servidores con mejor lectura de imagen, badges y estados.
- Planes Normal/Plus y selector de publicación con jerarquía más clara.
- Resultados Stripe preparados para Lottie con fallback CSS.
- Login, registro y onboarding con composición más coherente, sin cambiar el registro directo ni `VITE_REQUIRE_EMAIL_CONFIRMATION=false`.

### Experiencia de tribu

- Entradas CSS posteriores al render asíncrono de Supabase.
- Dashboard, métricas, miembros y snapshot de breeding con ritmo visual más claro.
- Estados vacíos de tribu, breeds y mutaciones preparados para Lottie.
- Mejor lectura en configuración, webhook y estados de cooldown.
- Admin, roles globales, roles de tribu, RLS y contratos de servicios permanecen sin cambios.

## Pendiente editorial y QA de producción

### Assets y marca

- Diseñar o licenciar los cuatro archivos `.lottie` reservados solo si aportan más claridad que los fallbacks actuales.
- Registrar origen, autor y licencia de cada animación e imagen.
- Medir cada Lottie en móvil de gama media y mantener un fallback estático equivalente.
- Evitar activos oficiales de ARK en escenas, banners de producto o animaciones.

### i18n y contenido

- Completar la migración a i18n ES/EN de la navegación privada, breeding, mutaciones y ajustes de tribu.
- Mantener toda cadena visible nueva en ambos diccionarios.
- Revisar cortes de texto en 360 px, 768 px y escritorio para ambos idiomas.

### Rendimiento

- Registrar LCP, CLS e INP en producción después del despliegue.
- Confirmar que el chunk de Three.js nunca se precarga en rutas distintas de Home.
- Comparar consumo de CPU/GPU con WebGL activo, pestaña oculta y `saveData`.
- Optimizar o retirar cualquier efecto que no sostenga 60 fps en los dispositivos objetivo.

### QA visual y funcional

- Verificar Home, servidores, Owners y Publish con teclado y lector de pantalla.
- Probar `prefers-reduced-motion` a nivel de sistema.
- Validar pagos success/cancel con y sin assets Lottie.
- Probar creación/unión de tribu, invitaciones, breeds, mutaciones, webhook y sesión de 4 horas.
- Confirmar que Admin no recibe clases, bundles ni timelines GSAP.

## Candidatos futuros

### Rive

Considerar Rive solo para una interacción de marca que necesite estados controlados y cuando exista un `.riv` final. Requisitos: licencia documentada, fallback, carga diferida, soporte de movimiento reducido y presupuesto menor que una solución equivalente en video/canvas.

### HyperFrames

Reevaluar únicamente si aparece un caso de uso concreto que GSAP/CSS no resuelva de forma mantenible. No debe coexistir como una segunda solución general de scroll o transiciones.

### Flutter animations

Solo tendría sentido en una aplicación Flutter independiente. No pertenece al bundle web actual y no debe instalarse en este repositorio.

### Evolución de Three.js

Mantener la escena abstracta. No agregar modelos descargables, físicas, postprocesado pesado ni navegación 3D. Cualquier ampliación debe demostrar mejora de comprensión o marca, no solo novedad visual.

## Criterio de cierre para Fase 9

La siguiente fase puede comenzar cuando:

- Los assets Lottie finales estén disponibles o se decida conservar los fallbacks.
- El smoke test visual en producción confirme Home, servidores, auth y tribu.
- No haya regresiones en Auth, Stripe, Supabase/RLS, logout o inactividad.
- `npm run check`, `npm run test:unit` y `npm run build` permanezcan en verde.
