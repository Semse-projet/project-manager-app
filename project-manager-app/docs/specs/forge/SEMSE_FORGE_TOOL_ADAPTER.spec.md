---
id: semse-forge-tool-adapter
title: "SEMSE Forge Tool Adapter"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/tool-adapter.ts
  - packages/forge/src/registry.ts
  - packages/forge/src/policy.ts
  - packages/forge/src/types.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-tool-adapter.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_TOOLS_PLANNED
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

# SPEC: SEMSE Forge Tool Adapter

## 1. Qué resuelve

**Para quién:** agentes de SEMSE Forge y el runtime de `packages/agents`.

**Problema:** las acciones semánticas (`code.implement`, `spec.draft`, `verify.test`, etc.) declaradas en los manifests de Forge no se traducen a llamadas concretas a herramientas (`repo.read`, `code.write`, `command.run`, `approval.request`). No hay una capa que, antes de ejecutar, verifique que el rol solicitante tiene permitido usar cada herramienta necesaria y que las secuencias críticas (`deployment.propose`, `schema.propose`, `migration.propose`) requieren aprobación explícita.

**Solución:** un `ToolAdapter` puro en `packages/forge` que, en modo `dry-run`, mapea una acción semántica a un conjunto de herramientas esperadas y lo valida contra `manifest.allowedTools`. Produce un `ForgeToolPlan` con decisión `allow`, `deny` o `require_approval`. Ninguna herramienta real se ejecuta; el plan sirve como gate antes de cualquier invocación real.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `backend-builder`, `frontend-builder` | agente Forge | usar `repo.read`, `code.write`, `test.write`, `command.run` acotado | usar herramientas aprobadas por otro rol |
| `data-engineer` | `DATA_ENGINEER` | proponer schemas/migraciones | ejecutar migraciones sin aprobación dual |
| `devops-release` | `DEVOPS` | proponer CI y despliegues | modificar variables de producción sin aprobación |
| `security-reviewer` | `SECURITY` | auditar uso de herramientas | ejecutar en lugar del agente |
| `forge-supervisor` | `PLATFORM` | revisar planes de herramientas | saltarse validaciones |

## 3. Escenarios de Usuario

### P1 — Plan de herramientas pasa para acción acotada

**Journey:** un run de Forge está en `building`. El `backend-builder` recibe `action: "code.implement"` y un task packet con herramientas permitidas `["repo.read", "repo.search", "spec.read", "code.write", "test.write", "command.run", "audit.record"]`. El `DryRunToolAdapter` mapea `code.implement` a `repo.read`, `code.write`, `test.write` y `command.run`, confirma que todas están en el manifest y emite `FORGE_TOOLS_PLANNED` con decisión `allow`.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket APPROVED con action "code.implement" y herramientas permitidas que cubren el mapeo
CUANDO el runtime invoca createToolAdapter({ mode: "dry-run" }).plan({ task, action })
ENTONCES el ForgeToolPlan tiene decision "allow"
  Y    cada herramienta requerida tiene allowed: true
  Y    se emite FORGE_TOOLS_PLANNED con el resumen del plan
```

**Casos borde:**
- action `runtime.execute` sin herramientas mapeadas: plan `allow` vacío.
- action `approval.request` requiere herramienta `approval.request`.
- acción crítica (`deployment.propose`) siempre requiere aprobación aunque las herramientas estén permitidas.

**Errores esperados:**
- `deny` si la acción no existe en el mapa y no es `runtime.execute`.
- `deny` si una herramienta requerida no está en `manifest.allowedTools`.
- `require_approval` si la acción es crítica (deployment, migration, schema, production variable, security review).

### P2 — Acción no permitida es bloqueada

**Journey:** un `data-engineer` intenta ejecutar `migration.apply` (sin spec). El mapeo no conoce esa acción; el plan deniega y el run queda `blocked`.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con action no mapeada o herramientas no permitidas
CUANDO el runtime evalúa el tool adapter
ENTONCES la decisión final es "deny"
  Y    el run no avanza a "ready_for_review"
  Y    el payload de FORGE_VERIFICATION_COMPLETED incluye policyDecision "deny"
```

