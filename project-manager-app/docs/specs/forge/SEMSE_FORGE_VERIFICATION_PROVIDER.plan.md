---
type: plan
feature: "SEMSE Forge Verification Provider"
domain: forge
spec: "docs/specs/forge/SEMSE_FORGE_VERIFICATION_PROVIDER.spec.md"
version: "1.0"
status: APPROVED
branch: "agent/forge-verification-provider"
date: "2026-07-18"
---

# Plan Técnico: SEMSE Forge Verification Provider

## 1. Resumen Técnico

**Spec referenciado:** `docs/specs/forge/SEMSE_FORGE_VERIFICATION_PROVIDER.spec.md`

**Estrategia de implementación:** agregar `packages/forge/src/verification-provider.ts` con `DryRunVerificationProvider` (por defecto) y un stub `LiveVerificationProvider`. Invocarlo desde `buildForge` en `packages/agents/src/runtime.ts` cuando el `patchResult` es `allow` (o cuando no hay parches pero la política es `allow`). Incluir la matriz en el payload y enriquecer el evento `FORGE_VERIFICATION_COMPLETED` en `apps/api/src/modules/forge/forge.service.ts`.

**Estimación de complejidad:** Baja.

**Riesgo principal:** simulación demasiado permisiva. Mitigación: mapear criterios conocidos y fallar criterios de seguridad sin evidencia; nunca asumir `passed` para criterios no reconocidos si son `required`.

## 2. Constitution Check

- [x] **P1 — Spec primero:** El spec está `APPROVED`.
- [x] **P2 — Evidencia primero:** No hay pagos.
- [x] **P3 — Audit Log:** `FORGE_VERIFICATION_COMPLETED` se enriquece con la matriz.
- [x] **P4 — Privacidad local:** No se envían datos a modelos cloud.
- [x] **P5 — Tests antes del código:** Tests listados en spec y creados en `tests/unit/forge-verification-provider.test.mjs`.

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

Sin cambios de schema. La `ForgeVerificationMatrix` se almacena como JSON dentro de `result.payload`.

## 5. Módulos NestJS

### Módulo existente modificado: `ForgeModule`

```
apps/api/src/modules/forge/forge.service.ts
└── applyTaskResult: enriquece FORGE_VERIFICATION_COMPLETED con { passed, itemCount, failedCount, requiredFailed }
```

## 6. Schemas (packages/schemas)

Sin cambios. `packages/forge` exporta los tipos `VerificationProvider` y `createVerificationProvider`.

## 7. Frontend

No aplica.

## 8. Eventos y SSE

```typescript
// Evento existente enriquecido
FORGE_VERIFICATION_COMPLETED: { taskId, agentRunId, policyDecision, passed, itemCount, failedCount }
```

## 9. Fases de Implementación

### Fase 1 — Setup
- [x] Crear rama `agent/forge-verification-provider` desde `origin/main`.
- [ ] Crear `packages/forge/src/verification-provider.ts` con tipos y `DryRunVerificationProvider`.
- [ ] Exportar `VerificationProvider` y `createVerificationProvider` desde `packages/forge/src/index.ts`.

### Fase 2 — Foundational
- [ ] Mapear criterios por palabras clave: `spec`, `index`, `typecheck`, `test`, `lint`, `security`, `build`.
- [ ] `spec`/`index` → `passed` si `patchResult.decision === "allow"`.
- [ ] `typecheck`/`test`/`lint`/`build` → `passed` si el plan incluye `command.run` y el patch es allow.
- [ ] `security` → `failed` si no hay `security-reviewer` en el contexto.
- [ ] Criterios no reconocidos y `required === false` → `skipped`.
- [ ] Criterios no reconocidos y `required === true` → `failed`.
- [ ] `LiveVerificationProvider` lanza "not implemented".

### Fase 3 — API Contract / Worker
- [ ] Integrar `createVerificationProvider({ mode: "dry-run" })` en `buildForge`.
- [ ] Añadir `verification` al payload de `buildForge`.
- [ ] En `ForgeService.applyTaskResult`, extraer `payload.verification` y enriquecer `FORGE_VERIFICATION_COMPLETED`.
- [ ] Si `verification.passed === false` y hay criterios `required` fallidos, forzar `policy.decision = "deny"`.

### Fase 4 — Tests
- [ ] Crear `tests/unit/forge-verification-provider.test.mjs`.
- [ ] Actualizar `tests/unit/forge-runtime-integration.test.mjs` para cubrir `payload.verification`.
- [ ] Correr `pnpm --filter @semse/forge build`, `pnpm --filter @semse/agents build`, `pnpm typecheck`, `pnpm test:unit`.

### Fase 5 — Polish
- [ ] Actualizar `docs/foundation/EVENT_CATALOG.md` si es necesario (el evento ya existe).
- [ ] Ejecutar `pnpm spec:index` y `pnpm spec:validate`.

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Heurística de criterios demasiado permisiva | media | medio | default `failed` para criterios required no reconocidos; `skipped` para opcionales |
| Live mode habilitado accidentalmente | baja | alto | default `dry-run`; `LiveVerificationProvider` lanza error |

## Checklist antes de merge

- [ ] `pnpm typecheck` sin errores.
- [ ] `pnpm test:unit` sin errores.
- [ ] `pnpm spec:validate:strict` sin errores nuevos.
- [ ] `pnpm lint` sin errores.
- [ ] `SPEC_INDEX.md` regenerado.
