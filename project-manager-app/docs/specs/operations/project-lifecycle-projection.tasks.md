---
type: tasks
feature: "Project Lifecycle Projection F3"
domain: "operations"
plan: "docs/specs/operations/project-lifecycle-projection.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/production-convergence-f3"
date: "2026-07-28"
---

# Tareas: Project Lifecycle Projection F3

## Fase 0 — Verdad y SDD

- [x] [T-001] Auditar Git/Railway/PostgreSQL
- [x] [T-002] Recuperar WIP y SQL sin aplicar stash
- [x] [T-003] Aprobar spec/plan/tasks/checklist
- [x] [T-004] Regenerar SPEC_INDEX y matriz

## Fase 1 — Tests/contratos

- [x] [T-010] Escribir tests del builder mejorado
- [x] [T-011] Escribir tests de CAS/concurrencia/ownership
- [x] [T-012] Actualizar Zod schema

## Fase 2 — Datos

- [x] [T-020] Restaurar migration.sql exacto
- [x] [T-021] Confirmar checksum SHA-256
- [x] [T-022] Agregar modelo/relaciones Prisma
- [x] [T-023] Generar/validar Prisma Client
- [x] [T-024] Agregar `Evidence.updatedAt` como reloj de fuente para CAS

## Fase 3 — API

- [x] [T-030] Implementar builder determinista
- [x] [T-031] Implementar consulta tenant-scoped y fuentes
- [x] [T-032] Implementar CAS flaggeado
- [x] [T-033] Implementar endpoint/permission/allowlist
- [x] [T-034] Actualizar controller tests

## Fase 4 — Web/BuildOps

- [x] [T-040] Exponer canonicalProjectId
- [x] [T-041] Implementar BFF
- [x] [T-042] Implementar panel y estados
- [x] [T-043] Integrar Cliente/BuildOps

## Fase 5 — Verificación

- [x] [T-050] Tests dirigidos
- [x] [T-051] Build/typecheck/lint
- [x] [T-052] Spec strict/index/coverage
- [x] [T-053] Regresión proporcional al riesgo
- [x] [T-054] Actualizar `code_status: COMPLETE`, `status: IMPLEMENTED`

## Fase 6 — Producción

- [ ] [T-060] PR/CI/merge
- [ ] [T-061] Crear flags OFF
- [ ] [T-062] Deploy API/Web terminal
- [ ] [T-063] Canary tenant cálculo
- [ ] [T-064] Canary persistencia + mismatch
- [ ] [T-065] Activar o rollback

## Fase 7 — Cierre F3

- [ ] [T-070] Rebuild idempotente
- [ ] [T-071] Event invalidation/consumer
- [ ] [T-072] Replay verificado
- [ ] [T-073] Elevar a `VERIFIED`
