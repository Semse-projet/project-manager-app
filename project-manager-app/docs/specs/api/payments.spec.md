---
id: api-payments-escrow
title: "Payments and Escrow API"
type: spec
feature: "Payments & Escrow"
domain: "payments"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: critical
branch: "feat/payments-spec"
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
plan: "docs/specs/api/payments.plan.md"
depends_on:
  - "docs/specs/api/milestones.spec.md"
  - "docs/specs/api/evidence.spec.md"
related_files:
  - apps/api/src/modules/payments
  - packages/schemas/src/payment.schema.ts
  - packages/schemas/src/escrow-view.types.ts
  - packages/db/prisma/schema.prisma
related_tests:
  - apps/api/test/payments.spec-contract.test.ts
  - apps/api/test/payment-governance.service.test.ts
  - apps/api/test/payments.controller.test.ts
  - tests/unit/payment-escrow-status-prisma.test.ts
related_endpoints:
  - v1/payments
  - v1/escrow
related_events:
  - payment.released
related_agents:
  - crowd
  - Justus
last_verified: 2026-06-09
---

# Spec: Payments & Escrow

> **Propósito:** Contrato ejecutable del sistema de escrow y pagos de SEMSE OS.
> El escrow es el mecanismo que garantiza que el PRO cobra solo tras aprobación verificada.
> Basado en código real de `apps/api/src/modules/payments/` y `packages/schemas/src/payment.schema.ts`.

---

## 1. Qué resuelve

El sistema de pagos de SEMSE opera bajo el principio de **Payment Governance**:
ningún dinero se mueve sin que se cumplan condiciones de negocio verificadas.

El flujo canónico:
1. **Fondear** — CLIENT deposita dinero en escrow antes de que el trabajo comience
2. **Retener** — El dinero queda retenido (HELD) mientras los milestones se ejecutan
3. **Liberar** — Tras `milestone.approve`, PaymentGovernanceService valida y autoriza el release
4. **Pagar** — El PRO recibe el pago vía su método de cobro configurado

**Para quién:** CLIENT que fondea · PRO que cobra · OPS_ADMIN que supervisa · PaymentGovernanceService que valida
**privacyCritical:** `false` — los montos y referencias se manejan en cloud, no son PII sensible

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| Cliente | `CLIENT` | Depositar escrow · Ver pagos de su job · Ver escrow | Liberar sin governance · Ver financials de otros |
| Profesional | `PRO` | Ver pagos de su job · Configurar payout method | Depositar · Liberar directamente |
| Ops Admin | `OPS_ADMIN` | Todo + override de governance | — |
| Plataforma | `PLATFORM` | Liberar escrow (via governance) · Procesar webhook | — |

Permiso de escritura financiera: `projects:financials:write`
Referencia: `docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md`

---

## 3. FSM — Máquina de Estados (Escrow)

**Entidad:** `PaymentEscrow`
**Referencia canónica:** `docs/foundation/STATE_MACHINES.md`

```
                        CLIENT deposita
                              │
                              ▼
   PENDING ──────────────► FUNDED
                              │
                    sistema confirma pago
                              │
                              ▼
                            HELD ◄──────────────────────────────┐
                           ╱    ╲                               │
          milestone APPROVED   disputa abierta                  │
                 ↓                   ↓                          │
        PARTIALLY_RELEASED       DISPUTED ──► (resuelto) ───────┘
                 │                   │
          todos los                  └──► RELEASED
          milestones                 └──► REFUNDED
          aprobados
                 │
                 ▼
             RELEASED

[TERMINALES: RELEASED, REFUNDED]
[INVARIANTE: no liberar más de lo fondeado]
```

### Transiciones y condiciones

| Desde | Hacia | Guard | Actor | Efecto |
|-------|-------|-------|-------|--------|
| `PENDING` | `FUNDED` | Pago del proveedor confirmado | PLATFORM (webhook/provider) | `payment.funded` event |
| `FUNDED` | `HELD` | Sistema confirma recepción | PLATFORM | `payment.held` event |
| `HELD` | `PARTIALLY_RELEASED` | milestone APPROVED + governance OK | PLATFORM via `release` | `payment.released` event (parcial) |
| `HELD` | `RELEASED` | Todos los milestones APPROVED + cierre total | PLATFORM | `payment.released` event (total) |
| `HELD` | `DISPUTED` | Disputa abierta en job | OPS_ADMIN / PLATFORM | `dispute.opened` event |
| `PARTIALLY_RELEASED` | `HELD` | Nuevo milestone pendiente | PLATFORM | — |
| `PARTIALLY_RELEASED` | `RELEASED` | Último milestone aprobado | PLATFORM | `payment.released` |
| `DISPUTED` | `HELD` | Disputa resuelta sin money move | OPS_ADMIN | `dispute.resolved` |
| `DISPUTED` | `RELEASED` | Disputa resuelta a favor del PRO | OPS_ADMIN | `payment.released` |
| `DISPUTED` | `REFUNDED` | Disputa resuelta a favor del CLIENT | OPS_ADMIN | `payment.refunded` |

---

## 4. Payment Governance — El Guard Central

Antes de ejecutar cualquier release, `PaymentGovernanceService.evaluate()` valida:

```yaml
PaymentGovernanceResult:
  milestoneId: string
  projectId: string | null
  milestoneStatus: string
  evidenceReadiness: string
  paymentReadiness: string
  releaseStatus: ready | blocked | needs_review | released | disputed
  canRelease: boolean          ← el gate de decisión
  blockers: string[]           ← razones para NO liberar
  requiredActions: string[]
  riskLevel: low | medium | high | critical
  evidenceSummary:
    total: number
    required: number
    approved: number
    missing: number
    rejected: number
    submitted: number
  changeOrderBlockers: number   ← change orders pendientes que bloquean
  openSignals: number
  criticalSignals: number
  disputeRisk: boolean
  nextBestAction: string
  auditReason: string
  governedAt: string (ISO)
```

**Regla:** `canRelease = true` solo cuando:
- `milestoneStatus = APPROVED`
- `evidenceSummary.missing = 0`
- `evidenceSummary.rejected = 0`
- `changeOrderBlockers = 0`
- `disputeRisk = false`
- `riskLevel ≠ critical`

---

## 5. Escenarios de Usuario

### P1-A — Cliente fondea escrow de un job

**Criterio de aceptación:**
```
DADO   que existe un job aceptado con contrato activo
       Y el actor tiene rol CLIENT con permiso projects:financials:write
CUANDO POST /v1/jobs/:jobId/escrow/fund con { amount, currency, provider, methodType }
ENTONCES se crea registro de escrow en estado FUNDED
  Y     se crea transacción de tipo FUND
  Y     se retorna { escrow (visible), transaction (visible), contract (visible) }
  Y     se emite evento audit de fondeo
```

**Casos borde:**
- `amount` negativo o cero → `400 Bad Request`
- Job no existe en el tenant → `404 Not Found`
- Actor sin `projects:financials:write` → `403 Forbidden`

---

### P1-B — Sistema libera pago de milestone aprobado

**Criterio de aceptación:**
```
DADO   que un milestone fue APPROVED
       Y PaymentGovernanceService retorna canRelease = true
CUANDO POST /v1/milestones/:milestoneId/escrow/release con { amount? }
ENTONCES se libera el monto del milestone desde el escrow
  Y     se crea transacción de tipo RELEASE
  Y     el escrow pasa a PARTIALLY_RELEASED o RELEASED (si es el último)
  Y     se emite evento "payment.released"
  Y     el milestone pasa a estado PAID
```

**Casos borde:**
- `canRelease = false` (governance bloqueado) → `400 Bad Request` con lista de blockers
- `amount` mayor al saldo retenido → `400 Bad Request`
- Milestone no está en estado APPROVED → `400 Bad Request`
- Actor sin `projects:financials:write` → `403 Forbidden`

---

### P1-C — PRO configura método de cobro

**Criterio de aceptación:**
```
DADO   que el actor tiene rol PRO
CUANDO POST /v1/workers/me/payout-method con { type, ...campos por tipo }
ENTONCES se guarda el método de pago del worker
  Y     GET /v1/workers/me/payout-method retorna el método configurado
  Y     se registra auditLog `worker.payout_method.update` sin datos sensibles
```

**Casos borde:**
- `type` fuera de los valores válidos → `400 Bad Request`

---

### P2-A — Cliente consulta readiness de pago antes de liberar

