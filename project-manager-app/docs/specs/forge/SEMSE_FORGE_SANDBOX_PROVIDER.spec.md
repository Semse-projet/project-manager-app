---
id: semse-forge-sandbox-provider
title: "SEMSE Forge Sandbox Provider"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/sandbox.ts
  - packages/forge/src/policy.ts
  - packages/forge/src/types.ts
  - packages/forge/src/registry.ts
  - packages/agents/src/runtime.ts
  - apps/worker/src/agent-run-handlers.mjs
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-sandbox.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
  - tests/unit/forge-harness.test.mjs
related_endpoints: []
related_events:
  - FORGE_SANDBOX_PLANNED
  - FORGE_VERIFICATION_COMPLETED
related_agents:
  - forge-supervisor
  - backend-builder
  - frontend-builder
  - qa-verifier
  - security-reviewer
  - data-engineer
  - devops-release
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Sandbox Provider

## 1. Qué resuelve

**Para quién:** operaciones, agentes de ingeniería y reviewers de SEMSE Forge.

**Problema:** las tareas de Forge declaran `allowedCommands`, pero el runtime no valida ni planifica su ejecución antes de correrlos. Sin un sandbox, un comando malicioso, una ruta fuera de alcance o un shell-injection podrían ejecutarse directamente en el worker.

**Solución:** un `SandboxProvider` en `packages/forge` que, en modo `dry-run`, parsea y valida los comandos de un `ForgeTaskPacket` antes de que se ejecuten. Produce un `SandboxPlan` auditable: decide `allow`, `deny` o `require_approval`, enumera violaciones y no realiza mutaciones reales. La ejecución real (`live`) queda especificada para una fase posterior con aislamiento adecuado.

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| `forge-supervisor` | `PLATFORM` | coordinar tareas y solicitar sandbox | ejecutar comandos directamente |
| `backend-builder`, `frontend-builder`, `qa-verifier`, etc. | agente Forge | recibir plan y, con aprobación, ejecutar | ampliar su propio scope de archivos |
| `ops_admin` | `OPS_ADMIN` | aprobar/rechazar planes con comandos riesgosos | saltar dual control en riesgo crítico |
| `security-reviewer` | `SECURITY` | auditar plan y marcar violaciones | aprobar sin evidencia |

## 3. Escenarios de Usuario

### P1 — Plan dry-run pasa para un comando acotado

**Journey:** un run de Forge transicionó a `building`. El `backend-builder` recibe un task packet con `allowedCommands: ["pnpm build:api"]`. El sandbox provider valida que no hay shell-injection, rutas absolutas, `..` ni archivos fuera de `allowedFiles`. Produce un plan `allow`.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket APPROVED con allowedCommands dentro del scope
CUANDO el runtime invoca createSandboxProvider({ mode: "dry-run" }).plan(task)
ENTONCES el SandboxPlan tiene decision "allow"
  Y    no contiene violaciones de path ni shell
  Y    se emite FORGE_SANDBOX_PLANNED con el plan resumido
```

**Casos borde:**
- comando vacío: plan `allow` vacío, sin evento negativo.
- `allowedCommands` vacío: plan `allow`.
- token de paquete scoped (`@scope/pkg`): no se trata como path del filesystem.

**Errores esperados:**
- sandbox policy `deny` si hay path fuera de `allowedFiles`, `..`, ruta absoluta o shell metacharacter.
- sandbox `require_approval` si el programa es destructivo (`rm`, `curl`, `bash`, etc.).

### P2 — Comando destructivo o fuera de scope requiere aprobación o bloqueo

**Journey:** un task packet contiene `allowedCommands: ["rm -rf packages/db"]`. El sandbox detecta tanto el programa `rm` como la ruta `packages/db` fuera de `allowedFiles` para `documentation-curator`. El plan es `deny` y el runtime pone el run en `blocked`.

**Criterio de aceptación:**
```
DADO   un ForgeTaskPacket con allowedCommands que violan scope o seguridad
CUANDO el runtime evalúa la política y luego el sandbox
ENTONCES la decisión final es "deny"
  Y    el run no avanza a "ready_for_review"
  Y    el detalle de FORGE_VERIFICATION_COMPLETED incluye policyDecision "deny"
```

## 4. FSM

No se introduce un nuevo ciclo de vida. El sandbox actúa como una guarda adicional dentro del estado `building` → `verifying`:

```
building → verifying
  guard: policy "allow" y sandbox "allow"
  effect: FORGE_SANDBOX_PLANNED, FORGE_VERIFICATION_COMPLETED

building → blocked
  guard: sandbox "deny"
  effect: FORGE_RUN_BLOCKED

building → ready_for_review
  guard: sandbox "require_approval" u otra aprobación pendiente
  effect: FORGE_HUMAN_REVIEW_REQUESTED
```

## 5. Contratos de API

No se agregan endpoints REST nuevos. El sandbox se invoca internamente desde `executeGovernedAgentRun` (`agentType: "forge"`) y se expone en el payload del `AgentRun`.

**SandboxProvider (TypeScript):**

```typescript
export type SandboxMode = "dry-run" | "live";

export interface SandboxProvider {
  plan(input: {
    task: ForgeTaskPacket;
    action?: string;
    environment?: string;
  }): SandboxPlan;
}

export type SandboxPlan = {
  mode: SandboxMode;
  decision: "allow" | "deny" | "require_approval";
  reason: string;
  riskLevel: ForgeRiskLevel;
  commands: SandboxCommand[];
  requiredApprovals: string[];
  violations: string[];
  auditTags: string[];
};
```

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Cobertura de branches del sandbox | ≥ 80% |
| Validación `pnpm spec:validate` | 0 errores nuevos |
| `pnpm typecheck` | 0 errores |
| Tests unitarios afectados | 100% pass |
| Mutaciones reales en dry-run | 0 |

## 7. Tests Requeridos

```typescript
describe("DryRunSandboxProvider") {
  it("permite un comando seguro dentro del scope");
  it("niega shell metacharacter en un comando");
  it("niega ruta absoluta o parent directory");
  it("niega path fuera de allowedFiles");
  it("requiere aprobación para comandos destructivos");
  it("ignora argumentos de opciones (-foo) y paquetes scoped");
}

describe("buildForge with sandbox") {
  it("incluye SandboxPlan en el payload cuando policy allow");
  it("sobrescribe policy a deny cuando sandbox deniega");
  it("mantiene policy allow cuando sandbox allow");
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

- `packages/forge` sigue siendo puro; el sandbox `dry-run` no usa `node:child_process`.
- `allowedCommands` contiene comandos shell (no acciones semánticas). El `action` semántico se pasa por `input.action` o se infiere cuando `allowedCommands[0]` coincide con `manifest.allowedActions`.
- El modo `live` requiere un proveedor futuro con aislamiento (contenedor, chroot, etc.) y no se implementa en esta fase.
- El worker y la API invocan `createSandboxProvider({ mode: "dry-run" })` por defecto.

## 10. Checklist de aprobación

- [x] Escenarios P1 y P2 tienen criterio Given/When/Then.
- [x] Contrato `SandboxProvider` documentado.
- [x] FSM alineada con `STATE_MACHINES.md` (sin transiciones nuevas).
- [x] Tests listados antes de la implementación.
- [x] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada.
- [x] Spec agregado a `docs/SPEC_INDEX.md` vía `pnpm spec:index`.
- [x] Status cambiado a `APPROVED`.
