---
id: semse-forge-verification-provider
title: "SEMSE Forge Verification Provider"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/verification-provider.ts
  - packages/forge/src/types.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-verification-provider.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_VERIFICATION_COMPLETED
related_agents:
  - qa-verifier
  - backend-builder
  - frontend-builder
  - security-reviewer
last_verified: 2026-07-18
---

# SPEC: SEMSE Forge Verification Provider

## 1. Qué resuelve

**Para quién:** agentes `qa-verifier` y builders de SEMSE Forge.

**Problema:** `buildForge` decide si una tarea es segura, pero no genera evidencia de verificación. El evento `FORGE_VERIFICATION_COMPLETED` se emite sin datos, y el estado `verifying` carece de una matriz de criterios verificables.

**Solución:** un `VerificationProvider` puro en `packages/forge` que, en modo `dry-run`, produce una `ForgeVerificationMatrix` a partir de los `acceptanceCriteria` de la tarea, el resultado del `PatchWriter` y el `ToolAdapter`. No ejecuta comandos reales. La ejecución real queda para una fase `live` futura.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `qa-verifier` | `QA` | evaluar criterios y generar matriz | modificar el plan |
| `backend-builder`, `frontend-builder` | `BUILDER` | proveer evidencia simulada | aprobarse a sí mismos |
| `security-reviewer` | `SECURITY` | añadir criterio de seguridad | saltarse approval |
| `forge-supervisor` | `PLATFORM` | revisar matriz de verificación | ejecutar sin plan |

## 3. Escenarios de Usuario

### V1 — Verificación exitosa de tarea de documentación

**Journey:** `documentation-curator` propone actualizar `docs/specs/forge/*.md`. El `PatchWriter` simula el cambio y el `VerificationProvider` genera una matriz con `spec` e `index` como `passed`.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con acceptanceCriteria [{ id: "ac-1", statement: "Spec must be indexed", verification: "pnpm spec:index", required: true }]
CUANDO el VerificationProvider.verify recibe el task y un patchResult allow
ENTONCES ForgeVerificationMatrix.items[0].status es "passed"
  Y    ForgeVerificationMatrix.passed es true
```

### V2 — Criterio de seguridad bloquea tarea crítica

**Journey:** `backend-builder` propone cambiar `packages/api/src/auth/controller.ts`. El `VerificationProvider` detecta un criterio de seguridad y, al no haber evidencia de revisión, lo marca como `failed`. La matriz indica `passed: false` y la run pasa a `blocked`.

**Criterio de aceptación:**
```
DADO   un task con acceptanceCriteria que incluye "security review"
CUANDO el verification provider no recibe evidencia de security-reviewer
ENTONCES el item correspondiente queda "failed"
  Y    la decisión de policy se propaga como "deny" si el criterio es required
```

## 4. FSM

No se introducen estados nuevos. El `verifying` guard se enriquece:

```
building → verifying
  guard: policy "allow", sandbox "allow", patch "allow", writer "allow"
  effect: FORGE_VERIFICATION_COMPLETED con matriz

verifying → ready_for_review
  guard: matrix.passed === true

verifying → blocked
  guard: matrix.passed === false y existe criterio required fallido
```

## 5. Contratos de API

```typescript
export interface VerificationProvider {
  verify(input: {
    task: ForgeTaskPacket;
    patchResult?: ForgePatchResult;
    toolPlan?: ForgeToolPlan;
  }): ForgeVerificationMatrix;
}

export function createVerificationProvider(config?: { mode?: "dry-run" | "live" }): VerificationProvider;
```

Reutiliza los tipos existentes:

```typescript
type ForgeVerificationItem = {
  id: string;
  command: string;
  required: boolean;
  status: "pending" | "passed" | "failed" | "skipped";
  evidence?: string;
};

type ForgeVerificationMatrix = {
  runId: string;
  items: ForgeVerificationItem[];
  passed: boolean;
  completedAt?: string;
};
```

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Cobertura de branches | ≥ 80% |
| `pnpm typecheck` | 0 errores |
| `pnpm test:unit` | 100% pass |
| `pnpm spec:validate:strict` | 0 errores nuevos |
| Ejecución real de comandos en dry-run | 0 |

## 7. Tests Requeridos

```typescript
describe("DryRunVerificationProvider") {
  it("pasa criterio 'spec:index' cuando patchResult es allow");
  it("falla criterio 'security.review' sin evidencia de security-reviewer");
  it("omite criterios opcionales no reconocidos (skipped)");
  it("falla matriz completa si un criterio required falla");
  it("live mode arroja not implemented");
}

describe("buildForge with verification") {
  it("incluye ForgeVerificationMatrix en el payload");
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

- `packages/forge` sigue siendo puro; `dry-run` no ejecuta `child_process` ni lee archivos.
- La matriz se genera a partir de `acceptanceCriteria` del task y del `patchResult`/`toolPlan`.
- Un criterio es considerado `required` si `required === true`.
- El proveedor `live` lanzará error hasta que se implemente ejecución real.

## 10. Checklist de aprobación

- [x] Escenarios V1 y V2 con criterios Given/When/Then.
- [x] Contrato `VerificationProvider` documentado.
- [x] FSM alineada con `STATE_MACHINES.md` (sin transiciones nuevas).
- [x] Tests listados antes de la implementación.
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada.
- [x] Spec agregado a `docs/SPEC_INDEX.md` vía `pnpm spec:index`.
- [x] Status cambiado a `APPROVED`.