**Criterio de aceptación:**
```
DADO   que existen milestones en distintos estados para el job
CUANDO GET /v1/jobs/:jobId/payment-readiness
ENTONCES retorna resumen de readiness por milestone
  Y     incluye blockers y nextBestAction para cada uno
  Y     no retorna información de otros tenants
```

---

### P2-B — Webhook de proveedor de pago

**Criterio de aceptación:**
```
DADO   que el proveedor de pago (Stripe, mock) envía confirmación
CUANDO POST /v1/payments/webhook con { event, providerRef }
ENTONCES el sistema procesa el evento del proveedor
  Y     actualiza el estado del escrow/transacción correspondiente
```

---

### P2-C — OPS reembolsa escrow sin disputa abierta

**Criterio de aceptación:**
```
DADO   que existe escrow fondeado con saldo disponible
CUANDO OPS_ADMIN POST /v1/escrow/refund con { projectId|escrowId, amount, reason }
ENTONCES se crea PaymentTxn REFUND
  Y     el saldo disponible descuenta releases y refunds previos
  Y     se registra auditLog `escrow.refund`
  Y     CLIENT/PRO reciben 403 aunque tengan contexto del proyecto
```

---

## 6. Contratos de API

### `POST /v1/jobs/:jobId/escrow/fund`

```yaml
método: POST
ruta: /v1/jobs/:jobId/escrow/fund
descripción: Fondear escrow de un job (CLIENT deposita dinero)

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: projects:financials:write
privacyCritical: false

input:
  schema: depositEscrowSchema
  campos:
    - nombre: amount
      tipo: number
      requerido: true
      validación: positive()
    - nombre: currency
      tipo: string
      requerido: false
      validación: min(3).max(3) — ej. "USD"
	    - nombre: provider
	      tipo: enum (paymentProviderSchema)
	      requerido: false
	      valores: [mock, stripe, paypal, adyen, bank-transfer]
    - nombre: methodType
      tipo: enum (paymentMethodTypeSchema)
      requerido: false

output:
  campos:
    - escrow: EscrowRecord (visible — status, amounts)
    - transaction: PaymentTransaction (visible — type FUND, status)
    - contract: ContractRecord (visible)

errores:
  400: amount inválido, currency fuera de formato
  403: actor sin projects:financials:write
  404: jobId no existe en el tenant

efectos:
  auditLog: true
  evento: "payment.funded" → "payment.held"
  sse: false
  fsmTransicion: PENDING → FUNDED → HELD
  paymentGovernance: false (es el depósito, no el release)
```

---

### `POST /v1/projects/:projectId/escrow/deposit`

```yaml
método: POST
ruta: /v1/projects/:projectId/escrow/deposit
descripción: Depositar en escrow de un proyecto (alias por projectId)

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: projects:financials:write
privacyCritical: false

input: depositEscrowSchema (igual que fund)
output:
  campos:
    - escrow: EscrowRecord (visible)
    - transaction: PaymentTransaction (visible)
    (sin contract — el contrato viene del job, no del proyecto directo)

errores:
  400: amount inválido
  403: sin permiso
  404: projectId no existe

efectos:
  auditLog: true
  evento: "payment.funded"
  fsmTransicion: escrow PENDING → FUNDED → HELD
```

---

### `POST /v1/milestones/:milestoneId/escrow/release`

```yaml
método: POST
ruta: /v1/milestones/:milestoneId/escrow/release
descripción: Liberar fondos del escrow para un milestone aprobado

auth: requerida
roles: [CLIENT, OPS_ADMIN]
permiso: projects:financials:write
privacyCritical: false

input:
  schema: releaseEscrowSchema
  campos:
    - nombre: amount
      tipo: number
      requerido: false
      validación: positive() — si omitido, usa el monto del milestone
    - nombre: provider
      tipo: enum
      requerido: false
    - nombre: methodType
      tipo: enum
      requerido: false

output:
  campos:
    - transaction: PaymentTransaction (visible — type RELEASE)
    - governance: PaymentGovernanceResult (resultado de la evaluación)

errores:
  400: milestone no está en APPROVED
  400: canRelease = false — incluye blockers[] en la respuesta
  400: amount supera saldo retenido en escrow
  403: actor sin projects:financials:write
  404: milestoneId no existe

efectos:
  auditLog: true
  evento: "payment.release_requested" → "payment.released"
  sse: false
  fsmTransicion: escrow HELD → PARTIALLY_RELEASED | RELEASED
                 milestone APPROVED → PAID
  paymentGovernance: true — PaymentGovernanceService.evaluate() ANTES de ejecutar
```

