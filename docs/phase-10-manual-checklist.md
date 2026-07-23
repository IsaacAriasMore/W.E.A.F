# Checklist manual — Fase 10

> Fase 10 implementada y desplegada. El contenido verificado inicial cubre The Island y 3 INIs editoriales. El resto del catálogo queda como trabajo editorial progresivo.

Las casillas siguientes se conservan como regresión manual repetible, no como bloqueo del cierre documental.

## Público

- [ ] Abrir `/maps-bosses` en 1440 px, 768 px, 390 px y 360 px.
- [ ] Cambiar ASE/ASA y confirmar que Aquatica solo aparece en ASE y Astraeos solo en ASA.
- [ ] Confirmar que Genesis: Part 1 aparece en ambos juegos.
- [ ] Cambiar mapa, boss y Gamma/Beta/Alpha sin salto de layout ni error de consola.
- [ ] Marcar artefactos y tributos, recargar y verificar persistencia.
- [ ] Reiniciar un boss/dificultad y confirmar que otra dificultad conserva su progreso.
- [ ] Verificar que cards sin asset usan el fallback W.E.A.F.
- [ ] Confirmar que el slot patrocinado queda fuera del bloque de requisitos.
- [ ] Abrir `/inis`, alternar juego/categoría y revisar estados vacíos.
- [ ] Copiar y descargar cada preset; verificar nombre, archivo destino y saltos de línea.
- [ ] Abrir el detalle y confirmar fuente, riesgo y reversión.
- [ ] Repetir ES/EN y `prefers-reduced-motion`.

## Admin

- [ ] Acceder con administrador global y abrir Contenido público.
- [ ] Crear y editar un mapa en borrador sin escribir slug.
- [ ] Crear y editar un boss asociado al mapa.
- [ ] Crear Gamma, Beta y Alpha con filas estructuradas de artefactos/tributos.
- [ ] Crear un INI en borrador con fuente, archivo, riesgo y rollback.
- [ ] Publicar cada registro y comprobar su aparición pública.
- [ ] Archivar y confirmar que desaparece para usuario anónimo.
- [ ] Intentar los RPC con usuario normal y confirmar `global_admin_required`.

## Regresión

- [ ] Registro/login/logout y onboarding.
- [ ] Dos usuarios no pueden leer tribus ajenas.
- [ ] Publicación Normal/Plus y Checkout de Stripe.
- [ ] Portal y webhook de Stripe.
- [ ] Anuncios internos de Fase 9 y tracking sin consentimiento.
- [ ] Service Worker no intercepta Auth, Supabase, Stripe ni rutas dinámicas.
- [ ] Sesión expira por cuatro horas de inactividad.

## Automatizado

```powershell
npm.cmd run check
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:e2e
```
