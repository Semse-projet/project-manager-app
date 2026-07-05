# Spec — Context Bridge MVP

## Problema

El usuario usa herramientas externas como ChatGPT, Claude, Codex, Gemini, Notion, Figma, GitHub y Railway. Cada herramienta necesita contexto del proyecto. Hoy ese contexto se pierde o se copia manualmente.

## Objetivo

Crear un Context Bridge dentro de `/admin/tool-hub` que genere un bloque de contexto listo para copiar.

## UI requerida

Panel lateral o sección destacada con:

- Project: SEMSEproject
- Repository: Semse-projet/project-manager-app
- Active branch: main
- Environment: Production
- Latest deploy: Production
- Current goal: Modular ecosystem restructure
- Target area: Admin frontend
- Guardrail: no backend, no Prisma, no Railway changes in this phase
- Suggested prompt

## Prompt sugerido

```txt
You are working on SEMSEproject.
Repository: Semse-projet/project-manager-app.
Root: project-manager-app.
Frontend: apps/web.
Target: apps/web/app/(app)/admin.
Goal: apply modular admin ecosystem navigation without breaking production.
Do not change backend, Prisma, Railway, or database migrations in this phase.
Preserve legacy routes and create module hubs for Mission Control, WorkOps, Intelligence, Tool Hub, and Verticals.
Validate TypeScript and web build before finalizing.
```

## Acciones

- Copy Context
- Copy Prompt
- Open GitHub
- Open Railway

## Criterios de aceptación

- Botones no fallan si `navigator.clipboard` no existe.
- En SSR no se accede a `window` sin guard.
- No usa secretos ni tokens.
- No expone variables privadas.
