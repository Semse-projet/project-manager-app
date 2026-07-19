---
id: semse-forge-rollback-provider
title: "SEMSE Forge Rollback Provider"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/rollback-provider.ts
  - packages/forge/src/types.ts
  - packages/forge/src/index.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-rollback-provider.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_ROLLBACK_PROPOSED
  - FORGE_RUN_BLOCKED
  - FORGE_RUN_ROLLED_BACK
related_agents:
  - devops-release
  - data-engineer
  - forge-supervisor
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Rollback Provider

## 1. Qué resuelve

**Para quién:** agentes `devops-release` y `data-engineer` que preparan un plan de rollback seguro tras un despliegue o ante una migración riesgosa.

**Problema:** cuando un despliegue falla o se detecta una regresión, SEMSE Forge necesita un plan de rollback puro que valide qué se puede revertir, qué aprobaciones requiere y qué pasos de verificación son obligatorios, sin ejecutar mutaciones reales.

**Solución:** un `RollbackProvider` puro en `packages/forge` que, en modo `dry-run`, ensambla una `ForgeRollbackPlan` a partir del `ForgeTaskPacket`, la política y, opcionalmente, un `ForgeDeploymentPlan` previo. No ejecuta rollback; la ejecución real se deja para una fase `live` futura.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `devops-release` | agente Forge | preparar rollback de despliegues | ejecutar rollback a producción sin `dual_control` |
| `data-engineer` | agente Forge | preparar rollback de migraciones/schema | borrar datos de producción sin aprobación `security` |
| `forge-supervisor` | PLATFORM | revisar planes de rollback | forzar rollback sin aprobaciones |
| `security-reviewer` | GOVERNANCE | validar rollback que toca datos o secretos | ejecutar rollback |

## 3. Escenarios de Usuario

### P1 — Rollback de despliegue a staging

**Journey:** el `devops-release` propone revertir un despliegue reciente en `staging`. El provider verifica que exista un plan de despliegue previo, que el entorno sea reversible y que las aprobaciones requeridas estén presentes.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con action "rollback.prepare",
       environment "staging",
       riskLevel "medium",
       un policy allow o require_approval
       y un deploymentPlan previo
CUANDO el runtime invoca createRollbackProvider({ mode: "dry-run" }).plan(input)
ENTONCES el ForgeRollbackPlan tiene decision "allow" o "require_approval"
  Y    los pasos incluyen "identify_previous_release", "backup_state", "restore_release",
       "verify_health" y "observe"
```

### P2 — Rollback de producción bloqueado sin aprobaciones

**Journey:** un agente intenta preparar rollback a `production` sin las aprobaciones necesarias. El provider deniega la propuesta.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con environment "production" y riskLevel "critical"
CUANDO el provider evalúa el plan
ENTONCES decision es "deny" o "require_approval"
  Y    las violaciones incluyen "rollback.production_requires_approval"
```

### P3 — Rollback que toca migraciones de datos

**Journey:** el `data-engineer` propone rollback de una migración que alteró `packages/db/prisma/schema.prisma` o migraciones. El provider requiere aprobación `security` y un paso de `data_backup`.

## 4. Entradas y Salidas

### Entrada `RollbackProviderInput`

```typescript
export type RollbackProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
  deploymentPlan?: ForgeDeploymentPlan;
};
```

### Salida `ForgeRollbackPlan`

```typescript
export type ForgeRollbackPlan = {
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

## 5. Reglas de decisión

1. Si `policy.decision === "deny"` → `decision: "deny"`.
2. Si `environment === "production"` y `riskLevel` es `high`/`critical` → `require_approval` y `dual_control`.
3. Si `environment === "production"` y `targetBranch` no es `main`/`master` → `deny`.
4. Si `task.allowedFiles` intersecta `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/**` o archivos `.sql` → añadir `security` a `requiredApprovals` y paso `data_backup`.
5. Si `deploymentPlan` existe y `deploymentPlan.decision === "deny"` → `deny`.
6. En cualquier otro caso → `decision: "allow"` con pasos:
   - `identify_previous_release`
   - `backup_state`
   - `restore_release`
   - `verify_health`
   - `observe`

## 6. Eventos

- `FORGE_ROLLBACK_PROPOSED`: emite `taskId`, `agentRunId`, `rollbackDecision`, `environment`, `targetBranch`, `stepCount`, `requiredApprovals`.
