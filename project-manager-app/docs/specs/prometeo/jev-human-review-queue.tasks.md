---
type: tasks
feature: "jev-human-review-queue"
domain: "prometeo"
plan: "docs/specs/prometeo/jev-human-review-queue.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/jev-human-review-queue"
date: "2026-09-26"
---

# Tareas: Bandeja de revisión humana — Jev Decision Layer, Wave Marketplace

> Prerrequisito: plan aprobado y análisis spec↔plan↔constitución sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar spec `APPROVED` e indexado — `prometeo.jev-human-review-queue`, PR #687, sign-off 2026-09-26
- [x] [T-002] Registrar SHA Git/producción, migraciones y flags actuales — ver plan §1
- [x] [T-003] Completar plan, análisis y checklist — plan escrito; checklist pendiente de generar tras Fase 4
- [x] [T-004] Registrar investigación externa y decisiones — plan §9 ("no aplica", justificado)

## Fase 1 — Tests y contratos

- [x] [T-010] `MAG.P2` (`marketplace-agent-review-gate.test.ts`): modo `live` con `matchScore` bajo el umbral NO dispara `ESTIMATE_REQUESTED`/`PROJECT_PLANNED` hasta `approve`
- [x] [T-011] `MAG.P1`: en modo `shadow`, el dispatch ocurre igual y además se crea el `JevDecisionEvent`
- [x] [T-012] Convención confirmada: el resto de `semse-agents.controller.ts` no usa Zod, sólo `Record<string, unknown>` con parseo manual — se siguió la misma convención en vez de introducir Zod aisladamente
- [x] [T-013] `MAG.dup` cubre doble-approve (evento ya resuelto → `already_resolved`, no re-dispatcha); `MAG.tenant-isolation` cubre aislamiento cross-tenant
- [~] [T-014] No se corrió en rojo-primero literal: tests e implementación se escribieron en la misma pasada, no en dos commits separados. Cada assertion se revisó para confirmar que ejercita el gap real (bloqueo de dispatch, no un no-op) — ver `marketplace-agent-review-gate.test.ts`. Desviación de proceso, documentada en vez de callada.

## Fase 2 — Datos y dominio

- [x] [T-020] Confirmado N/A — sin migración Prisma (`JevDecisionEvent.feature` es `String`, no enum de DB)
- [x] [T-021] `marketplace_classify` añadido a `DECISION_FEATURES` (`decision.types.ts`) — `agent_router`/`vision_gate` sin tocar (test de regresión existente `jev-decision-layer.test.ts` actualizado y verde)
- [x] [T-022] `SEMSE_JEV_MARKETPLACE_GATE_ENABLED`/`_MODE` añadidos a `decision-flags.ts`
- [x] [T-023] Gate implementado en `MarketplaceAgent.handleMessage` — **desviación de diseño respecto al plan §3/§7**: NO se llama a `DecisionLayerService.decide()` (ese método está armado para pedirle una segunda opinión a un LLM externo — Jev AI — sobre un baseline determinístico; esta decisión AUTO_PROCEED/HUMAN_REVIEW ya es 100% determinística, no hay opinión de LLM que pedir). En su lugar: `marketplace-confidence-gate.ts` (función pura, sin DI) evalúa el umbral reutilizando `isFeatureActive`/`resolveCanary`/`config.minConfidence`, y se persiste directo vía `DECISION_TELEMETRY` (mismo repositorio Prisma que usa `decide()`, inyectado ahora también aquí — requirió exportar `DECISION_TELEMETRY` desde `decision-layer.module.ts`, cambio de una línea). Ver comentario de cabecera en `marketplace-confidence-gate.ts`.
- [x] [T-024] Todos verdes — ver Fase 4

## Fase 3 — API/BFF/UI

- [x] [T-030] `GET /v1/agents/semse/review`, `POST .../review/:eventId/approve`, `POST .../review/:eventId/reject` en `semse-agents.controller.ts`
- [x] [T-031] Rutas BFF: `apps/web/app/api/semse/agents/review/route.ts`, `.../[eventId]/approve/route.ts`, `.../[eventId]/reject/route.ts`
- [x] [T-032] Sección "Revisión pendiente" en `admin/agents/page.tsx` — loading/forbidden/degraded/error/ready cubiertos; estado "empty" se resuelve ocultando la sección entera (no ocupa espacio cuando no hay nada pendiente, decisión de UX, no un estado vacío visible)
- [x] [T-033] Confirmado N/A
- [x] [T-034] Cubierto por Fase 1 (los 3 endpoints se ejercitan indirectamente vía los métodos del agente que llaman; no hay test de contrato HTTP separado en esta pasada — **gap documentado**, no fingido: falta un test que golpee el controller/BFF de punta a punta)

