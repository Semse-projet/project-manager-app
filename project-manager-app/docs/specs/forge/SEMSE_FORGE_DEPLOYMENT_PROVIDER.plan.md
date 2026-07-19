---
type: plan
feature: "SEMSE Forge Deployment Provider"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_DEPLOYMENT_PROVIDER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-deployment-provider"
date: "2026-07-17"
---

# Plan Técnico: SEMSE Forge Deployment Provider

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_DEPLOYMENT_PROVIDER.spec.md`

**Estrategia de implementación:** agregar `packages/forge/src/deployment-provider.ts` con `DryRunDeploymentProvider` (por defecto) y un stub `LiveDeploymentProvider`. Invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` cuando el `action` sea `deployment.propose` (o `rollback.prepare`/`ci.implement`), e incluir `deployment` en el payload. En `apps/api/src/modules/forge/forge.service.ts`, usar `deployment` para emitir `FORGE_DEPLOYMENT_PLANNED`.

**Estimación de complejidad:** Media.

**Riesgo principal:** generar un plan de despliegue para un entorno no autorizado. Mitigación: denegar entornos desconocidos, forzar `require_approval` para production, y añadir `security` si hay archivos críticos.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** Se emite `FORGE_DEPLOYMENT_PLANNED`.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-deployment-provider.test.mjs`.

## 3. Stack Técnico Afectado

```yaml
backend:
  framework: NestJS
  módulos_afectados:
    - apps/api/src/modules/forge/forge.service.ts
  schemas_afectados: []
  prisma_cambios: no

frontend:
  framework: Next.js
  páginas_afectadas: []
  componentes_nuevos: []

workers:
  bullmq_jobs: no
  jobs_nuevos: []

infraestructura:
  railway: no cambios
  variables_nuevas: []
  ollama: no
```

## 4. Cambios en Base de Datos

Sin cambios de schema. La `ForgeDeploymentPlan` se almacena como JSON dentro de `result.payload`.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
└── applyTaskResult: emite FORGE_DEPLOYMENT_PLANNED cuando payload.deployment existe
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `ForgeDeploymentPlan`, `DeploymentProviderInput` y `createDeploymentProvider`.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
FORGE_DEPLOYMENT_PROPOSED: { taskId, agentRunId, deploymentDecision, environment, targetBranch, stepCount, requiredApprovals }
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [ ] Crear rama `agent/forge-deployment-provider` desde `origin/main`.
- [ ] Crear `packages/forge/src/deployment-provider.ts` con tipos y `DryRunDeploymentProvider`.
- [ ] Añadir `ForgeDeploymentPlan` a `packages/forge/src/types.ts`.
- [ ] Exportar `DeploymentProvider`, `DeploymentProviderInput`, `ForgeDeploymentPlan` y `createDeploymentProvider` desde `packages/forge/src/index.ts`.

### Fase 2 — Lógica de planificación
- [ ] Si `policy.decision === "deny"` → `decision: "deny"`.
- [ ] Si `prPackage?.decision === "deny"` → `decision: "deny"`.
- [ ] Validar entorno permitido: `local`, `ci`, `staging`, `production`.
- [ ] Si `environment === "production"` y `riskLevel` es `high`/`critical` → `require_approval`.
- [ ] Si `targetBranch` no es `main`/`master` y entorno no es `staging`/`production` → `deny`.
- [ ] Detectar archivos críticos en `prPackage?.changedFiles` o `task.allowedFiles`: `railway.json`, `Dockerfile*`, `docker-compose*`, `.github/workflows/**`.
- [ ] Añadir `security` a `requiredApprovals` si hay archivos críticos.
- [ ] Generar `steps` según entorno: `build`, `test`, `deploy-{env}`, `verify`, `observe`.
- [ ] `LiveDeploymentProvider` lanza "Live deployment is not implemented in this phase. Use mode 'dry-run'."

### Fase 3 — API Contract / Worker
- [ ] Integrar `createDeploymentProvider({ mode: "dry-run" })` en `buildForge` para acciones `deployment.propose`, `rollback.prepare` y `ci.implement`.
- [ ] Añadir `deployment` al payload de `buildForge`.
- [ ] En `ForgeService.applyTaskResult`, extraer `payload.deployment`.
- [ ] Emitir `FORGE_DEPLOYMENT_PROPOSED` con detalle seguro.
- [ ] Calcular `nextState` hacia `deployed` solo si `current.state === "merged"`, `deployment.decision === "allow"` y no hay aprobaciones pendientes.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-deployment-provider.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir `payload.deployment`.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Añadir `forge.deployment.proposed` a `docs/foundation/EVENT_CATALOG.md`.
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Plan generado para entorno no autorizado | baja | alto | validar entorno contra allowlist |
| Despliegue a producción sin aprobaciones | baja | alto | forzar `require_approval` y aprobación `dual_control` |
| Cambios críticos de infra sin aprobación `security` | media | alto | detectar `railway.json`, Dockerfiles, workflows |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
