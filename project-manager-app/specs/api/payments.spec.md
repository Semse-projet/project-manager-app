# SPEC: Payments & Escrow API
**Versión:** 1.0
**Dominio:** Payments / Escrow
**Estado:** APPROVED
**Depende de:** jobs.spec.md, milestones.spec.md, specs/fsm/payment-lifecycle.spec.md
**Implementado en:** apps/api/src/modules/payments/payments.controller.ts
**Tests:** apps/api/tests/ (MISSING — crear)

## Qué resuelve
El dinero no puede ser una caja negra. El client fondeea un escrow al asignar un pro. Los fondos se liberan por hito aprobado. En disputas, los fondos quedan retenidos hasta resolución. Todo movimiento tiene una entrada de ledger auditable.

## Principio de Payment Governance
```
Ningún release de fondos sin:
  1. Milestone en estado APPROVED
  2. Evidence válida vinculada
  3. AuditLog de MILESTONE_APPROVED
  4. Ledger entry generada
```

## Actores
- **Client:** fondea el escrow, puede solicitar reembolso parcial en casos específicos
- **Pro:** recibe pagos al aprobarse milestones
- **Payments Agent:** orquesta releases, valida condiciones, genera ledger
- **Admin:** puede override en disputas, aprobar releases manuales

## FSM del Escrow
Ver `specs/fsm/payment-lifecycle.spec.md`
```
UNFUNDED → FUNDED → PARTIALLY_RELEASED → FULLY_RELEASED
               ↓
           DISPUTED → RESOLVED_CLIENT | RESOLVED_PRO | RESOLVED_SPLIT
```

---

## Contratos de API

### POST /v1/jobs/:jobId/escrow/fund
Fondear el escrow al asignar un pro (automático tras POST /v1/jobs/:id/assign).

**Input:**
```ts
{
  amount: number          // total del job
  currency: "USD" | "CAD"
  paymentMethodId: string // token del procesador de pagos
}
```
**Output:**
```ts
{
  escrowId: string
  jobId: string
  amount: number
  currency: string
  status: "FUNDED"
  ledgerEntryId: string
  fundedAt: string
}
```
**Errores:** `402` pago rechazado por procesador · `403` no es client del job · `409` ya fondeado · `422` amount != suma de milestones
**Guards:** rol = client · job.clientId = user.id · job.status = ASSIGNED
**Efectos:** AuditLog: `ESCROW_FUNDED` · Ledger: DEBIT client, CREDIT escrow · SSE: `escrow.funded` al pro

---

### GET /v1/jobs/:jobId/escrow
Ver estado del escrow de un job.

**Output:**
```ts
{
  id, jobId, status, currency,
  totalAmount,
  releasedAmount,
  pendingAmount,
  heldAmount,
  ledger: LedgerEntry[],
  milestoneBreakdown: [{
    milestoneId, title, amount, status, releasedAt?
  }]
}
```
**Errores:** `403` no miembro del job · `404` escrow no existe
**Guards:** autenticado · miembro del job O admin

---

### POST /v1/escrow/:escrowId/release
Liberar fondos de un milestone aprobado (llamado por Payments Agent tras MILESTONE_APPROVED).

**Input:**
```ts
{
  milestoneId: string
  agentRunId: string      // trazabilidad del agent que dispara el release
}
```
**Output:**
```ts
{
  ledgerEntryId: string
  milestoneId: string
  amount: number
  releasedTo: { proId: string }
  releasedAt: string
  escrowStatus: "PARTIALLY_RELEASED" | "FULLY_RELEASED"
}
```
**Errores:** `403` solo agente o admin · `404` milestone no existe · `409` milestone no está APPROVED · `409` ya fue liberado · `422` escrow insuficiente
**Guards:** agentToken O rol = admin
**Efectos:** AuditLog: `ESCROW_RELEASED` con milestoneId, agentRunId, amount · Ledger: DEBIT escrow, CREDIT pro · SSE: `payment.released` al pro · PayoutAccount del pro actualizado