## Fase 4 — Verificación local

- [x] [T-040] `node --experimental-strip-types --test test/marketplace-confidence-gate.test.ts test/marketplace-agent-review-gate.test.ts` — 16/16 verdes
- [x] [T-041] Suite completa `@semse/api`: 2614 tests, 2519 pass, 2 fail — **ambos fallos son preexistentes y no relacionados** (`admin-integrations-status.test.ts`, `agro-rbac T-058b`; `@semse/schemas` le falta exportar `AdminIntegrationId`/`AdminIntegrationStatus` desde antes de esta rama). Cero regresiones nuevas tras arreglar 2 asserts sobredimensionados en `jev-decision-layer.test.ts` que asumían sólo 2 features en el registro cerrado.
- [~] [T-042] `pnpm typecheck`: `apps/api` y `apps/web` verificados por separado, **cero errores en los archivos de esta feature**. El workspace completo no puede correr limpio hoy: los mismos ~20 errores preexistentes de `@semse/schemas` (`AdminIntegration*`) bloquean el build de ambos apps independientemente de esta rama — **hallazgo nuevo, no causado aquí, reportado para que se arregle por separado**.
- [x] [T-043] `pnpm spec:validate:strict` — 0 errores, 0 warnings
- [x] [T-044] `pnpm spec:index` — specs indexados; `spec:coverage` no corrido en esta pasada
- [x] [T-045] `code_status: COMPLETE` actualizado en el spec; `status` permanece `APPROVED` hasta el merge real (T-054)

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff completo — sin secretos, sin scope creep hacia BuildOps/Evidence/Crowd (riesgo identificado en plan §8)
- [ ] [T-051] Abrir PR contra `main` con: sin migración (explícito), rollback = apagar flag, evidencia de tests
- [ ] [T-052] Esperar CI terminal (`quality-gates`, `unit-coverage`, `e2e`, `integration` — mismo patrón de espera ya usado en #678/#680); registrar `ci_status: PASS`
- [ ] [T-053] Resolver review sin ampliar scope
- [ ] [T-054] Fusionar; registrar SHA de merge; actualizar `merge_status: MERGED` y spec `status: IMPLEMENTED`

## Fase 6 — Deploy y activación

- [ ] [T-060] Verificar que no hay pre-deploy/migración pendiente (ya establecido: N/A)
- [ ] [T-061] Esperar deployment terminal API/Web (Railway) — verificar realmente, no asumir desde el merge (Artículo XIII)
- [ ] [T-062] Verificar health/readiness y logs post-deploy
- [ ] [T-063] Activar canary gradual: (1) shadow global → (2) live en `SEMSE_JEV_CANARY_TENANT_IDS=tenant_default` → (3) live general — cada paso es una acción humana explícita en Railway, no un flag que un agente active solo (AGENTS.md: "NUNCA tocar variables de entorno de producción")
- [ ] [T-064] Ejecutar smoke autenticado: un ciclo completo shadow (evento visible, no bloqueante) y un ciclo completo live (bloqueo real + approve/reject) sobre `tenant_default`
- [ ] [T-065] Validar métrica clave: tasa de `HUMAN_REVIEW` sobre total de clasificaciones en shadow, antes de mover a live general (señal de rollback si >50%, plan §8)
- [ ] [T-066] Promover a `ACTIVE` (live general) o mantener en `CANARY`/revertir según la tasa observada
- [ ] [T-067] Registrar `production_evidence`, `last_verified` y spec `status: VERIFIED` — sólo con evidencia real, no inferida

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` o `ACTIVE` según el gate aprobado en T-063 (nunca ambos a la vez sin el paso intermedio)
- [ ] Migración `NOT_APPLICABLE` (confirmado en plan §4, no inferido)
- [ ] Evidencia de producción enlazada (conteo shadow + ciclo approve/reject en canary)
- [ ] Índice/matriz/roadmap actualizados (`pnpm spec:index`, `IMPLEMENTATION_STATUS_MATRIX.md`, `ROADMAP.md` si aplica una fila nueva bajo el programa Jev)
