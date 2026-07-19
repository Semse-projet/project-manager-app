# Reporte — Prometeo Copilot & SEMSE Workspace (2026-07-18)

## Objetivo

1. Verificar/arreglar el build base del monorepo.
2. Implementar las features aprobadas: Prometeo Orchestrator, SEMSE Workspace y
   Prometeo Copilot.

## Diagnóstico del build

El build base **compila correctamente** en este entorno. El fallo reportado por
la sesión previa (`Cannot find module '@semse/forge'`) era un `node_modules`
desincronizado: `@semse/forge` (añadido en los PRs #331–335) estaba en el
lockfile pero sin symlink en `packages/agents/node_modules`. Un `pnpm install`
limpio lo resolvió. No se requirieron cambios de código para el build (CI/Docker
hacen instalación limpia).

## Implementación

### Contratos (`packages/schemas/src`)

- `workspace.schema.ts`
- `prometeo-orchestration.schema.ts`
- `prometeo-copilot.schema.ts`

Exportados desde `packages/schemas/src/index.ts`.

### Backend (`apps/api/src/modules`)

- `orchestration/` — FSM + servicio + controlador (`v1/prometeo/orchestrate`,
  `agents/{id}/consult`, `orchestration/{id}`).
- `workspace/` — FSM + servicio + controlador (`v1/workspace/*`).
- `prometeo-copilot/` — servicio + controlador (`v1/prometeo/copilot/*`),
  compone Orchestration + Workspace.
- Registrados en `apps/api/src/app.module.ts`.

### Frontend (`apps/web`)

- `app/workspace/` — página, layout y componentes de los tres paneles.
- `app/components/prometeo/` — `PrometeoCopilot` flotante + subcomponentes.
- `lib/bff/{workspace,prometeo}.ts` — clientes BFF.
- `lib/stores/workspaceStore.ts` — store con `useSyncExternalStore` (sin nueva
  dependencia).
- `lib/hooks/useCopilotContext.ts` — detección de contexto por ruta.
- Rutas BFF bajo `app/api/semse/{workspace,prometeo}/`.
- `PrometeoCopilot` montado en `app/(app)/layout.tsx`.

## Decisiones de diseño

- **Determinismo**: la interpretación de intención es basada en reglas (no LLM)
  para testeabilidad y cobertura; el LLM sigue disponible en el surface existente
  de `prometeo`/`ai-models`.
- **Sin nuevas dependencias**: el store usa React (`useSyncExternalStore`) en
  lugar de añadir Zustand.
- **Eventos**: no se inventaron nombres fuera de `EVENT_CATALOG.md`; los cambios
  materiales se registran vía logger a la espera de registro en el catálogo.
- **RBAC**: endpoints de Prometeo reutilizan `agents:run:create`; los de
  Workspace usan `@AuthenticatedAccess` (solo tocan estado propio del usuario).

## Quality gates

- `pnpm typecheck` → OK (API, web, worker)
- `pnpm lint` → 0 errores (54 warnings preexistentes)
- `pnpm --filter @semse/api test:coverage` → OK (stmts 76.31%, branches 83.05%,
  funcs 68.53%; sobre umbrales 70/80/65)
- `pnpm test:unit` → 845 pass, 0 fail

## Pendiente / follow-ups

- Registrar los eventos de orquestación/workspace/copilot en `EVENT_CATALOG.md`
  y emitirlos vía `DomainEventsService` (hoy quedan como logs de auditoría).
- Persistencia de misiones (dominio Prometeo Memory).
