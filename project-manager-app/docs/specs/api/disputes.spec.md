---
id: api-dispute-lifecycle
title: "Dispute Lifecycle API"
type: spec
feature: "Dispute Lifecycle"
domain: "disputes"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: critical
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
depends_on:
  - "docs/specs/api/jobs.spec.md"
  - "docs/specs/api/evidence.spec.md"
  - "docs/specs/api/payments.spec.md"
related_files:
  - apps/api/src/modules/disputes
  - packages/schemas/src/dispute.schema.ts
related_tests:
  - apps/api/test/contracts-disputes.spec-contract.test.ts
  - scripts/api-disputes-smoke.mjs
related_endpoints:
  - v1/disputes
related_events:
  - dispute.opened
related_agents:
  - dispute-analyzer
last_verified: 2026-06-09
---

# Spec: Dispute Lifecycle

> Las disputas son el mecanismo de resolución de conflictos entre CLIENT y PRO.
> Una disputa abierta bloquea el release de escrow hasta su resolución.
> Basado en `apps/api/src/modules/disputes/disputes.controller.ts`.

---

## 1. Qué resuelve

Cuando un milestone es rechazado repetidamente o hay desacuerdo sobre el trabajo,
cualquier parte puede abrir una disputa. OPS_ADMIN la revisa y resuelve con un
`resolutionType` que determina el destino del dinero en escrow.

---

## 2. Actores y Permisos

| Actor | Permiso | Puede hacer |
|-------|---------|-------------|
| CLIENT / PRO | `disputes:create` | Abrir disputa |
| CLIENT / PRO | `disputes:create` | Subir evidencia de disputa |
| OPS_ADMIN | `disputes:assign` | Asignar revisor, revisar |
| OPS_ADMIN | `disputes:resolve` | Resolver con resolutionType |
| OPS_ADMIN | `disputes:archive/restore` | Archivar/restaurar |

---

## 3. FSM — Disputa

**Referencia:** `docs/foundation/STATE_MACHINES.md`

```
OPEN → UNDER_REVIEW → RESOLVED
OPEN → CANCELLED

[TERMINALES: RESOLVED, CANCELLED]
```

### resolutionType → efecto en escrow

| resolutionType | Efecto |
|----------------|--------|
| `client_favor` | Escrow → REFUNDED (CLIENT recupera) |
| `pro_favor` | Escrow → RELEASED (PRO cobra) |
| `partial_50_50` | Escrow → PARTIALLY_RELEASED (split) |
| `escalated_legal` | Escrow → DISPUTED (congelado, proceso legal) |

**Invariante:** disputa abierta bloquea `canRelease` en PaymentGovernanceService.

---

## 4. Escenarios P1

### P1-A — PRO abre disputa por trabajo rechazado

```
DADO   job en IN_PROGRESS con milestone rechazado repetidamente
       Y actor PRO con disputes:create
CUANDO POST /v1/disputes { projectId, jobId, reason }
ENTONCES disputa creada en estado OPEN
  Y     job pasa a estado DISPUTE
  Y     escrow pasa a DISPUTED (bloquea release)
  Y     audit "dispute.opened"
  Y     OPS_ADMIN notificado
```

**Casos borde:**
- `reason` < 10 chars → `400`
- Actor sin `disputes:create` → `403`

### P1-B — OPS_ADMIN resuelve a favor del PRO

```
DADO   disputa en UNDER_REVIEW
       Y actor OPS_ADMIN con disputes:resolve
CUANDO POST /v1/disputes/:id/resolve { resolution, resolutionType: "pro_favor" }
ENTONCES disputa pasa a RESOLVED
  Y     escrow → RELEASED
  Y     audit "dispute.resolved"
  Y     ambas partes notificadas
```

### P1-C — PRO sube evidencia de disputa

```
DADO   disputa en OPEN o UNDER_REVIEW
       Y actor PRO con disputes:create
CUANDO POST /v1/disputes/:id/submit-evidence { evidenceIds }
ENTONCES evidencias vinculadas a la disputa
  Y     audit registrado
```

---

## 5. Contratos de API

### `POST /v1/disputes`

```yaml
método: POST · permiso: disputes:create · roles: [CLIENT, PRO, OPS_ADMIN]
input:
  schema: createDisputeSchema
  campos:
    - projectId: string min(1) — requerido
    - jobId: string min(1) — requerido
    - reason: string min(10).max(3000) — causa formal
output: DisputeRecord en OPEN
errores:
  400: reason < 10 chars
  403: sin disputes:create
  404: projectId o jobId no existe
  409: ya existe disputa abierta para este job
efectos:
  auditLog: true — "dispute.opened"
  evento: "dispute.opened"
  fsmTransicion: job → DISPUTE · escrow → DISPUTED
  paymentGovernance: true — bloquea canRelease
```

