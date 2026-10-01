# C18 — invariantes restantes (2026-10-01)

Decisiones del dueño aplicadas: revalidar `APPROVED` dentro de la misma transacción que reserva fondos; revalidar Evidence antes de aprobar y otra vez en el gate de pago; impedir self-approval cuando `clientOrgId === assignedProOrgId` en producción (demo de una org solo con flag explícito de sandbox/no-prod).

## Hallazgo (hueco real en el gate de pago)
`computePaymentReadiness` solo bloqueaba por evidencia **faltante** o **rechazada**. Un requisito `required` en `submitted` (sin revisar) o `archived` no bloqueaba, así que un hito aprobado con evidencia requerida sin validar podía liberar dinero. (El mensaje de auditoría decía "Evidence complete (approved/required)" pero la regla no lo garantizaba.)

## Cambios (sin migración)
- `milestones/evidence-readiness.ts`: predicado único `evaluateRequiredEvidence` (todo requisito `required` debe estar `approved`; submitted/archived/rejected/missing/desconocido bloquean; sin checklist no bloquea) y modos `MILESTONE_EVIDENCE_REVALIDATION` (`enforce` por defecto, `shadow` observa, `off` = rollback).
- **Aprobar:** el snapshot incluye `evidenceBlockers`; `assertMilestoneApprovable` devuelve 409 con los blockers.
- **Reservar fondos:** `PaymentsRepository.releaseFunds` (transacción Serializable) revalida que el hito siga `APPROVED` y que la evidencia requerida esté validada **antes** de crear la reserva → cubre el camino manual/agente y el auto-release. Cierra la ventana aprobar → rechazar/cambiar evidencia → reservar.
- `computePaymentReadiness` usa el mismo predicado (en `shadow`/`off` conserva el comportamiento anterior).
- **Auto-aprobación:** `clientOrgId == assignedProOrgId` (no vacíos) ⇒ 403, salvo `OPS_ADMIN`, o `MILESTONE_ALLOW_SELF_APPROVAL=sandbox` en no-producción.

## Verificación
- `c18-invariants.test.ts` (7): predicado (incluye los casos que antes NO bloqueaban), modos, aprobar con/sin evidencia validada, auto-aprobación (OPS, sandbox, producción), y `releaseFunds` con hito REJECTED/SUBMITTED/DRAFT/PAID/inexistente ⇒ 409 sin crear reserva, evidencia sin validar ⇒ 409 con blockers, validada ⇒ reserva, shadow/off no bloquean.
- `tsc` limpio · suite API 2634 pass / 0 fail.
- Los flujos de humo existentes no siembran checklist de evidencia (`seedEvidenceItems` solo se invoca explícitamente) y usan orgs distintos; no deberían verse afectados.

## Cambios de comportamiento a vigilar
Hitos con checklist sembrado cuyos ítems requeridos sigan `submitted`/`archived` ya no se podrán aprobar ni liberar hasta aprobar los ítems. Rollback inmediato: `MILESTONE_EVIDENCE_REVALIDATION=off` (o `shadow` para medir primero).

## Pendiente
Auto-release como adaptador del comando (ADR-041 2b); smoke autenticado multi-tenant.