---

### `POST /v1/escrow/refund`

```yaml
método: POST
ruta: /v1/escrow/refund
descripción: Reembolso manual de escrow por OPS_ADMIN cuando no hay flujo de disputa activo

auth: requerida
roles: [OPS_ADMIN]
permiso: projects:financials:write + validación explícita de rol OPS_ADMIN
privacyCritical: false

input:
  schema: refundEscrowSchema
  campos:
    - nombre: projectId
      tipo: string
      requerido: condicional (projectId o escrowId)
    - nombre: escrowId
      tipo: string
      requerido: condicional (projectId o escrowId)
    - nombre: amount
      tipo: number
      requerido: true
      validación: positive()
    - nombre: reason
      tipo: string
      requerido: true
      validación: min(3).max(500)
    - nombre: provider
      tipo: enum
      requerido: false
    - nombre: methodType
      tipo: enum
      requerido: false

output:
  campos:
    - escrow: EscrowRecord (visible) | null
    - totalDeposited: number
    - totalReleased: number
    - totalRefunded: number
    - available: number
    - transaction: PaymentTransaction (visible — type REFUND)
    - refundIntent: RefundIntentRecord

errores:
  400: projectId/escrowId ausentes, amount inválido o reason inválido
  403: actor no es OPS_ADMIN
  404: escrow no existe en tenant
  409: amount supera saldo reembolsable

efectos:
  auditLog: true (`escrow.refund`)
  evento: "payment.refunded"
  sse: true (`project:{projectId}` → `payment.refunded`)
  fsmTransicion: HELD | PARTIALLY_RELEASED → REFUNDED cuando el saldo reembolsable llega a 0
```

---

### `GET /v1/jobs/:jobId/payments`

```yaml
método: GET
ruta: /v1/jobs/:jobId/payments
descripción: Lista todas las transacciones de pago de un job

auth: requerida
roles: [CLIENT, PRO, OPS_ADMIN]
privacyCritical: false

input: jobId en path
output: array de PaymentTransaction (visible — tipo y status en mayúsculas)

errores:
  403: actor sin acceso al job
  404: jobId no existe
efectos: auditLog: false
```

---

### `GET /v1/jobs/:jobId/escrow`

```yaml
método: GET
ruta: /v1/jobs/:jobId/escrow
descripción: Estado actual del escrow de un job

auth: requerida
roles: [CLIENT, OPS_ADMIN]
privacyCritical: false

input: jobId en path
output:
  campos:
    - escrow: EscrowRecord (visible) | null
    - contract: ContractRecord (visible) | null

errores:
  403: actor sin acceso — PRO NO puede leer financials por defecto
  404: jobId no existe
efectos: auditLog: false

nota de seguridad: |
  "El pro asignado no debe leer financials por defecto salvo política explícita"
  Referencia: docs/foundation/DOMAIN_INVARIANTS.md
```

---

### `GET /v1/jobs/:jobId/payment-readiness`

```yaml
método: GET
ruta: /v1/jobs/:jobId/payment-readiness
descripción: Estado de readiness de pago por milestone del job

auth: requerida
roles: [CLIENT, OPS_ADMIN]
privacyCritical: false

input: jobId en path
output: resumen de readiness por milestone con blockers, evidenceSummary, nextBestAction

errores:
  403: actor sin acceso
  404: jobId no existe
efectos: auditLog: false
```

---

### `GET /v1/projects/:projectId/payments`

```yaml
método: GET
ruta: /v1/projects/:projectId/payments
descripción: Lista transacciones de pago de un proyecto

auth: requerida
roles: [CLIENT, OPS_ADMIN]
privacyCritical: false

input: projectId en path
output: array de PaymentTransaction (visible)
errores:
  403: actor sin acceso
  404: proyecto no existe
efectos: auditLog: false
```

---

### `GET /v1/projects/:projectId/escrow`

```yaml
método: GET
ruta: /v1/projects/:projectId/escrow
descripción: Estado del escrow de un proyecto

auth: requerida
roles: [CLIENT, OPS_ADMIN]
privacyCritical: false

input: projectId en path
output: EscrowRecord (visible) | null
errores:
  403: PRO no puede leer financials
  404: proyecto no existe
efectos: auditLog: false
```

