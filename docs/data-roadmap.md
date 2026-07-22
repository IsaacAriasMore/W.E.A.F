# Roadmap de datos reales

Este documento es la lista operativa para sustituir el contenido local inicial por datos mantenibles en Supabase. No publicar una fila solo para llenar una pantalla.

## Metadatos mínimos por registro

- [ ] Fuente principal o referencia comunitaria confiable.
- [ ] URL de fuente y fecha de consulta.
- [ ] Fecha de última revisión.
- [ ] Responsable editorial.
- [ ] Compatibilidad: `evolved`, `ascended` o `both`.
- [ ] Estado: borrador, revisado, publicado o archivado.
- [ ] Nombre y descripción ES/EN, o decisión documentada de fallback.
- [ ] Imagen original/licenciada con autor, licencia y archivo de evidencia.

## Criaturas

- [ ] Inventario completo por ASE, ASA y ambas versiones.
- [ ] Nombre canónico, slug, categoría y uso principal.
- [ ] Mapas de aparición separados de mapa recomendado.
- [ ] ¿Es reproducible? Método, restricciones y excepciones.
- [ ] Cooldown vanilla con rango correcto y contexto.
- [ ] Stats disponibles y stats relevantes para breeding.
- [ ] Notas de versión cuando ASE y ASA difieran.
- [ ] Fuente y fecha de comprobación por ficha.

Prioridad inicial: completar las cuatro especies ya remotas, reconciliar las ocho fichas locales y retirar cualquier duplicado antes de importar el resto.

## Mapas

- [ ] Lista oficial completa de ASE.
- [ ] Lista de mapas ya disponibles en ASA a la fecha de publicación.
- [ ] No clasificar un mapa futuro de ASA como disponible.
- [ ] Tipo de mapa: historia, comunidad oficial u otro.
- [ ] Orden de progresión y descripción corta.
- [ ] Bosses por mapa y arena compartida si aplica.
- [ ] Fuente oficial o wiki comunitaria reconocida y fecha.

Lista local que debe verificarse: The Island, Scorched Earth, Aberration, Extinction, The Center, Ragnarok, Valguero, Genesis: Part 1, Crystal Isles, Genesis: Part 2, Lost Island y Fjordur.

## Bosses y requisitos

- [ ] Un registro por boss y mapa.
- [ ] Gamma, Beta y Alpha separadas.
- [ ] Artefactos requeridos con cantidades.
- [ ] Trofeos requeridos con cantidades.
- [ ] Nivel mínimo y límite de participantes si corresponde.
- [ ] Criaturas permitidas/restringidas y condiciones de arena.
- [ ] Preparación sugerida separada de requisitos obligatorios.
- [ ] Diferencias ASE/ASA verificadas.
- [ ] Fuente y fecha por dificultad.

Bloqueo actual: `boss_requirements` está vacío y el Admin aún no ofrece edición estructurada por dificultad. No presentar el fallback local como lista exhaustiva.

## INIs públicas

- [ ] Probar cada comando en un entorno limpio.
- [ ] Separar cliente, servidor y plataforma.
- [ ] Indicar archivo/sección de destino.
- [ ] Explicar efecto, riesgo y cómo revertir.
- [ ] Confirmar compatibilidad ASE/ASA.
- [ ] Categorías: General, Farmeo, PvP, Hard, FPS, Visibilidad y Clean.
- [ ] Evitar promesas de rendimiento sin medición.
- [ ] Añadir fecha de revisión y versión.

Los seis presets locales son candidatos de revisión, no métricas ni recomendaciones definitivas.

## Rates recomendados

- [ ] Vanilla/oficial 1x como referencia.
- [ ] Presets Bajo, Medio y Alto con explicación de intención.
- [ ] XP, recolección, tameo, crianza, maduración, incubación, intervalo e imprint.
- [ ] Validar que el multiplicador de intervalo se explique en sentido inverso cuando corresponda.
- [ ] Evitar denominar un preset como recomendado sin público objetivo.

## Ayuda y FAQ

- [ ] Cómo saber si un dato aplica a ASE o ASA.
- [ ] Cómo verificar una INI antes de usarla.
- [ ] Diferencia entre requisito obligatorio y preparación sugerida.
- [ ] Cómo reportar un dato incorrecto.
- [ ] Cómo proponer una fuente.
- [ ] Cómo se revisan banners y derechos de imagen.
- [ ] Cómo se actualiza una ficha de servidor.
- [ ] Qué ocurre al cancelar Stripe.

## Orden de carga recomendado

1. Mapas y clasificación por juego.
2. Bosses y requisitos completos de un solo mapa piloto.
3. Especies prioritarias para ese mapa.
4. INIs probadas y reversibles.
5. Repetir por mapa, manteniendo fuente y fecha.
6. Activar contenido solo después de revisión cruzada.

## Controles de plataforma pendientes

- [ ] Activar protección contra contraseñas filtradas cuando el plan de Supabase utilizado lo permita y repetir las pruebas de registro/login.
- [ ] Mantener RLS habilitado y validar con dos usuarios que una tribu nunca pueda leer datos de otra.
- [ ] Revisar periódicamente listings activos, banners, fuentes y fechas; ningún registro demo debe volver a producción.
- [ ] Revalidar SMTP, SPF, DKIM y DMARC antes de volver a activar confirmación obligatoria de correo.

## Operación de anuncios internos

- [ ] Revisar semanalmente que banners, Discord, sitio web, mapas y rates de cada servidor Plus sigan vigentes.
- [ ] Moderar manualmente cualquier promoción engañosa y conservar la auditoría del cambio.
- [ ] Comparar impresiones/clics solo con usuarios que aceptaron medición; no presentar estos datos como alcance total.
- [ ] Definir límites de rotación si el catálogo supera tres servidores Plus simultáneos.
- [ ] Mantener `home_hero_secondary` desactivado hasta confirmar que Home no queda saturada.
- [ ] No habilitar providers externos sin revisión legal, CMP, CSP y migración dedicada.