---

### GET /v1/payments/ledger
Ver ledger de transacciones del usuario (pro o client).

**Input (query):**
```ts
{
  jobId?: string
  type?: "DEBIT" | "CREDIT"
  from?: string     // ISO date
  to?: string       // ISO date
  page?: number
  limit?: number    // max 100
}
```
**Output:**
```ts
{
  items: [{
    id, type, amount, currency,
    description, reference,
    jobId?, milestoneId?,
    createdAt
  }]
  total: number
  balance: number
}
```
**Guards:** autenticado · solo ve sus propias entradas · admin ve todo
**Efectos:** ninguno (read-only)

---

### POST /v1/escrow/:escrowId/dispute
Poner el escrow en disputa (fondos retenidos).

**Input:**
```ts
{
  reason: string      // min 20 chars
  milestoneId?: string
  evidence?: string[] // evidenceIds de soporte
}
```
**Output:** `{ escrowId, status: "DISPUTED", disputeId: string }`
**Errores:** `403` no miembro del job · `409` ya en disputa · `409` escrow FULLY_RELEASED
**Guards:** rol = client | pro · miembro del job
**Efectos:** AuditLog: `ESCROW_DISPUTED` · Dispute creado · fondos congelados · SSE: `escrow.disputed` a ambas partes · notificación a admin

---

### POST /v1/escrow/:escrowId/resolve
Resolver una disputa y distribuir fondos (solo admin).

**Input:**
```ts
{
  resolution: "CLIENT" | "PRO" | "SPLIT"
  splitRatio?: number   // 0-1, solo si SPLIT (porción del pro)
  notes: string
}
```
**Output:**
```ts
{
  escrowId,
  resolution,
  clientAmount: number,
  proAmount: number,
  ledgerEntries: string[]
}
```
**Errores:** `403` solo admin · `409` no está DISPUTED · `422` splitRatio fuera de rango
**Guards:** rol = admin
**Efectos:** AuditLog: `DISPUTE_RESOLVED` · Ledger entries para ambas partes · SSE: `dispute.resolved` a ambas partes · escrow → RESOLVED

---

### GET /v1/payments/payout-status
Ver estado de payout del pro (cuándo se acredita en su cuenta bancaria).

**Output:**
```ts
{
  pendingAmount: number
  availableAmount: number
  nextPayoutDate: string
  payouts: [{
    id, amount, status, scheduledAt, processedAt?
  }]
}
```
**Guards:** rol = pro
**Efectos:** ninguno (read-only)

---

## Tests requeridos

### POST /escrow/fund
- [ ] Client fondea correctamente → FUNDED + ledger entry
- [ ] Pro intenta fondear → 403
- [ ] Pago rechazado por procesador → 402
- [ ] Amount != suma de milestones → 422
- [ ] Doble fondeo → 409

### GET /escrow
- [ ] Client ve escrow de su job
- [ ] Pro asignado ve escrow del job
- [ ] Pro de otro job → 403
- [ ] Ledger visible y correcto

### POST /release (Payments Agent)
- [ ] Milestone APPROVED → fondos liberados + ledger
- [ ] Milestone no APPROVED → 409
- [ ] Release doble del mismo milestone → 409
- [ ] Último milestone → escrow = FULLY_RELEASED
- [ ] SSE emitido al pro

### POST /dispute
- [ ] Client o pro puede disputar
- [ ] Fondos congelados inmediatamente
- [ ] Dispute creado y admin notificado
- [ ] Escrow FULLY_RELEASED → 409

### POST /resolve
- [ ] Admin resuelve → ledger entries para ambas partes
- [ ] SPLIT con ratio 0.6 → distribución correcta
- [ ] No admin → 403
- [ ] SSE a ambas partes

### Ledger
- [ ] Toda transacción tiene su ledger entry
- [ ] Balance calculado correctamente
- [ ] No se pueden ver entradas de otro tenant
