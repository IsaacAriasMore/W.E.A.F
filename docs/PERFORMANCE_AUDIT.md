# Auditoría de rendimiento

Fecha: 29 de julio de 2026. Entorno medido: build local de producción con Vite 7.

## Resultado

- El bundle inicial permanece separado por ruta; Home, Admin, Servidores y espacios privados no comparten sus módulos de página.
- Three.js continúa siendo una mejora progresiva exclusiva de Home, cargada durante tiempo inactivo y omitida con `saveData`, hardware limitado o `prefers-reduced-motion`.
- La escena importa únicamente módulos concretos de Three.js y separa el runtime básico del renderer WebGL. El warning de chunks mayores de 500 kB desapareció sin elevar artificialmente el límite de Vite.
- Tamaño Three.js inicial: 734.33 kB minificados / 189.46 kB gzip.
- Tamaño después: renderer 418.12 kB / 107.92 kB gzip, material compartido 107.17 kB / 30.04 kB gzip y core de escena 3.81 kB / 1.38 kB gzip. Total aproximado: 529.10 kB / 139.34 kB gzip, diferido.
- Reducción total aproximada: 28.0 % minificado y 26.5 % gzip.
- Los handlers de acciones administrativas ahora salen temprano, bloquean doble clic y restauran el botón con `finally`. Las llamadas de red siguen siendo asíncronas.

## Riesgos y mediciones pendientes

- Lighthouse y Core Web Vitals deben medirse en Vercel Preview y en un móvil real; un build local no representa red, CPU ni caché de producción.
- Comparar LCP, INP, CLS, consumo de batería y GPU con WebGL activo/desactivado.
- El CSS global mide aproximadamente 118.78 kB / 23.53 kB gzip. Dividirlo por ruta solo debe hacerse con cobertura visual suficiente para evitar regresiones.
- Supabase, GSAP y Lottie ya se cargan de forma diferida o por uso; vigilar waterfalls en Preview.

## Presupuesto recomendado

- JavaScript inicial por debajo de 200 kB gzip.
- Ningún chunk minificado por encima de 500 kB.
- CLS menor a 0.1; INP menor a 200 ms; LCP menor a 2.5 s en percentil 75.
- Mantener el hero funcional y legible aunque fallen WebGL, GSAP o Lottie.

## Medición local de cierre - 1 de agosto de 2026

- La ruta `/creatures` usa como elemento LCP el `h1` de texto, no la hoja de criaturas. Lighthouse identificó un `elementRenderDelay` de aproximadamente 140 ms y TTFB de aproximadamente 4 ms; por tanto no existe evidencia para añadir un preload o volver eager las ocho tarjetas.
- La hoja `creature-sheet.webp` pesa 164 KB, queda bajo el presupuesto de 200 KB y mantiene relación de aspecto explícita. El presupuesto inicial terminó en 34.3/40 KB JS gzip y 12.6/15 KB CSS gzip.
- Una repetición local de Lighthouse 13 sobre un servidor Vite ya activo reportó un valor absoluto anómalo de 12.7 s en todas las rutas, aunque el desglose del mismo LHR suma cerca de 145 ms, TBT es 0 y los checks remotos anteriores permanecen aprobados. La ejecución además terminó con `EPERM` al limpiar el perfil temporal de Chrome en Windows. Se conserva el elemento y desglose como diagnóstico, pero no se usa ese valor absoluto contradictorio como regresión del código.
- Accesibilidad, best practices y SEO dieron 100 en las tres corridas de criaturas; CLS fue 0.019. La decisión técnica es no modificar carga de imágenes sin evidencia específica y mantener ID 55 para datos de campo reales.
