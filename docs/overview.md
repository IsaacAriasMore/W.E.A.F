# W.E.A.F Overview

La Fase 6 incorpora el directorio público de servidores, planes para propietarios, analítica de impresiones y clics, y la operación manual desde el centro de administración. Consulta [phase-6-server-marketplace.md](./phase-6-server-marketplace.md).

W.E.A.F, Wild Evolution & Ascension Forge, es una aplicación web comunitaria independiente para jugadores y tribus de ARK: Survival Evolved y ARK: Survival Ascended.

La plataforma se divide en dos dominios:

- Público: Home, INIs, Mapas & Bosses, criaturas, guías, servidores y páginas legales.
- Privado: perfiles, tribus, breeding, mutaciones, propagators, Discord y administración.

La Fase 1 implementa el dominio público inicial con datos locales de demostración. La Fase 2 incorpora Supabase Auth, perfiles y onboarding. La Fase 3 abre el dominio privado con tribus, invitaciones de un solo uso, selección de tribu y administración de miembros por rol.

## Principios no negociables

- JavaScript vanilla sobre Vite.
- Aislamiento multi-tenant por `tribe_id`.
- RLS y privilegios SQL explícitos en todo objeto expuesto.
- Ningún secreto ni webhook completo llega al navegador.
- Diseño mobile-first, accesible y preparado para PWA.
- W.E.A.F no usa logos oficiales como marca ni se presenta como producto afiliado.
