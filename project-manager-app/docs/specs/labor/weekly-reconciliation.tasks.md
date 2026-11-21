---
type: tasks
feature: "weekly-reconciliation"
domain: "labor"
plan: "docs/specs/labor/weekly-reconciliation.plan.md"
version: "2.0"
status: "PENDING"
branch: "claude/plan3-conciliacion-gates-32rob6"
date: "2026-11-21"
---

# Tareas — Conciliación semanal del Time Tracker

> Prerrequisito: plan aprobado y análisis sin gaps (`weekly-reconciliation.analyze.md`). Hoy **no se cumple**: spec `DRAFT`, plan `DRAFT` y análisis con gaps abiertos.
> Marcas: `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable. Ninguna tarea de código puede empezar mientras T-001 siga sin completar.

## Fase 0 — SDD y verdad

- [~] [T-001] Confirmar spec `APPROVED` e indexada — bloqueada: spec `DRAFT`; revisor independiente y aprobador pendientes (G32)
- [x] [T-002] Registrar SHA Git (`main@86c0be5…`) — hecho en la spec §10.10. SHA de producción, migraciones y flags: **no verificados** (sin acceso)
- [~] [T-003] Completar plan, análisis y checklist — borradores creados el 21-11; bloqueados por los gaps del análisis
- [x] [T-004] Registrar investigación externa (DOL FLSA como contexto) — la validación legal sigue pendiente (G21)
- [ ] [T-005] Decidir la ubicación del FSM: crear `packages/fsm` o enmendar la constitución (ADR) — owner de arquitectura
- [ ] [T-006] Decidir el efecto de un cambio de `TimeEntry` durante el plazo C3-17 (análisis A-01) — dueño del producto
- [ ] [T-007] Reconciliar la SDD v0.7 perdida (`docs/plan3-conciliacion-v47`) si su autor la conserva (G31)
- [ ] [T-008] Registrar en `STATE_MACHINES.md` y `EVENT_CATALOG.md` los estados y eventos propuestos, una vez aprobada la spec

## Fase 1 — Tests y contratos (tras T-001)

- [~] [T-010] Tests rojos de autorización y lector: T-R01…T-R08
- [~] [T-011] Tests de identidad de servicio: T-W01…T-W03 — también bloqueados por G04
- [~] [T-012] Tests de auditoría: T-A01…T-A05
- [~] [T-013] Tests de concurrencia e idempotencia: T-C01…T-C05, T-I01, T-I02
- [~] [T-014] Tests de perfil horario y baseline: T-P01, T-P02, T-B01
- [~] [T-015] Tests de C3-17: T-V01…T-V22
- [~] [T-016] [P] Schemas Zod del caso, la declaración, la constancia y el resultado
- [~] [T-017] Confirmar que los tests fallan por el gap y no por el fixture

## Fase 2 — Datos y dominio (slice S1, luego S3)

- [~] [T-020] Migración aditiva: revisión de TimeEntry (expand/backfill) — requiere SDD + `semse-prisma-workflow`
- [~] [T-021] W1–W9 incrementan la revisión con CAS; decisión sobre I2/I3 (G11)
- [~] [T-022] BO-08: `originalRevision`, `STALE` y `appendInTransaction`
- [~] [T-023] Modelos del caso con `tenantId`/`orgId`
- [~] [T-024] Servicio de conciliación sin writer de TimeEntry; outbox atómico
- [~] [T-025] Pasar tests unitarios y de persistencia en base aislada

## Fase 3 — API/BFF/UI (slices S2, S3)

- [~] [T-030] Lector canónico de TimeEntry por organización — requiere owner, ruta, corte y límite (G01–G03)
- [~] [T-031] Endpoints de captura, decisión y reapertura con capabilities de Plan 4
- [~] [T-032] BFF `apps/web/app/api/semse/labor/**`
- [~] [T-033] UI en Tracker con estados loading/empty/forbidden/degraded/error y ES/EN
- [~] [T-034] Actualizar `SEMSE_API_SURFACE_V1.md`

## Fase 3′ — Vencimiento C3-17 (slice S4)

- [~] [T-035] Principal de servicio del worker (G04)
- [~] [T-036] Job programado de vencimiento: constancia por trabajador y versión, CAS e idempotencia
- [~] [T-037] Resultado «base de facturación por vencimiento» sin tocar TimeEntry, factura ni pago

## Fase 4 — Verificación local

- [~] [T-040] Tests dirigidos · [T-041] regresión · [T-042] build/typecheck/lint
- [x] [T-043] `spec:validate:strict` — sólo documental (220/0/0, 21-11)
- [~] [T-044] `spec:coverage` y `spec:index`
- [~] [T-045] Actualizar `code_status`/`status`

## Fase 5 — PR, CI y merge

- [~] [T-050]…[T-054] — PR documental pendiente de autorización (G33); los PR de código, después de T-001

## Fase 6 — Deploy y activación

- [~] [T-060]…[T-067] — flag inactivo; canary en la organización piloto sólo con la autoridad del responsable designado verificada (G23)

## Criterio de Done

Ninguno cumplido. Ver la plantilla SEMSE (Art. XIII).
