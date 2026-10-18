---
id: "core.daily-reports"
title: "Reporte diario de cuadrilla con hash y revisión humana (BO-11)"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_DAILY_REPORTS_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/daily-reports/daily-reports.service.ts"
  - "apps/api/src/modules/daily-reports/daily-reports.controller.ts"
  - "apps/api/src/modules/daily-reports/daily-reports.module.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/daily-reports.test.ts"
related_endpoints: []
related_events:
  - "daily_report.generated"
  - "daily_report.reviewed"
  - "daily_report.returned"
  - "daily_report.published"
related_agents: []
last_verified: "2026-10-18"
---
# BO-11 — Reporte diario de cuadrilla

Fuente: plan Astra `03_producto/11_PROMETEO_REPORTES_EVIDENCIA.md` ("Reporte diario esperado") y `03_producto/07_CUADRILLAS_OBRAS_HITOS_TAREAS.md`. Depende de BO-07 (cuadrillas). Lee `TimeEntry` y `JobTask` existentes; no los modifica. No incluye Prometeo (BO-13): el borrador lo arma código determinista, no un modelo.

## Alcance
- Modelo aditivo `DailyReport` (único por cuadrilla y fecha) con `snapshot` JSON, `contentHash` SHA-256 y estados `DRAFT → REVIEWED → PUBLISHED`.
- API tras `SEMSE_DAILY_REPORTS_ENABLED` (apagado → 404):
  - `POST/GET /v1/crews/:crewId/daily-reports`, `GET .../:reportDate` (supervisor vigente de esa cuadrilla o gestor de cuadrillas de la Org).
  - `POST /v1/daily-reports/:id/review` (aprobar o devolver) y `POST .../publish` (gestor de cuadrillas de la Org, distinto de quien generó).

## Reglas
1. El reporte es una **foto** de registros que ya existen: por trabajador, los intervalos de `TimeEntry` del día (ventana por `tzOffsetMinutes`), las horas reales (transcurrido − descanso registrado) y las tareas cerradas ese día.
2. No se inventan horas: un registro abierto se lista sin horas y se cuenta aparte; un registro borrado no entra; no hay nómina ni GPS.
3. Cada reporte declara sus fuentes (ids) y sus limitaciones (offline, miembros activos al generar, sin ubicación).
4. `contentHash` es el SHA-256 de la serialización canónica (claves ordenadas) del snapshot; cambia si cambian los datos.
5. El borrador se puede regenerar. **Revisar lo congela**: ya no se regenera ni se revisa otra vez (409).
6. La revisión la hace un gestor de cuadrillas vigente distinto del generador. Devolver exige motivo y deja el borrador. Publicar exige estado `REVIEWED`.
7. Cada paso se audita con eventos del catálogo.

## Criterios de aceptación
AC-01 flag apagado → 404 · AC-02 alcance (otra cuadrilla 403, otro tenant 404, suspendido 404) · AC-03 horas sin inventar · AC-04 tareas y limitaciones · AC-05 hash coherente y sensible a cambios · AC-06 autorrevisión y falta de permiso → 403 · AC-07 revisar congela, devolver permite regenerar · AC-08 publicar solo lo revisado.

## Fuera de alcance
Redacción asistida por Prometeo (BO-13), comparativa semanal, evidencias vinculadas y su revisión, cambios de obra con trayecto, enlaces con alcance a archivos, exportación PDF, pantallas web, y la zona horaria por obra (por ahora la indica quien genera).

## Riesgos
Un reporte "publicado" puede leerse como verdad oficial: por eso declara limitaciones y exige revisor distinto. Las horas son informativas, no autorizan nómina.