### `GET /v1/disputes`

```yaml
método: GET · permiso: disputes:read · roles: [CLIENT, PRO, OPS_ADMIN]
input: ninguno
output: array de DisputeRecord del tenant
errores: 403 sin acceso
efectos: auditLog: false
```

### `POST /v1/disputes/:disputeId/assign`

```yaml
método: POST · permiso: disputes:assign · roles: [OPS_ADMIN]
input:
  schema: assignDisputeSchema
  campos:
    - assigneeUserId: string min(1)
output: DisputeRecord con reviewer asignado
errores: 403 solo OPS_ADMIN · 404 · 409 ya RESOLVED
efectos:
  auditLog: true — "dispute.review_started"
  fsmTransicion: OPEN → UNDER_REVIEW
```

### `POST /v1/disputes/:disputeId/submit-evidence`

```yaml
método: POST · permiso: disputes:create · roles: [CLIENT, PRO, OPS_ADMIN]
input:
  schema: submitDisputeEvidenceSchema
  campos:
    - evidenceIds: array de string — min 1, max 50
output: confirmación
errores:
  400: evidenceIds vacío
  403: sin permiso
  404: disputa no existe
efectos:
  auditLog: true
```

### `POST /v1/disputes/:disputeId/resolve`

```yaml
método: POST · permiso: disputes:resolve · roles: [OPS_ADMIN]
input:
  schema: resolveProjectDisputeSchema
  campos:
    - resolution: string min(1) — descripción de la resolución
    - resolutionType: enum [client_favor, pro_favor, partial_50_50, escalated_legal] — opcional
output: DisputeRecord en RESOLVED
errores:
  400: resolution vacío
  403: solo OPS_ADMIN
  404: disputeId no existe
  409: disputa ya RESOLVED o CANCELLED
efectos:
  auditLog: true — "dispute.resolved"
  evento: "dispute.resolved"
  fsmTransicion: UNDER_REVIEW → RESOLVED
  paymentGovernance: true — desbloquea escrow según resolutionType
  notificacion: CLIENT y PRO reciben resultado
```

### `POST /v1/disputes/:disputeId/archive`

```yaml
método: POST · permiso: disputes:archive · roles: [OPS_ADMIN]
input: ninguno
output: { id, archivedAt }
efectos: auditLog: true
```

### `POST /v1/disputes/:disputeId/restore`

```yaml
método: POST · permiso: disputes:restore · roles: [OPS_ADMIN]
input: ninguno
output: DisputeRecord restaurado
efectos: auditLog: true
```

---

## 6. Tests Requeridos

```typescript
describe("POST /v1/disputes") {
  it("PRO puede abrir disputa con reason válido")
  it("rechaza con 400 si reason < 10 chars")
  it("rechaza con 403 si actor sin disputes:create")
  it("rechaza con 409 si ya existe disputa abierta para el job")
  it("emite evento 'dispute.opened'")
  it("bloquea canRelease en PaymentGovernance")
}
describe("POST /v1/disputes/:id/resolve") {
  it("OPS_ADMIN resuelve con resolutionType 'pro_favor' → escrow RELEASED")
  it("OPS_ADMIN resuelve con resolutionType 'client_favor' → escrow REFUNDED")
  it("rechaza con 403 si actor no es OPS_ADMIN")
  it("rechaza con 409 si disputa ya está RESOLVED")
  it("emite evento 'dispute.resolved'")
}
describe("POST /v1/disputes/:id/submit-evidence") {
  it("PRO puede subir hasta 50 evidenceIds")
  it("rechaza con 400 si evidenceIds está vacío")
}
```

---

## 7. Gaps identificados

| Gap | Severidad |
|-----|-----------|
| `resolutionType` es opcional en resolveProjectDisputeSchema — debería ser requerido para trazabilidad financiera | 🟡 Media |
| No hay endpoint `GET /v1/disputes/:disputeId` para detalle individual | 🟡 Media |
| `POST /v1/disputes/:id/review` existe en controller (`disputes:assign`) pero no está en SEMSE_API_SURFACE_V1.md | 🟢 Baja |
| No hay timeout automático para disputas en OPEN sin asignar | 🟢 Baja |
