# W.E.A.F Design System

## Intent

Una sala de planificación usada por una tribu de noche: roca oscura, luz de monitor contenida y un único destello ámbar que señala la siguiente acción.

La interfaz combina una base casi negra con superficies azul mineral. El ámbar fósil es la firma de marca y el único acento de acción. La imagen generada de criaturas prehistóricas es original y evita activos de franquicias.

## Design dials

- DESIGN_VARIANCE: 7
- MOTION_INTENSITY: 5
- VISUAL_DENSITY: 4

## Color strategy

Estrategia contenida con identidad comprometida en el hero. Todos los colores se expresan en OKLCH.

```css
:root {
  --color-bg: oklch(0.105 0.012 252);
  --color-bg-raised: oklch(0.145 0.018 252);
  --color-surface: oklch(0.185 0.022 252);
  --color-surface-strong: oklch(0.235 0.025 252);
  --color-ink: oklch(0.955 0.008 80);
  --color-muted: oklch(0.74 0.018 250);
  --color-subtle: oklch(0.59 0.018 250);
  --color-primary: oklch(0.70 0.13 60);
  --color-primary-strong: oklch(0.62 0.14 55);
  --color-line: oklch(0.30 0.024 252);
  --color-danger: oklch(0.67 0.16 25);
}
```

## Typography

La familia principal es `Archivo Variable`, autoalojada y con `font-display: swap`. Los títulos usan pesos 700-800, tracking mínimo de `-0.035em` y escalas fluidas. Los datos breves usan la pila monoespaciada del sistema solo cuando representan valores, códigos o tiempos.

## Shape

- Cards y paneles: 14 px.
- Inputs y controles: 10 px.
- Botones y filtros: píldora completa cuando son acciones compactas.
- Sin sombras amplias sobre elementos con borde.

## Layout

- Contenedor máximo: 1240 px.
- Mobile-first desde 360 px.
- Hero asimétrico, texto a la izquierda y arte real a la derecha.
- Las páginas de herramientas priorizan controles simples, resultados inmediatos y estados vacíos claros.
- Espaciado por escala de 4, 8, 12, 16, 24, 32, 48, 72 y 96 px.

## Motion

- Entrada inicial del hero para comunicar jerarquía.
- Transiciones de 180-320 ms para feedback de filtros, copiado y navegación.
- Nada se oculta antes de que JavaScript ejecute.
- `prefers-reduced-motion: reduce` desactiva desplazamientos y animaciones automáticas.

## Components

- Header público compacto, con navegación de una sola línea en escritorio y panel móvil accesible.
- Botón primario ámbar con texto oscuro de alto contraste.
- Botón secundario sobre superficie oscura con borde definido.
- Cards solo para entidades seleccionables: INIs, criaturas, mapas y bosses.
- Footer editorial con bloque de creador estilo Discord, sin copiar recursos de Discord.

## Content rules

- Español como idioma inicial.
- Mensajes concretos, sin superlativos vacíos.
- No usar em dash ni separadores decorativos repetidos.
- No presentar datos de demostración como métricas reales.
- Disclaimer de independencia siempre visible en el footer.
