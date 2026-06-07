# P6 — Change Order Lifecycle

**Fecha:** 2026-05-17  
**Tests:** 15/15 P6 + 61/61 total

---

## Frase clave

> SEMSE no solo detecta cambios de alcance; SEMSE los gobierna hasta convertirlos en impacto operativo trazable.

---

## Lifecycle completo

```
predicted
  → submit    → submitted
  → reject    → rejected (requiere auditReason)

submitted
  → approve         → approved
  → reject          → rejected (requiere auditReason)
  → request-changes → changes_requested

approved
  → apply-to-buildops → applied (idempotente)

changes_requested
  → submit → submitted (reintento)
  → reject → rejected

applied
  (estado final operativo — no mutable)

rejected / voided
  (estados finales — no bloquean payment governance)
```

---

## Endpoints

### Existentes (pre-P6)
```
GET  /v1/change-orders                 → listar con filtros
POST /v1/change-orders                 → crear candidato
POST /v1/change-orders/:id/submit      → enviar para revisión
POST /v1/change-orders/:id/approve     → aprobar (requiere submitted)
POST /v1/change-orders/:id/reject      → rechazar con reason
```

### Nuevos en P6
```
GET  /v1/change-orders/:id             → detalle de un candidato
POST /v1/change-orders/:id/request-changes  → solicitar cambios
  Body: { requiredActions: string[], note?: string }

GET  /v1/change-orders/:id/impact      → computar impacto
  Returns: costDeltaMin/Max/Avg, affectedMilestones, riskLevel, paymentImpact

POST /v1/change-orders/:id/apply-to-buildops → aplicar a BuildOps (idempotente)
  Solo funciona con status=approved
  Marks as "applied", creates OperationalSignal
```

### Permisos
```
change-orders:read   → GET endpoints
change-orders:create → POST / + POST /:id/submit
change-orders:approve → POST approve/reject/request-changes/apply-to-buildops
```

---

## Impacto computado

`GET /v1/change-orders/:id/impact` devuelve:

```json
{
  "changeOrderId": "co_xxx",
  "status": "approved",
  "costDeltaMin": 1000,
  "costDeltaMax": 2000,
  "costDeltaAvg": 1500,
  "affectedMilestones": ["ms_xxx"],
  "riskLevel": "medium",
  "paymentImpact": "requires_approval",
  "probability": 75,
  "pricingMode": "time_and_materials",
  "auditReason": "CO 'Closet painting' impact computed...",
  "computedAt": "2026-05-17T..."
}
```

### Lógica de riskLevel

| Condición | riskLevel |
|-----------|-----------|
| costAvg > $5000 OR prob > 80% | critical |
| costAvg > $2000 OR prob > 60% | high |
| costAvg > $500 OR prob > 40% | medium |
| Todo lo demás | low |

### Lógica de paymentImpact

| Status CO | paymentImpact |
|-----------|---------------|
| applied | already_applied |
| submitted / approved / changes_requested | requires_approval |
| predicted + riskLevel=critical | hold_required |
| predicted sin risk | none |

---

## Impacto en Payment Governance

`PaymentGovernanceService` ya consulta `changeOrderBlockers`:

```ts
// ChangeOrderCandidates con status in ['predicted', 'submitted']
// son blockers para payment release
const changeOrderBlockers = await prisma.changeOrderCandidate.count({
  where: { tenantId, milestoneId, status: { in: ["predicted", "submitted"] } }
});
```

| Estado CO | ¿Bloquea payment-governance? |
|-----------|------------------------------|
| predicted | Sí (está en la cuenta) |
| submitted | Sí |
| changes_requested | Sí |
| approved (no applied) | Sí → needs_review |
| applied | No |
| rejected | No |
| voided | No |

---

## Impacto en Mission Control

`applyToBuildOps` crea automáticamente una `OperationalSignal`:

```json
{
  "type": "CHANGE_ORDER_RECOMMENDED",
  "severity": "medium|high|critical",
  "title": "Change order applied: <título>",
  "message": "Change order applied to BuildOps. Cost delta: $X. Risk: Y.",
  "sourceAgent": "ChangeOrderLifecycle"
}
```

---

## Relación con Evidence Review Agent

- Si un evidence item muestra trabajo fuera de scope → Evidence Review devuelve `possible_mismatch`
- Si hay un CO abierto (`submitted/predicted`) → Evidence Review devuelve `manual_review_required`
- P6 no modifica el behavior de P3

---

## apply-to-buildops: idempotencia

```
Primera llamada:
  status: "approved" → "applied"
  audit trail guardado en evidenceJson
  OperationalSignal creado
  returns: { applied: true, alreadyApplied: false, impact }

Segunda llamada:
  status: "applied" (ya aplicado)
  NO se modifica nada
  NO duplica impacto
  returns: { applied: false, alreadyApplied: true, impact }
```

---

## Tests (15/15 P6)

| Test | Escenario | Resultado |
|------|-----------|-----------|
| L1 | predicted → submitted | ✅ |
| L2 | submitted → approved | ✅ |
| L3 | reject desde submitted/predicted | ✅ |
| L4 | request-changes desde submitted/predicted | ✅ |
| L5 | apply-to-buildops solo desde approved | ✅ |
| L6 | apply-to-buildops idempotente | ✅ |
| L7 | rejected no bloquea payment-governance | ✅ |
| I1 | bajo costo → low risk, requires_approval si submitted | ✅ |
| I2 | alto costo → critical + hold_required si predicted | ✅ |
| I3 | applied → already_applied | ✅ |
| I4 | alta probabilidad → escala risk | ✅ |
| I5 | con milestoneId → affectedMilestones | ✅ |
| I6 | sin estimados → bajo impacto | ✅ |
| G1 | apply no libera pago | ✅ |
| G2 | reject elimina bloqueo | ✅ |

---

## Limitaciones pendientes

1. `apply-to-buildops` no actualiza el presupuesto de `BuildOpsProject` automáticamente — queda como señal para acción manual
2. No existe aún `POST /v1/change-orders/:id/run-risk-agent` — el LLM puede analizar el CO y generar un riskScore
3. No hay UI para el lifecycle — el ciclo existe en el backend
4. `voided` no tiene endpoint explícito — se puede implementar via `reject` con reason="voided"

---

## Próximos pasos UI

```
Tarjeta Change Order en Mission Control:
→ badge: predicted | submitted | approved | applied | rejected
→ botón: Review (→ POST /approve o /reject)
→ botón: Request Changes (→ POST /request-changes)
→ botón: Apply to BuildOps (→ POST /apply-to-buildops) — solo si approved
→ card: Impact ($X, risk=Y, affectedMilestones)
```
