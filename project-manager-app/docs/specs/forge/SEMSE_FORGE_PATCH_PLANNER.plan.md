---
type: plan
feature: "SEMSE Forge Patch Planner"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_PATCH_PLANNER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-patch-planner"
date: "2026-07-17"
---

# Plan Técnico: SEMSE Forge Patch Planner

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_PATCH_PLANNER.spec.md`

**Estrategia de implementación:** agregar un `PatchPlanner` puro en `packages/forge/src/patch-planner.ts` (`DryRunPatchPlanner` por defecto; `LivePatchPlanner` como stub explícito), invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` cuando `input.proposedFiles` esté presente, y persistir el plan en el payload del `AgentRun` para que `apps/api` lo use sin cambios de Prisma.

**Estimación de complejidad:** Media.

**Riesgo principal:** falso positivo en detección de archivos críticos o paths. Mitigación: reutilizar `matchesScope` ya probado y mantener la lista de archivos críticos explícita y pequeña.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** `FORGE_PATCH_PROPOSED` y `FORGE_VERIFICATION_COMPLETED` se emiten.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-patch-planner.test.mjs`.

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

Sin cambios de schema. El `ForgePatchPlan` se almacena como JSON dentro de `tasksJson` / `result.payload` existentes.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
├── applyTaskResult: emite FORGE_PATCH_PROPOSED cuando payload.patch existe
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `PatchPlanner`, `ProposedFileChange`, `ForgePatchPlan`, etc.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
// Eventos a emitir
FORGE_PATCH_PROPOSED: { taskId, agentRunId, patchDecision, mode: "dry-run" }
FORGE_VERIFICATION_COMPLETED: { taskId, agentRunId, policyDecision }
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [x] Crear rama `agent/forge-patch-planner` desde `origin/main`.
- [ ] Crear `packages/forge/src/patch-planner.ts` con tipos y `DryRunPatchPlanner`.
- [ ] Exportar patch planner desde `packages/forge/src/index.ts`.

### Fase 2 — Foundational
- [ ] Implementar validaciones de paths/scope/operación crítica.
- [ ] Integrar `createPatchPlanner` en `buildForge` (`packages/agents/src/runtime.ts`) después del sandbox cuando `input.proposedFiles` esté presente.
- [ ] Sobrescribir `policy` a `deny` o `require_approval` según el resultado del patch planner.

### Fase 3 — API Contract / Worker
- [ ] Emitir `FORGE_PATCH_PROPOSED` en `apps/api/src/modules/forge/forge.service.ts`.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-patch-planner.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir patch planner.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Actualizar `docs/foundation/EVENT_CATALOG.md`.
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.
- [ ] Crear reporte de sesión si aplica.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Path con `..` no detectado | baja | alto | validación explícita de `..` y `~`/`/` |
| Falso positivo en archivos críticos | media | medio | lista explícita y tests |
| Live mode habilitado accidentalmente | baja | alto | default `dry-run`; `LivePatchPlanner` lanza error |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
