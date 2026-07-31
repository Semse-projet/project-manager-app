---
type: tasks
feature: "Mission Control 2.0 F4"
domain: "operations"
plan: "docs/specs/operations/mission-control-2.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/f4-mission-control-2"
date: "2026-07-31"
---

# Tareas: Mission Control 2.0 F4

## Fase 0 — SDD y verdad

- [x] [T-001] Crear y aprobar child spec F4 SDD 2.0
- [x] [T-002] Inventariar UI/API/SSE/señales/eventos/runs/loops/incidentes actuales
- [x] [T-003] Completar plan, análisis y checklist sin gaps bloqueantes
- [x] [T-004] Registrar cuatro fuentes primarias y decisiones
- [x] [T-005] Fusionar el SDD y crear rama de implementación desde `main`

## Fase 1 — Tests y contratos

- [x] [T-010] Reemplazar la prueba de nextAction copiada por prueba al servicio real
- [x] [T-011] [P] Escribir tests del normalizador y cursor
- [x] [T-012] [P] Escribir tests policy/runbook/action/target
- [x] [T-013] [P] Escribir tests idempotency hash, duplicate y lease
- [x] [T-014] [P] Escribir tests 404 cross-tenant y SSE tenant/global
- [x] [T-014A] [P] Escribir regresión retry/requeue `AgentRun` cross-tenant
- [x] [T-015] Confirmar que los tests fallan por los gaps F4, no por fixtures

## Fase 2 — Datos y dominio

- [x] [T-020] Añadir schema y migración aditiva F4
- [x] [T-021] Verificar SQL/checksum e historial PostgreSQL completo
- [x] [T-022] Implementar repositorio de receipts con key/hash/lease
- [x] [T-023] Implementar read model normalizado tenant-safe
- [x] [T-024] Implementar catálogo de runbooks allowlisted
- [x] [T-025] Implementar adapters ACK/RESOLVE/DISMISS/PAUSE/RESUME
- [x] [T-026] Implementar adapters RETRY/REQUEUE/REPLAY
- [x] [T-026A] Corregir ownership de retry/requeue a `id + tenantId`
- [x] [T-027] Implementar ESCALATE con incidente durable
- [x] [T-028] Endurecer SSE tenant/global y reconnect por GET
- [x] [T-029] Pasar tests unitarios e integración PostgreSQL

## Fase 3 — API/BFF/UI

- [x] [T-030] GET exceptions con filtros/cursor/counts/sourceErrors
- [x] [T-031] GET catálogo de runbooks
- [x] [T-032] POST action con permiso, reason, receipt e idempotencia
- [x] [T-033] BFF server-side para los tres contratos
- [x] [T-034] UI loading/empty/forbidden/degraded/error
- [x] [T-035] Diálogo de acción con riesgo/runbook/reason/confirmación
- [x] [T-036] Receipt live/poll y deep links al workspace propietario
- [x] [T-037] Actualizar API surface, arquitectura, roadmap y runbook
- [x] [T-038] Pasar pruebas de contrato/UI/E2E

## Fase 4 — Verificación local

- [x] [T-040] Tests dirigidos F4
- [x] [T-041] Regresión Ops/domain-events/auth/SSE
- [x] [T-042] Build/typecheck/lint/workspace verify
- [x] [T-043] `pnpm spec:validate:strict`
- [x] [T-044] `pnpm spec:index` y `pnpm spec:coverage`
- [x] [T-045] Prisma audit y migración reproducible
- [x] [T-046] Marcar código `COMPLETE` y spec `IMPLEMENTED`

## Fase 5 — PR, CI y merge

- [x] [T-050] Revisar diff, secretos, payloads y rollback
- [ ] [T-051] Abrir PR F4 implementable/reversible
- [ ] [T-052] Esperar CI/CodeQL/E2E terminales
- [ ] [T-053] Resolver review sin ampliar scope
- [ ] [T-054] Fusionar y registrar SHA

## Fase 6 — Deploy y activación

- [ ] [T-060] Verificar pre-deploy/migración
- [ ] [T-061] Esperar deployments terminales
- [ ] [T-062] Verificar health/readiness/logs sin inferir activación
- [ ] [T-063] Configurar flags default-off y canary `tenant_default`
- [ ] [T-064] Ejecutar smoke OPS_ADMIN tenant/cross-tenant
- [ ] [T-065] Ejecutar señal/incident sintéticos y duplicate keys
- [ ] [T-066] Ejecutar dry-run de acciones de alto impacto
- [ ] [T-067] Medir errors/duplicates/stale leases y decidir canary/rollback
- [ ] [T-068] Registrar producción y promover spec a `VERIFIED` sólo si cumple

## Criterio de Done

- [ ] Código/tests/CI/merge/deploy separados y completos
- [ ] Migración `VERIFIED`
- [ ] Activación `CANARY` limitada a `tenant_default`
- [ ] Cero fuga cross-tenant y cero efecto duplicado
- [ ] Receipts/runbooks/audit/correlation verificables
- [ ] Índice/matriz/roadmap/API/runbook alineados
