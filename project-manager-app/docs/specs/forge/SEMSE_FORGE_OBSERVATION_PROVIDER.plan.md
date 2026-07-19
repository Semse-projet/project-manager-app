# Plan: SEMSE Forge Observation Provider

## Fases

### 1. Especificación y contratos

- Crear `SEMSE_FORGE_OBSERVATION_PROVIDER.spec.md` (APPROVED).
- Añadir `ForgeObservationPlan` a `packages/forge/src/types.ts`.
- Añadir `FORGE_OBSERVATION_PROPOSED` y `FORGE_RUN_CLOSED` a `ForgeEvent`.
- Actualizar `docs/foundation/EVENT_CATALOG.md`.

### 2. Implementación del proveedor

- Crear `packages/forge/src/observation-provider.ts`.
  - `DryRunObservationProvider`
  - `LiveObservationProvider` (lanza "not implemented")
  - `createObservationProvider`
  - Reglas de decisión del spec.
- Exportar en `packages/forge/src/index.ts`.
- Añadir `observation.propose` a `allowedActions` de `devops-release` en `packages/forge/src/registry.ts`.
- Añadir `observation.propose` a `branchAgnosticActions` en `packages/forge/src/policy.ts`.

### 3. Integración runtime

- `packages/agents/src/runtime.ts`:
  - Importar `createObservationProvider`.
  - Invocar para `observation.propose`.
  - Incluir `observation` en el payload de resultado.

### 4. Integración API

- `apps/api/src/modules/forge/forge.service.ts`:
  - Emitir `FORGE_OBSERVATION_PROPOSED` en `applyTaskResult`.
  - Calcular siguiente estado con `observation`:
    - `deployed -> observing`
    - `observing -> closed` si `allow` y aprobaciones completas
    - `observing -> rolled_back` si `deny`
  - `decideApproval`:
    - Si `approved` y run en `observing`, buscar evento `FORGE_OBSERVATION_PROPOSED` más reciente.
    - Si todas las aprobaciones requeridas están aprobadas y decisión `allow`, transicionar `observing -> closed`.

### 5. Tests

- `tests/unit/forge-observation-provider.test.mjs`:
  - allow (low/medium sin producción).
  - require_approval (producción, crítico, high).
  - deny (policy deny, entorno inválido).
  - missing health checks.
  - live not implemented.
- `tests/unit/forge-runtime-integration.test.mjs`:
  - assert `payload.observation` para `observation.propose`.

### 6. Validación y PR

- `pnpm --filter @semse/forge build`
- `pnpm --filter @semse/agents build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`
- `pnpm spec:preflight`
- `pnpm spec:validate:strict` (verificar que no se añadan errores nuevos)
- `pnpm spec:index`
- Commit, push y PR.
