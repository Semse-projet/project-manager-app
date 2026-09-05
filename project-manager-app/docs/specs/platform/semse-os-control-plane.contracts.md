# Contratos propuestos — SEMSE OS Capability Control Plane

**Spec:** `platform.semse-os-control-plane`
**Estado:** ACCEPTED DESIGN CONTRACT
**Fecha:** 2026-07-19
**Canon:** FSM y eventos incorporados a `STATE_MACHINES.md` y `EVENT_CATALOG.md`

Estos contratos fueron aceptados para diseño F0. No autorizan Prisma, endpoints,
emisión de eventos, runtime ni producción.

## 1. CapabilityDefinition v1alpha1

```yaml
apiVersion: semse.io/v1alpha1
kind: CapabilityDefinition
metadata:
  name: evidence
  version: 1.0.0
  publisher: semse-core
spec:
  domain: evidence
  description: Gestión verificable de evidencia operacional
  dependencies:
    required: [identity@^1, events@^1, storage@^1]
    optional: [buildops@^1, governance@^1]
  interfaces:
    apiBasePath: /v1/evidence
    uiRoute: /evidence
    mcpTools: [evidence.list, evidence.submit, evidence.review]
  permissions: [evidence:read, evidence:create, evidence:review]
  dataClassification: confidential
  runtime:
    profile: standard
    adapterKinds: [compose, railway]
  health:
    livenessPath: /v1/health
    readinessPath: /v1/ready
  rollout:
    strategy: canary
    rollbackRequired: true
```

Reglas:

- `metadata.name + metadata.version` es inmutable.
- Imágenes se fijan por digest; `latest` queda prohibido en targets no locales.
- Dependencias usan rangos semánticos, pero una instalación resuelve versiones
  exactas antes de aplicar.
- El manifiesto declara permisos; no concede permisos por sí mismo.
- Una capability no puede declarar secretos literales, solo `SecretReference`.

## 2. CapabilityInstallation

```ts
type CapabilityInstallation = {
  id: string;
  tenantId: string;
  orgId: string;
  workspaceId: string;
  capabilityName: string;
  desiredVersion: string;
  resolvedVersion: string | null;
  desiredState: "ACTIVE" | "SUSPENDED";
  observedState:
    | "PENDING"
    | "PLANNED"
    | "AWAITING_APPROVAL"
    | "APPLYING"
    | "VERIFYING"
    | "ACTIVE"
    | "DEGRADED"
    | "SUSPENDING"
    | "SUSPENDED"
    | "ROLLING_BACK"
    | "ROLLED_BACK"
    | "BLOCKED";
  runtimeTargetId: string;
  configurationRevision: number;
  lastOperationId: string | null;
  observedAt: string | null;
};
```

`tenantId` delimita el dato, pero toda operación también valida organization,
workspace ownership, actor y permiso.

## 3. Operation y DeploymentPlan

```ts
type CapabilityOperation = {
  id: string;
  idempotencyKey: string;
  tenantId: string;
  workspaceId: string;
  installationId: string;
  requestedBy: { actorType: "user" | "agent" | "system"; actorId: string };
  intent: "ACTIVATE" | "UPDATE" | "SUSPEND" | "ROLLBACK" | "RECONCILE";
  risk: "low" | "medium" | "high" | "critical";
  policyDecisionId: string;
  planDigest: string;
  status: string;
  correlationId: string;
};

type DeploymentPlan = {
  operationId: string;
  capabilityDigest: string;
  target: { adapter: "compose" | "railway" | "kubernetes"; targetId: string };
  resolvedDependencies: Array<{ name: string; version: string }>;
  steps: Array<{
    id: string;
    action: string;
    risk: "low" | "medium" | "high" | "critical";
    requiresApproval: boolean;
    timeoutSeconds: number;
  }>;
  verification: Array<{ type: "health" | "readiness" | "metric"; condition: string }>;
  rollback: Array<{ action: string; targetRevision: string }>;
};
```

El digest cambia si cambian pasos, versión, configuración o target. Una
aprobación sobre un digest anterior no autoriza el plan nuevo.

