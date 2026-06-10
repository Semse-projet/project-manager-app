---
id: "api-agents-runtime"
title: "Agents Runtime API"
domain: "agents"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
related_files:
  - "apps/api/src/modules/agents"
  - "packages/agents/src"
  - "packages/schemas/src/agent-governance.schema.ts"
related_tests:
  - "apps/api/test/agent-governance.test.ts"
  - "apps/api/test/agent-policy.service.test.ts"
  - "scripts/api-agents-smoke.mjs"
related_endpoints:
  - "v1/agents"
related_events:
  - "agent.run.claim"
related_agents:
  - "orchestrator"
  - "prometeo"
last_verified: "2026-06-09"
---

# Spec: Agents Runtime API

## Problem Statement

SEMSE agents need a governed runtime for catalog discovery, policy evaluation, chat, work plans, approvals and run execution. The API must keep tenant boundaries, require explicit permissions and preserve auditability for worker actions and human approvals.

## Scope

- In scope:
  - Agent catalog and tool discovery.
  - Policy evaluation.
  - Human approval review and decisions.
  - Agent chat and threads.
  - Agent run lifecycle endpoints.
  - Worker claim, heartbeat, complete, fail and retry operations.
  - Plan Mode list, approval, rejection, cancellation and step updates.
- Out of scope:
  - Adding new agent personas.
  - Changing LLM provider routing.
  - Autonomous execution of sensitive financial/dispute actions.

## Actors

| Actor | Permissions | Capabilities |
| --- | --- | --- |
| Admin / operator | `ops:dashboard:read`, `ops:dashboard:write`, `agents:run:create`, `agents:run:retry` | Inspect runs, decide approvals, retry failed runs. |
| Agent worker | `agents:run:worker`, `agents:run:manage` | Claim, heartbeat, complete and fail runs. |
| Product user | `agents:run:create` | Chat with allowed agents and create allowed runs. |

## API Contract

### `GET /v1/agents/catalog`

```yaml
auth: required
permissions: ["agents:run:create"]
output:
  agents: "catalog of allowed agent types"
errors:
  403: "missing permission"
```

### `GET /v1/agents/catalog/:agentType`

```yaml
auth: required
permissions: ["agents:run:create"]
input:
  agentType: "enum from agentCatalog"
output:
  agent: "catalog detail"
errors:
  400: "invalid agent type"
  403: "missing permission"
```

### `GET /v1/agents/tools`

```yaml
auth: required
permissions: ["agents:run:create"]
output:
  tools: "allowed runtime tools"
```

### `POST /v1/agents/policy/evaluate`

```yaml
auth: required
permissions: ["agents:run:create"]
input_schema: "agentPolicyEvaluationSchema"
output:
  allowed: boolean
  violations: array
effects:
  audit_log: "policy evaluation may be logged by service policy layer"
```

### `GET /v1/agents/approvals`

```yaml
auth: required
permissions: ["ops:dashboard:read"]
output:
  approvals: "pending and historical approvals scoped to tenant"
```

### `POST /v1/agents/approvals/:approvalId/decision`

```yaml
auth: required
permissions: ["ops:dashboard:write"]
input:
  decision: "approved | rejected"
  comment: "optional string"
effects:
  audit_log: "approval decision"
  optional_execution: "approved copilot approvals can execute through ProjectCopilotHarness"
errors:
  400: "invalid approval id or decision body"
  403: "missing permission"
  409: "approval already decided"
```

### `POST /v1/agents/chat`

```yaml
auth: required
permissions: ["agents:run:create"]
input:
  message: "non-empty string"
  agentId: "optional string"
  threadId: "optional string"
  context: "optional object"
output:
  reply: "agent response"
  threadId: "conversation thread"
```

### `GET /v1/agents/threads`

```yaml
auth: required
permissions: ["agents:run:create"]
output:
  threads: "tenant/user scoped thread list"
```

### `GET /v1/agents/runs`

```yaml
auth: required
permissions: ["agents:run:create"]
output:
  runs: "tenant/org/user scoped run list"
```

### `POST /v1/agents/runs`

```yaml
auth: required
permissions: ["agents:run:create"]
headers:
  x-idempotency-key: "optional"
input:
  agentType: "enum from agentCatalog"
  triggerType: "manual | event | schedule"
  correlationId: "string"
  maxAttempts: "optional integer 1-10"
  workspaceId: "optional string"
  repoId: "optional string"
  taskId: "optional string"
  input: "optional object"
  inputSummary: "optional string max 500"
output:
  run: "created run"
effects:
  audit_log: "agent.run.create"
```

### Worker endpoints

```yaml
endpoints:
  - "GET /v1/agents/runs/:runId/worker"
  - "POST /v1/agents/runs/claim"
  - "POST /v1/agents/runs/reclaim-stale"
  - "POST /v1/agents/runs/:runId/start"
  - "POST /v1/agents/runs/:runId/heartbeat"
  - "POST /v1/agents/runs/:runId/complete"
  - "POST /v1/agents/runs/:runId/fail"
permissions:
  worker_read: "agents:run:worker"
  manage: "agents:run:manage"
effects:
  audit_log:
    - "agent.run.claim"
    - "agent.run.reclaim_stale"
    - "agent.run.heartbeat"
    - "agent.run.complete"
    - "agent.run.fail"
```

### `POST /v1/agents/runs/:runId/retry`

```yaml
auth: required
permissions: ["agents:run:retry"]
effects:
  audit_log: "agent.run.retry"
errors:
  409: "running run cannot be retried"
```

## FSM

Canonical agent run lifecycle is defined in `docs/specs/fsm/agent-run-lifecycle.spec.md`.

```txt
queued -> running -> completed
queued -> running -> failed -> queued
queued -> running -> failed -> dead_lettered
```

## Security / RBAC

- All operations resolve tenant, org, user and roles from request context.
- Worker endpoints require worker/manage permissions, not normal chat permission.
- Approval execution must only run after approval decision and service policy validation.
- Cross-tenant run lookup is forbidden.

## Tests Required

- [x] Governance policy tests: `apps/api/test/agent-governance.test.ts`
- [x] Agent policy tests: `apps/api/test/agent-policy.service.test.ts`
- [x] Smoke: `scripts/api-agents-smoke.mjs`
- [ ] Controller-level tests for run claim, heartbeat, complete, fail and retry.
- [ ] Approval decision test for already-decided approvals.

## Implementation Map

### API

- `apps/api/src/modules/agents/agents.controller.ts`
- `apps/api/src/modules/agents/agents.service.ts`
- `apps/api/src/modules/agents/agents.repository.ts`
- `apps/api/src/modules/agents/agent-approval.service.ts`

### Packages

- `packages/agents/src`
- `packages/schemas/src/agent-governance.schema.ts`

### Tests

- `apps/api/test/agent-governance.test.ts`
- `apps/api/test/agent-policy.service.test.ts`
- `scripts/api-agents-smoke.mjs`

## Acceptance Criteria

- [ ] Spec is linked from `docs/SPEC_INDEX.md`.
- [ ] `pnpm spec:validate` passes.
- [ ] Agent run endpoints keep tenant and permission boundaries.
- [ ] Worker lifecycle transitions are covered by FSM spec.
- [ ] Sensitive actions remain approval-gated.
