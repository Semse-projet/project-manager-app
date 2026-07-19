---
type: tasks
feature: "F1 — Event Backbone transaccional"
domain: "platform"
plan: "docs/specs/platform/event-backbone.plan.md"
version: "1.0"
status: "PENDING"
branch: "feat/f1-event-backbone"
date: "2026-07-12"
---

# Tareas: F1 — Event Backbone transaccional

> Orden obligatorio. No iniciar código hasta crear la rama de implementación
> desde `main` y confirmar que spec/plan siguen APPROVED.

## Fase 0 — Preflight

- [x] **T-001** Crear `feat/f1-event-backbone` desde `origin/main` limpio.
- [x] **T-002** Ejecutar `pnpm spec:validate:strict` y guardar baseline.
- [x] **T-003** Confirmar Railway/Production Health Gate verdes antes de schema.
- [x] **T-004** Revisar Prisma schema/migrations recientes para evitar colisión.

## Fase 1 — Tests antes del código

- [x] **T-010** Crear tests del envelope v2 y `evidence.uploaded.v1`.
- [x] **T-011** Testear rechazo suffix/version, actor, tenant y schemaRef inválidos.
- [x] **T-012** Crear integration test state+outbox atomic rollback.
- [x] **T-013** Crear concurrency test unique idempotency key.
- [x] **T-014** Crear claim test con dos dispatchers y lease vencida.
- [x] **T-015** Crear consumer test duplicate delivery/no double effect.
- [x] **T-016** Crear DLQ/replay RBAC/tenant/audit tests.
- [x] **T-017** Confirmar que los tests nuevos fallan por ausencia controlada.

## Fase 2 — Contratos y migración

- [x] **T-020** Implementar schemas v2 en `@semse/schemas`.
- [x] **T-021** Implementar adapter compatible v2 -> v1 para Evidence.
- [x] **T-022** Agregar enums/modelos/índices Prisma.
- [x] **T-023** Crear migración aditiva `*_f1_event_backbone`.
- [x] **T-024** Ejecutar `prisma validate`, `db:generate` y `migrate diff` estático.
- [x] **T-025** Documentar rollback operacional sin down destructivo.

## Fase 3 — Producer Evidence atómico

- [x] **T-030** Crear outbox repository con transaction client.
- [x] **T-031** Construir envelope desde datos persistidos de Evidence.
- [x] **T-032** Migrar `EvidenceRepository.create` a state+outbox en mismo tx.
- [x] **T-033** Añadir idempotency key determinística por comando.
- [x] **T-034** Pasar rollback y concurrency tests de producer.
- [x] **T-035** Verificar que no hay network/Redis dentro de la transacción.

## Fase 4 — Dispatcher e ingreso BullMQ

- [x] **T-040** Agregar `SEMSE_DOMAIN_EVENT_QUEUE` a shared.
- [x] **T-041** Implementar queue service con jobId determinístico y retention.
- [x] **T-042** Implementar claim batch `FOR UPDATE SKIP LOCKED`.
- [x] **T-043** Implementar lease/reclaim, ack, nack y exponential backoff.
- [x] **T-044** Añadir scheduler con kill switch OFF por defecto.
- [x] **T-045** Emitir métricas pending/oldest-age/publish-lag/DLQ.
- [x] **T-046** Pasar tests de doble dispatcher y Redis caído.

## Fase 5 — Worker y consumer idempotente

- [x] **T-050** Registrar worker `semse-domain-events` con shutdown limpio.
- [x] **T-051** Añadir handler por `eventId`; no aceptar payload canónico desde Redis.
- [x] **T-052** Añadir ruta interna `process` con service identity y permiso.
- [x] **T-053** Implementar receipts por consumer.
- [x] **T-054** Implementar `evidence-readiness.v1`.
- [x] **T-055** Confirmar efecto + receipt en mismo tx.
- [x] **T-056** Confirmar no-op para Evidence sin milestone.
- [x] **T-057** Confirmar que no cambia Milestone.status ni Payment.
- [x] **T-058** Pasar duplicate/crash/retry tests.

## Fase 6 — Ops, DLQ y replay

- [x] **T-060** Implementar list outbox con cursor/filtros/redaction.
- [x] **T-061** Implementar delivery detail tenant-scoped.
- [x] **T-062** Implementar replay solo para estado terminal fallido.
- [x] **T-063** Auditar actor, reason, eventId, consumer y replayCount.
- [x] **T-064** Extender trace con outbox + receipts.
- [x] **T-065** Añadir permisos RBAC y default-deny tests.
- [x] **T-066** Actualizar `SEMSE_API_SURFACE_V1.md` y EVENT_CATALOG.

## Fase 7 — Validación y canary

- [ ] **T-070** `pnpm spec:validate:strict`.
- [x] **T-071** Tests unitarios/contract/integration del slice. (suite completa de `@semse/api`: 1907/1908 passing sobre `main` post-merge F1-E; el único fallo — `graphify.service.test.ts` — es preexistente, no relacionado con event-backbone, y falla por una aserción de path POSIX en Windows)
- [ ] **T-072** `pnpm verify:workspace`.
- [x] **T-073** Fault test: Redis OFF durante registro Evidence. (`apps/api/test/evidence-outbox-integration.test.ts` — "F1-E fault test (T-073)")
- [x] **T-074** Fault test: crash después de enqueue antes de ack. (cubierto desde F1-C por `apps/api/test/event-outbox-dispatcher-integration.test.ts` — "an expired lease becomes eligible for a new dispatcher")
- [ ] **T-075** Deploy con switches OFF y verificar health.
- [ ] **T-076** Canary allowlist solo `evidence.uploaded.v1`.
- [ ] **T-077** Verificar SLO, duplicados, DLQ y ausencia de pagos.
- [ ] **T-078** Crear reporte F1 con research loop y evidencia.
- [ ] **T-079** Actualizar arquitectura/matriz/roadmap según estado real.

## Criterio de cierre

- [ ] state+outbox atómicos demostrados;
- [ ] Redis outage recuperable sin pérdida;
- [ ] duplicate logical effects = 0;
- [ ] DLQ/replay operables y auditados;
- [ ] tenant/RBAC/redaction verificados;
- [ ] CI, Railway Deploy y Production Health Gate verdes;
- [ ] spec marcado IMPLEMENTED o VERIFIED solo con evidencia correspondiente.
