---
id: "payments.escrow-release-command"
title: "Comando único de release de escrow"
domain: "payments"
sdd_version: "2.0"
version: "0.2"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: ["PAYMENTS_RELEASE_WAIVER_GATE", "PAYMENTS_RELEASE_GOVERNANCE_MODE", "PAYMENTS_RELEASE_COMMAND", "PAYMENTS_RECONCILE_ENABLED"]
production_evidence: []
related_files:
  - apps/api/src/modules/payments/escrow-release.command.ts
  - apps/api/src/modules/payments/escrow-release.reconcile.ts
  - apps/api/src/modules/payments/escrow-release-reconcile.service.ts
  - apps/api/src/modules/payments/escrow-release-reconcile.controller.ts
  - apps/worker/src/main.mjs
  - apps/api/src/modules/payments/escrow-release.service.ts
  - apps/api/src/modules/payments/payments.service.ts
  - apps/api/src/modules/payments/payment-governance.service.ts
  - apps/api/src/modules/payment-governance/payment-governance.service.ts
  - apps/api/src/modules/liens/waiver-payment-gate.service.ts
  - apps/api/src/modules/milestones/milestones.service.ts
related_tests:
  - apps/api/test/release-governance-gate.test.ts
  - apps/api/test/escrow-release-command.test.ts
  - apps/api/test/escrow-release-provider-adapter.test.ts
  - apps/api/test/escrow-release-service-replay.test.ts
  - apps/api/test/escrow-release-reconcile.test.ts
  - apps/api/test/escrow-release-reconcile-job.test.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-30"
---

# Spec: Comando único de release de escrow (C27 · C28 · C29)

> **Aprobado el 2026-09-30 por el owner (Samuelcastella), respuesta explícita en la sesión de trabajo**: "Apruebo con valores recomendados" para ADR-041 y este spec. Decisiones: **D1** `PaymentProviderRegistry` como puerto canónico; **D3** la UI admin/finance exigirá `milestoneId`; **D4** payouts de contributor fuera de alcance. **D2 (dual approval)**: umbral por monto y segundo aprobador **sin definir**; se implementará configurable y **apagado** hasta que el owner fije el valor (requiere migración aditiva planificada).

## Slices de implementación
1. **Slice 1 — autorización económica única**: `ReleaseGovernanceGate` aplicado en `PaymentsService.release()` (REST, harness del copilot, tool de Prometeo). Gate de lien waivers **enforced por defecto** (`PAYMENTS_RELEASE_WAIVER_GATE=off` = rollback); `evaluate()` completo en **shadow** por defecto (`PAYMENTS_RELEASE_GOVERNANCE_MODE=shadow|enforce|off`). Sin migraciones.
2. Slice 2 — comando único `EscrowReleaseCommand` (idempotencia por clave, estado ambiguo/reconciliación) y auto-release como adaptador. **2a (código, con hotfix de identidad/replay/clasificación):** núcleo `runEscrowRelease` (reserva→transferencia→finalización con estados `released|pending|failed|unknown`), guarda de un RELEASE activo por milestone en `releaseFunds` (Serializable), adaptador en `PaymentsService.release()` tras `PAYMENTS_RELEASE_COMMAND=on` (apagado por defecto), clasificación de reconciliación (solo informe). **2b (parcial):** informe de reconciliación de PENDING estancados de solo lectura (`escrow-release.reconcile.ts`, `pnpm payments:reconcile-report`, runbook `ESCROW_RELEASE_RECONCILIATION.md`). **2b-job (código, decisión del dueño 2026-10-01):** job de worker (`PAYMENTS_RECONCILE_ENABLED`, off por defecto, cada ~15 min) que llama al endpoint interno `POST /v1/admin/payments/release-reconcile/check` (`ops:dashboard:write`, no público); **solo lectura sobre dinero** (jamás cambia estados ni reintenta), emite alerta (log `alert:true`) y auditoría append-only (`AuditLog` `escrow.release.reconcile_alert`, sin actor), como mucho 1 vez/24 h por transacción; la resolución sigue siendo humana. **2b (pendiente):** adaptador del auto-release (`EscrowReleaseService`/Stripe Connect con fee), consulta automática al proveedor / resolución asistida.
3. Slice 3 — dual approval (migración aditiva `PaymentReleaseApproval`), tras definir D2.
4. Slice 4 — re-habilitar "Liberar" en admin/finance con `milestoneId` y retirar `payment-governance/releasePayment()`.

## 1. Problema y resultado
**Para quién:** cliente (fondos), profesional (cobro), admin/finanzas, agentes.
**Problema:** hay dos caminos reales que mueven el mismo dinero con reglas distintas: el auto-release aplica `evaluate()` (evidencia, disputa, change orders, señales, lien waivers) y el manual/agente/Prometeo no. No existe dual approval en payments.
**Resultado:** un único comando durable; toda liberación (UI, auto, agente) pasa por la misma autorización determinista, queda idempotente, auditada y reconciliable.

