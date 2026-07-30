---
type: checklist
feature: "Project Lifecycle Projection F3"
spec: "docs/specs/operations/project-lifecycle-projection.spec.md"
version: "2.0"
date: "2026-07-30"
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
- [ ] Rebuild idempotente

## Producción

- [x] CI/merge/deploy registrados
- [x] Canary tenant autenticado
- [x] Mismatch durable/calculado observado en cero
- [ ] Latencia y error rate observados durante una ventana SLO
- [x] Rollback por flags probado/documentado
- [x] Activación separada del healthcheck
