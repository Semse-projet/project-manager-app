# Reporte — 0.42: auditoría de las acciones del harness del copiloto

**Fecha:** 2026-11-10 · **Hallazgo:** [`AUDIT_REMEDIATION_PLAN.md` 0.42](../AUDIT_REMEDIATION_PLAN.md) · **Spec:** [`prometeo.tool-call-audit-lineage`](../specs/prometeo/tool-call-audit-lineage.spec.md) (APPROVED; D1 y D5 aceptadas) · **Rama:** `fix/copilot-harness-tool-audit` · **PR:** pendiente

| SPEC | CODE | TEST local | CI | MERGE | DEPLOY | ACTIVATION | UAT |
|---|---|---|---|---|---|---|---|
| APPROVED | COMPLETE | PASS dirigido (12 fallos de entorno preexistentes en la suite) | PENDIENTE | NO | NO | Sigue el modo `PROMETEO_TOOL_AUDIT_LIFECYCLE` (hoy `shadow` en producción) | NO |

## Qué faltaba

0.42 había quedado parcial. Las tool calls de Prometeo ya pasaban por `ToolCallAuditor`, pero las acciones que ejecuta el harness del copiloto (`source: project_copilot`) no dejaban fila de auditoría. Por eso el `runId` del run padre D5 no quedaba registrado en ninguna fila.

## Cambios

- `project-copilot.harness.ts`: `executeApprovedAction` es el único punto por el que pasan las ejecuciones (`recommended`, `none`, `executeFromApproval` y el reintento manual). Ahora abre el ciclo de vida del auditor antes de ejecutar y lo cierra con el resultado. La lógica anterior pasa sin cambios a `runApprovedAction`.
  - Campos: `source`/`namespace` `project_copilot`, `name` = tipo de acción, `runId` = run padre D5, `projectId`, `approvalId`, `agentId: project-copilot`, entrada/salida redactadas.
  - Lecturas (`SEARCH_PATTERNS`, `READ_FILE`, `LIST_DIRECTORY`): fail-open. El resto, escritura: fail-closed en `enforce` (D1).
  - Con `off` no se escribe nada (`legacy: null`).
- `executeFromApproval` reclama la aprobación y audita con **el mismo `executionId`** (spec §3.3).
- `agents.controller.ts`: el reintento manual pasa el id con el que reclamó.
- Inyección opcional de `ToolGovernanceRepository`, que ya exportaba `PrometeoModule` (importado por `AgentsModule`). No añade dependencias entre módulos ni migración.

## Verificación

- `copilot-harness-tool-audit.test.ts`: 8/8. Control negativo con el harness de `main`: fallan 6; los 2 que pasan cubren el modo `off` y la lectura fail-open.
- Tests del harness, aprobaciones y auditor (`harness-integrity`, `h05-approval-execution`, `copilot-parent-run`, `harness-policy-lineage`, `agents-project-scope`, `prometeo-tool-audit-lifecycle`, `agents*`): pasan. La única excepción es `agents.controller.test.ts` ("agent run claim signing authority unavailable"), que falla igual en `main`.
- Suite API: 3976 pass / 12 fail, los mismos 12 de entorno de siempre (motor de Prisma y DNS).
- `tsc --noEmit` limpio; eslint sin errores en los archivos tocados.

## No verificado / pendiente

- **En vivo:** sin probar. Con `shadow` activo en producción, una acción del copiloto debería dejar una fila `source = project_copilot` con el `runId` del run padre; se comprueba con una consulta de solo lectura en `prometeo_tool_invocation_audit`.
- **Decisiones que siguen abiertas (dueño):** pasar a `enforce` y, opcionalmente, mover los barridos a un job del worker.