## 2. Alcance
**Incluido:** comando `EscrowReleaseCommand`; autorización única vía `evaluate()`; política de dual approval (tras D2); idempotencia; estados ambiguos (`PENDING`) con reconciliación proveedor↔DB; migración de callers; retiro de caminos duplicados.
**Fuera:** refunds/payouts de otros dominios (contributor), cambios de FSM de Milestone, UI nueva salvo re-habilitar "Liberar" con `milestoneId`.

## 3. Actores, permisos y límites
- Iniciador: `finance:write` (o auto por FSM). Segundo aprobador (si aplica): rol distinto ≠ iniciador. Agentes: sólo `propose_escrow_release`; nunca autorizan ni ejecutan.
- Tenant + org + recurso (milestone→project→escrow) verificados en cada lectura/escritura; tests negativos cross-tenant/cross-org.

## 4. Criterios de aceptación
1. Release por cualquier entrypoint con waiver pendiente/evidencia incompleta/disputa abierta/change order pendiente → **bloqueado** con los mismos blockers.
2. Dos llamadas concurrentes o repetidas → una sola transferencia; la segunda devuelve el resultado de la primera.
3. Transfer OK + fallo al finalizar → estado explícito reconciliable (no `released:false`, no silencio).
4. Por encima del umbral D2: sin segundo aprobador distinto no se ejecuta.
5. Un agente no puede ejecutar; sólo proponer.
6. Flag apagado = comportamiento actual intacto (rollback).

## 5. Contratos
`execute({ tenantId, milestoneId, amount?, actor, idempotencyKey?, source })` → `{ status: released|pending|blocked|needs_approval|failed|unknown, blockers[], transactionId?, providerRef?, replay }`.

**Identidad de idempotencia (ADR-041, hotfix 2a):** `(milestoneId, amountCents)`, **independiente de `source`**. Con `Idempotency-Key` del cliente: la misma clave devuelve SIEMPRE el mismo resultado, también tras un `failed` definitivo (la reserva FAILED conserva su referencia; reintentar de verdad exige otra clave). Sin clave: un reintento tras `failed` es un intento nuevo (`…_a{n}`), y repetir el mismo intento es replay. Importe distinto sobre un release activo ⇒ 409, no replay. Un replay siempre devuelve un `PaymentTxn` válido. **Resultado del proveedor normalizado** (`paid|processing|definitive_failure|ambiguous_failure`): los proveedores marcan `PayoutFailureError`; sin señal ⇒ ambiguo (reserva PENDING, `unknown`). Límite: si una reserva `processing` cambia a la `providerRef` real y un webhook la marca FAILED, su identidad ya no es buscable hasta la columna de idempotencia (slice 3). API REST: `POST /v1/payments/milestones/:milestoneId/release` (versionado; rutas actuales quedan como adaptadores hasta retiro).

## 6. FSM, eventos y reconstrucción
Sin nuevas transiciones de Milestone/Escrow. Eventos sólo de `EVENT_CATALOG.md` (p. ej. release reservado/finalizado/fallido); outbox atómico con la finalización. Reconstrucción por `PaymentTxn` + audit.

## 7. Datos y migración
Aditiva y reversible: `PaymentReleaseApproval` (tenantId, milestoneId, requestedBy, approvedBy, status, createdAt) + índice único de idempotencia. Sin cambios destructivos. **Requiere migración planificada (AGENTS.md).**

## 8. Observabilidad, despliegue y activación
Métricas: releases por source/status, bloqueos por blocker, `PENDING` > N min, discrepancias proveedor↔DB. Despliegue: flag apagado → canary interno → por entorno. Activación sólo con evidencia de canary.

## 9. Tests requeridos
Paridad entre caminos A/B; bloqueos por waiver/evidencia/disputa/CO en **todos** los entrypoints; idempotencia concurrente; dual approval (iniciador≠aprobador); cross-tenant/cross-org; agente no ejecuta; rollback con flag.

## 10. Mapa de implementación
API: `payments/escrow-release.command.ts`; adaptadores en `milestones.service`, `payments.controller`, `project-copilot.harness`, `prometeo-tool-execution`. Web: `admin/finance` re-habilitar con `milestoneId`. DB: migración aditiva. Tests: `apps/api/test/`, `tests/unit/payment-release-canonical-path.test.mjs` (pasa a `PASSING`).

## 12. Gates de cierre
AS-IS reconciliado · spec APPROVED · migración + rollback · tests · CI terminal · merge SHA · deploy · smoke autenticado/canary · evidencia registrada.
