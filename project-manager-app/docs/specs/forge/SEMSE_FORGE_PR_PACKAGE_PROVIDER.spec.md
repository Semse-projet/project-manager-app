---
id: semse-forge-pr-package-provider
title: "SEMSE Forge PR Package Provider"
domain: forge
status: APPROVED
owner: semse-core
risk: medium
related_files:
  - packages/forge/src/pr-package.ts
  - packages/forge/src/types.ts
  - packages/forge/src/index.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-pr-package.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_PR_READY
  - FORGE_VERIFICATION_COMPLETED
  - FORGE_RUN_BLOCKED
related_agents:
  - backend-builder
  - frontend-builder
  - documentation-curator
  - forge-supervisor
  - governance-auditor
last_verified: 2026-07-18
---

# SPEC: SEMSE Forge PR Package Provider

## 1. Qué resuelve

**Para quién:** agentes de SEMSE Forge que completan una tarea de implementación y deben proponer integración vía pull request.

**Problema:** después de que `DryRunPatchWriter` y `DryRunVerificationProvider` aprueban un cambio, el run de Forge necesita un paquete de PR listo para revisión humana. Sin un ensamblador puro, la trazabilidad spec → diff → test → PR body queda dispersa y el supervisor no puede validar que la propuesta cumple las guardas de rama y scope antes de crear un PR real.

**Solución:** un `PRPackageProvider` puro en `packages/forge` que, en modo `dry-run`, ensambla una `ForgePRPackage` a partir del `ForgeTaskPacket`, la política, el parche simulado y la matriz de verificación. Define título, cuerpo, rama base, rama head, commits propuestos, reviewers, etiquetas, checklist y aprobaciones requeridas. No crea ramas ni PRs reales; la creación real se deja para una fase `live` futura.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `backend-builder`, `frontend-builder` | agente Forge | ensamblar paquete dentro de su scope | crear PRs o ramas reales |
| `documentation-curator` | documentación | ensamblar paquetes de specs/ADRs | modificar código fuera de `docs/**` |
| `forge-supervisor` | PLATFORM | revisar paquetes propuestos | forzar merge sin aprobación |
| `governance-auditor` | GOVERNANCE | verificar trazabilidad y aprobaciones | ejecutar cambios |

## 3. Escenarios de Usuario

### P1 — Paquete de PR exitoso

**Journey:** el `backend-builder` propone crear `packages/api/src/modules/forge/controller.ts`. El sandbox, patch planner, tool adapter, patch writer y verification provider validan el cambio. El `PRPackageProvider` ensambla un paquete con título, body, rama `main` <- `agent/forge-run-abc`, commit atómico y checklist de verificación.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con targetBranch distinto de main,
       un patchResult allow con cambios simulados,
       una verification matrix passed
CUANDO el runtime invoca createPRPackageProvider({ mode: "dry-run" }).assemble(input)
ENTONCES el ForgePRPackage tiene decision "allow"
  Y    el body incluye el specId, el objective y el resumen de verificación
  Y    changedFiles contiene los paths del patchResult
  Y    draft es false para riesgo low/medium
  Y    las aprobaciones requeridas coinciden con policy.requiredApprovals
```

**Casos borde:**
- tarea de riesgo high: draft = true.
- tarea de riesgo critical: draft = true y se añade `ops_admin` a reviewers si no está.
- patch vacío: decision "allow" pero changedFiles vacío (no hay cambios que proponer).
- no hay verification matrix: no se genera paquete.

### P2 — Propuesta bloqueada por rama prohibida

**Journey:** un agente intenta ensamblar un paquete cuyo `targetBranch` es `main`. El provider deniega la propuesta porque Forge nunca escribe directamente a la rama por defecto.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con targetBranch "main"
CUANDO el PR Package Provider ensambla el paquete
ENTONCES la decision es "deny"
  Y    las violaciones incluyen "pr.target_branch.is_default"
```

### P3 — PR requiere aprobación antes de merge

**Journey:** una tarea high-risk pasa todas las verificaciones, pero la política exige `ops_admin`. El paquete se genera con `decision = "require_approval"`, draft = true y `requiredApprovals` listados.

**Criterio de aceptación:**
```
DADO   un patch allow y verification passed
  Y    policy.requiredApprovals contiene "ops_admin"
CUANDO se ensambla el paquete
ENTONCES la decision es "require_approval"
  Y    draft es true
  Y    el body incluye la sección de aprobaciones requeridas
```

## 4. FSM

No se introducen nuevos estados. El PR Package Provider actúa como guarda de salida de `verifying`:

```
verifying → ready_for_review
  guard: policy "allow" o "require_approval", patchResult allow, verification passed, targetBranch != main
  effect: FORGE_PR_READY

verifying → blocked
  guard: prPackage decision "deny"
  effect: FORGE_RUN_BLOCKED
```

## 5. Contratos de API

No endpoints REST nuevos. El provider se invoca internamente desde `buildForge` (`agentType: "forge"`) y se expone en el payload del `AgentRun`.

**PRPackageProvider (TypeScript):**

```typescript
export type ForgePRPackage = {
  mode: "dry-run" | "live";
  decision: "allow" | "deny" | "require_approval";
  reason: string;
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  commits: Array<{
    message: string;
    files: string[];
    body?: string;
  }>;
  changedFiles: string[];
  reviewers: string[];
  labels: string[];
  draft: boolean;
  checklist: string[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export type PRPackageProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
  patchResult?: ForgePatchResult;
  verification?: ForgeVerificationMatrix;
  toolPlan?: ForgeToolPlan;
};

export interface PRPackageProvider {
  assemble(input: PRPackageProviderInput): ForgePRPackage;
}

export function createPRPackageProvider(config?: { mode?: "dry-run" | "live" }): PRPackageProvider;
```

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Cobertura de branches del provider | ≥ 80% |
| Validación `pnpm spec:validate` | 0 errores nuevos |
| `pnpm typecheck` | 0 errores |
| Tests unitarios afectados | 100% pass |
| PRs reales creados en dry-run | 0 |

## 7. Tests Requeridos

```typescript
describe("DryRunPRPackageProvider") {
  it("ensambla paquete allow con datos completos");
  it("deniega si targetBranch es main");
  it("deniega si policy es deny");
  it("deniega si patchResult es deny");
  it("deniega si verification no pasó");
  it("marca require_approval cuando policy lo exige");
  it("marca draft true para riesgo high/critical");
  it("mantiene allow para patch vacío con verification passed");
  it("lanza not implemented en modo live");
}

describe("buildForge with pr package provider") {
  it("incluye ForgePRPackage en el payload cuando verification passed");
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

- `packages/forge` sigue siendo puro; el provider `dry-run` no realiza llamadas a la API de GitHub ni escrituras de filesystem.
- El provider consume la salida del `PatchWriter` y `VerificationProvider`; no revalida scopes (eso es responsabilidad del planner y policy engine).
- La creación real del PR (`live`) requiere un proveedor futuro y no se implementa en esta fase.
- El provider se invoca desde `buildForge` cuando `patchResult` es `allow` y `verification` es `passed`.

## 10. Checklist de aprobación

- [x] Escenarios P1, P2 y P3 tienen criterio de aceptación Given/When/Then.
- [x] Contrato `PRPackageProvider` documentado.
- [x] FSM alineada con `STATE_MACHINES.md` (sin transiciones nuevas).
- [x] Tests listados antes de la implementación.
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada.
- [x] Spec agregado a `docs/SPEC_INDEX.md` vía `pnpm spec:index`.
