---
id: "agro.incident-ops"
title: "Agro IncidentOps — incidencias operacionales de finca"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/agro/agro-incident.domain.ts
  - apps/api/src/modules/agro/agro-incident.repository.ts
  - apps/api/src/modules/agro/agro-incident.service.ts
  - apps/api/src/modules/agro/agro-incident.controller.ts
  - apps/api/src/modules/agro/agro-task-ref.resolver.ts
  - apps/web/app/agro/[farmId]/incidents/page.tsx
  - apps/web/app/agro/[farmId]/incidents/[incidentId]/page.tsx
  - apps/web/app/agro/[farmId]/incidents/report/page.tsx
related_tests:
  - apps/api/test/agro-incident.service.test.ts
  - apps/api/test/agro-workforce-incidents-integration.test.ts
related_endpoints:
  - farms/:farmId/incidents
  - incidents/:incidentId
  - incidents/:incidentId/transition
  - incidents/:incidentId/assign
  - incidents/:incidentId/task
related_events: []
related_agents: []
last_verified: "2026-09-25"
---

# Spec: Agro IncidentOps

> Aprobación: solicitud explícita del propietario de producto en la sesión del 2026-09-25 (PR2 y PR3).

## 1. Problema y resultado

Los problemas de campo (animal herido, falta de agua, cerca rota, plaga…) se pierden en conversaciones. Resultado: cada problema es una incidencia con tipo, severidad, relaciones, responsable, tarea, evidencia e historial completo.

## 2. Alcance

14 tipos (`AGRO_INCIDENT_TYPES`), severidad LOW…CRITICAL con `severityConfirmed`, FSM, relaciones opcionales (unidad, animal, grupo, ciclo de cultivo, inventario/equipo), tarea canónica mediante `AgroTaskRef`, idempotencia por `clientEventId`, comentarios y evaluaciones profesionales como eventos del timeline. No se reutiliza `JobIncident` porque exige `jobId`.

Fuera de alcance: notificaciones push, SLA/escalado automático, eventos de dominio (outbox).

## 3. Permisos

Matriz completa en AGRO_AS_IS_AUDIT §6. Resumen: todos los miembros reportan, comentan y aportan evidencia; supervisión clasifica, asigna, relaciona tareas, cierra, reabre y cancela; el responsable asignado y los profesionales inician y resuelven; solo los roles profesionales registran evaluaciones. Prometeo nunca confirma severidad.

## 4. FSM

`OPEN → TRIAGED | IN_PROGRESS | CANCELLED | DUPLICATE`; `TRIAGED → IN_PROGRESS | RESOLVED | CANCELLED | DUPLICATE`; `IN_PROGRESS → RESOLVED | CANCELLED`; `RESOLVED → CLOSED | IN_PROGRESS (reabrir)`; `CLOSED → IN_PROGRESS (reabrir)`. RESOLVED exige resolución; CANCELLED, un motivo; DUPLICATE, una incidencia original de la misma finca. Concurrencia optimista por estado esperado (409).

## 5. Auditoría y evidencia

Historial = `AgroAuditEvent` con `entityType = "AgroIncident"`: created, triaged, severity_changed, type_changed, relations_changed, updated, assigned/unassigned, evidence_added, task_linked/unlinked, comment_added, assessment_added, started, resolved, closed, reopened, cancelled, marked_duplicate. Evidencia = `AgroEvidenceItem` con `entityType = "INCIDENT"` (nuevos medios: AUDIO, FORM, MEASUREMENT).

## 9. Tests

20 unitarios + E2E HTTP contra Postgres (10 pasos) + recorrido en navegador con 4 identidades.
