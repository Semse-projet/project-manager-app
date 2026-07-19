---
type: plan
feature: "SEMSE Forge Rollback Provider"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_ROLLBACK_PROVIDER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-rollback-provider"
date: "2026-07-17"
---

# Plan Técnico: SEMSE Forge Rollback Provider

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_ROLLBACK_PROVIDER.spec.md`

**Estrategia de implementación:** agregar `packages/forge/src/rollback-provider.ts` con `DryRunRollbackProvider` (por defecto) y un stub `LiveRollbackProvider`. Invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` cuando el `action` sea `rollback.prepare`, e incluir `rollback` en el payload. En `apps/api/src/modules/forge/forge.service.ts`, usar `rollback` para emitir `FORGE_ROLLBACK_PROPOSED` y transicionar `deployed`/`observing` → `rolled_back` tras aprobaciones.

**Estimación de complejidad:** Media.

**Riesgo principal:** generar un plan de rollback incompleto para producción. Mitigación: exigir aprobaciones `dual_control`/`security` y detectar archivos de datos/migraciones.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** Se emiten `FORGE_ROLLBACK_PROPOSED` y `FORGE_RUN_ROLLED_BACK`.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-rollback-provider.test.mjs`.

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

Sin cambios de schema. La `ForgeRollbackPlan` se almacena como JSON dentro de `result.payload`.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
└── applyTaskResult: emite FORGE_ROLLBACK_PROPOSED
└── decideApproval: transiciona deployed/observing → rolled_back cuando aprobaciones ok
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `ForgeRollbackPlan`, `RollbackProviderInput` y `createRollbackProvider`.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
FORGE_ROLLBACK_PROPOSED: { taskId, agentRunId, rollbackDecision, environment, targetBranch, stepCount, requiredApprovals }
FORGE_RUN_ROLLED_BACK: ya existe en el harness, se reusa para la transición final
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [ ] Crear rama `agent/forge-rollback-provider` desde `origin/main`.
- [ ] Crear `packages/forge/src/rollback-provider.ts` con tipos y `DryRunRollbackProvider`.
- [ ] Añadir `ForgeRollbackPlan` a `packages/forge/src/types.ts`.
- [ ] Exportar `RollbackProvider`, `RollbackProviderInput`, `ForgeRollbackPlan` y `createRollbackProvider` desde `packages/forge/src/index.ts`.

### Fase 2 — Lógica de planificación
- [ ] Si `policy.decision === "deny"` → `decision: "deny"`.
- [ ] Si `deploymentPlan?.decision === "deny"` → `decision: "deny"`.
- [ ] Validar entorno permitido: `local`, `ci`, `staging`, `production`.
- [ ] Si `environment === "production"` y `riskLevel` es `high`/`critical` → `require_approval` y `dual_control`.
- [ ] Si `environment === "production"` y `targetBranch` no es `main`/`master` → `deny`.
- [ ] Detectar archivos de datos en `task.allowedFiles`: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/**`, `**/*.sql`.
- [ ] Añadir `security` a `requiredApprovals` si hay archivos de datos.
- [ ] Generar `steps`: `identify_previous_release`, `backup_state`, `restore_release`, `verify_health`, `observe`.
- [ ] `LiveRollbackProvider` lanza "Live rollback is not implemented in this phase. Use mode 'dry-run'."

### Fase 3 — API Contract / Worker
- [ ] Integrar `createRollbackProvider({ mode: "dry-run" })` en `buildForge` para `action === "rollback.prepare"`.
- [ ] Añadir `rollback` al payload de `buildForge`.
- [ ] En `ForgeService.applyTaskResult`, extraer `payload.rollback`.
- [ ] Emitir `FORGE_ROLLBACK_PROPOSED` con detalle seguro.
- [ ] Calcular `nextState` hacia `rolled_back` solo si `current.state` es `deployed` u `observing`, `rollback.decision` no es `deny` y todas sus aprobaciones están satisfechas.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-rollback-provider.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir `payload.rollback`.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Añadir `forge.rollback.proposed` a `docs/foundation/EVENT_CATALOG.md`.
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Rollback planificado para entorno no autorizado | baja | alto | validar entorno y rama |
| Rollback de producción sin aprobaciones | baja | alto | `dual_control` obligatorio para high/critical |
| Rollback de migraciones sin respaldo de datos | media | alto | detectar archivos db y requerir `security` |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