## 4. FSM

No se introducen nuevos estados. El tool adapter actúa como guarda dentro de `building` → `verifying`:

```
building → verifying
  guard: policy "allow", sandbox "allow", patch "allow", tools "allow"
  effect: FORGE_TOOLS_PLANNED, FORGE_VERIFICATION_COMPLETED

building → blocked
  guard: tools "deny"
  effect: FORGE_RUN_BLOCKED

building → ready_for_review
  guard: tools "require_approval" u otra aprobación pendiente
  effect: FORGE_HUMAN_REVIEW_REQUESTED
```

## 5. Contratos de API

No endpoints REST nuevos. El tool adapter se invoca internamente desde `buildForge` (`agentType: "forge"`) y se expone en el payload del `AgentRun`.

**ToolAdapter (TypeScript):**

```typescript
export type ForgeToolName =
  | "repo.read"
  | "repo.search"
  | "spec.read"
  | "spec.write"
  | "code.write"
  | "test.write"
  | "command.run"
  | "approval.request"
  | "audit.record"
  | "task.plan"
  | "pr.prepare"
  | "schema.propose"
  | "migration.propose"
  | "deployment.propose"
  | "connector.implement"
  | "contract.verify"
  | "webhook.verify"
  | "marketplace.publish.propose"
  | "verify.typecheck"
  | "verify.lint"
  | "verify.test"
  | "verify.build"
  | "verify.acceptance";

export type ToolPlanDecision = "allow" | "deny" | "require_approval";

export type ToolPlanEntry = {
  name: ForgeToolName;
  allowed: boolean;
  violations: string[];
};

export type ForgeToolPlan = {
  mode: "dry-run" | "live";
  decision: ToolPlanDecision;
  reason: string;
  action: string;
  riskLevel: ForgeRiskLevel;
  tools: ToolPlanEntry[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export interface ToolAdapter {
  plan(input: { task: ForgeTaskPacket; action: string }): ForgeToolPlan;
}

export function createToolAdapter(config?: { mode?: "dry-run" | "live" }): ToolAdapter;
```

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Cobertura de branches del adapter | ≥ 80% |
| Validación `pnpm spec:validate` | 0 errores nuevos |
| `pnpm typecheck` | 0 errores |
| Tests unitarios afectados | 100% pass |
| Invocaciones reales de herramientas en dry-run | 0 |

## 7. Tests Requeridos

```typescript
describe("DryRunToolAdapter") {
  it("permite code.implement con herramientas cubiertas");
  it("permite runtime.execute con plan vacío");
  it("requiere aprobación para deployment.propose");
  it("niega acción no mapeada");
  it("niega si falta herramienta requerida en el manifest");
  it("requiere aprobación para migration.propose");
  it("incluye audit.record cuando la acción lo requiere");
}

describe("buildForge with tool adapter") {
  it("incluye ForgeToolPlan en el payload");
  it("sobrescribe policy a deny cuando el tool adapter deniega");
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

- `packages/forge` sigue siendo puro; el adapter `dry-run` no ejecuta comandos ni escribe archivos.
- `manifest.allowedTools` del `forgeAgentRegistry` es la fuente de verdad de herramientas permitidas por rol.
- La ejecución real de herramientas (`live`) requiere un adapter futuro y no se implementa en esta fase.
- El adapter se invoca desde `buildForge` después del patch planner.

## 10. Checklist de aprobación

- [x] Escenarios P1 y P2 tienen criterio de aceptación Given/When/Then.
- [x] Contrato `ToolAdapter` documentado.
- [x] FSM alineada con `STATE_MACHINES.md` (sin transiciones nuevas).
- [x] Tests listados antes de la implementación.
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada.
- [x] Spec agregado a `docs/SPEC_INDEX.md` vía `pnpm spec:index`.
- [x] Status cambiado a `APPROVED`.
