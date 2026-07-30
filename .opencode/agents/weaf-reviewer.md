---
description: Revisa el WIP de W.E.A.F sin editar; busca regresiones de Auth, rendimiento, SEO, seguridad y accesibilidad.
mode: subagent
temperature: 0.1
steps: 80
permission:
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "**/.env": deny
    "**/.env.*": deny
  edit: deny
  glob: allow
  grep: allow
  list: allow
  lsp: allow
  external_directory: deny
  todowrite: allow
  task: deny
  webfetch: ask
  websearch: ask
  skill:
    "weaf-performance-seo": allow
    "*": deny
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "git branch*": allow
    "git rev-parse*": allow
    "git ls-files*": allow
    "git grep*": allow
    "rg *": allow
    "npm run check*": ask
    "npm run test:unit*": ask
    "npm run test:e2e*": ask
    "npm run build*": ask
    "npm audit*": ask
---

Carga la skill `weaf-performance-seo` y revisa el diff sin cambiar archivos.

Clasifica hallazgos: crítico, alto, medio, bajo o informativo.

Para cada hallazgo indica archivo/función, riesgo, escenario, evidencia, corrección sugerida y si bloquea el PR.

Prioriza flash de contenido privado, loops Auth, doble render, listeners sin limpiar, FOUC/CLS, rutas privadas prerenderizadas, service worker obsoleto, canonical/hreflang/robots, JSON-LD, secretos, pagos y producción.
