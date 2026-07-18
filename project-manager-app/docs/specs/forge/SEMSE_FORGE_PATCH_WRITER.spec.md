---
id: semse-forge-patch-writer
title: "SEMSE Forge Patch Writer"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/patch-writer.ts
  - packages/forge/src/patch-planner.ts
  - packages/forge/src/types.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-patch-writer.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_PATCH_SIMULATED
  - FORGE_VERIFICATION_COMPLETED
related_agents:
  - backend-builder
  - frontend-builder
  - documentation-curator
  - qa-verifier
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Patch Writer

## 1. Qué resuelve

**Para quién:** agentes de SEMSE Forge que proponen cambios de archivos.

**Problema:** el `PatchPlanner` valida que un conjunto de cambios es seguro, pero no simula el resultado de aplicarlos. Sin una simulación previa, un agente podría proponer múltiples cambios en el mismo archivo, generar contenido ilegal o intentar actualizar un archivo que no tiene contenido ni diff.

**Solución:** un `PatchWriter` puro en `packages/forge` que, en modo `dry-run`, simula la aplicación de un `ForgePatchPlan` ya aprobado. Produce un `ForgePatchResult` con el contenido resultante de cada archivo, detecta conflictos entre cambios y nunca escribe en el filesystem. La escritura real se deja para una fase `live` futura.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `backend-builder`, `frontend-builder` | agente Forge | simular cambios dentro de su scope | aplicar cambios reales |
| `qa-verifier` | `QA` | revisar resultados simulados | modificar el plan |
| `forge-supervisor` | `PLATFORM` | revisar trazas de simulación | ejecutar sin plan aprobado |

## 3. Escenarios de Usuario

### P1 — Simulación de patch exitosa

**Journey:** el `backend-builder` propone crear `packages/api/src/modules/forge/controller.ts` y actualizar `packages/api/src/modules/forge/service.ts`. El `PatchPlanner` aprueba el plan y el `DryRunPatchWriter` simula ambos cambios, devolviendo el contenido final de cada archivo y sin detectar conflictos.

**Criterio de aceptación:**
```
DADO   un ForgePatchPlan con decision "allow" y cambios en paths distintos
CUANDO el runtime invoca createPatchWriter({ mode: "dry-run" }).apply(plan)
ENTONCES el ForgePatchResult tiene decision "allow"
  Y    cada resultado contiene el contenido simulado del archivo
  Y    no hay violaciones
```

**Casos borde:**
- patch plan vacío: result `allow` vacío.
- create sin `content` ni `diff`: deniega con `patch.missing_content`.
- update con `content`: resultado igual a `content`.
- delete: resultado `null`.

**Errores esperados:**
- `deny` si el plan original no es `allow`.
- `deny` si dos cambios afectan el mismo path.
- `deny` si una operación `update` o `create` no tiene `content` ni `diff`.

### P2 — Conflicto entre cambios es bloqueado

**Journey:** el agente propone dos actualizaciones distintas para `packages/api/src/modules/forge/controller.ts`. El writer detecta el conflicto y deniega la simulación.

**Criterio de aceptación:**
```
DADO   un ForgePatchPlan con dos cambios sobre el mismo path
CUANDO el patch writer simula la aplicación
ENTONCES la decisión es "deny"
  Y    el payload de FORGE_VERIFICATION_COMPLETED incluye policyDecision "deny"
```

## 4. FSM

No se introducen nuevos estados. El patch writer actúa como guarda dentro de `building` → `verifying`:

```
building → verifying
  guard: policy "allow", sandbox "allow", patch "allow", writer "allow"
  effect: FORGE_PATCH_SIMULATED, FORGE_VERIFICATION_COMPLETED

building → blocked
  guard: writer "deny"
  effect: FORGE_RUN_BLOCKED
```

## 5. Contratos de API

No endpoints REST nuevos. El patch writer se invoca internamente desde `buildForge` (`agentType: "forge"`) y se expone en el payload del `AgentRun`.

**PatchWriter (TypeScript):**

```typescript
export type PatchResultEntry = {
  path: string;
  operation: PatchOperation;
  previousContent?: string;
  newContent?: string;
  applied: boolean;
  violations: string[];
};

export type ForgePatchResult = {
  mode: "dry-run" | "live";
  decision: "allow" | "deny";
  reason: string;
  results: PatchResultEntry[];
  violations: string[];
  auditTags: string[];
};

export interface PatchWriter {
  apply(plan: ForgePatchPlan): ForgePatchResult;
}

export function createPatchWriter(config?: { mode?: "dry-run" | "live" }): PatchWriter;
```

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Cobertura de branches del writer | ≥ 80% |
| Validación `pnpm spec:validate` | 0 errores nuevos |
| `pnpm typecheck` | 0 errores |
| Tests unitarios afectados | 100% pass |
| Escrituras reales en dry-run | 0 |

## 7. Tests Requeridos

```typescript
describe("DryRunPatchWriter") {
  it("simula un create con content");
  it("simula un update con content");
  it("simula un delete");
  it("deniega si el plan no es allow");
  it("deniega si hay dos cambios en el mismo path");
  it("deniega create/update sin content ni diff");
  it("permite plan vacío");
}

describe("buildForge with patch writer") {
  it("incluye ForgePatchResult en el payload cuando el plan es allow");
}
```

## 8. Impacto en otros dominios

| Dominio | Impacto | Acción requerida |
|---------|---------|-----------------|
| Escrow/Payments | no | — |
| Evidence | no | — |
| Prometeo RAG | no | — |
| SSE/Real-time | no | — |
| WhatsApp/Comms | no | — |
| Consciousness | no | — |
| BuildOps | no | — |

## 9. Supuestos y Dependencias

- `packages/forge` sigue siendo puro; el writer `dry-run` no accede a `node:fs`.
- El `PatchWriter` consume la salida del `PatchPlanner`; no revalida scopes (eso es responsabilidad del planner).
- La aplicación real de parches (`live`) requiere un proveedor futuro y no se implementa en esta fase.
- El writer se invoca desde `buildForge` cuando `patchPlan.decision === "allow"`.

## 10. Checklist de aprobación

- [x] Escenarios P1 y P2 tienen criterio de aceptación Given/When/Then.
- [x] Contrato `PatchWriter` documentado.
- [x] FSM alineada con `STATE_MACHINES.md` (sin transiciones nuevas).
- [x] Tests listados antes de la implementación.
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada.
- [x] Spec agregado a `docs/SPEC_INDEX.md` vía `pnpm spec:index`.
- [x] Status cambiado a `APPROVED`.
