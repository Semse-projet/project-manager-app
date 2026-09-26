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

- [ ] [T-010] Test rojo: `MarketplaceAgent` en modo `live` con `matchScore` bajo el umbral NO dispara `ESTIMATE_REQUESTED`/`PROJECT_PLANNED` hasta `approve`
- [ ] [T-011] Test rojo: en modo `shadow`, el dispatch ocurre igual y además se crea el `JevDecisionEvent`
- [ ] [T-012] [P] Zod schemas (o el equivalente de validación ya en uso en `semse-agents.controller.ts` — confirmar convención real del módulo antes de asumir Zod) para `approve` (override) y `reject` (reason)
- [ ] [T-013] [P] Fixture de doble-approve concurrente sobre el mismo `eventId` (idempotencia)
- [ ] [T-014] Confirmar que T-010/T-011 fallan hoy (demuestran el gap real, no un test vacío)

## Fase 2 — Datos y dominio

- [ ] [T-020] N/A — sin migración Prisma (spec §7, `JevDecisionEvent.feature` es `String`)
- [ ] [T-021] Añadir `"marketplace_classify"` a `DECISION_FEATURES` en `ai-models/decision/decision.types.ts` (actions, caution, certaintyActions, question) sin tocar `agent_router`/`vision_gate`
- [ ] [T-022] Añadir `SEMSE_JEV_MARKETPLACE_GATE_ENABLED`/`_MODE` a `decision-flags.ts`, mismo patrón que `agent_router`
- [ ] [T-023] Implementar el branch de gate en `MarketplaceAgent.handleMessage` (evaluar confidence, escribir `JevDecisionEvent`, pausar dispatch sólo en modo `live` + `HUMAN_REVIEW`)
- [ ] [T-024] Pasar T-010/T-011 (antes rojos, ahora verdes)

## Fase 3 — API/BFF/UI

- [ ] [T-030] `GET /v1/agents/semse/review`, `POST .../review/:eventId/approve`, `POST .../review/:eventId/reject` en `semse-agents.controller.ts` con `@RequirePermissions("ops:dashboard:read"|"ops:dashboard:write")`
- [ ] [T-031] Rutas BFF espejo: `apps/web/app/api/semse/agents/review/route.ts`, `.../[eventId]/approve/route.ts`, `.../[eventId]/reject/route.ts` (patrón `Promise<{ params }>` de Next 15, confirmado en las rutas `pause`/`resume` ya existentes de esta misma sesión)
- [ ] [T-032] Sección "Revisión pendiente" en `admin/agents/page.tsx`: loading/empty/ready/forbidden/degraded/error (spec §5)
- [ ] [T-033] N/A — no hay API surface pública externa que actualizar (endpoints internos de ops)
- [ ] [T-034] Pasar tests de contrato (T-012) y de UI

## Fase 4 — Verificación local

- [ ] [T-040] `pnpm --filter @semse/api test:unit` dirigido a los tests nuevos
- [ ] [T-041] Regresión: correr la suite completa de `@semse/api` (mismo hábito que PRs #678/#680 de esta sesión — confirmar 0 fallos, no sólo los tests nuevos)
- [ ] [T-042] `pnpm typecheck` workspace completo (api/web/worker/mobile + packages)
- [ ] [T-043] `pnpm spec:validate:strict`
- [ ] [T-044] `pnpm spec:coverage` y `pnpm spec:index`
- [ ] [T-045] Actualizar spec a `code_status: COMPLETE` y `status` sigue `APPROVED` (pasa a `IMPLEMENTED` recién en T-054 tras merge real, no antes)

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
