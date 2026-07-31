---
type: checklist
feature: "Project Lifecycle Projection F3"
spec: "docs/specs/operations/project-lifecycle-projection.spec.md"
version: "2.1"
date: "2026-07-31"
---

# Checklist: Project Lifecycle Projection F3

## Seguridad

- [x] Endpoint exige permiso financiero
- [x] Repository filtra tenant y ownership
- [x] Consulta ajena no persiste snapshot
- [x] UI no expone finanzas al profesional

## Cálculo

- [x] Progress separa trabajo de pago
- [x] FAILED/REVERSED excluidos
- [x] Gastos duplicados/rechazados excluidos
- [x] Riesgo ausente es `null`
- [x] Revision cubre todas las fuentes

## Persistencia

- [x] Baseline vacío y snapshot canary único confirmados
- [x] SQL y checksum coinciden
- [x] CAS evita downgrade
- [x] Flags OFF por defecto
- [x] Rebuild idempotente tenant-scoped

## Eventos

- [x] Contrato `project.lifecycle-source-changed.v1` validado
- [x] Consumer `project-lifecycle-projection.v1` allowlisted
- [x] Evidence + outbox F3 comparten transacción
- [x] Hooks post-commit no se presentan como atomicidad garantizada
- [x] Entrega duplicada no repite rebuild/audit
- [x] Replay conserva una proyección y termina `no_op`
- [x] Worker exige rol `EVENT_CONSUMER`

## Producción

- [x] CI/merge/deploy registrados
- [x] Canary tenant autenticado
- [x] Mismatch durable/calculado observado en cero
- [x] Cinco eventos publicados y cinco receipts completados en canary
- [x] Cero outbox/receipts pending, failed o dead-letter al cierre
- [ ] Latencia y error rate observados durante una ventana SLO para promoción global
- [x] Rollback por flags probado/documentado
- [x] Activación separada del healthcheck

## Análisis Spec Kit

- [x] Constitución, spec, plan y tasks no se contradicen
- [x] API surface, event catalog, matriz, roadmap e índice reflejan el canary real
- [x] `VERIFIED + CANARY` no se presenta como activación global
- [x] Evidencia no contiene secretos ni payloads de negocio
