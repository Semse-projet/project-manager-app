# Reporte — C27/C28/C29 slice 1: autorización económica única en el release manual/agente

**Fecha:** 2026-09-30 · **Base:** main · **ADR:** ADR-041 (ACCEPTED, aprobado explícitamente por el owner) · **Spec:** payments.escrow-release-command (APPROVED)

## Estado
- C28: **avance fuerte, sigue PARCIAL**. El gate de lien waivers ahora aplica también al release manual/REST/agente/Prometeo (antes sólo al auto-release).
- C27/C29: slice 1 de 4. Faltan comando único con idempotencia/reconciliación (slice 2), dual approval (slice 3, bloqueado por D2) y retiro del camino falso (slice 4).

## Cambios
- Nuevo `payments/release-governance.gate.ts` (`ReleaseGovernanceGate`), inyectado `@Optional()` en `PaymentsService` (no rompe constructores existentes) y llamado en `release()` **antes** de reservar fondos.
  - Waivers: **enforced por defecto**; rollback `PAYMENTS_RELEASE_WAIVER_GATE=off`.
  - Governance completa `evaluate()`: **shadow por defecto** (log estructurado `release_governance_shadow_would_block`, nunca bloquea ni lanza); `enforce` bloquea con la lista de blockers y falla cerrado si `evaluate()` falla; `off` la omite. Variable: `PAYMENTS_RELEASE_GOVERNANCE_MODE`.
- `source: "manual" | "agent"` explícito (harness del copilot y tool de Prometeo pasan `agent`), sólo observabilidad.
- Sin migraciones; sin cambios de contrato de respuesta; ningún proveedor de pago tocado.

## Tests
`test/release-governance-gate.test.ts` (11): resolución de modo/flags, waiver bloquea por defecto y antes de todo, kill switch, shadow no bloquea ni lanza, enforce bloquea/falla cerrado/permite, off, e integración `PaymentsService.release` (gate bloqueante ⇒ `releaseFunds` nunca se llama). API unit: 2590 tests, 2553 pass, 0 fail; tsc, lint, build OK.

## Operación (el merge despliega solo)
- **Cambio de comportamiento inmediato:** un release manual con waiver pendiente responde 409. Es el objetivo (mismo gate que el auto-release).
- Shadow genera logs `release_governance_shadow_would_block`: revisar unos días antes de pasar a `PAYMENTS_RELEASE_GOVERNANCE_MODE=enforce` (acción del operador; no ejecutada).
- Rollback inmediato sin redeploy de código: `PAYMENTS_RELEASE_WAIVER_GATE=off`.
