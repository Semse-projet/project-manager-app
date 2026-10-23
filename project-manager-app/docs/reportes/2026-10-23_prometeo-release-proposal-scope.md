# Reporte — 0.48: alcance del proponente en `payments.propose_release`

**Fecha:** 2026-10-23 · **Hallazgo:** [`AUDIT_REMEDIATION_PLAN.md` 0.48](../AUDIT_REMEDIATION_PLAN.md) (seguimiento de 0.44) · **Rama:** `fix/prometeo-release-proposal-scope` · **PR:** pendiente

| SPEC | CODE | TEST local | CI | MERGE | DEPLOY | ACTIVATION | UAT |
|---|---|---|---|---|---|---|---|
| N/A (remediación de backlog) | COMPLETE | PASS dirigido (12 fallos de entorno preexistentes en la suite) | PENDIENTE | NO | NO | NO | NO |

## Alcance revisado

El pendiente de 0.44 pedía revisar, con el mismo criterio que visión, las herramientas de Prometeo que reciben ids de recurso.

- **`time_tracker.*` (9 herramientas): sin hallazgo.** El repositorio de `field-ops` ya acota sesiones por `createdBy` y trabajos por asignación. La herramienta usa el mismo servicio que REST con la identidad verificada.
- **`payments.propose_release`: hueco.** Al aprobarse, el efecto corre como el OPS_ADMIN aprobador, así que los chequeos de `release()` nunca evaluaban al proponente. Al proponer no se validaba nada.

## Cambios

- `payments.repository.ts`: nuevo `assertMilestoneProjectParticipant`, de solo lectura y sin upsert de contexto de actor. Usa la regla de lectura del proyecto, no la de finanzas, porque producto permite que el PRO asignado proponga la liberación de su hito.
- `payments.service.ts`: nuevo `assertCanProposeRelease`.
- `prometeo-tool-execution.service.ts`: `assertProposerScope` antes de encolar o ejecutar. Audita la denegación y falla cerrado si `PaymentsService` no está disponible.
- Test nuevo: `apps/api/test/prometeo-release-proposal-scope.test.ts`.

## Verificación

- Test nuevo: 8/8. Control negativo con el ejecutor anterior: fallan los 4 casos de denegación y pasan los 4 de comportamiento permitido.
- Prometeo y pagos (todos sus archivos de test): 257/257.
- Suite API: 3587 pass / 12 fail. Son los mismos fallos que en `main`: el entorno no tiene motor de Prisma ni DNS.
- `tsc --noEmit` limpio en `apps/api`; eslint sin errores en los archivos tocados (1 warning preexistente).

## No verificado / pendiente

- **En vivo:** sin probar. Hacen falta dos orgs en un tenant de prueba; contra producción no se intenta (ver `semse-security-baseline`).
- **Exposición previa:** revisar en `PrometeoProposedAction` si existe alguna propuesta `payments.propose_release` sobre un hito cuyo proyecto no incluye la org del proponente.
- **Gobernanza:** toca un flujo de dinero. Según `semse-audit-remediation`, requiere revisión humana antes de fusionar. No cambia el estado de ningún pago; solo restringe quién puede proponer.
