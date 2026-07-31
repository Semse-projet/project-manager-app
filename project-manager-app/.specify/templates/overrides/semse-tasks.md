---
type: tasks
feature: "[FEATURE_NAME]"
domain: "[DOMAIN]"
plan: "docs/specs/[domain]/[feature].plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/[feature-slug]"
date: "[YYYY-MM-DD]"
---

# Tareas: [FEATURE_NAME]

> Prerrequisito: plan aprobado y análisis spec↔plan↔constitución sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [ ] [T-001] Confirmar spec `APPROVED` e indexado
- [ ] [T-002] Registrar SHA Git/producción, migraciones y flags actuales
- [ ] [T-003] Completar plan, análisis y checklist
- [ ] [T-004] Registrar investigación externa y decisiones

## Fase 1 — Tests y contratos

- [ ] [T-010] Escribir tests rojos de escenarios P1 y seguridad
- [ ] [T-011] [P] Crear/actualizar schemas compartidos
- [ ] [T-012] [P] Definir fixtures de idempotencia/concurrencia
- [ ] [T-013] Confirmar que el fallo inicial demuestra el gap

## Fase 2 — Datos y dominio

- [ ] [T-020] Crear/restaurar migración Prisma reproducible
- [ ] [T-021] Verificar SQL, checksum y compatibilidad hacia atrás
- [ ] [T-022] Implementar dominio/repositorio sin violar ownership
- [ ] [T-023] Implementar eventos/outbox/receipts si aplica
- [ ] [T-024] Pasar tests unitarios y de persistencia

## Fase 3 — API/BFF/UI

- [ ] [T-030] Implementar endpoint con permiso backend
- [ ] [T-031] Implementar BFF sin exponer secretos
- [ ] [T-032] Implementar UI con loading/empty/forbidden/degraded/error
- [ ] [T-033] Actualizar API surface y documentación afectada
- [ ] [T-034] Pasar pruebas de contrato y UI

## Fase 4 — Verificación local

- [ ] [T-040] Tests dirigidos
- [ ] [T-041] Regresión proporcional al riesgo
- [ ] [T-042] Build/typecheck/lint
- [ ] [T-043] `pnpm spec:validate:strict`
- [ ] [T-044] `pnpm spec:coverage` y `pnpm spec:index`
- [ ] [T-045] Actualizar spec a `code_status: COMPLETE` y `status: IMPLEMENTED`

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos
- [ ] [T-051] Abrir PR con migración, rollback y evidencia
- [ ] [T-052] Esperar CI terminal y registrar `ci_status`
- [ ] [T-053] Resolver review sin ampliar scope
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`

## Fase 6 — Deploy y activación

- [ ] [T-060] Verificar pre-deploy/migración
- [ ] [T-061] Esperar deployment terminal API/Web/Worker afectado
- [ ] [T-062] Verificar health/readiness y logs
- [ ] [T-063] Activar canary/flag de forma gradual
- [ ] [T-064] Ejecutar smoke autenticado y validar tenant/ownership
- [ ] [T-065] Validar métricas/SLO y señal de rollback
- [ ] [T-066] Promover a `ACTIVE` o revertir/pausar
- [ ] [T-067] Registrar `production_evidence`, `last_verified` y `status: VERIFIED`

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` o `ACTIVE` según el gate aprobado
- [ ] Migración `VERIFIED` o `NOT_APPLICABLE`
- [ ] Evidencia de producción enlazada
- [ ] Índice/matriz/roadmap actualizados
