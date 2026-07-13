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

- [ ] **T-001** Crear `feat/f1-event-backbone` desde `origin/main` limpio.
- [ ] **T-002** Ejecutar `pnpm spec:validate:strict` y guardar baseline.
- [ ] **T-003** Confirmar Railway/Production Health Gate verdes antes de schema.
- [ ] **T-004** Revisar Prisma schema/migrations recientes para evitar colisión.

## Fase 1 — Tests antes del código

- [ ] **T-010** Crear tests del envelope v2 y `evidence.uploaded.v1`.
- [ ] **T-011** Testear rechazo suffix/version, actor, tenant y schemaRef inválidos.
- [ ] **T-012** Crear integration test state+outbox atomic rollback.
- [ ] **T-013** Crear concurrency test unique idempotency key.
- [ ] **T-014** Crear claim test con dos dispatchers y lease vencida.
- [ ] **T-015** Crear consumer test duplicate delivery/no double effect.
- [ ] **T-016** Crear DLQ/replay RBAC/tenant/audit tests.
- [ ] **T-017** Confirmar que los tests nuevos fallan por ausencia controlada.

## Fase 2 — Contratos y migración

- [ ] **T-020** Implementar schemas v2 en `@semse/schemas`.
- [ ] **T-021** Implementar adapter compatible v2 -> v1 para Evidence.
- [ ] **T-022** Agregar enums/modelos/índices Prisma.
- [ ] **T-023** Crear migración aditiva `*_f1_event_backbone`.
- [ ] **T-024** Ejecutar `prisma format`, `db:generate` y `migrate diff`.
- [ ] **T-025** Documentar rollback operacional sin down destructivo.

## Fase 3 — Producer Evidence atómico

- [ ] **T-030** Crear outbox repository con transaction client.
- [ ] **T-031** Construir envelope desde datos persistidos de Evidence.
- [ ] **T-032** Migrar `EvidenceRepository.create` a state+outbox en mismo tx.
- [ ] **T-033** Añadir idempotency key determinística por comando.
- [ ] **T-034** Pasar rollback y concurrency tests de producer.
- [ ] **T-035** Verificar que no hay network/Redis dentro de la transacción.

## Fase 4 — Dispatcher e ingreso BullMQ

- [ ] **T-040** Agregar `SEMSE_DOMAIN_EVENT_QUEUE` a shared.
- [ ] **T-041** Implementar queue service con jobId determinístico y retention.
- [ ] **T-042** Implementar claim batch `FOR UPDATE SKIP LOCKED`.
- [ ] **T-043** Implementar lease/reclaim, ack, nack y exponential backoff.
- [ ] **T-044** Añadir scheduler con kill switch OFF por defecto.
- [ ] **T-045** Emitir métricas pending/oldest-age/publish-lag/DLQ.
- [ ] **T-046** Pasar tests de doble dispatcher y Redis caído.

## Fase 5 — Worker y consumer idempotente

- [ ] **T-050** Registrar worker `semse-domain-events` con shutdown limpio.
- [ ] **T-051** Añadir handler por `eventId`; no aceptar payload canónico desde Redis.
- [ ] **T-052** Añadir ruta interna `process` con service identity y permiso.
- [ ] **T-053** Implementar receipts por consumer.
- [ ] **T-054** Implementar `evidence-readiness.v1`.
- [ ] **T-055** Confirmar efecto + receipt en mismo tx.
- [ ] **T-056** Confirmar no-op para Evidence sin milestone.
- [ ] **T-057** Confirmar que no cambia Milestone.status ni Payment.
- [ ] **T-058** Pasar duplicate/crash/retry tests.

## Fase 6 — Ops, DLQ y replay

- [ ] **T-060** Implementar list outbox con cursor/filtros/redaction.
- [ ] **T-061** Implementar delivery detail tenant-scoped.
- [ ] **T-062** Implementar replay solo para estado terminal fallido.
- [ ] **T-063** Auditar actor, reason, eventId, consumer y replayCount.
- [ ] **T-064** Extender trace con outbox + receipts.
- [ ] **T-065** Añadir permisos RBAC y default-deny tests.
- [ ] **T-066** Actualizar `SEMSE_API_SURFACE_V1.md` y EVENT_CATALOG.

## Fase 7 — Validación y canary

- [ ] **T-070** `pnpm spec:validate:strict`.
- [ ] **T-071** Tests unitarios/contract/integration del slice.
- [ ] **T-072** `pnpm verify:workspace`.
- [ ] **T-073** Fault test: Redis OFF durante registro Evidence.
- [ ] **T-074** Fault test: crash después de enqueue antes de ack.
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

