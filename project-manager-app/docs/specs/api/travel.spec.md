---
id: "api.travel-assignments-settlement"
title: "Travel — asignaciones, gastos, hospedaje, anticipos y liquidación"
domain: "travel"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/travel/travel.controller.ts
  - apps/api/src/modules/travel/travel.service.ts
  - apps/web/app/(app)/worker/travel/page.tsx
  - apps/web/app/(app)/worker/travel/[travelId]/page.tsx
  - apps/web/app/(app)/admin/travel/page.tsx
related_tests:
  - apps/api/test/travel.controller.test.ts
  - apps/api/test/travel.service.test.ts
related_endpoints:
  - v1/travel
related_events: []
related_agents: []
last_verified: "2026-07-25"
---

# Spec: Travel — asignaciones y liquidación

## 1. Alcance del plan

Contrato canónico para `2.31`, `2.34`, `2.35`, `2.36`, `2.38`, `3.24` y
`3.35`. Los uploads de comprobantes se rigen además por `api-evidence-upload-review`.

## 2. Actores y acceso

| Actor | Lectura/escritura |
|---|---|
| `PRO`/`WORKER` | viajes asignados a su usuario |
| `CLIENT` | viajes de jobs cuya `clientOrgId` coincide con su org |
| `OPS_ADMIN` | tenant-wide |
| Otro rol | sin acceso |

Todos los endpoints de detalle aplican la misma policy; conocer `travelId` no
autoriza.

## 3. Creación segura

```text
DADO un actor que crea una asignación
CUANDO envía jobId
ENTONCES el job debe existir en el tenant
  Y CLIENT debe ser dueño del job
  Y PRO/WORKER debe estar asignado al job
  Y OPS_ADMIN conserva override tenant-wide
  Y un updateMany con count=0 se trata como rechazo, nunca como validación
```

**Implementado en v1.1 (2026-07-25):** el controller propaga identidad completa
del actor y `createAssignment` resuelve el job con `id + tenantId +
deletedAt:null` dentro de una transacción. CLIENT se valida contra
`clientOrgId`; PRO/WORKER contra `project.assignedProOrgId`; OPS_ADMIN conserva
el override únicamente después de confirmar que el job pertenece al tenant. La
marcación `isOutOfTown` usa compare-and-set y `count !== 1` bloquea la creación.
Sin persistencia, la creación falla cerrada porque no puede validar ownership.

## 4. Contratos API

- `GET /v1/travel`: lista ya agregada con contadores/resumen necesarios para
  evitar N+1 desde la UI.
- `POST /v1/travel`: valida job y actor antes de crear.
- `GET/PATCH /v1/travel/:travelId`: aplica policy por recurso.
- Expenses, lodging y advances: misma policy y validación de monto/moneda.
- `GET /settlement`: calcula saldo sin mutar.
- `POST /settlement/close`: confirmación explícita, comprobantes requeridos y
  cierre auditable.

## 5. Reglas de integridad

- Montos no negativos y moneda explícita.
- El cierre no ocurre si faltan comprobantes requeridos.
- La UI dice “falta hospedaje requerido”; no usa el ambiguo “sin hospedaje
  requerido”.
- El listado obtiene summaries en una sola carga o endpoint batch; no tres
  requests por viaje ni doble carga al montar.

## 6. Tests requeridos

- PRO ajeno recibe 403 en cada subrecurso.
- CLIENT de otra org recibe 403.
- [x] Job inexistente/cross-tenant impide crear.
- [x] PRO/WORKER sin asignación no crea viaje.
- [x] CLIENT de otra org no crea viaje.
- [x] OPS_ADMIN puede crear únicamente para un job existente dentro de su tenant.
- [x] `updateMany.count=0` no permite crear y el modo sin persistencia falla cerrado.
- Cierre requiere evidencia y confirmación.
- Lista no ejecuta N+1 desde el cliente.

## 7. Rollback

No requiere migración. Si se revierte el endpoint agregado, la UI puede volver a
consultas individuales, pero nunca se revierte la policy de ownership.
