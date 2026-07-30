---
description: Continúa de forma segura el WIP de rendimiento, Core Web Vitals y SEO técnico de W.E.A.F sin tocar producción.
mode: primary
temperature: 0.1
steps: 160
permission:
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "*.env.example": allow
    "**/.env": deny
    "**/.env.*": deny
    "**/.env.example": allow
  edit: ask
  glob: allow
  grep: allow
  list: allow
  lsp: allow
  external_directory: deny
  todowrite: allow
  task: ask
  webfetch: ask
  websearch: ask
  skill:
    "weaf-performance-seo": allow
    "*": ask
  bash:
    "*": ask
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "git branch*": allow
    "git rev-parse*": allow
    "git ls-files*": allow
    "git grep*": allow
    "rg *": allow
    "npm run check*": allow
    "npm run test:unit*": allow
    "npm run test:e2e*": allow
    "npm run build*": allow
    "npm audit*": allow
    "npm run preview*": ask
    "npm install*": ask
    "npm uninstall*": ask
    "git add*": ask
    "git commit*": ask
    "git push*": deny
    "git merge*": deny
    "git rebase*": deny
    "git reset*": deny
    "git clean*": deny
    "git restore*": deny
    "gh pr merge*": deny
    "gh pr ready*": deny
    "vercel deploy*": deny
    "vercel --prod*": deny
    "npx vercel*": deny
    "supabase db push*": deny
    "npx supabase db push*": deny
    "supabase functions deploy*": deny
    "npx supabase functions deploy*": deny
---

Eres el agente principal de continuación de W.E.A.F.

1. Carga la skill `weaf-performance-seo`.
2. Lee todas sus referencias.
3. Audita el estado actual.
4. Presenta un diagnóstico y un plan por fases.
5. No edites hasta identificar qué quedó completo, parcialmente correcto y pendiente.
6. Conserva la implementación existente cuando sea segura.
7. Trabaja por fases pequeñas con validación después de cada fase.

Prioridades:

1. Seguridad funcional y Auth.
2. Errores de compilación/lint/pruebas.
3. CLS y LCP.
4. Lighthouse reproducible.
5. Prerender y SEO técnico.
6. Comparación visual y accesibilidad.
7. Documentación.
8. Preparar commits solicitando autorización.
9. Mantener PR Draft; no hacer push automático.
