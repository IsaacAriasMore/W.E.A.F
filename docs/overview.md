# W.E.A.F Overview

W.E.A.F, Wild Evolution & Ascension Forge, es una aplicación web comunitaria independiente para jugadores y tribus de ARK: Survival Evolved y ARK: Survival Ascended.

La plataforma se divide en dos dominios:

- Público: Home, INIs, Mapas & Bosses, criaturas, guías, servidores y páginas legales.
- Privado: perfiles, tribus, breeding, mutaciones, propagators, Discord y administración.

La Fase 1 implementa el dominio público inicial con datos locales de demostración. Supabase se conectará desde la Fase 2 sin cambiar la interfaz de servicios ni las rutas públicas.

## Principios no negociables

- JavaScript vanilla sobre Vite.
- Aislamiento multi-tenant por `tribe_id`.
- RLS y privilegios SQL explícitos en todo objeto expuesto.
- Ningún secreto ni webhook completo llega al navegador.
- Diseño mobile-first, accesible y preparado para PWA.
- W.E.A.F no usa logos oficiales como marca ni se presenta como producto afiliado.
