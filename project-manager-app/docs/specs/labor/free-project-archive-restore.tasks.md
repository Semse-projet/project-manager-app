---
type: tasks
feature: "FreeProject archive/restore S1"
domain: "labor"
plan: "docs/specs/labor/free-project-archive-restore.plan.md"
version: "2.0"
status: "PENDING"
branch: "fix/labor-s1-archive-restore"
date: "2026-10-25"
---

# Tareas S1

**Bloqueo:** spec todavía DRAFT. No escribir código antes de S1-D1–D6 y aprobación.

## Fase 0 — SDD
- [x] T-001 Inspeccionar S0 y hueco de listado archive en main.
- [x] T-002 Identificar PR #1036/#1039 para evitar duplicación.
- [ ] T-003 Aprobar S1-D1–D6; spec, plan y checklist.
- [ ] T-004 Registrar main/deploy SHA y fixtures aislados antes de código.

## Fase 1 — Tests rojos
- [ ] T-010 Propietario lista legacy/archived/all; status inválido 400.
- [ ] T-011 GET detalle archived; no-owner mismo tenant 404.
- [ ] T-012 Restore active y restore converted, conservando convertedJobId.
- [ ] T-013 CAS concurrente, idempotencia y rollback AuditLog.
- [ ] T-014 TimeEntry pre/post idéntico sin Job/escrow/multimedia mutado.
- [ ] T-015 Resolver nombres archived en UI y CSV sin expandir export de #1036.
- [ ] T-016 Registrar rojo en main con fixtures sintéticos.

## Fase 2 — Backend
- [ ] T-020 Repository owner-only status filter, GET by id, CAS restore.
- [ ] T-021 Service guards state/owner, idempotencia y audit.
- [ ] T-022 Controller GET /:id, list status, POST restore; errores claros.
- [ ] T-023 Actualizar EVENT_CATALOG y SEMSE_API_SURFACE_V1.

## Fase 3 — UI
- [ ] T-030 Cliente/BFF que conserva legacy default de Timer.
- [ ] T-031 Proyectos Activos/Archivados/Todos, detalle y restaurar.
- [ ] T-032 Registros/Resumen/Reportes nombres históricos.
- [ ] T-033 Evaluar ES/EN, responsive, error/red/offline, y compatibilidad móvil.
- [ ] T-034 Revisión con F1A #1036 y CSV #1039.

## Fase 4 — Validación local
- [ ] T-040 Tests positivos/negativos multi-org/tenant, regresión S0.
- [ ] T-041 Integración PG audit rollback/concurrencia.
- [ ] T-042 Typecheck/lint/build y pnpm spec:validate:strict + spec:index:check.
- [ ] T-043 Revisar diffs/secrets/PII; documentar gaps.

## Fase 5 — CI al final
- [ ] T-050 CI terminal y revisión independiente.
- [ ] T-051 Resolver findings; merge autorizado, no automático.

## Fase 6 — Producción
- [ ] T-060 Deploy API/Web por commit, observabilidad y smoke autenticado.
- [ ] T-061 Fixture A/B nuevo sintético sin alterar Jobs/TimeEntry reales.
- [ ] T-062 Registrar evidencia de rol+owner+restore+CSV y reporte docs/reportes.
- [ ] T-063 Actualizar #933/#935 con estados separados, nunca inferir VERIFIED.