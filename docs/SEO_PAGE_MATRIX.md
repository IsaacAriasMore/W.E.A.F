# Matriz SEO por página

| Ruta | Intención | Title / H1 | Indexación | Schema | Enlaces y pendientes |
|---|---|---|---|---|---|
| `/` | Herramientas para tribus ARK | Únicos por idioma | index | Organization, WebSite, FAQPage | Enlaza todas las herramientas; medir LCP. |
| `/inis` | Configuraciones INI ASE/ASA | Únicos por idioma | index | BreadcrumbList | Crear detalles solo con contenido revisado. |
| `/maps-bosses` | Mapas, bosses y tributos | Únicos por idioma | index | BreadcrumbList | Futuros detalles por mapa/boss. |
| `/creatures` | Catálogo de criaturas | Únicos por idioma | index | BreadcrumbList | Futuros detalles con datos suficientes. |
| `/servers` | Encontrar servidor ARK | Únicos por idioma | index | BreadcrumbList | Detalles activos con slug estable en fase posterior. |
| `/servers/owners` | Publicar servidor | Únicos por idioma | index | BreadcrumbList | Enlaza planes y política. |
| legales y contacto | Confianza y políticas | Únicos por documento | index | BreadcrumbList | Textos preliminares; revisión profesional pendiente. |
| Auth, perfil, tribu y Admin | Acción privada | Títulos funcionales | noindex/noarchive | ninguno | Excluidas también por header y robots. |
| checkout, success, cancel, billing | Flujo transaccional | Títulos funcionales | noindex/noarchive | ninguno | Nunca incluir en sitemap. |
| 404 | Recuperación | Mensaje claro | noindex | ninguno | Debe enlazar Home. |
| `/marketplace` | Comprar, vender o intercambiar recursos | Pendiente de Fase 7 | index al publicarse | ItemList + breadcrumb | Sitemap dinámico con anuncios activos. |
| `/marketplace/:slug` | Detalle de anuncio | Pendiente de Fase 7 | index solo activo | Breadcrumb + contenido | Expirado: noindex y 404/410 según retención. |

Todos los canonicals apuntan al sitio de producción, eliminan query/hash y disponen de alternates `es`, `en` y `x-default` cuando la ruta es indexable.
