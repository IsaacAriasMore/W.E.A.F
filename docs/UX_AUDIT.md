# Auditoría técnica de UX y accesibilidad

Actualizada: 2026-07-28. Alcance visual ejecutado sobre la rama de auditoría, con
Supabase deshabilitado en el navegador local para no depender de datos ni sesiones reales.

## Resultado

| Dimensión | Puntuación | Evidencia principal |
| --- | ---: | --- |
| Accesibilidad | 3/4 | Semántica, foco y formularios correctos; se corrigieron objetivos táctiles menores de 44 px. |
| Rendimiento | 3/4 | Three.js se carga por ruta y sin warning de 500 kB; falta medición de campo en Preview. |
| Responsive | 4/4 | Sin overflow a 390, 768 y 1280 px; navegación móvil y filtros cambian correctamente. |
| Theming | 3/4 | Marketplace usa tokens; Admin conserva algunos colores históricos hardcodeados. |
| Anti-patrones | 3/4 | Identidad propia y contenida; quedan kickers uppercase repetidos en superficies legacy. |
| **Total** | **16/20** | **Bueno; listo para Preview con validaciones manuales pendientes.** |

Veredicto anti-patrones: no parece una plantilla genérica generada. La sala táctica oscura,
el ámbar fósil y el arte propio sostienen una identidad reconocible. Se retiró del marketplace
el panel con franja lateral y se normalizó el tracking de títulos al sistema W.E.A.F.

## Hallazgos corregidos

- **P1 · Objetivos táctiles pequeños:** idioma, enlaces legales, correo y preferencias medían
  entre 15 y 32 px de alto en móvil. Ahora todos alcanzan al menos 44 px.
- **P2 · Estado de reportes no anunciado:** el resultado de un reporte ahora usa una región
  `aria-live` y recupera el botón aun si falla la petición.
- **P2 · Promesas sin recuperación:** catálogo, detalle, cuenta y retorno de pago muestran un
  estado controlado cuando una llamada rechaza inesperadamente.
- **P3 · Jerarquía tipográfica:** títulos del marketplace usan `-0.035em` y `text-wrap: balance`,
  en línea con `DESIGN.md`.
- **P3 · Panel fuera del lenguaje visual:** la publicación gratuita usa borde completo y radio,
  no una franja lateral decorativa.

## Riesgos de UX restantes

- **P2 · Estados autenticados no recorridos con identidades reales.** Cuenta, formulario,
  Admin y estados PayPal se cubren por unidad/contratos, pero necesitan una pasada visual con
  usuario normal y admin de desarrollo después de aplicar migraciones.
- **P2 · Datos extremos.** Revisar manualmente títulos, URLs e idiomas de longitud máxima con
  datos de desarrollo para confirmar cortes y tablas en Admin.
- **P2 · Métricas de campo.** Lighthouse y Core Web Vitals deben medirse en Vercel Preview;
  el navegador local confirma layout, consola y targets, no latencia de red real.
- **P3 · Superficies legacy.** Admin conserva tracking más agresivo, colores locales y varios
  kickers uppercase. No bloquea WCAG, pero conviene normalizarlo en una fase separada.

## Matriz ejecutada

- Marketplace público: escritorio 1280×720, tablet 768×1024 y móvil 390×844.
- Idiomas: español e inglés.
- Estados: carga, catálogo vacío, error controlado y visitante sin sesión.
- Navegación pública: 8 E2E; Auth y protección de rutas: 12 E2E.
- Resultado: cero overflow horizontal, cero errores/warnings de consola en la ruta auditada y
  20/20 pruebas E2E exitosas.

Pendientes manuales antes de producción: pago pendiente/exitoso/cancelado con PayPal Sandbox,
Normal y Plus, Admin, usuario autenticado, ownership con dos usuarios y contenido límite.

## Acciones recomendadas

1. **P2 · `$impeccable harden`:** probar estados autenticados y errores remotos con datos de desarrollo.
2. **P2 · `$impeccable optimize`:** medir LCP, CLS e INP en Preview y un móvil real.
3. **P3 · `$impeccable typeset`:** normalizar tokens tipográficos de Admin en una fase independiente.
4. **P3 · `$impeccable polish`:** repetir la pasada final después de habilitar el catálogo de desarrollo.

## Validación responsive del hotfix de Admin

- Admin Marketplace, Facturación y Servidores se recorrieron a 390×844, 768×1024 y 1280×720 con
  datos sintéticos no persistentes.
- El documento no produjo scroll horizontal; las tablas anchas quedaron dentro de wrappers
  `overflow-x:auto`; no hubo controles recortados y las acciones alcanzaron 44 px.
- Marketplace público se verificó a 390 px en español e inglés, y Servidores a 768 px en inglés.
- El estado inicial de error fue visible; Reintentar recuperó datos reales del fixture y Guardar solo
  se habilitó en `loaded`.
- La consola de W.E.A.F no registró errores ni warnings. Los únicos mensajes observados pertenecían
  al login SSO de Vercel y no al sitio.
- El Preview protegido se validó mediante requests reales para CSP/caché. La inspección visual usó
  el mismo commit en Vite porque la sesión SSO anterior no estaba compartida con el navegador de esta
  tarea. El fixture `qa-admin.*` fue eliminado al terminar.

## UX de Turnstile

Los tres puntos de Auth comparten un widget oscuro y flexible con estados accesibles `role=status`:
cargando, disponible, verificado, expirado, error y enviando. El botón permanece deshabilitado hasta
verificación cuando la flag está activa; el error conserva feedback antes de reiniciar el widget. Los
controles mantienen 44 px, no agregan sombras o paneles ajenos al sistema mineral/ámbar y el CSS evita
overflow a 390 px. `prefers-reduced-motion` conserva una transición inmediata y legible.

Todos los textos están disponibles en ES/EN, incluida recuperación neutral para evitar enumeración.
La suite cubre el rollout apagado y las rutas inglesas. Falta recorrer el widget real del Preview en
390×844, 768×1024 y escritorio para login, registro y recuperación, comprobando consola/CSP y captura
de token sin imprimirlo. La clave pública oficial de prueba configurada en Preview no es válida para
producción.
