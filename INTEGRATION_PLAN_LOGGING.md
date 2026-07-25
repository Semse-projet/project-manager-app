# Logging Integration Plan - SEMSE Services

**Goal:** Integrate structured, trace-aware logging into the Node/TS services
**Status:** Phases 1–4 implemented
**Scope:** autonomy-server, API observability, BullMQ worker processors, distributed trace propagation

---

## Canonical logger per runtime

| Runtime | Logger | Location |
|---------|--------|----------|
| Node/TypeScript services (api, worker, autonomy-server) | `SEMSELogger` / `createLogger()` from `@semse/shared` | `packages/shared/src/observability/logger.ts` |
| Python services (vision-service, scripts) | `SEMSELogger` from `utils.logging` | `utils/logging.py` |

The Python logger is **not** used by Node services — it only exists for the
Python side. Both emit the same JSON shape (`level`, `message`, `timestamp`,
`service`, `runId`, `traceId`, plus span/context fields), so Railway ingestion
is uniform across runtimes.

Trace header: `x-trace-id` (`SEMSE_TRACE_HEADER_NAME` in `@semse/shared`).

---

## Phase 1: Autonomy Server — DONE

**Location:** `project-manager-app/apps/autonomy-server/src/server.mjs`

The inline `log()` helper was replaced by the shared logger:

```javascript
import { createLogger, SEMSE_TRACE_HEADER_NAME } from "@semse/shared";

const logger = createLogger("autonomy-server", { runId: SERVICE_ID, traceId: TRACE_ID });
// TRACE_ID = process.env.TRACE_ID ?? randomUUID()

// per-operation logger, traceId taken from the inbound request
const runLogger = createLogger("autonomy-server", { runId, traceId: resolveTraceId(req) });
await runLogger.withSpan("run_autonomy_task", () => runAutonomyTask(...));
```

**Impact:** autonomy logs are structured, span-timed and share the caller's trace.

---

## Phase 2: API Service — ALREADY IN PLACE

`apps/api` has a global `ObservabilityModule` (`apps/api/src/infrastructure/observability/`)
with `SemseLoggerService`, `MetricsService`, an `AsyncLocalStorage` request context
(`request-context.store.ts`), per-request JSON logging, `x-request-id` and
`GET /v1/metrics`. No NestJS middleware needed — the Fastify `onRequest` hook in
`apps/api/src/main.ts` populates the context.

Phase 4 extends it with `traceId` (see below). API logs automatically carry
`traceId` because `SemseLoggerService` spreads the observability context.

---

## Phase 3: Worker Service — DONE

**Location:** `project-manager-app/apps/worker/src/`

Processors are plain `.mjs` BullMQ workers (`main.mjs`: agent runs, developer
runtime, domain events; `modules/autonomy-loops/loops.scheduler.mjs`: permanent
loops). All of them are wrapped by
`apps/worker/src/observability/job-logging.mjs`:

```javascript
processJobWithLogging({
  job,
  queue: SEMSE_AGENT_RUN_QUEUE,
  data: { runId: job.data.runId, agentType: job.data.agentType },
  handler: () => processQueuedRun(job.data)
});
```

which creates one `SEMSELogger` per job (`service: "semse-worker"`,
`runId: job.id`, `traceId` from `job.data.traceId`), runs the handler inside a
`process_job` span and emits `info` on start/completion and `error` on failure.
The existing `pino` logger is kept for worker lifecycle logs.

**Impact:** every job has span timing plus a trace that links back to the API request.

---

## Phase 4: Distributed Trace Propagation — DONE

Flow: **API → Worker → API/Autonomy**

- API (`main.ts` + `common/request-id.ts`): `resolveTraceId()` reuses the inbound
  `x-trace-id` header or generates one; the value goes into the observability
  context and is echoed back in the `x-trace-id` response header.
- API queue services (`infrastructure/queue/*.ts`): `buildQueueTracePayload()`
  adds `traceId` to the BullMQ job payload of the agent-run, developer-runtime
  and domain-event queues.
- Worker: the per-job logger takes that `traceId` and stores it in an
  `AsyncLocalStorage`, so every outgoing API call from the job adds the
  `x-trace-id` header (`buildHeadersForTenant` in `main.mjs`).
- autonomy-server: reads `x-trace-id` from the request and uses it as the
  `traceId` of that operation's logger.

**Impact:** one `traceId` spans the entry request and all downstream work.

---

## Testing

```bash
# 1. Start local services
pnpm dev:api
pnpm dev:worker
pnpm start:autonomy

# 2. Send a request with an explicit trace id
curl -i -H "x-trace-id: trace-demo-1" http://localhost:4000/v1/health
curl -X POST http://localhost:4310/api/run \
  -H "content-type: application/json" -H "x-trace-id: trace-demo-1" \
  -d '{"task":"noop"}'

# 3. Verify in the logs
# - every line is a single JSON object
# - it carries traceId (and runId / service)
# - the same traceId appears in api, worker and autonomy-server lines
```

---

## Next: Metrics Layer (Optional)

- Span duration auto-tracking (`withSpan` already emits `durationMs`)
- Error rate monitoring per span name
- Throughput metrics
- P95/P99 latencies

---

**Status:** Phases 1–4 implemented
**Blockers:** None
