# Reporte: SEMSE Forge Observation Provider (dry-run)

**Fecha:** 2026-07-17
**Rama:** `agent/forge-observation-provider`
**Dominio:** `packages/forge`

## Resumen

Implementé el siguiente componente puro del plano de control de SEMSE Forge: `ObservationProvider`. Opera en modo `dry-run`, simula la planificación de observación post-release a partir del `ForgeTaskPacket` y el resultado de política. No ejecuta monitoreo real ni consulta servicios externos; produce un plan auditable con `decision`, `reason`, `requiredApprovals` y `violations`.

## Especificación

- `docs/specs/forge/SEMSE_FORGE_OBSERVATION_PROVIDER.spec.md` (APPROVED)
- `docs/specs/forge/SEMSE_FORGE_OBSERVATION_PROVIDER.plan.md` (APPROVED)

## Cambios principales

### `packages/forge`

- `src/types.ts`: nuevo tipo `ForgeObservationPlan`; nuevos eventos `FORGE_OBSERVATION_PROPOSED` y `FORGE_RUN_CLOSED`.
- `src/observation-provider.ts`: `DryRunObservationProvider` + stub `LiveObservationProvider`.
  - Valida entornos permitidos (`sandbox`, `local`, `ci`, `staging`, `production`).
  - Rechaza observación si `policy.decision === "deny"` o el entorno es inválido.
  - Requiere aprobación `dual_control` para `production` o `riskLevel` `critical`.
  - Requiere aprobación `ops_admin` para `riskLevel` `high`.
  - Requiere aprobación si no hay health checks o criterios de aceptación (`observation.missing_health_checks`).
  - Genera pasos de observación: `collect_metrics`, `check_slo`, `scan_incidents`, `verify_health`, `observe`.
  - En caso de denegación, genera pasos de rollback: `identify_incident`, `assess_blast_radius`, `restore_previous_release`, `verify_health`, `observe`.
- `src/registry.ts`: añadida acción `observation.propose` al manifest `devops-release`.
- `src/policy.ts`: añadida `observation.propose` a `branchAgnosticActions` para permitir observación sobre `main`/`master` (no es mutación directa).
- `src/tool-adapter.ts`: añadido mapeo de `observation.propose` a herramientas `repo.read`, `command.run`, `audit.record`; incluida en `CRITICAL_ACTIONS`.
- `src/orchestrator.ts`: emite `FORGE_RUN_CLOSED` al transicionar a `closed`.
- `src/index.ts`: exporta `createObservationProvider`, `ObservationProvider`, `ObservationProviderInput`, `ForgeObservationPlan`.

### `packages/agents`

- `src/runtime.ts`: `buildForge` invoca `createObservationProvider` para la acción `observation.propose` y añade `observation` al payload de resultado.

### `apps/api`

- `src/modules/forge/forge.service.ts`:
  - `applyTaskResult` extrae `payload.observation`, asegura que las aprobaciones requeridas estén registradas, emite `FORGE_OBSERVATION_PROPOSED` y calcula transiciones:
    - `deployed` / `observing` → `observing`
    - `observing` → `closed` si `observation.decision === "allow"` y todas las aprobaciones requeridas están aprobadas
    - `observing` → `rolled_back` si `observation.decision === "deny"`
  - `decideApproval` transiciona `observing` → `closed` tras aprobar un modo si el evento `FORGE_OBSERVATION_PROPOSED` más reciente tiene decisión `allow` y todas sus aprobaciones requeridas están satisfechas.

### Documentación

- `docs/foundation/EVENT_CATALOG.md`: añadidos `forge.observation.proposed` y `forge.run.closed`.
- `docs/SPEC_INDEX.md`: regenerado con `pnpm spec:index`.

### Tests

- `tests/unit/forge-observation-provider.test.mjs`: 8 casos (allow, producción requiere aprobación, riesgo crítico, entorno desconocido, health checks faltantes, policy deny, rollback steps, live not implemented).
- `tests/unit/forge-runtime-integration.test.mjs`: añadido caso de integración para `observation.propose`.

## Validación

```text
pnpm --filter @semse/forge build    PASS
pnpm --filter @semse/agents build   PASS
pnpm typecheck                       PASS
pnpm lint                            PASS (54 warnings preexistentes en apps/web, 0 errores)
pnpm test:unit                       PASS (924 pass / 0 fail)
pnpm spec:preflight                  PASS
pnpm spec:validate:strict            12 errores preexistentes (ninguno nuevo, tampoco relacionado con este cambio)
```

## Notas

- No se modificó `packages/db/prisma/schema.prisma`.
- No se añadieron dependencias.
- No se expusieron secretos.
- Los 12 errores de `spec:validate:strict` son preexistentes (specs de change-orders, rbac-explicit-boundary, communications-canonical-model, time-tracking-consolidation, weather, multi-stage-releases, materials-calculator). Ninguno proviene del spec de Observation Provider.
