---
type: plan
feature: "SEMSE Forge Patch Writer"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_PATCH_WRITER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-patch-writer"
date: "2026-07-17"
---

# Plan Técnico: SEMSE Forge Patch Writer

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_PATCH_WRITER.spec.md`

**Estrategia de implementación:** agregar un `PatchWriter` puro en `packages/forge/src/patch-writer.ts` (`DryRunPatchWriter` por defecto; `LivePatchWriter` como stub), invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` cuando `patchPlan.decision === "allow"`, y persistir el resultado en el payload del `AgentRun`.

**Estimación de complejidad:** Baja.

**Riesgo principal:** simulación inconsistente con escritura real futura. Mitigación: mantener la simulación simple y documentar que `diff` complejos requieren parser de unificación futuro.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** `FORGE_PATCH_SIMULATED` y `FORGE_VERIFICATION_COMPLETED` se emiten.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-patch-writer.test.mjs`.

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

Sin cambios de schema. El `ForgePatchResult` se almacena como JSON dentro de `result.payload` existente.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
├── applyTaskResult: emite FORGE_PATCH_SIMULATED cuando payload.patchResult existe
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `PatchWriter`, `ForgePatchResult`, `PatchResultEntry`.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
// Eventos a emitir
FORGE_PATCH_SIMULATED: { taskId, agentRunId, patchResultDecision }
FORGE_VERIFICATION_COMPLETED: { taskId, agentRunId, policyDecision }
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [x] Crear rama `agent/forge-patch-writer` desde `origin/main`.
- [ ] Crear `packages/forge/src/patch-writer.ts` con tipos y `DryRunPatchWriter`.
- [ ] Exportar patch writer desde `packages/forge/src/index.ts`.

### Fase 2 — Foundational
- [ ] Implementar simulación de create/update/delete.
- [ ] Detectar cambios duplicados sobre el mismo path.
- [ ] Denegar plan que no sea `allow` o cambios sin contenido.

### Fase 3 — API Contract / Worker
- [ ] Integrar `createPatchWriter` en `buildForge` después del patch planner.
- [ ] Emitir `FORGE_PATCH_SIMULATED` en `apps/api/src/modules/forge/forge.service.ts`.
- [ ] Añadir `FORGE_PATCH_SIMULATED` a `packages/forge/src/types.ts`.
- [ ] Actualizar `docs/foundation/EVENT_CATALOG.md`.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-patch-writer.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir patch writer.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Actualizar `docs/foundation/EVENT_CATALOG.md`.
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Diff sin parser realista | baja | medio | documentar que `diff` en dry-run se trata como `content` fallback |
| Live mode habilitado accidentalmente | baja | alto | default `dry-run`; `LivePatchWriter` lanza error |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