## 4. RuntimeAdapter

```ts
interface RuntimeAdapter {
  kind: "compose" | "railway" | "kubernetes";
  observe(input: ObserveRequest): Promise<ObservedRuntimeState>;
  plan(input: DesiredRuntimeState): Promise<DeploymentPlan>;
  apply(plan: DeploymentPlan, grant: ExecutionGrant): Promise<ApplyReceipt>;
  verify(receipt: ApplyReceipt): Promise<VerificationResult>;
  rollback(plan: DeploymentPlan, grant: ExecutionGrant): Promise<RollbackReceipt>;
}
```

El adapter no evalúa reglas empresariales y no acepta prompts. Solo consume
contratos estructurados autorizados.

## 5. FSM candidata

```text
PENDING -> PLANNED -> AWAITING_APPROVAL -> APPLYING -> VERIFYING -> ACTIVE
PLANNED -> APPLYING
PLANNED -> BLOCKED
AWAITING_APPROVAL -> BLOCKED
APPLYING -> DEGRADED | ROLLING_BACK
VERIFYING -> DEGRADED | ROLLING_BACK
ACTIVE -> APPLYING | SUSPENDING | DEGRADED
DEGRADED -> APPLYING | ROLLING_BACK | BLOCKED
ROLLING_BACK -> ROLLED_BACK | BLOCKED
ROLLED_BACK -> PLANNED | SUSPENDED
SUSPENDING -> SUSPENDED | DEGRADED
SUSPENDED -> PLANNED
BLOCKED -> PLANNED
```

Guards:

- `PLANNED -> APPLYING` solo si policy permite y no quedan approvals.
- `VERIFYING -> ACTIVE` requiere todos los checks obligatorios.
- `* -> ROLLING_BACK` requiere target previo direccionable y grant aplicable.
- `ACTIVE -> SUSPENDING` rechaza si hay una operación incompatible con lease.
- los transitions materiales crean AuditLog y Domain Event.

## 6. Eventos candidatos v1

| Evento | Momento | Payload mínimo |
| --- | --- | --- |
| `capability.operation_requested.v1` | intake aceptado | operationId, installationId, intent |
| `capability.plan_created.v1` | plan fijado por digest | operationId, planDigest, risk |
| `capability.approval_required.v1` | policy pausa ejecución | operationId, approvalMode |
| `capability.apply_started.v1` | adapter empieza | operationId, adapterKind, targetId |
| `capability.verification_completed.v1` | checks terminan | operationId, passed, checks |
| `capability.activated.v1` | estado observado ACTIVE | installationId, version |
| `capability.degraded.v1` | salud bajo umbral | installationId, reasonCode |
| `capability.rollback_requested.v1` | rollback autorizado | operationId, targetRevision |
| `capability.rolled_back.v1` | rollback verificado | installationId, version |
| `capability.suspended.v1` | suspensión verificada | installationId, reasonCode |

Todos usan Domain Event envelope v2 y contienen tenant, org, actor,
correlation, causation, idempotency y schemaRef. No transportan secretos,
archivos Compose completos ni logs sin redacción.

## 7. API candidata

```text
GET  /v1/capability-definitions
GET  /v1/workspaces/:workspaceId/capabilities
POST /v1/workspaces/:workspaceId/capabilities/:name/operations
GET  /v1/capability-operations/:operationId
POST /v1/capability-operations/:operationId/approve
POST /v1/capability-operations/:operationId/reject
POST /v1/capability-operations/:operationId/rollback
```

Todas son privadas, tenant/ownership scoped y default-deny. Crear, aprobar y
rollback son acciones diferentes; quien solicita no puede satisfacer dual
control por sí solo.

## 8. Reconciliación e idempotencia

- unique `(tenantId, idempotencyKey)` por operación;
- lease por `runtimeTargetId + installationId`;
- reconciliación observa antes de mutar;
- retries reutilizan `operationId` y `planDigest`;
- `apply` devuelve receipt direccionable;
- el estado solo avanza tras evidencia persistida;
- drift no autorizado genera incidente, no adopción silenciosa.
