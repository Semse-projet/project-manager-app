---
type: plan
feature: "SEMSE Forge PR Package Provider"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_PR_PACKAGE_PROVIDER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-pr-package-provider"
date: "2026-07-18"
---

# Plan Técnico: SEMSE Forge PR Package Provider

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_PR_PACKAGE_PROVIDER.spec.md`

**Estrategia de implementación:** agregar `packages/forge/src/pr-package.ts` con `DryRunPRPackageProvider` (por defecto) y un stub `LivePRPackageProvider`. Invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` después del `VerificationProvider`, cuando `patchResult` es `allow` y `verification` es `passed`, e incluir `prPackage` en el payload. En `apps/api/src/modules/forge/forge.service.ts`, usar `prPackage` para emitir `FORGE_PR_READY` y calcular la transición de estado hacia `ready_for_review`.

**Estimación de complejidad:** Media.

**Riesgo principal:** ensamblar un paquete inválido que luego se interprete como listo para merge. Mitigación: denegar si `targetBranch` es `main`, si `policy`/`patchResult`/`verification` no permiten avanzar, y marcar `draft` para tareas high/critical.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** Se emiten `FORGE_PR_READY` y `FORGE_RUN_BLOCKED`.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-pr-package.test.mjs`.

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

Sin cambios de schema. La `ForgePRPackage` se almacena como JSON dentro de `result.payload`.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
└── applyTaskResult: emite FORGE_PR_READY y transiciona building → verifying → ready_for_review
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `ForgePRPackage`, `PRPackageProviderInput` y `createPRPackageProvider`.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
// Evento existente en types.ts; se añade al EVENT_CATALOG.md
FORGE_PR_READY: { taskId, agentRunId, prPackageDecision, headBranch, baseBranch, changedFileCount }
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [ ] Crear rama `agent/forge-pr-package-provider` desde `origin/main`.
- [ ] Crear `packages/forge/src/pr-package.ts` con tipos y `DryRunPRPackageProvider`.
- [ ] Exportar `PRPackageProvider`, `PRPackageProviderInput`, `ForgePRPackage` y `createPRPackageProvider` desde `packages/forge/src/index.ts`.
- [ ] Añadir `ForgePRPackage` a `packages/forge/src/types.ts`.

### Fase 2 — Lógica de ensamblado
- [ ] Si `policy.decision === "deny"` → `decision: "deny"` con `violations: ["pr.policy.denied"]`.
- [ ] Si `patchResult` no existe o `decision !== "allow"` → `decision: "deny"` con `violations: ["pr.patch.not_allowed"]`.
- [ ] Si `verification` no existe o `passed !== true` → `decision: "deny"` con `violations: ["pr.verification.failed"]`.
- [ ] Si `task.targetBranch` es `main` o `master` → `decision: "deny"` con `violations: ["pr.target_branch.is_default"]`.
- [ ] Si `task.forbiddenFiles` intersecta `patchResult.results` → `decision: "deny"` con `violations` concretas.
- [ ] `headBranch` = `task.targetBranch`; `baseBranch` = `task.metadata?.baseBranch ?? "main"`.
- [ ] `title` = `[{domain}] {task.title}` o inferido de `task.objective`.
- [ ] `body` = markdown con spec, objective, risk, verification summary, changed files y approvals.
- [ ] `commits` = commit atómico con todos los archivos changed.
- [ ] `changedFiles` = paths de `patchResult.results` filtrados por `applied`.
- [ ] `reviewers` = `[manifest.owner]` si existe; para critical/high añadir `ops_admin`.
- [ ] `labels` = `["forge", task.requestedRole, task.riskLevel]`.
- [ ] `draft` = `task.riskLevel === "high" || task.riskLevel === "critical"`.
- [ ] `checklist` = items de trazabilidad, tests, typecheck, spec, approvals.
- [ ] `requiredApprovals` = `policy.requiredApprovals`.
- [ ] `decision` = `policy.decision` si todo lo anterior es `allow`; por defecto `allow`.
- [ ] `LivePRPackageProvider` lanza "Live PR creation is not implemented in this phase. Use mode 'dry-run'."

### Fase 3 — API Contract / Worker
- [ ] Integrar `createPRPackageProvider({ mode: "dry-run" })` en `buildForge` después del verification provider.
- [ ] Añadir `prPackage` al payload de `buildForge`.
- [ ] En `ForgeService.applyTaskResult`, extraer `payload.prPackage`.
- [ ] Emitir `FORGE_PR_READY` con detalle seguro.
- [ ] Calcular `nextState` considerando `building → verifying → ready_for_review` cuando `prPackage` no es `deny`.
- [ ] Si `prPackage.decision === "deny"`, forzar `nextState = "blocked"`.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-pr-package.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir `payload.prPackage`.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Añadir `forge.pr.ready` a `docs/foundation/EVENT_CATALOG.md`.
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Paquete generado para rama prohibida | baja | alto | denegar `targetBranch` main/master |
| Paquete `allow` aunque faltan aprobaciones | media | medio | `decision` hereda `policy.decision`; `requiredApprovals` se copia |
| Body de PR con información sensible | baja | medio | sólo usar campos públicos del task/spec |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
