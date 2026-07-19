# Reporte: SEMSE Forge Rollback Provider (dry-run)

**Fecha:** 2026-07-17
**Rama:** `agent/forge-rollback-provider`
**Dominio:** `packages/forge`

## Resumen

Implementé el siguiente componente puro del plano de control de SEMSE Forge: `RollbackProvider`. Opera en modo `dry-run`, simula la planificación de un rollback seguro a partir del `ForgeTaskPacket`, el resultado de política y, opcionalmente, un `ForgeDeploymentPlan` previo. No ejecuta rollbacks reales ni toca infraestructura.

## Especificación

- `docs/specs/forge/SEMSE_FORGE_ROLLBACK_PROVIDER.spec.md` (APPROVED)
- `docs/specs/forge/SEMSE_FORGE_ROLLBACK_PROVIDER.plan.md` (APPROVED)

## Cambios principales

### `packages/forge`

- `src/types.ts`: nuevo tipo `ForgeRollbackPlan` y nuevo evento `FORGE_ROLLBACK_PROPOSED`.
- `src/rollback-provider.ts`: `DryRunRollbackProvider` + stub `LiveRollbackProvider`.
  - Valida entornos permitidos (`sandbox`, `local`, `ci`, `staging`, `production`).
  - Rechaza rollback a `production` con `riskLevel` `high`/`critical` sin aprobación `dual_control`.
  - Rechaza rollback a `production` si el `targetBranch` no es `main`/`master`.
  - Detecta archivos de datos (`packages/db/prisma/schema.prisma`, migraciones, `**/*.sql`) y requiere aprobación `security` y paso `data_backup`.
  - Hereda violaciones de `policy` o `deploymentPlan`.
  - Genera pasos de rollback: `identify_previous_release`, `backup_state`, `restore_release`, `verify_health`, `observe`.
- `src/index.ts`: exporta `createRollbackProvider`, `RollbackProvider`, `RollbackProviderInput`, `ForgeRollbackPlan`.

### `packages/agents`

- `src/runtime.ts`: `buildForge` invoca `createRollbackProvider` para la acción `rollback.prepare` y añade `rollback` al payload de resultado.

### `apps/api`

- `src/modules/forge/forge.service.ts`: `applyTaskResult` extrae `payload.rollback`, emite `FORGE_ROLLBACK_PROPOSED`, asegura que las aprobaciones requeridas estén registradas y transiciona `deployed`/`observing` → `rolled_back` cuando el plan es `allow` o cuando todas sus aprobaciones requeridas están aprobadas.
- `src/modules/forge/forge.service.ts`: `decideApproval` transiciona `deployed`/`observing` → `rolled_back` tras aprobar un modo si todas las aprobaciones requeridas por el evento `FORGE_ROLLBACK_PROPOSED` más reciente están satisfechas.

### Documentación

- `docs/foundation/EVENT_CATALOG.md`: añadido `forge.rollback.proposed`.
- `docs/SPEC_INDEX.md`: regenerado con `pnpm spec:index`.

### Tests

- `tests/unit/forge-rollback-provider.test.mjs`: 8 casos.
- `tests/unit/forge-runtime-integration.test.mjs`: añadido caso de integración para `rollback.prepare`.

## Validación

```text
pnpm --filter @semse/forge build    PASS
pnpm --filter @semse/agents build   PASS
pnpm typecheck                       PASS
pnpm lint                            PASS (54 warnings preexistentes en apps/web, 0 errores)
pnpm test:unit                       PASS (915 pass / 0 fail)
pnpm spec:preflight                  PASS
pnpm spec:validate:strict            11 errores preexistentes (ninguno nuevo, tampoco relacionado con este cambio)
```

## Notas

- No se modificó `packages/db/prisma/schema.prisma`.
- No se añadieron dependencias.
- No se expusieron secretos.
- Los 11 errores de `spec:validate:strict` son preexistentes (specs de change-orders, rbac-explicit-boundary, communications-canonical-model, weather, multi-stage-releases, materials-calculator). Ninguno proviene del spec de Rollback Provider.
