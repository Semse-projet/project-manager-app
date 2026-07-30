---
type: checklist
feature: "Project Lifecycle Projection F3"
spec: "docs/specs/operations/project-lifecycle-projection.spec.md"
version: "2.0"
date: "2026-07-28"
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

- [x] Tabla de producción vacía confirmada
- [x] SQL y checksum coinciden
- [x] CAS evita downgrade
- [x] Flags OFF por defecto
- [ ] Rebuild idempotente

## Producción

- [x] CI/merge/deploy registrados
- [ ] Canary tenant autenticado
- [ ] Mismatch y latencia observables
- [x] Rollback por flags probado/documentado
- [ ] Activación separada del healthcheck
