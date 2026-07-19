# Reporte: SEMSE Forge Deployment Provider (dry-run)

**Fecha:** 2026-07-17
**Rama:** `agent/forge-deployment-provider`
**Dominio:** `packages/forge`

## Resumen

Implementé el siguiente componente puro del plano de control de SEMSE Forge: `DeploymentProvider`. Opera en modo `dry-run`, simula la planificación de un despliegue o rollback a partir del `ForgeTaskPacket`, el resultado de política y, opcionalmente, el paquete de PR. No ejecuta despliegues reales ni toca infraestructura.

## Especificación

- `docs/specs/forge/SEMSE_FORGE_DEPLOYMENT_PROVIDER.spec.md` (APPROVED)
- `docs/specs/forge/SEMSE_FORGE_DEPLOYMENT_PROVIDER.plan.md` (APPROVED)

## Cambios principales

### `packages/forge`

- `src/types.ts`: nuevo tipo `ForgeDeploymentPlan`.
- `src/deployment-provider.ts`: `DryRunDeploymentProvider` + stub `LiveDeploymentProvider`.
  - Valida entornos permitidos (`sandbox`, `local`, `ci`, `staging`, `production`).
  - Rechaza despliegues a `production` con `riskLevel` `high`/`critical` sin aprobación `dual_control`.
  - Rechaza despliegues a `production` si el `targetBranch` no es `main`/`master`.
  - Detecta archivos críticos de infraestructura (`railway.json`, `Dockerfile*`, `docker-compose*`, workflows, prisma) y requiere aprobación `security`.
  - Hereda violaciones de `policy` o `prPackage`.
- `src/index.ts`: exporta `createDeploymentProvider`, `DeploymentProvider` y `DeploymentProviderInput`.
- `src/policy.ts`: permite que las acciones `deployment.propose` y `rollback.prepare` tengan `targetBranch` `main`/`master`, porque son acciones de planificación/rollback que no escriben código directamente en la rama por defecto.

### `packages/agents`

- `src/runtime.ts`: `buildForge` invoca `createDeploymentProvider` para las acciones `deployment.propose`, `rollback.prepare` y `ci.implement`, y añade `deployment` al payload de resultado.

### `apps/api`

- `src/modules/forge/forge.service.ts`: `applyTaskResult` extrae `payload.deployment`, emite `FORGE_DEPLOYMENT_PROPOSED` y permite transicionar `merged → deployed` cuando `deployment.decision === "allow"`.

### Documentación

- `docs/foundation/EVENT_CATALOG.md`: añadido `forge.deployment.proposed`.
- `docs/SPEC_INDEX.md`: regenerado con `pnpm spec:index`.

### Tests

- `tests/unit/forge-deployment-provider.test.mjs`: 8 casos.
- `tests/unit/forge-runtime-integration.test.mjs`: añadido caso de integración para `deployment.propose`.

## Validación

```text
pnpm --filter @semse/forge build    PASS
pnpm --filter @semse/agents build   PASS
pnpm typecheck                       PASS
pnpm lint                            PASS (54 warnings preexistentes en apps/web, 0 errores)
pnpm test:unit                       PASS (904 pass / 0 fail)
pnpm spec:preflight                  PASS
node scripts/forge-validate.mjs     PASS (Agents 14, States 15, Errors 0)
pnpm spec:validate:strict            11 errores preexistentes (ninguno nuevo, tampoco relacionado con este cambio)
```

## Notas

- No se modificó `packages/db/prisma/schema.prisma`.
- No se añadieron dependencias.
- No se expusieron secretos.
- Los 11 errores de `spec:validate:strict` son preexistentes (specs de change-orders, rbac-explicit-boundary, communications-canonical-model, weather, multi-stage-releases, materials-calculator). Ninguno proviene del spec de Deployment Provider.
