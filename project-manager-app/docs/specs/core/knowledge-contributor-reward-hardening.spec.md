---
id: "core.knowledge-contributor-reward-hardening"
title: "Field Knowledge Contributor Program — Reward Payout Hardening (PR-10)"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.repository.ts"
  - "apps/api/src/modules/payments/payments.service.ts"
related_tests:
  - "apps/api/test/contributor-program.service.test.ts"
related_endpoints:
  - "POST /v1/contributor-program/admin/rewards/:rewardId/authorize-payout"
  - "POST /v1/payments/webhook"
related_events: []
related_agents: []
last_verified: "2026-09-19"
---

# Spec: Field Knowledge Contributor Program — Reward Payout Hardening (PR-10)

> Contrato ejecutable SDD 2.0.

**Aprobación:** a diferencia de PR-6/7/8, "contributor reward hardening
beyond the existing mocked Stripe Connect payout" apuntaba a código real,
no a una etiqueta vacía. ZOOM encontró dos hallazgos concretos de dinero.
Por la propia regla de este repo (`semse-security-baseline`, RC5: "any
change here needs a plan reviewed by a human before implementation"), se
presentaron ambos hallazgos y el fix propuesto al dueño del producto antes
de escribir código; eligió corregir **ambos**: la carrera de doble pago y
la reconciliación de `transfer.reversed`.

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| `authorizePayout` — guarda de elegibilidad | EXISTE pero no es atómica | lee `status` vía `listRewardsForAdmin` (una consulta plana), luego llama al proveedor real, luego escribe `PAID` — sin ningún paso de reserva atómica entre medio |
| `ContributorRewardRepository.updateRewardStatus` | `update` ciego (no `updateMany` condicional) | dos llamadas concurrentes a `authorizePayout` para el mismo reward pueden leer ambas el mismo estado elegible antes de que cualquiera escriba, y ambas disparar `StripeConnectService.transferToContractor` — un doble pago real |
| El mismo patrón (reservar→proveedor→finalizar) | YA EXISTE y ya fue auditado | `payments.service.ts`/`payments.repository.ts` (`releaseFunds`/`finalizeRelease`, hallazgos 0.14/0.15 de `AUDIT_REMEDIATION_PLAN.md`) — nunca se portó a este flujo de reward |
| `ContributorRewardStatus.PAYMENT_PENDING` | definido en el schema, nunca escrito | el propio enum ya anticipaba un estado de reserva intermedio que el código de servicio nunca usó |
| `ContributorRewardStatus.REVERSED` | definido en el schema, nunca escrito | mismo patrón — un estado que el diseño original previó pero el servicio nunca alcanza |
| Reconciliación de `transfer.reversed` para `ContributorReward` | AUSENTE | `PaymentsService.webhook()` ya mapea `transfer.reversed` → `"REVERSED"` y reconcilia `PaymentTxn` por `providerRef`, pero nunca intenta reconciliar `ContributorReward` — si Stripe revierte una transferencia de reward (ej. saldo insuficiente de la plataforma), el reward queda marcado `PAID` para siempre, incorrectamente |
| Campo para enlazar un reward con su transferencia de Stripe | AUSENTE | necesita migración — sin él no hay forma de que el webhook encuentre el reward correcto por `transferId` |

## 1. Problema y resultado

**Para quién:** el sistema de pagos y, en última instancia, cualquier
contribuidor cuyo pago dependa de que esto funcione correctamente
exactamente una vez.

**Problema 1 (carrera):** dos clics rápidos, o dos sesiones de admin
distintas, autorizando el mismo reward casi simultáneamente pueden ambos
pasar la validación de elegibilidad antes de que cualquiera escriba el
nuevo estado, resultando en dos transferencias reales de Stripe para un
solo reward.

**Problema 2 (reversión no reconciliada):** una transferencia que Stripe
revierte después del hecho (ej. saldo insuficiente de la cuenta
Connect/plataforma) nunca se refleja en el reward — queda `PAID`
indefinidamente aunque el contribuidor nunca haya recibido el dinero.

**Resultado esperado:** `authorizePayout` reclama el reward de forma
atómica (condición en el `WHERE`, no solo en el código de aplicación)
antes de mover dinero real; y un `transfer.reversed` de Stripe para la
transferencia de un reward lo mueve a `REVERSED` automáticamente.

## 2. Alcance

### Incluido

- `ContributorProgramRepository.claimRewardForPayout` — `updateMany`
  condicional (`WHERE id, tenantId, status IN (elegibles)`) que reclama el
  reward hacia `PAYMENT_PENDING`; solo si `count === 1` procede a llamar
  al proveedor. Mismo patrón exacto que `releaseFunds`/`finalizeRelease`
  (0.14) — no una implementación nueva y distinta.
- `ContributorReward.transferId String? @unique` — se guarda al finalizar
  `PAID`.
- `ContributorProgramRepository.reconcileReversedTransfer` — busca por
  `transferId`, solo reconcilia si el estado actual es `PAID` (mismo
  patrón de guarda que `PaymentsRepository.reconcileTransactionStatus`).
- `PaymentsService.webhook()` — cuando el evento es `transfer.reversed` y
  la reconciliación de `PaymentTxn` no encontró nada, intenta también
  `ContributorProgramService.reconcileReversedTransfer`. Wiring
  bidireccional `PaymentsModule` ↔ `ContributorProgramModule` vía
  `forwardRef` (patrón ya establecido en el repo — 10+ usos existentes,
  no una técnica nueva).

### Fuera de alcance

- Reintentos automáticos de un reward `FAILED`/`REVERSED` — sigue siendo
  una acción humana explícita (`authorizePayout`), igual que hoy.
- Cambiar el mecanismo de transferencia en sí (`StripeConnectService`) —
  se reutiliza tal cual.
- Cualquier otro hallazgo de `AUDIT_REMEDIATION_PLAN.md` fuera de este
  flujo específico de reward.

## 3. Actores, permisos y límites

Sin cambios de permisos en `authorizePayout` (sigue `contributor-program:
manage`). El nuevo `reconcileReversedTransfer` no tiene actor humano — se
invoca solo desde el webhook de Stripe, sin `ctx`, igual que el resto de
`PaymentsService.webhook()`.

## 4. Escenarios y criterios de aceptación

### P1 — Dos autorizaciones concurrentes, solo una transferencia real

```gherkin
DADO un reward en PENDING_REVIEW
CUANDO dos llamadas a authorizePayout llegan casi simultáneamente
ENTONCES solo una reclama el reward (la otra recibe 409 o ve PAID ya
  resuelto) y StripeConnectService.transferToContractor se llama
  exactamente una vez
```

### P2 — Autorización repetida tras PAID es idempotente

```gherkin
DADO un reward ya PAID
CUANDO se llama authorizePayout de nuevo
ENTONCES devuelve el reward sin llamar al proveedor otra vez (sin cambios
  de comportamiento respecto a hoy)
```

### P3 — Reversión reconciliada

```gherkin
DADO un reward PAID con transferId guardado
CUANDO llega un webhook transfer.reversed para ese transferId
ENTONCES el reward pasa a REVERSED
```

### P4 — Reversión de una transferencia que no es de un reward

```gherkin
DADO un transfer.reversed cuyo transferId no corresponde a ningún
  ContributorReward (es, por ejemplo, un release de milestone)
CUANDO llega el webhook
ENTONCES reconcileReversedTransfer no encuentra nada y no falla —
  la reconciliación de PaymentTxn sigue siendo la que actúa
```

## 5. Contratos

### API — sin endpoint nuevo, cambio de efecto en los existentes

```yaml
endpoints:
  - "POST admin/rewards/:rewardId/authorize-payout"
  - "POST /v1/payments/webhook"
auth: sin cambios
effects:
  audit_log: reconcileReversedTransfer agrega
    contributor_program.reward.payout_reversed
```

## 6. Datos y migración

`packages/db/prisma/schema.prisma` — `ContributorReward.transferId
String? @unique`. Migración generada con `prisma migrate dev
--create-only` y aplicada contra Postgres local.

## 7. Tests requeridos

- [ ] La segunda de dos autorizaciones concurrentes para el mismo reward
      no dispara una segunda transferencia real
- [ ] Autorizar un reward ya `PAID` sigue siendo idempotente
- [ ] `transfer.reversed` con `transferId` de un reward `PAID` lo mueve a
      `REVERSED`
- [ ] `transfer.reversed` con un `transferId` que no es de ningún reward
      no falla ni reconcilia nada
- [ ] Todo el flujo respeta el aislamiento por tenant ya existente

## 8. Mapa de implementación

### API

- `packages/db/prisma/schema.prisma` (`ContributorReward.transferId`)
- `apps/api/src/modules/contributor-program/contributor-program.repository.ts`
  (`claimRewardForPayout`, `reconcileReversedTransfer`)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (`authorizePayout` reestructurado, `reconcileReversedTransfer`)
- `apps/api/src/modules/contributor-program/contributor-program.module.ts`
  (import de `PaymentsModule` pasa a `forwardRef`)
- `apps/api/src/modules/payments/payments.module.ts` (import de
  `ContributorProgramModule` vía `forwardRef`)
- `apps/api/src/modules/payments/payments.service.ts` (`webhook()` llama
  `reconcileReversedTransfer` cuando corresponde)

## 9. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Tests verdes contra Postgres real
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado
