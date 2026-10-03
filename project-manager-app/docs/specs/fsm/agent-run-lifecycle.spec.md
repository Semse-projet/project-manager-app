---
id: "fsm-agent-run-lifecycle"
title: "Agent Run Lifecycle FSM"
domain: "agents"
version: "1.1"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - "apps/api/src/modules/agents"
  - "packages/agents/src"
related_tests:
  - "apps/api/test/agents-auto-trigger.test.ts"
  - "apps/api/test/agent-run-reclaim-race.test.ts"
  - "apps/api/test/fsm-lifecycles.test.ts"
  - "scripts/api-agents-smoke.mjs"
related_endpoints:
  - "v1/agents"
related_events:
  - "agent.run.retry"
related_agents:
  - "orchestrator"
last_verified: "2026-07-23"
---

# FSM Spec: Agent Run Lifecycle

## States

| State | Description | Terminal | Reversible |
| --- | --- | --- | --- |
| `queued` | Run is created and waiting for worker claim. | No | Yes. |
| `running` | Run has been claimed/started by a worker. | No | No direct retry while running. |
| `completed` | Run finished successfully with optional output. | Yes | No. |
| `failed` | Run failed and may be retried if attempts remain. | Conditional | Yes, through retry/reclaim if attempts remain. |
| `dead_lettered` | Run exceeded attempts or failed stale reclaim policy. | Yes | No except manual administrative intervention later specified. |

`dead_lettered` es el estado lógico del FSM. El modelo físico vigente lo
representa como `status=FAILED` junto con `deadLettered=true`, porque el enum
persistido no tiene un valor separado.

## Transitions

| From | Event | To | Guard | Effects |
| --- | --- | --- | --- | --- |
| none | `agent.run.create` | `queued` | Valid agent type and correlationId. | Persist run, respect idempotency key. |
| `queued` | `agent.run.claim` | `running` | Worker permission and optional agent type filter. | Assign worker, set `startedAt`, `heartbeatAt`. |
| `running` | `agent.run.heartbeat` | `running` | Same tenant and worker; run is running. | Update heartbeat. |
| `running` | `agent.run.complete` | `completed` | Manage permission. | Persist output; write run summary; close delegation if linked. |
| `running` | `agent.run.fail` | `failed` | Manage permission. | Persist error; close delegation as failed if linked. |
| `failed` | `agent.run.retry` | `queued` | Not running and attempts remain. | Increment attempt as implemented; clear worker/heartbeat/error where applicable. |
| `running` | `agent.run.reclaim_stale` | `queued` | Last heartbeat older than threshold and attempts remain. | Clear worker and mark reclaimed. |
| `running` | `agent.run.reclaim_stale` | `dead_lettered` | Last heartbeat older than threshold and max attempts reached. | Mark dead-lettered with error. |

## Diagram

```txt
create
  │
  ▼
queued ── claim/start ──► running ── complete ──► completed
  ▲                       │
  │                       ├── fail ─────────────► failed
  │                       │                         │
  │                       │                         └── retry ──► queued
  │                       │
  └── reclaim_stale ◄─────┘
                          │
                          └── reclaim_stale(max attempts) ──► dead_lettered
```

## Invariants

- Running runs cannot be retried.
- Heartbeat is valid only for running runs.
- Worker endpoints require `agents:run:worker` or `agents:run:manage`.
- Runs are tenant scoped.
- `correlationId` must remain stable across retries for traceability.
- Sensitive downstream actions must still pass approval/policy gates.
- Stale reclaim may mutate only a run that is still `running` and whose latest
  heartbeat/start/update timestamp remains older than the cutoff.
- Candidate selection never authorizes a later mutation by itself; a failed
  compare-and-set is skipped.

## Tests Required

- [x] Auto-trigger coverage: `apps/api/test/agents-auto-trigger.test.ts`
- [x] API smoke: `scripts/api-agents-smoke.mjs`
- [ ] Unit test for queued -> running claim.
- [ ] Unit test for running -> completed.
- [ ] Unit test for running -> failed -> queued retry.
- [ ] Unit test that running retry is rejected.
- [x] Unit test for stale reclaim to queued/dead_lettered.
- [x] Race test that a run completed or heartbeated after selection is not
  reclaimed.

## Implementation Map

### API

- `apps/api/src/modules/agents/agents.controller.ts`
- `apps/api/src/modules/agents/agents.service.ts`
- `apps/api/src/modules/agents/agents.repository.ts`

### Packages

- `packages/agents/src`

### Tests

- `apps/api/test/agents-auto-trigger.test.ts`
- `scripts/api-agents-smoke.mjs`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`.
- [x] Agents API spec references this FSM.
- [x] Retry and stale reclaim preserve traceability through correlationId.
