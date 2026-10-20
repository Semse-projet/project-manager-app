---
id: "core.labor-policy"
title: "Política de horario versionada y correcciones de horas (BO-08)"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_LABOR_POLICY_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/labor-engine/labor-policy.service.ts"
  - "apps/api/src/modules/labor-engine/labor-policy.controller.ts"
  - "apps/api/src/modules/labor-engine/labor-policy.calc.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/labor-policy.test.ts"
related_endpoints: []
related_events:
  - "labor_policy.created"
  - "labor_correction.requested"
  - "labor_correction.approved"
  - "labor_correction.rejected"
related_agents: []
last_verified: "2026-10-18"
---
# BO-08 — Política de horario y correcciones de horas

Fuente: plan Astra `03_producto/08_TIME_TRACKER_GEO_NOTIFICACIONES.md` y `04_ejecucion/16_DECISIONES_PENDIENTES.md`. Depende de BO-07 (obras) y del Labor Engine existente (`TimeEntry`, `/v1/labor`), que sigue siendo la fuente única de horas.

## Decisiones del propietario (2026-10-18)
| ID | Decisión | Efecto |
|---|---|---|
| OPEN-09 | Política versionada. | Horario, descanso y overtime son datos versionados por Org u obra, no reglas fijas. Hora real ≠ horario ≠ pagable. Sin nómina automática. |
| OPEN-07/08 | ASK por defecto. | Aquí no hay GPS ni auto-inicio (eso es BO-09); este slice solo prepara horario y correcciones. |
| OPEN-10 | Retención mínima. | No se guardan coordenadas; las solicitudes de corrección conservan el valor original. Plazos exactos los fija el asesor. |

Las decisiones no sustituyen asesoría legal ni de payroll: antes de usar horarios con personas reales, Legal/Payroll revisa OPEN-09.

## Alcance
- Modelo aditivo `LaborSchedulePolicy` (versionado, una ACTIVE por Org u obra) y `LaborTimeCorrection` (original + propuesta + estado). No modifica `TimeEntry` ni su esquema.
- API tras `SEMSE_LABOR_POLICY_ENABLED` (apagado → 404):
  - `POST/GET /v1/organizations/:orgId/labor/policies` (`org:labor:manage`: CLIENT y OPS_ADMIN; no PRO, por OPEN-04).
  - `POST /v1/labor/corrections`, `GET /v1/labor/corrections/mine` (el trabajador, solo lo suyo).
  - `GET /v1/organizations/:orgId/labor/corrections`, `POST .../:id/approve|reject` (`org:labor:manage`).
- Cálculo puro `computeLaborTime`: horas reales, pagables y candidatas a overtime por separado.

## Reglas
1. Hora real = transcurrido − descanso **registrado**. Un descanso no tomado no se descuenta.
2. El overtime solo se **propone** (`overtimeNeedsApproval`); nunca se paga solo.
3. Publicar una política nueva para el mismo ámbito supersede la anterior y sube la versión; carrera → 409.
4. Una corrección solo aplica a registros propios y terminados, con motivo, y no puede dejar horas imposibles ni repetir una pendiente.
5. La revisión la hace otra persona con `org:labor:manage`; nadie revisa su propia corrección. Aprobar aplica el cambio con `editedBy` y `editReason`; la solicitud conserva el original. Revisar dos veces → 409.
6. Todo cambio material se audita con eventos del catálogo.

## Criterios de aceptación
- AC-01 Flag apagado → 404 sin efectos.
- AC-02 PRO y trabajadores no gestionan política ni revisan; otra Org → 404.
- AC-03 06:30–17:00 con 1 h de pausa real = 9 h 30; 4×10 con 1 h real = 10 h; descanso no tomado no se descuenta.
- AC-04 Versionado: la segunda política deja la primera `SUPERSEDED`.
- AC-05 Pedir corrección no cambia el registro; aprobar sí, con revisor y motivo; rechazar no.
- AC-06 Autorrevisión → 403; doble revisión → 409.

## Fuera de alcance
GPS, geofence, recordatorios y auto-inicio (BO-09, requiere iOS y Android físicos); nómina, costos y cobros; pantallas web de este slice; zonas horarias/DST por obra (se agrega con la UI).

## Riesgos
Tiempo pagable impacta dinero: por eso no hay cálculo de pago y la activación exige revisión de Legal/Payroll. Una corrección aprobada modifica `TimeEntry`; el rastro queda en `LaborTimeCorrection` y en la auditoría.

## Capa web (slice `feat/bo-08-ui`)
`/worker/corrections` (la persona elige un registro terminado, propone nueva hora de fin y/o descanso real con motivo, y ve sus solicitudes) y `/client/labor-policy` (el responsable publica políticas versionadas y aprueba o rechaza correcciones, con nota). Rutas BFF `labor/corrections/**` y `organizations/[orgId]/labor/**`. La API decide los permisos y estados; la UI no calcula horas ni pagos. Con el flag apagado la API responde 404 y la UI muestra "aún no habilitadas". Sigue vigente que la activación con personas reales exige la revisión de Legal/Payroll de OPEN-09.
