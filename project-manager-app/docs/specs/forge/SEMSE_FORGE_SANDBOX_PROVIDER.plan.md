---
type: plan
feature: "SEMSE Forge Sandbox Provider"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_SANDBOX_PROVIDER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-sandbox-provider"
date: "2026-07-17"
---

# Plan Técnico: SEMSE Forge Sandbox Provider

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_SANDBOX_PROVIDER.spec.md`

**Estrategia de implementación:** agregar un `SandboxProvider` puro en `packages/forge/src/sandbox.ts` (`DryRunSandboxProvider` por defecto; `LiveSandboxProvider` como stub explícito), invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` después de `evaluateForgePolicy`, y persistir el plan en el payload del `AgentRun` para que `apps/api` y `apps/worker` lo usen sin cambios de Prisma.

**Estimación de complejidad:** Media.

**Riesgo principal:** parseo incorrecto de comandos o falso positivo en path-like tokens. Mitigación: tests unitarios extensivos y parser simple de comillas/espacios.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** `FORGE_SANDBOX_PLANNED` y `FORGE_VERIFICATION_COMPLETED` se emiten.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-sandbox.test.mjs`.

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
  variables_nuevas:
    - SEMSE_FORGE_SANDBOX_MODE (opcional, default "dry-run")
  ollama: no
```

## 4. Cambios en Base de Datos

Sin cambios de schema. El `SandboxPlan` se almacena como JSON dentro de `tasksJson` / `result.payload` existentes.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
├── applyTaskResult: emite FORGE_SANDBOX_PLANNED cuando payload.sandbox existe
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `SandboxProvider`, `SandboxPlan` y `SandboxCommand`.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
// Eventos a emitir
FORGE_SANDBOX_PLANNED: { taskId, agentRunId, sandboxDecision, mode: "dry-run" }
FORGE_VERIFICATION_COMPLETED: { taskId, agentRunId, policyDecision }
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [x] Crear rama `agent/forge-sandbox-provider`.
- [ ] Crear `packages/forge/src/sandbox.ts` con tipos y `DryRunSandboxProvider`.
- [ ] Exportar sandbox desde `packages/forge/src/index.ts`.

### Fase 2 — Foundational
- [ ] Implementar parser y validaciones de comandos/paths.
- [ ] Integrar `createSandboxProvider` en `buildForge` (`packages/agents/src/runtime.ts`).
- [ ] Ajustar `buildForge` para inferir `action` semántico vs shell (`allowedCommands[0]` si coincide con `manifest.allowedActions`, sino `runtime.execute`).
- [ ] Agregar `runtime.execute` a `allowedActions` de todos los manifests en `packages/forge/src/registry.ts`.

### Fase 3 — API Contract / Worker
- [ ] Ajustar `apps/worker/src/agent-run-handlers.mjs` si es necesario (no se espera cambio funcional).
- [ ] Emitir `FORGE_SANDBOX_PLANNED` en `apps/api/src/modules/forge/forge.service.ts`.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-sandbox.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir sandbox.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Actualizar `docs/foundation/EVENT_CATALOG.md`.
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.
- [ ] Crear reporte de sesión si aplica.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Falso positivo en scoped packages | media | medio | regex explícita `^@[^/]+/` |
| Comando destructivo no detectado | baja | alto | allowlist de programas riesgosos y `require_approval` |
| Live mode habilitado accidentalmente | baja | alto | default `dry-run`; `LiveSandboxProvider` lanza error explícito |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
