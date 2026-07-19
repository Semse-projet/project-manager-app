---
id: semse-forge-deployment-provider
title: "SEMSE Forge Deployment Provider"
domain: forge
status: APPROVED
owner: semse-core
risk: medium
related_files:
  - packages/forge/src/deployment-provider.ts
  - packages/forge/src/types.ts
  - packages/forge/src/index.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-deployment-provider.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_DEPLOYMENT_PROPOSED
  - FORGE_RUN_BLOCKED
related_agents:
  - devops-release
  - forge-supervisor
  - security-reviewer
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Deployment Provider

## 1. Qué resuelve

**Para quién:** agentes `devops-release` y `forge-supervisor` que proponen desplegar una entrega aprobada.

**Problema:** después de que un paquete de PR está `ready_for_review` y se mergea (o se propone un despliegue directo), SEMSE Forge necesita un plan de despliegue puro que valide el entorno, las aprobaciones requeridas y los artefactos críticos antes de ejecutar un despliegue real.

**Solución:** un `DeploymentProvider` puro en `packages/forge` que, en modo `dry-run`, ensambla una `ForgeDeploymentPlan` a partir del `ForgeTaskPacket`, la política y, opcionalmente, el `ForgePRPackage`. No despliega ni toca infraestructura real; la ejecución real se deja para una fase `live` futura.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `devops-release` | agente Forge | proponer despliegues en staging/production | desplegar a producción sin aprobación `dual_control` |
| `forge-supervisor` | PLATFORM | revisar planes de despliegue | forzar despliegue sin aprobaciones |
| `security-reviewer` | GOVERNANCE | validar cambios críticos de infraestructura | ejecutar despliegues |

## 3. Escenarios de Usuario

### P1 — Despliegue a staging permitido

**Journey:** el `devops-release` propone desplegar un PR mergeado a `staging`. El provider verifica que el entorno es `staging`, que no hay archivos críticos sin revisar y que las aprobaciones requeridas están presentes.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con action "deployment.propose",
       targetBranch "main",
       environment "staging",
       riskLevel "medium",
       un policy allow o require_approval
CUANDO el runtime invoca createDeploymentProvider({ mode: "dry-run" }).plan(input)
ENTONCES el ForgeDeploymentPlan tiene decision "allow" o "require_approval"
  Y    los pasos incluyen "build", "test", "deploy-staging" y "verify"
  Y    requiredApprovals incluye "ops_admin" si el riesgo es high/critical
```

### P2 — Despliegue a producción bloqueado por falta de aprobaciones

**Journey:** un agente intenta proponer despliegue a `production` sin las aprobaciones necesarias. El provider deniega la propuesta.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con environment "production" y riskLevel "critical"
CUANDO el provider evalúa el plan
ENTONCES decision es "deny" o "require_approval"
  Y    las violaciones incluyen "deployment.production_requires_approval"
```

### P3 — Despliegue con archivos críticos de infraestructura

**Journey:** el PR incluye cambios en `railway.json`, `Dockerfile` o `docker-compose`. El provider requiere aprobación `security` además de `ops_admin`/`dual_control`.

## 4. Entradas y Salidas

### Entrada `DeploymentProviderInput`

```typescript
export type DeploymentProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
  prPackage?: ForgePRPackage;
};
```

### Salida `ForgeDeploymentPlan`

```typescript
export type ForgeDeploymentPlan = {
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
2. Si `task.environment === "production"` y `task.riskLevel` es `high` o `critical` → `require_approval` (o `deny` si no hay aprobaciones en `prPackage`).
3. Si `prPackage` existe y `prPackage.decision === "deny"` → `decision: "deny"`.
4. Si `task.targetBranch` es `main` o `master` y `task.environment` no es `production` ni `staging` → `decision: "deny"`.
5. Si cambios críticos (`railway.json`, `Dockerfile*`, `docker-compose*`, `.github/workflows/**`) están en `prPackage.changedFiles` → añadir `security` a `requiredApprovals` y `require_approval`.
6. En cualquier otro caso → `decision: "allow"` con pasos `build`, `test`, `deploy-${environment}`, `verify`, `observe`.

## 6. Eventos

- `FORGE_DEPLOYMENT_PROPOSED`: emite `taskId`, `agentRunId`, `deploymentDecision`, `environment`, `targetBranch`, `stepCount`, `requiredApprovals`.
