---
id: "payments.escrow-release-command"
title: "Comando único de release de escrow"
domain: "payments"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: ["PAYMENTS_SINGLE_RELEASE_COMMAND"]
production_evidence: []
related_files:
  - apps/api/src/modules/payments/escrow-release.service.ts
  - apps/api/src/modules/payments/payments.service.ts
  - apps/api/src/modules/payments/payment-governance.service.ts
  - apps/api/src/modules/payment-governance/payment-governance.service.ts
  - apps/api/src/modules/liens/waiver-payment-gate.service.ts
  - apps/api/src/modules/milestones/milestones.service.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-30"
---

# Spec: Comando único de release de escrow (C27 · C28 · C29)

> Borrador para aprobación humana. Decisiones abiertas D1–D4 en `docs/architecture/ADR-041-single-escrow-release-command.md`. No implementar mientras `status: DRAFT`.

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
`execute({ tenantId, milestoneId, amount?, actor, idempotencyKey, source })` → `{ status: released|pending|blocked|needs_approval, blockers[], transactionId?, providerRef? }`. API REST: `POST /v1/payments/milestones/:milestoneId/release` (versionado; rutas actuales quedan como adaptadores hasta retiro).

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
