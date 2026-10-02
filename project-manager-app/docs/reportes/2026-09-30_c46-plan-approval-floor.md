# Reporte — C46 Plan Mode: piso de aprobación determinista (Wave A, lote A1, parte 2)

**Fecha:** 2026-09-30 · **Base:** main `21ccbeb`

## Estado
- Previo: PARCIAL. Criterio: "plan versionado con toolsAllowed, gates, trazas, fallos y cancelación".
- Actual: **PARCIAL (avance de seguridad)**. Cancelación y gates por step existen; se cierra un bypass de aprobación. Versionado de plan sigue abierto.

## Hallazgo (reproducido antes del fix)
Los borradores de plan son generados por el modelo y `inferToolsAllowed` fusiona sus `toolsAllowed` con el mapa por capability; además `defaultRequiresApprovedPlan` respetaba `requiresApprovedPlan:false` del propio plan. Resultado: un step `searching`/riesgo bajo con `toolsAllowed:["propose_escrow_release"]` quedaba **permitido sin plan aprobado** (`allowed:true`), y steps `worker`/`dispute`/`browser-form` podían declararse sin aprobación.

## Cambios (`plan-tool-policy.service.ts`)
- `capabilityRequiresApprovedPlan()` + `toolRequiresApprovedPlan()`: piso determinista (dispute, worker, browser-form con `requiresApproval`).
- `defaultRequiresApprovedPlan()`: el plan sólo puede **subir** el requisito, nunca bajarlo.
- `validateToolExecution()`: herramientas de dinero/disputa/formularios exigen `planApproved` aunque capability/riesgo/flag del step digan otra cosa. Con plan aprobado el flujo sigue igual (gate humano intacto).
- Sin migraciones ni cambios de contrato.

## Tests
- 6 nuevos en `plan-tool-policy.service.test.ts` (smuggling, aprobado permitido, piso no bajable, explicit:true sube, browser-form, clasificación).
- API unit: 2553 tests, 2516 pass, 0 fail; `tsc`, lint, build OK.

## Abierto en C46
- **Versionado del plan**: `AgentWorkPlan` no tiene columna de versión (requiere migración aditiva → confirmar antes).
- Trazas/auditoría por decisión de policy denegada: revisar contra `EVENT_CATALOG.md` antes de emitir eventos nuevos.
- Existen otras políticas allow/deny en `packages/agents` (ver skill `semse-agents-governance`); no se tocaron.
