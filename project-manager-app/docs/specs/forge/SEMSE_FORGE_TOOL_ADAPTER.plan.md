---
type: plan
feature: "SEMSE Forge Tool Adapter"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_TOOL_ADAPTER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-tool-adapter"
date: "2026-07-17"
---

# Plan Técnico: SEMSE Forge Tool Adapter

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_TOOL_ADAPTER.spec.md`

**Estrategia de implementación:** agregar un `ToolAdapter` puro en `packages/forge/src/tool-adapter.ts` (`DryRunToolAdapter` por defecto; `LiveToolAdapter` como stub), invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` después del patch planner, y persistir el plan en el payload del `AgentRun`.

**Estimación de complejidad:** Media.

**Riesgo principal:** mapa de acciones desactualizado respecto a `allowedTools`. Mitigación: mantener el mapa explícito en `tool-adapter.ts`, tests por acción y auditar violaciones.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** `FORGE_TOOLS_PLANNED` y `FORGE_VERIFICATION_COMPLETED` se emiten.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-tool-adapter.test.mjs`.

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

Sin cambios de schema. El `ForgeToolPlan` se almacena como JSON dentro de `result.payload` existente.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
├── applyTaskResult: emite FORGE_TOOLS_PLANNED cuando payload.toolPlan existe
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `ToolAdapter`, `ForgeToolPlan`, `ForgeToolName`, `ToolPlanEntry`.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
// Eventos a emitir
FORGE_TOOLS_PLANNED: { taskId, agentRunId, toolDecision, action }
FORGE_VERIFICATION_COMPLETED: { taskId, agentRunId, policyDecision }
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [x] Crear rama `agent/forge-tool-adapter` desde `origin/main`.
- [ ] Crear `packages/forge/src/tool-adapter.ts` con tipos y `DryRunToolAdapter`.
- [ ] Exportar tool adapter desde `packages/forge/src/index.ts`.

### Fase 2 — Foundational
- [ ] Definir mapa `ACTION_TO_TOOLS` de acciones semánticas a `ForgeToolName[]`.
- [ ] Implementar validación contra `manifest.allowedTools`.
- [ ] Marcar acciones críticas (`deployment.propose`, `migration.propose`, `schema.propose`, `security.review`) como `require_approval`.
- [ ] Integrar `createToolAdapter` en `buildForge` después del patch planner.

### Fase 3 — API Contract / Worker
- [ ] Emitir `FORGE_TOOLS_PLANNED` en `apps/api/src/modules/forge/forge.service.ts`.
- [ ] Añadir `FORGE_TOOLS_PLANNED` a `packages/forge/src/types.ts`.
- [ ] Actualizar `docs/foundation/EVENT_CATALOG.md`.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-tool-adapter.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir tool adapter.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Actualizar `docs/foundation/EVENT_CATALOG.md`.
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Acción no cubierta por el mapa | baja | medio | default a deny con violación `tool.action.unknown` |
| Herramienta crítica permitida accidentalmente | baja | alto | lista de acciones críticas explicita |
| Live mode habilitado accidentalmente | baja | alto | default `dry-run`; `LiveToolAdapter` lanza error |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
