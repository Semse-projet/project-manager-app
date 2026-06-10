---
id: api-contract-lifecycle
title: "Contract Lifecycle API"
type: spec
feature: "Contract Lifecycle"
domain: "contracts"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: high
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
depends_on: "docs/specs/api/jobs.spec.md"
related_files:
  - apps/api/src/modules/contracts
  - packages/schemas/src/marketplace.schema.ts
related_tests:
  - apps/api/test/contracts-disputes.spec-contract.test.ts
  - apps/api/test/contracts-payments-integration.test.ts
related_endpoints:
  - v1/contracts
  - v1/jobs/:jobId/contracts
related_events: []
related_agents:
  - contract-reviewer
last_verified: 2026-06-09
---

# Spec: Contract Lifecycle

> El contrato formaliza el acuerdo entre CLIENT y PRO tras la aceptación del bid.
> Es prerequisito para fondear el escrow y ejecutar milestones.
> Basado en `apps/api/src/modules/contracts/contracts.controller.ts`.

---

## 1. Qué resuelve

Un contrato digital que vincula a CLIENT y PRO para un job específico.
Ambas partes firman con `documentHash` para garantizar integridad.
Sin contrato completamente firmado no puede fondearse el escrow.

---

## 2. Actores y Permisos

| Actor | Permiso | Puede hacer |
|-------|---------|-------------|
| CLIENT | `contracts:create`, `contracts:sign` | Crear, firmar como client |
| PRO | `contracts:sign` | Firmar como professional |
| OPS_ADMIN | todos | Override |

---

## 3. FSM — Contrato

**Referencia:** `docs/foundation/STATE_MACHINES.md`

```
DRAFT → PENDING_SIGNATURES → PARTIALLY_SIGNED → ACTIVE
                                                    │
                                              SUPERSEDED (nuevo contrato)
DRAFT → VOID
PENDING_SIGNATURES → VOID
```

| Desde | Hacia | Guard |
|-------|-------|-------|
| `DRAFT` | `PENDING_SIGNATURES` | condiciones mínimas presentes |
| `PENDING_SIGNATURES` | `PARTIALLY_SIGNED` | una firma recibida |
| `PARTIALLY_SIGNED` | `ACTIVE` | ambas firmas presentes |
| `ACTIVE` | `SUPERSEDED` | nuevo contrato creado |
| `DRAFT/PENDING` | `VOID` | cancelación explícita |

**Invariante:** términos inmutables tras `ACTIVE`. Cambios requieren nuevo contrato → `SUPERSEDED`.

---

## 4. Escenarios P1

### P1-A — Crear contrato para un job

```
DADO   job en estado ACCEPTED con bid aceptado
       Y actor CLIENT con contracts:create
CUANDO POST /v1/jobs/:jobId/contracts
ENTONCES contrato creado en DRAFT/PENDING_SIGNATURES
  Y     audit "contract.generated"
```

### P1-B — Ambas partes firman → contrato ACTIVE

```
DADO   contrato en PENDING_SIGNATURES o PARTIALLY_SIGNED
CUANDO POST /v1/contracts/:contractId/sign { documentHash, signAs }
ENTONCES si es la segunda firma → contrato pasa a ACTIVE
  Y     audit "contract.client_signed" o "contract.professional_signed"
  Y     si ACTIVE → audit "contract.activated"
```

**Casos borde:**
- `documentHash` < 16 chars → `400`
- Contrato ya ACTIVE → `409`
- Actor sin `contracts:sign` → `403`

---

## 5. Contratos de API

### `POST /v1/jobs/:jobId/contracts`

```yaml
método: POST · permiso: contracts:create · roles: [CLIENT, OPS_ADMIN]
input: ninguno (jobId en path)
output: ContractRecord (DRAFT o PENDING_SIGNATURES)
errores: 403 sin permiso · 404 job no existe · 409 ya existe contrato activo
efectos:
  auditLog: true — "contract.generated"
  fsmTransicion: → DRAFT → PENDING_SIGNATURES
```

### `GET /v1/jobs/:jobId/contracts/current`

```yaml
método: GET · permiso: contracts:read · roles: [CLIENT, PRO, OPS_ADMIN]
input: jobId en path
output: ContractRecord activo | null
errores: 403 sin acceso · 404 job no existe
efectos: auditLog: false
```

### `GET /v1/contracts/:contractId`

```yaml
método: GET · permiso: contracts:read · roles: [CLIENT, PRO, OPS_ADMIN]
input: contractId en path
output: ContractRecord
errores: 403 · 404
efectos: auditLog: false
```

### `POST /v1/contracts/:contractId/sign`

```yaml
método: POST · permiso: contracts:sign · roles: [CLIENT, PRO, OPS_ADMIN]
input:
  schema: signContractSchema
  campos:
    - signAs: enum [client, professional] — opcional
    - documentHash: string min(16) — hash del PDF firmado
    - pdfUrl: string url — opcional
output: ContractRecord actualizado
errores:
  400: documentHash < 16 chars
  403: actor sin contracts:sign
  404: contractId no existe
  409: contrato ya está ACTIVE o VOID
efectos:
  auditLog: true — "contract.client_signed" | "contract.professional_signed"
  fsmTransicion: PENDING_SIGNATURES → PARTIALLY_SIGNED → ACTIVE
  paymentGovernance: true — ACTIVE habilita fondeo de escrow
```

---

## 6. Tests Requeridos

```typescript
describe("POST /v1/contracts/:id/sign") {
  it("CLIENT firma → contrato pasa a PARTIALLY_SIGNED")
  it("PRO firma segunda → contrato pasa a ACTIVE")
  it("rechaza con 400 si documentHash < 16 chars")
  it("rechaza con 409 si contrato ya está ACTIVE")
  it("emite audit 'contract.activated' cuando ambas firmas presentes")
}
describe("GET /v1/jobs/:jobId/contracts/current") {
  it("retorna contrato activo para job con contrato")
  it("retorna null si no hay contrato activo")
  it("rechaza con 403 si actor no tiene acceso al job")
}
```

---

## 7. Gaps identificados

| Gap | Severidad |
|-----|-----------|
| No hay endpoint para anular (VOID) un contrato activo — requiere OPS_ADMIN override | 🟡 Media |
| `signAs` es opcional — el sistema debería inferirlo del rol del actor para evitar spoofing | 🟡 Media |
| No hay validación de que el `documentHash` corresponde al PDF real | 🟢 Baja |
