---
type: tasks
feature: "ToolResult multimodal tipado (alias histórico SPEC-AGT-004)"
domain: "prometeo"
plan: "docs/specs/prometeo/tool-result-multimodal.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-27"
---

# Tareas: ToolResult multimodal tipado

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Spec `APPROVED`, sin plan/tasks previos — creados en esta
      sesión.
- [x] [T-002] Registrar SHA (`4649dfb`, `origin/main`) y re-confirmar
      estado real de `outputKind`/handler antes de tocar código (sin
      drift desde 2026-08-17).
- [x] [T-003] Hallazgo nuevo documentado en plan.md §1: no existe ningún
      campo de "imagen anotada" en `VisionAnalysisRecord`/`rawResult`/
      `apps/vision-service` — el escenario P1 "con imagen" del spec no es
      ejercitable con datos reales hoy. Decisión: no inventar detección
      especulativa (ver plan.md Riesgos).

## Fase 1 — Tests y contratos

- [x] [T-010] `toolResultPartSchema`/`toolResultSchema` creados en
      `packages/schemas/src/prometeo-runtime.schema.ts`.
- [x] [T-011] Tests de schema: cada `type` válido acepta, un discriminante
      desconocido rechaza.
- [x] [T-012] Test rojo→verde del handler: `vision.analyze_image` ahora
      devuelve `ToolResult` con `legacyJson` idéntico al resultado previo.
- [x] [T-013] Test de regresión: las otras 30 tools no cambian
      `output.data` (P2 del spec).

## Fase 2 — API

- [x] [T-020] `prometeo-tool-registry.ts`: `outputKind` de
      `vision.analyze_image` → `"ToolResult"`.
- [x] [T-021] `prometeo-tool-execution.service.ts`: envolver el resultado
      en `{ parts: [{type:"json", data}], legacyJson: data }` — sin parte
      `image` (ver T-003).

## Fase 3 — Web

- [x] [T-030] Renderer por `ToolResultPart.type` en
      `apps/web/components/ai/prometeo-response.ts`, con fallback al
      resumen existente si `outputKind !== "ToolResult"` o el parseo
      falla.
- [x] [T-031] `agent-chat-panel.tsx` usa el renderer nuevo antes del
      resumen genérico.

## Fase 4 — Verificación local

- [x] [T-040] `pnpm --filter @semse/schemas build` limpio.
- [x] [T-041] `pnpm --filter @semse/api build` limpio.
- [x] [T-042] `node ./scripts/run-tests.mjs` — regresión completa de
      `apps/api`, no solo lo tocado (el registry es compartido por las 31
      tools).
- [x] [T-043] Typecheck del lado web limpio (o error preexistente
      confirmado no relacionado, mismo criterio que la spec anterior).
- [x] [T-044] `pnpm spec:validate:strict`, `pnpm spec:index`.
- [x] [T-045] Spec actualizado a `code_status: COMPLETE`,
      `status: IMPLEMENTED`.

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos.
- [ ] [T-051] Commit + push a `claude/roadmap-continuation-vhmve9`; PR
      nuevo (mandato de rama única — mismo patrón que la spec anterior).
- [ ] [T-052] Esperar CI terminal y registrar `ci_status`.
- [ ] [T-053] Resolver review sin ampliar scope.
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`.

## Fase 6 — Deploy y activación

- [ ] [T-060] Deployment terminal API/Web.
- [ ] [T-061] Smoke real: invocar `vision.analyze_image` autenticado,
      confirmar que `apps/web` renderiza la parte `json` sin romper.
- [ ] [T-062] Registrar `production_evidence`, `last_verified`,
      `status: VERIFIED`.

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Smoke autenticado real confirmado
- [ ] `docs/SPEC_INDEX.md` actualizado
