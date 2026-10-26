---
id: "core.crews-worksites"
title: "Obras y cuadrillas con alcance por supervisor (BO-07)"
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
  - "SEMSE_CREWS_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/organizations/crews.service.ts"
  - "apps/api/src/modules/organizations/crews.controller.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/crews-worksites.test.ts"
related_endpoints:
  - "POST /v1/organizations/:orgId/worksites"
  - "GET /v1/organizations/:orgId/worksites"
  - "POST /v1/organizations/:orgId/crews"
  - "GET /v1/organizations/:orgId/crews"
  - "POST /v1/organizations/:orgId/crews/:crewId/members"
  - "POST /v1/organizations/:orgId/crews/:crewId/members/remove"
  - "POST /v1/organizations/:orgId/crews/:crewId/archive"
  - "GET /v1/crews/mine"
  - "GET /v1/crews/:crewId/roster"
related_events:
  - "worksite.created"
  - "crew.created"
  - "crew.member_added"
  - "crew.member_removed"
  - "crew.archived"
related_agents: []
last_verified: "2026-10-18"
---
# BO-07 — Obras y cuadrillas con alcance por supervisor

Diseño: plan Astra `03_producto/07_CUADRILLAS_OBRAS_HITOS_TAREAS.md`. Depende de BO-01 (membresías WORKER). **Supuestos conservadores** (el propietario pidió avanzar así); no es aprobación legal ni activa nada con empleados reales.

## Alcance
Incluido: modelos aditivos `Worksite`, `Crew`, `CrewMember`; gestión por quien tenga `org:crews:manage` (CLIENT, PRO, OPS_ADMIN como en invitaciones y ofertas); el supervisor de una cuadrilla es un **WORKER activo** de la Org (no se crea un rol de plataforma); lectura propia (`mine`) y roster solo para el supervisor vigente de esa cuadrilla. Todo tras `SEMSE_CREWS_ENABLED` (apagado → 404).

Excluido: tareas, hitos, asignaciones, horarios, geolocalización y evidencia (BO-08 en adelante). No reutiliza ni duplica `BuildOpsTask`/`JobTask`.

## Contrato
- AC-01: gestionar exige `org:crews:manage` **y** Membership ACTIVE del actor en esa Org y tenant; otra Org → 404, sin permiso → 403.
- AC-02: supervisor y miembros deben ser WORKER ACTIVE de la misma Org; suspendidos o ajenos → 422.
- AC-03: la obra de una cuadrilla debe pertenecer a la misma Org; si no → 422.
- AC-04: agregar miembro es idempotente; quitar dos veces → 409; cuadrilla de otra Org → 404.
- AC-05: **sesión obsoleta:** `mine` y `roster` revalidan la Membership ACTIVE vigente en cada lectura; si la membresía deja de estar ACTIVE, la persona deja de ver sus cuadrillas y el roster (404).
- AC-06: cross-crew: el supervisor de una cuadrilla no puede leer el roster de otra (404); un miembro sin ser supervisor tampoco.
- AC-07: archivar una cuadrilla una sola vez; las archivadas no aparecen en `mine`.
- AC-08: eventos de auditoría solo del catálogo (`EVENT_CATALOG.md`).
- AC-09: flag apagado → todas las rutas 404 sin efectos.

## Reglas de privacidad
El roster expone solo `userId` y fecha de alta; nunca compensación, oferta ni datos de engagement.

## Pendiente de decisión
Qué más puede hacer un supervisor (asignar tareas, ver horas) llega con BO-08/BO-10 y requiere OPEN-05 (¿el supervisor solicita o ejecuta?). Aquí solo lee su roster.
