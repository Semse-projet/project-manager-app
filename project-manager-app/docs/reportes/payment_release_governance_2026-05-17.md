# Payment Release Governance — P2

**Fecha:** 2026-05-17  
**Estado:** Implementado  
**Tests:** 10/10 P2 + 34/34 total

---

## Filosofía

> SEMSE no solo calcula pagos; SEMSE gobierna cuándo un pago está legítimamente listo para liberarse.

Un pago no debe liberarse porque un milestone existe o porque alguien presionó un botón. SEMSE evalúa múltiples condiciones y devuelve una decisión auditable.

---

## Endpoint principal

```
GET /v1/milestones/:milestoneId/payment-governance
```

**Permiso:** `milestones:read`

### Respuesta

```json
{
  "milestoneId": "ms_xxx",
  "projectId": "proj_xxx",
  "milestoneStatus": "APPROVED",
  "evidenceReadiness": "complete",
  "paymentReadiness": "ready_to_release",
  "releaseStatus": "ready",
  "canRelease": true,
  "blockers": [],
  "requiredActions": [],
  "riskLevel": "low",
  "evidenceSummary": {
    "total": 3,
    "required": 3,
    "approved": 3,
    "missing": 0,
    "rejected": 0,
    "submitted": 0
  },
  "changeOrderBlockers": 0,
  "openSignals": 0,
  "criticalSignals": 0,
  "disputeRisk": false,
  "nextBestAction": "All conditions met — payment can be released",
  "auditReason": "Evidence complete (3/3), milestone approved, no blockers",
  "governedAt": "2026-05-17T..."
}
```

---

## Reglas de gobernanza

### `releaseStatus` posibles

| Status | Significado |
|--------|------------|
| `ready` | Todas las condiciones se cumplen — pago puede liberarse |
| `blocked` | Hay blockers de evidencia o aprobación |
| `needs_review` | Core está listo pero hay change orders o señales críticas |
| `released` | Pago ya fue liberado |
| `disputed` | Disputa activa — pago retenido |

### Reglas de bloqueo

| Condición | Resultado |
|-----------|-----------|
| Evidencia faltante (`missing > 0`) | `blocked`, `riskLevel=medium` |
| Evidencia rechazada (`rejected > 0`) | `blocked`, `riskLevel=high` |
| Milestone no aprobado | `blocked` |
| Change order candidato pendiente | `needs_review`, `riskLevel=high` |
| Señales críticas/altas en Mission Control | `needs_review`, `riskLevel=critical` |
| Disputa activa | `disputed`, `riskLevel=critical` |
| Pago ya liberado | `released`, `canRelease=false` |
| Sin blockers + milestone aprobado | `ready`, `canRelease=true` |

### `riskLevel`

| Condición | riskLevel |
|-----------|-----------|
| Disputa activa OR señales críticas | `critical` |
| Evidencia rechazada OR change orders | `high` |
| Evidencia faltante OR señales open | `medium` |
| Sin condiciones de riesgo | `low` |

---

## Implementación

### `PaymentGovernanceService`

`apps/api/src/modules/payments/payment-governance.service.ts`

Combina:
1. `MilestonesRepository.computePaymentReadiness()` — evidencia, dispute, aprobación
2. `ChangeOrderCandidate` count (estado: `predicted | submitted`)
3. `OperationalSignal` count (crítico/alto)

### Arquitectura de datos consultados

```
MilestoneEvidenceItem
  → required=true items → aprobados, faltantes, rechazados, submitted

Milestone.status
  → APPROVED → condición necesaria para release

Milestone.disputes (active)
  → OPEN | UNDER_REVIEW → bloqueo inmediato

ChangeOrderCandidate
  → milestoneId + status in [predicted, submitted] → needs_review

OperationalSignal
  → milestoneId + status=open + severity in [critical, high] → needs_review
```

---

## Conexión con flujo monetizable

```
Estimate
→ BuildOps
→ Milestones
  → Evidence Items (approved/missing/rejected)
  → GET /v1/milestones/:id/payment-governance
    → canRelease=true → POST /v1/milestones/:id/escrow/release (ya existe)
    → canRelease=false → mostrar blockers + requiredActions al usuario
→ Change Orders
→ Payment Readiness
```

---

## Diferencia con `/payment-readiness`

| Endpoint | Qué devuelve |
|----------|-------------|
| `GET /v1/milestones/:id/payment-readiness` | Estado base: status, blockers, reasons, nextAction |
| `GET /v1/milestones/:id/readiness` | Resumen P1: evidenceReadiness, riskLevel, nextAction |
| `GET /v1/milestones/:id/payment-governance` | **P2 completo**: canRelease, changeOrders, signals, evidenceSummary, auditReason |

---

## Tests (10/10)

| Caso | Escenario | Resultado esperado |
|------|-----------|------------------|
| C1 | Sin evidencia | blocked, riskLevel=medium |
| C2 | Evidencia completa + milestone approved | ready, canRelease=true |
| C3 | Evidencia rechazada | blocked, riskLevel=high |
| C4 | Change order abierto | needs_review, canRelease=false |
| C5 | Pago ya liberado | released, canRelease=false |
| C6 | Disputa activa | disputed, riskLevel=critical |
| C7 | Señales críticas + evidencia OK | needs_review, riskLevel=critical |
| C8 | CO + señal crítica + evidencia rechazada | todos bloqueados |
| C9 | Sin items requeridos + approved | ready, canRelease=true |
| C10 | evidenceSummary counts | counts correctos |
