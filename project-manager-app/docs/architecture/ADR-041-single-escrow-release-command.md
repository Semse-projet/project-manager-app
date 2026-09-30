# ADR-041 — Un único comando de release de escrow (C27/C28/C29)

- **Date:** 2026-09-30
- **Status:** ACCEPTED (2026-09-30) — aprobado explícitamente por el owner ("Apruebo con valores recomendados"): D1 `PaymentProviderRegistry`, D3 `milestoneId` en la UI, D4 fuera de alcance. **D2 (umbral/segundo aprobador) sigue sin definir**: el dual approval se implementa apagado. Slice 1 en `docs/specs/payments/escrow-release-command.spec.md`.
- **Supersedes (parcial):** ADR-034 §"future ADR" (la mitigación fail-safe sigue vigente hasta que este ADR se implemente).
- **Affected:** `payments/`, `payment-governance/`, `milestones/`, `agents/harnesses`, `prometeo/prometeo-tool-execution`, admin/finance (web).

## Contexto — inventario verificado en código (main `21ccbeb`)

| # | Camino | Mueve dinero | Gates que aplica hoy |
|---|---|---|---|
| A | `EscrowReleaseService.tryAutoRelease()` (disparado por `MilestonesService.approve()`, fire-and-forget) | Sí, vía `StripeConnectService.transferToContractor` | `PaymentGovernanceService.evaluate()` (evidencia, disputa, aprobación, change orders, señales críticas, **lien waivers**), reserva→transfer→finalize |
| B | `PaymentsService.release()` (REST `POST payments/release…`, `project-copilot.harness`, `prometeo-tool-execution`) | Sí, vía `PaymentProviderRegistry.createPayoutIntent` | contrato firmado por ambas partes, milestone `APPROVED`, disputa abierta, saldo; reserva→provider→finalize; `auditService.append`. **No llama a `evaluate()`** |
| C | `payment-governance/PaymentGovernanceService.releasePayment()` (`POST /v1/payments/release`) | No (fail-safe desde ADR-034) | — |
| D | `ContributorProgramService.authorize…` → `transferToContractor` | Sí (pagos de recompensas, dominio distinto) | claim atómico de recompensa; no pasa por escrow |

**Hallazgos**
1. **C28 (waivers):** `WaiverPaymentGateService` solo se invoca desde `evaluate()`; el camino B (manual/agente/Prometeo) **no aplica** gate de waiver, evidencia, change orders ni señales críticas. Mismo dinero, dos conjuntos de reglas.
2. **C27 (dual approval):** no existe en el dominio de pagos. Solo hay un enum `dual_approval` en la gobernanza de tools de Prometeo, sin persistencia ni separación de funciones para releases.
3. **C29:** dos abstracciones de proveedor para el mismo release (`StripeConnectService` directo vs `PaymentProviderRegistry`); el camino A descarta su resultado (fire-and-forget) y reconcilia solo por logs; el camino B deja `PENDING` hasta webhook.
4. Dos clases llamadas `PaymentGovernanceService` (ver ADR-034) siguen coexistiendo.

## Decisión propuesta

1. **Propietario canónico:** `payments/` expone **un** comando `EscrowReleaseCommand.execute({ tenantId, milestoneId, amount?, actor, idempotencyKey, source })`. Pasos fijos: (a) `evaluate()` como **única** autorización económica determinista (incluye waivers); (b) política de aprobación (ver D2); (c) reserva atómica (`releaseFunds`), (d) proveedor vía **un** puerto, (e) `finalizeRelease`, (f) audit + evento outbox. Agentes/IA pueden **proponer**, nunca autorizar.
2. **Callers como adaptadores** (sin reglas de negocio propias): `MilestonesService.approve()` (auto), `PaymentsController`, harness del copilot, tool de Prometeo, y la UI admin/finance (re-habilitada solo tras enviar `milestoneId`). `EscrowReleaseService` y `PaymentsService.release()` pasan a delegar y luego se retiran.
3. **Idempotencia:** clave `(milestoneId, amount, source-independent)`; segundo intento devuelve el resultado del primero; nunca segunda transferencia.
4. **Migración sin big-bang:** (i) comando nuevo detrás de flag `PAYMENTS_SINGLE_RELEASE_COMMAND` (apagado), tests de paridad; (ii) migrar callers uno a uno, observando tráfico; (iii) activar por entorno; (iv) retirar caminos antiguos. Rollback = apagar flag (los caminos antiguos siguen intactos hasta el paso iv).
5. **Fail-safe vigente:** `releasePayment()` (camino C) sigue deshabilitado hasta que el comando exista; entonces se elimina o delega.

## Decisiones que requieren al humano (no se asumen)
- **D1 — Proveedor canónico:** ¿`PaymentProviderRegistry` (multi-proveedor; recomendado) con el adaptador Stripe usando Connect, o `StripeConnectService` directo?
- **D2 — Dual approval:** umbral por monto, quién puede ser segundo aprobador y separación iniciador≠aprobador. Requiere tabla aditiva (`PaymentReleaseApproval`) → migración planificada (AGENTS.md).
- **D3 — UI admin/finance:** exigir selección de `milestoneId` (recomendado) vs inferencia server-side.
- **D4 — Payouts de contributor (camino D):** fuera de este ADR; decidir si migran luego al mismo puerto de proveedor.

## Consecuencias
Un solo lugar para auditar dinero; waiver/evidencia/disputa aplican igual a UI, auto-release y agentes. Costo: migración por etapas y una tabla nueva para dual approval.
