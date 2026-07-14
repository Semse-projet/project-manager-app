# Reporte - Prometeo Missions P2

Fecha: 2026-07-12

## Objetivo

Convertir el estado de misión de Prometeo en una entidad reanudable y auditable
sin crear un runtime paralelo al Project Copilot.

## Implementación

- `PrometeoMissionService` adapta `AgentWorkPlanService` y
  `PlanExecutionService` al contrato de Prometeo.
- Las misiones persisten objetivo, contexto, entidades, acciones, riesgos,
  criterios de éxito, pasos y timestamps.
- El plan canónico contiene las fases observar, interpretar, planificar,
  aprobar cuando aplique, ejecutar y verificar.
- Las misiones sin mutaciones se autoaprueban; las que contienen acciones con
  `requiresApproval` quedan en `waiting_approval`.
- Se agregaron endpoints para crear, consultar, aprobar, rechazar, cancelar y
  registrar checkpoints.
- El BFF web y `semse-api.ts` exponen el ciclo completo.

## Estado de Railway observado

La API y la Web públicas respondieron HTTP 200 el 2026-07-12. El endpoint
`GET /v1/prometeo/tools` respondió HTTP 404, confirmando que P0/P1/P2 todavía no
están desplegados. La rama local debe pasar CI y desplegarse antes de validar
estos contratos en producción.

## Límites

- No se habilitan tools de escritura desde Prometeo.
- Las decisiones de misión no reemplazan gates financieros o de disputas.
- El chat aún puede devolver una misión sintética cuando no recibe un
  `missionId`; la creación durable se realiza por el endpoint de misiones.
- Video intelligence y adjuntos binarios siguen pendientes.

## Verificación local

```bash
pnpm --filter @semse/schemas build
pnpm --filter @semse/api build
node --experimental-strip-types --test apps/api/test/ai-models.controller.test.ts apps/api/test/prometeo.controller.test.ts apps/api/test/prometeo-mission.controller.test.ts
pnpm --filter @semse/web build
```