---

### `POST /v1/workers/me/payout-method`

```yaml
método: POST
ruta: /v1/workers/me/payout-method
descripción: PRO configura su método de cobro

auth: requerida
roles: [PRO, OPS_ADMIN]
privacyCritical: false

input:
  schema: workerPayoutMethodSchema (inline en controller)
  campos:
    - nombre: type
      tipo: enum
      requerido: true
      valores: [bank_account, debit_card, paypal, zelle, cashapp]
    - nombre: bankName
      tipo: string
      requerido: false
    - nombre: routingNumber, accountNumber, last4, email
      tipo: string
      requerido: false (según type)

output: método guardado
errores:
  400: type inválido o campos requeridos para el type faltantes
  403: actor sin autenticación
efectos: auditLog: true (`worker.payout_method.update`)
```

---

### `GET /v1/workers/me/payout-method`

```yaml
método: GET
ruta: /v1/workers/me/payout-method
descripción: PRO consulta su método de cobro configurado

auth: requerida
roles: [PRO, OPS_ADMIN]
privacyCritical: false

input: ninguno (actor del request)
output: payout method o null
errores: 403 si no autenticado
efectos: auditLog: false
```

---

### `POST /v1/payments/webhook`

```yaml
método: POST
ruta: /v1/payments/webhook
descripción: Recibe eventos de proveedores de pago externos (Stripe, etc.)

auth: verificación por proveedor (`@Public` para omitir JWT SEMSE estándar)
roles: [PLATFORM]
privacyCritical: false

input:
  schema: paymentsWebhookSchema
  campos:
    - nombre: event
      tipo: string
      requerido: false
    - nombre: providerRef
      tipo: string
      requerido: false

output: confirmación de procesamiento
errores:
  400: payload inválido
efectos:
  auditLog: false (el proveedor mantiene su propio log)
  evento: según el tipo de evento del proveedor
  paymentGovernance: false (solo sincroniza estado)

nota de seguridad: |
  En producción, STRIPE_WEBHOOK_SECRET es obligatorio. Si está ausente, el endpoint
  falla cerrado. Si está presente, valida `Stripe-Signature` con HMAC SHA-256 sobre
  el raw body y tolerancia anti-replay.
```

---

## 7. Providers de pago

| Provider | Archivo | Uso | Estado |
|----------|---------|-----|--------|
| `mock` | `apps/api/src/modules/payments/providers/mock-payment.provider.ts` | Dev/staging, tests y flows sin proveedor externo | Soporta funding, payout y refund síncronos |
| `stripe` | `apps/api/src/modules/payments/providers/stripe.provider.ts` | Producción con Stripe/Connect | Soporta PaymentIntent para funding, Transfer para payout y Refund sobre PaymentIntent/Charge original |

**Selección de provider:**
- `PaymentProviderRegistry` registra siempre `mock`.
- `stripe` se registra cuando el provider está disponible y `STRIPE_SECRET_KEY` existe.
- `deposit`, `release` y `refund` aceptan `provider`; si se omite, el runtime usa `mock`.

---

## 8. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Latencia P95 de deposit/fund | < 500ms |
| Latencia P95 de release (con governance) | < 1000ms |
| `canRelease = false` con evidencia faltante | 100% de los casos |
| Tasa de doble-release del mismo milestone | 0% |
| Tasa de error 5xx en release | < 0.1% |
| Cobertura de tests | ≥ 80% branches |

---

## 9. Tests Requeridos

