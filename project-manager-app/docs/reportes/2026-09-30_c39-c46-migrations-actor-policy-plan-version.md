# Reporte — C39/C46: migración aditiva (actor/política en logs de IA, versión de plan)

**Fecha:** 2026-09-30 · **Base:** main · **Autorización:** el owner respondió "Sí a ambas" a las migraciones de C39 y C46 en la sesión de trabajo.

## Migración `20260930230513_c39_c46_ai_log_actor_policy_plan_version`
```sql
ALTER TABLE "AgentWorkPlan" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AiInteractionLog" ADD COLUMN "actorRoles" TEXT, ADD COLUMN "orgId" TEXT,
  ADD COLUMN "policyDecision" TEXT, ADD COLUMN "privacyLevel" TEXT;
```
- Puramente aditiva: 4 columnas nullable + 1 `INT NOT NULL DEFAULT 1` (en PG ≥ 11 no reescribe la tabla). No borra ni reescribe datos.
- **Validada** en una base descartable local: las 57+ migraciones previas aplican limpias (`migrate deploy`), la nueva se generó con `migrate dev` y `migrate status` = "up to date".
- **Rollback** (si hiciera falta; las columnas no son leídas por código antiguo):
```sql
ALTER TABLE "AgentWorkPlan" DROP COLUMN "version";
ALTER TABLE "AiInteractionLog" DROP COLUMN "actorRoles", DROP COLUMN "orgId", DROP COLUMN "policyDecision", DROP COLUMN "privacyLevel";
```
- El merge despliega y la migración corre en el deploy (`migrate deploy`); no hay pasos manuales.

## C39 — router de modelos
- `AiInteractionLog` registra ahora `orgId`, `actorRoles` (server-stamped desde el actor autenticado), `privacyLevel` y `policyDecision` (`private_enforced` | `denied` | `standard`).
- **Costo**: `estimatedCostUsd` se calcula solo si el operador define `AI_MODEL_PRICING_JSON`; no hay tarifas incorporadas. **Pendiente del owner: los precios** (sin ellos el costo sigue en null).
- C39 pasa a: tarea, modelo, permiso/actor, política y resultado observables; costo habilitado pero sin datos hasta configurar precios.

## C46 — Plan Mode
- `AgentWorkPlan.version` cuenta revisiones de la **definición** del plan (herramientas, capacidades, riesgo, flags de aprobación, dependencias). El progreso de ejecución (estado, timestamps, evidencia) no cambia la versión.
- Al aprobar se guarda la huella de la definición aprobada (`metaJson.approvedDefinitionHash`). Si después se edita la definición, `approvalValid=false` y la ejecución de herramientas falla cerrado hasta re-aprobar. Planes aprobados antiguos (sin huella) siguen válidos.
- Expuesto en `WorkPlanRecord`: `version`, `approvalValid` (aditivo).

## Tests
`ai-cost-and-actor-log.test.ts` (5), `plan-versioning.test.ts` (6), +1 en `plan-execution.service.test.ts`. API unit: 2591 tests, 2554 pass, 0 fail; `tsc`, lint, build y `pnpm typecheck` OK.

## Abierto
- Precios por modelo (owner).
- Trazas/eventos de denegación de política: alinear con `EVENT_CATALOG.md` antes de emitir eventos nuevos.
- Existen otras políticas allow/deny en `packages/agents` (no tocadas).
