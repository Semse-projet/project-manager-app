---
id: "api.governance-quadratic-credits"
title: "Votación cuadrática con gasto de créditos de gobernanza"
domain: "governance"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-11-10"
author: "Claude"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - "apps/api/src/modules/governance/governance.service.ts"
  - "apps/api/src/modules/governance/governance-credits.algorithm.ts"
  - "apps/api/src/modules/governance/governance-voting.algorithm.ts"
  - "docs/specs/api/governance-tenant-boundary.spec.md"
  - "docs/specs/ui/audit-product-decisions.spec.md"
related_tests:
  - "apps/api/test/governance-quadratic-credits.test.ts"
related_endpoints:
  - "POST /v1/governance/proposals/:id/vote"
  - "GET /v1/governance/credits/:userId"
related_events:
  - "governance:vote-cast"
related_agents: []
last_verified: "2026-11-10"
---

# Spec: Votación cuadrática con gasto de créditos de gobernanza

> Contrato SDD 2.0. **Aprobado por el dueño el 2026-11-10** a través de las decisiones PD-09 y D1–D3 de abajo
> (AUDIT_REMEDIATION_PLAN 0.49b). Complementa `api.governance-tenant-boundary`, cuyo alcance excluye
> explícitamente cambiar pesos o créditos; los límites de tenant y de actor de ese spec siguen vigentes sin cambios.

## 1. Problema y resultado

**Para quién:** miembros de un tenant que votan propuestas de gobernanza (CLIENT, PRO, OPS_ADMIN con `governance:vote`).

**Problema:** el peso de un voto ya es cuadrático (`√unidades × multiplicador de reputación`), pero votar con más
unidades no cuesta nada: nadie descuenta `unidades²` de ningún saldo y `validateVote` solo limita las unidades a 1–10.
Votar con 10 unidades siempre conviene, así que el mecanismo cuadrático no restringe nada.

**Resultado esperado:** votar con más intensidad cuesta créditos de gobernanza que se ganan participando; un miembro
nuevo puede votar con 1 unidad sin créditos; un voto que no se puede pagar se rechaza con el detalle.

## 2. Alcance

### Incluido

- Coste de un voto de `k` unidades (`1 ≤ k ≤ 10`): **`k² − 1` créditos** (D1). Con `k = 1` el coste es 0.
- Saldo disponible = créditos ganados con decaimiento (regla actual, vida media 90 días) − créditos gastados **sin
  decaimiento** (PD-09: lo gastado no se repone).
- Registro del gasto como `GovernanceCreditEvent` con `eventType: "vote_spent"` y `credits` negativo, en la misma
  transacción que el voto, sólo cuando el coste es mayor que 0.
- La recompensa actual por votar (`vote_cast`: +2, o +3 alineado) se mantiene (D2).
- Rechazo con 409 cuando el saldo no alcanza (D3), indicando `cost` y `available`.
- `GET /v1/governance/credits/:userId` añade `spentCredits` y `availableCredits`; `totalCredits` y `tier` siguen
  midiendo lo **ganado** (participación), no el saldo.

### Fuera de alcance

- Cambiar el peso del voto, el multiplicador de reputación, el decaimiento, el quórum o la regla de resultado.
- Reponer créditos gastados (PD-09), presupuestos por periodo o por propuesta.
- Migración de esquema o backfill: `GovernanceCreditEvent.credits` es `Decimal(8, 2)` y admite negativos.
- Cambios de UI (la respuesta 409 y los campos nuevos son aditivos).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Votante | `governance:vote` | su tenant (contexto autenticado) | votar con `k` unidades si `available ≥ k² − 1` | gastar créditos de otro usuario o de otro tenant |
| Cualquier miembro | `governance:read` | su tenant | consultar sus créditos | — |

- Tenant boundary: sin cambios respecto de `api.governance-tenant-boundary` (tenant y votante salen del contexto).
- Ownership/resource policy: el gasto se registra siempre a nombre del votante autenticado.
- Step-up o aprobación humana: no aplica.
- Datos `privacyCritical`: no.

## 4. Decisiones del dueño (2026-11-10)

| ID | Decisión | Elegida | Descartadas |
|---|---|---|---|
| PD-09 | Origen del presupuesto de votos y reposición | Créditos de gobernanza ganados participando; lo gastado no se repone | Presupuesto por propuesta; devolución al cerrar; presupuesto por periodo |
| D1 | Acceso de un miembro sin créditos | 1 unidad siempre gratis: coste `k² − 1` | Saldo de bienvenida; sin créditos no vota |
| D2 | Recompensa por votar | Se mantiene (+2, +3 alineado) | Eliminarla |
| D3 | Saldo insuficiente | Rechazar con coste y saldo disponible | Recortar unidades al máximo asequible |

## 5. Contrato

```yaml
vote:
  endpoint: POST /v1/governance/proposals/:id/vote
  cost: units^2 - 1            # units ∈ [1, 10]
  available: sum(earned * decay(age, halfLife=90d)) - sum(spent)   # spent never decays
  on_insufficient:
    status: 409
    body: { message: "Insufficient governance credits", cost, available, units }
  on_success:
    writes_in_one_transaction: [GovernanceVote, GovernanceCreditEvent(vote_spent, credits = -cost) if cost > 0]
    then: award vote_cast credits (unchanged, non-critical)
  concurrency: per-voter transaction-scoped advisory lock (tenantId, voterId) before reading the balance
credits:
  endpoint: GET /v1/governance/credits/:userId
  adds: [spentCredits, availableCredits]
  unchanged: [totalCredits (earned, decayed), tier (from earned), eventsCount]
```

## 6. Invariantes

- Un voto con `k = 1` nunca requiere créditos ni escribe un `vote_spent`.
- Ningún voto aceptado deja `availableCredits` por debajo de 0 en el momento de aceptarlo.
- Dos votos concurrentes del mismo votante no pueden gastar el mismo saldo dos veces (bloqueo consultivo por votante
  dentro de la transacción).
- Un voto rechazado por saldo no escribe ni el voto ni el gasto.
- Los eventos `vote_spent` no decaen: no hay reposición implícita.

## 7. Tests requeridos

- [x] Coste `k² − 1`: 1→0, 2→3, 3→8, 10→99.
- [x] Saldo: ganado con decaimiento menos gastado sin decaimiento.
- [x] Voto de 1 unidad sin créditos: se acepta y no registra gasto.
- [x] Voto con saldo suficiente: registra `vote_spent` negativo en la misma transacción.
- [x] Saldo insuficiente: 409 con `cost`/`available`, sin voto ni gasto.
- [x] `getCredits` devuelve `spentCredits`/`availableCredits` y mantiene `totalCredits`/`tier` sobre lo ganado.
- [x] El bloqueo por votante se toma antes de leer el saldo.

## 8. Rollback

Revertir el PR. Los `vote_spent` ya escritos quedan como historial; con el código anterior no se leen como gasto
(se suman como créditos negativos con decaimiento en `getCredits`), así que, si se revierte, conviene excluirlos o
borrarlos con una consulta aprobada por el dueño.
