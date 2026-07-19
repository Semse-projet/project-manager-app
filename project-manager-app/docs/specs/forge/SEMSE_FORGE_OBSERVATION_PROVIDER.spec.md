---
id: semse-forge-observation-provider
title: "SEMSE Forge Observation Provider"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/observation-provider.ts
  - packages/forge/src/types.ts
  - packages/forge/src/policy.ts
  - packages/forge/src/registry.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-observation-provider.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_OBSERVATION_PROPOSED
  - FORGE_RUN_CLOSED
related_agents:
  - devops-release
  - qa-verifier
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Observation Provider

## Propósito

Proveer un planificador puro (dry-run) de observación post-release que evalue si un `ForgeRun` puede pasar de `deployed` a `observing` y, eventualmente, a `closed` o `rolled_back`. No ejecuta comandos reales ni consulta servicios de monitoría; produce un plan auditable con `decision`, `reason`, `requiredApprovals` y `violations`.

## Alcance

- Evalúa el entorno, riesgo, rama objetivo y criterios de aceptación del task packet.
- Decide `allow` (cerrar run), `require_approval` (seguir observando con aprobación) o `deny` (rollback).
- Emite `FORGE_OBSERVATION_PROPOSED`.
- Integra con `buildForge` para la acción `observation.propose`.
- Integra con `ForgeService.applyTaskResult` para transicionar `deployed -> observing -> closed|rolled_back`.
- Integra con `ForgeService.decideApproval` para cerrar el run cuando se satisfagan las aprobaciones requeridas.

## Tipo canónico

```typescript
export type ForgeObservationPlan = {
  mode: "dry-run" | "live";
  decision: "allow" | "deny" | "require_approval";
  reason: string;
  environment: string;
  targetBranch: string;
  steps: string[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};
```

## Reglas de decisión

1. Si `policy.decision === "deny"` => `deny` con violación `observation.policy.denied`.
2. Si `environment` no está en `{sandbox, local, ci, staging, production}` => `deny` con `observation.invalid_environment`.
3. Si `targetBranch` es `main` o `master` => permitido (observación es lectura, no mutación directa).
4. Si `environment === "production"` o `riskLevel === "critical"` => requiere aprobación `dual_control`.
5. Si `riskLevel === "high"` => requiere aprobación `ops_admin`.
6. Si `allowedCommands` está vacío y no hay criterios de observación explícitos => `require_approval` con `observation.missing_health_checks`.
7. Si ninguna de las anteriores => `allow`.

El plan `allow` incluye pasos simulados:

- `collect_metrics`
- `check_slo`
- `scan_incidents`
- `verify_health`
- `observe`

Si la decisión es `deny`, el plan sugiere rollback:

- `identify_incident`
- `assess_blast_radius`
- `restore_previous_release`
- `verify_health`
- `observe`

## Eventos

### `FORGE_OBSERVATION_PROPOSED`

Se emite cuando `applyTaskResult` recibe un `observation` en el payload. Incluye:

- `taskId`
- `agentRunId`
- `observationDecision`
- `environment`
- `targetBranch`
- `stepCount`
- `requiredApprovals`

## Transiciones FSM

- `deployed -> observing` al recibir un plan de observación `allow`/`require_approval`/`deny`.
- `observing -> closed` si `observation.decision === "allow"` y todas las aprobaciones requeridas están aprobadas.
- `observing -> rolled_back` si `observation.decision === "deny"`.

## Guards

- No se permite `closed` si hay aprobaciones requeridas pendientes.
- No se permite `rolled_back` si la política deniega explícitamente la observación.

## Notas

- El proveedor `LiveObservationProvider` lanza `not implemented` en esta fase.
- No se modifica `packages/db/prisma/schema.prisma`.
