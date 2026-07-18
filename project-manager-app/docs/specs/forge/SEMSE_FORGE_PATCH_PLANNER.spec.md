---
id: semse-forge-patch-planner
title: "SEMSE Forge Patch Planner"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/patch-planner.ts
  - packages/forge/src/policy.ts
  - packages/forge/src/types.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-patch-planner.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_PATCH_PROPOSED
  - FORGE_VERIFICATION_COMPLETED
related_agents:
  - backend-builder
  - frontend-builder
  - qa-verifier
  - security-reviewer
  - documentation-curator
  - data-engineer
  - devops-release
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Patch Planner

## 1. Qué resuelve

**Para quién:** agentes de ingeniería, reviewers y operaciones de SEMSE Forge.

**Problema:** las tareas de Forge declaran `allowedFiles`/`forbiddenFiles`, pero no existe una capa que valide un conjunto de cambios de archivos propuestos antes de que se materialicen. Sin una validación previa, un agente podría intentar escribir fuera de su alcance, modificar archivos prohibidos o tocar `main` directamente.

**Solución:** un `PatchPlanner` puro en `packages/forge` que, en modo `dry-run`, valida una lista de `ProposedFileChange` contra el `ForgeTaskPacket`. Produce un `ForgePatchPlan` auditable con decisión `allow`, `deny` o `require_approval` y nunca escribe en el filesystem. La aplicación real de parches es una fase posterior con approbación explícita.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `backend-builder`, `frontend-builder` | agente Forge | proponer cambios acotados a su scope | ampliar `allowedFiles` en tiempo de ejecución |
| `security-reviewer` | `SECURITY` | auditar planes con cambios críticos | aprobar sin evidencia |
| `ops_admin` | `OPS_ADMIN` | aprobar/rechazar cambios en riesgo medio-alto | saltar dual control en riesgo crítico |
| `forge-supervisor` | `PLATFORM` | coordinar propuestas y bloquear violaciones | escribir archivos directamente |

## 3. Escenarios de Usuario

### P1 — Plan dry-run pasa para cambios acotados

**Journey:** un run de Forge está en `building`. El `backend-builder` recibe un task packet con `allowedFiles: ["packages/api/src/**"]` y propone actualizar `packages/api/src/modules/forge/forge.controller.ts`. El `DryRunPatchPlanner` valida que la ruta está dentro del scope, no es forbidden, no usa `..` ni es absoluta, y que la rama objetivo no es `main`. Emite `FORGE_PATCH_PROPOSED` con decisión `allow`.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket APPROVED con allowedFiles y proposedFiles dentro del scope
CUANDO el runtime invoca createPatchPlanner({ mode: "dry-run" }).plan(task, proposedFiles)
ENTONCES el ForgePatchPlan tiene decision "allow"
  Y    cada cambio tiene allowed: true
  Y    se emite FORGE_PATCH_PROPOSED con el resumen del plan
```

**Casos borde:**
- lista vacía: plan `allow` vacío.
- cambio con `diff` vacío: `allow` si el path es válido.
- cambio en path inexistente dentro del scope: `allow` (dry-run no verifica existencia real).

**Errores esperados:**
- `deny` si path fuera de `allowedFiles`, en `forbiddenFiles`, con `..`, absoluto, en rama `main` o archivo de entorno (`.*env*`).
- `require_approval` si la operación es `delete` o el archivo es crítico (por ejemplo `packages/db/prisma/schema.prisma`, `.github/workflows/**`, `railway.json`).

### P2 — Cambio fuera de scope o en archivo prohibido es bloqueado

**Journey:** un task packet contiene una propuesta para modificar `packages/db/prisma/schema.prisma` cuando `forbiddenFiles` incluye `packages/db/**`. El planner deniega el plan y el runtime pone el run en `blocked`.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con proposedFiles que violan scope o seguridad
CUANDO el runtime evalúa el patch planner
ENTONCES la decisión final es "deny"
  Y    el run no avanza a "ready_for_review"
  Y    el payload de FORGE_VERIFICATION_COMPLETED incluye policyDecision "deny"
```

## 4. FSM

No se introducen nuevos estados. El patch planner actúa como guarda dentro de `building` → `verifying`:

```
building → verifying
  guard: policy "allow", sandbox "allow", patch "allow"
  effect: FORGE_PATCH_PROPOSED, FORGE_VERIFICATION_COMPLETED

building → blocked
  guard: patch "deny"
  effect: FORGE_RUN_BLOCKED

building → ready_for_review
  guard: patch "require_approval" u otra aprobación pendiente
  effect: FORGE_HUMAN_REVIEW_REQUESTED
```

## 5. Contratos de API

No se agregan endpoints REST nuevos. El patch planner se invoca internamente desde `buildForge` (`agentType: "forge"`) y se expone en el payload del `AgentRun`.

**PatchPlanner (TypeScript):**

```typescript
export type PatchOperation = "create" | "update" | "delete";

export type ProposedFileChange = {
  path: string;
  operation: PatchOperation;
  content?: string;
  diff?: string;
  reason?: string;
};

export type PatchPlanDecision = "allow" | "deny" | "require_approval";

export type PatchPlanChange = {
  proposed: ProposedFileChange;
  allowed: boolean;
  violations: string[];
};

export type ForgePatchPlan = {
  mode: "dry-run" | "live";
  decision: PatchPlanDecision;
  reason: string;
  riskLevel: ForgeRiskLevel;
  changes: PatchPlanChange[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export interface PatchPlanner {
  plan(task: ForgeTaskPacket, proposedFiles: ProposedFileChange[]): ForgePatchPlan;
}

export function createPatchPlanner(config?: { mode?: "dry-run" | "live" }): PatchPlanner;
```

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Cobertura de branches del planner | ≥ 80% |
| Validación `pnpm spec:validate` | 0 errores nuevos |
| `pnpm typecheck` | 0 errores |
| Tests unitarios afectados | 100% pass |
| Mutaciones reales en dry-run | 0 |

## 7. Tests Requeridos

```typescript
describe("DryRunPatchPlanner") {
  it("permite un update dentro del scope");
  it("permite una lista vacía");
  it("niega path fuera de allowedFiles");
  it("niega archivo en forbiddenFiles");
  it("niega rama objetivo main");
  it("niega parent directory o ruta absoluta");
  it("requiere aprobación para delete");
  it("requiere aprobación para archivos críticos");
  it("niega archivos de entorno .env*");
}

describe("buildForge with patch planner") {
  it("incluye ForgePatchPlan en el payload cuando se proponen cambios");
  it("sobrescribe policy a deny cuando el patch planner deniega");
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

- `packages/forge` sigue siendo puro; el planner `dry-run` no accede a `node:fs`.
- `allowedFiles` y `forbiddenFiles` del `ForgeTaskPacket` son la fuente de verdad del scope.
- La aplicación real del patch (`live`) requiere un proveedor futuro que escriba en un workspace aislado y no se implementa en esta fase.
- El planner se invoca desde `buildForge` cuando `input.proposedFiles` está presente.

## 10. Checklist de aprobación

- [x] Escenarios P1 y P2 tienen criterio de aceptación Given/When/Then.
- [x] Contrato `PatchPlanner` documentado.
- [x] FSM alineada con `STATE_MACHINES.md` (sin transiciones nuevas).
- [x] Tests listados antes de la implementación.
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada.
- [x] Spec agregado a `docs/SPEC_INDEX.md` vía `pnpm spec:index`.
- [x] Status cambiado a `APPROVED`.