```typescript
describe("POST /v1/jobs/:jobId/escrow/fund") {
  it("fondea escrow para job con contrato activo")
  it("retorna escrow con status FUNDED/HELD y transacción tipo FUND")
  it("rechaza con 400 si amount es negativo o cero")
  it("rechaza con 403 si actor no tiene projects:financials:write")
  it("rechaza con 404 si jobId no existe en el tenant")
}

describe("POST /v1/milestones/:id/escrow/release") {
  it("libera pago cuando milestone es APPROVED y governance canRelease=true")
  it("rechaza con 400 cuando milestone no está en APPROVED")
  it("rechaza con 400 cuando governance retorna canRelease=false — incluye blockers")
  it("rechaza con 400 si amount supera saldo del escrow")
  it("rechaza con 403 si actor no tiene projects:financials:write")
  it("emite evento 'payment.released'")
  it("transiciona milestone a PAID tras release exitoso")
  it("PRO no puede liberar su propio pago directamente")
}

describe("POST /v1/escrow/refund") {
  it("crea PaymentTxn REFUND cuando OPS_ADMIN tiene saldo reembolsable")
  it("rechaza con 403 cuando CLIENT o PRO intenta reembolsar")
  it("rechaza con 409 si amount supera depósitos menos releases menos refunds")
  it("audita escrow.refund")
}

describe("PaymentGovernanceService.evaluate") {
  it("retorna canRelease=true cuando milestone APPROVED + evidencia OK + sin blockers")
  it("retorna canRelease=false cuando evidencia required falta (missing > 0)")
  it("retorna canRelease=false cuando hay changeOrderBlockers > 0")
  it("retorna canRelease=false cuando disputeRisk=true")
  it("retorna canRelease=false cuando riskLevel=critical")
  it("incluye nextBestAction descriptivo en todos los casos")
}

describe("GET /v1/jobs/:jobId/escrow") {
  it("retorna escrow y contrato para CLIENT dueño")
  it("rechaza con 403 para PRO (no puede leer financials por defecto)")
  it("retorna null si no hay escrow creado aún")
}

describe("POST /v1/workers/me/payout-method") {
  it("guarda método bank_account con routing y account number")
  it("guarda método paypal con email")
  it("rechaza con 400 si type está fuera del enum")
}
```

---

## 10. Impacto en otros dominios

| Dominio | Impacto | Detalle |
|---------|---------|---------|
| Milestones | ✅ Directo | release transiciona milestone a PAID · approve dispara governance |
| Evidence | ✅ Directo | governance verifica evidence summary antes de canRelease |
| Disputes | ✅ Directo | disputa abierta cambia escrow a DISPUTED · bloquea release |
| Trust | ✅ Indirecto | `payment.released` y `payment.refunded` son señales financieras para reputación/riesgo |
| BuildOps | ✅ Directo | change orders pendientes bloquean canRelease |
| SSE/Real-time | ✅ Directo | release emite `payment.released` al canal del proyecto |
| Prometeo RAG | ⚠️ No | Payments no usa RAG |
| Communications | 🟡 Futuro | Notificación al PRO cuando el pago se libera |
| Job FSM | ✅ Directo | Todos los milestones PAID desbloquea Job COMPLETED |

---

## 11. Gaps pendientes

No quedan gaps abiertos de pagos v1 identificados en esta spec.

**Gaps cerrados en implementación:**
- `POST /v1/workers/me/payout-method` audita cambios con `worker.payout_method.update`.
- `GET /v1/jobs/:jobId/escrow` y rutas financieras de proyecto validan explícitamente que PRO asignado no lee financials por política de dominio.
- `POST /v1/escrow/refund` permite reembolso manual OPS-only con audit, SSE y `PaymentTxn` REFUND.
- Providers `mock` y `stripe` quedan documentados en surface v1.

---

## 12. Supuestos y Dependencias

- [ ] `PaymentGovernanceService` corre síncronamente en el mismo request del `release` — no es asíncrono
- [ ] El proveedor de pago por defecto en dev/staging es `mock-payment.provider.ts`
- [ ] `Stripe` es el proveedor de producción — requiere `STRIPE_SECRET_KEY` en Railway
- [ ] El `amount` en el release es en la misma moneda que el depósito — no hay conversión de divisa
- [ ] Un milestone puede liberarse parcialmente si el `amount` es menor al total del milestone (edge case de negociación)
- [ ] `releaseMilestonePaymentSchema` en `marketplace.schema.ts` existe como schema alternativo — el controller usa `releaseEscrowSchema` de `payment.schema.ts`

---

## Checklist de aprobación

- [x] Todos los escenarios P1 tienen Given/When/Then
- [x] Todos los endpoints (10) tienen contrato completo
- [x] FSM del escrow declarada con todos los estados y transiciones
- [x] PaymentGovernanceService documentado con contrato completo
- [x] Invariantes de no-liberar-más-de-lo-fondeado verificadas
- [x] Tests requeridos listados (5 describes, 20+ casos)
- [x] PRO no puede leer financials documentado como invariante
- [x] Webhook Stripe valida firma cuando `STRIPE_WEBHOOK_SECRET` está configurado
- [x] Status: `APPROVED`
