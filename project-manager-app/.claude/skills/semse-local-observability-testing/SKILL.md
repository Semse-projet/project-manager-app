---
name: semse-local-observability-testing
description: How to run the full SEMSE local stack (Postgres + Redis + API + worker + autonomy-server) and verify structured JSON logging / traceId propagation end-to-end. Use when testing observability, BullMQ job flows, domain-events (outbox → queue → worker), or anything that needs the worker and API running together locally.
---

# SEMSE local stack + observability testing

## Bring up infrastructure (processes do NOT survive a snapshot/restart)
```bash
docker run -d --name test-redis -p 6379:6379 redis:7-alpine
docker run -d --name test-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=projectmanager_dev \
  postgres:16-alpine
# if they already exist: docker start test-redis test-pg
cd project-manager-app
echo 'DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/projectmanager_dev?schema=public"' > packages/db/.env
pnpm --filter @semse/db exec prisma migrate deploy     # ends with "All migrations have been successfully applied"
```
`redis-cli` / `psql` are NOT installed on the box — use `docker exec test-pg psql -U postgres -d projectmanager_dev -c "..."`.

## `apps/api/.env` (the worker reads this file too, via dotenv fallback)
Minimum that boots API + worker:
```
NODE_ENV=development
PORT=4132
HOST=127.0.0.1
SEMSE_API_BASE_URL=http://127.0.0.1:4132     # worker derives SEMSE_API_URL from this
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/projectmanager_dev?schema=public
REDIS_URL=redis://127.0.0.1:6379
STORAGE_PROVIDER=local
ENABLE_LLM_ROUTER=false
RATE_LIMIT_LIMIT=5000
SEMSE_ALLOW_HEADER_IDENTITY=true               # local-only opt-in, see "Auth shortcut" below
```

### Auth shortcut for CLI testing (header identity — local only)
Header identity is **fail-closed** (`core.header-identity-fail-closed`). Omitting `AUTH_SECRET` is no longer
enough: without the explicit opt-in every protected route answers
`503 "Authentication authority unavailable"`. The API trusts caller-supplied identity headers **only when all
three hold** — `headerIdentityAllowed()` in `apps/api/src/common/request-context.ts:45`, used by
`authenticateRequest` in `apps/api/src/modules/auth/auth.service.ts:160`:

1. `AUTH_SECRET` is **unset** (if it is set, a Bearer token from the login flow is mandatory);
2. `SEMSE_ALLOW_HEADER_IDENTITY=true` (exactly `"true"`);
3. `NODE_ENV` is `development` or `test` (anything else, including unset, fails closed).

Then every request just needs:
```
-H "x-tenant-id: tenant_default" -H "x-org-id: org_admin_001" -H "x-user-id: usr_admin_001" -H "x-roles: OPS_ADMIN"
```
(the seeded tenant is `tenant_default`). Roles → permissions live in `packages/auth/src/rbac.ts`.

**Why it exists:** it lets you exercise RBAC/tenant scoping from curl or Playwright without running the login
flow. **Why it is dangerous:** whoever sends the headers *is* that user, any role, any tenant. It is an
impersonation switch, so:
- use it only on your own machine/sandbox against a disposable local database;
- never set it in a shared, staging, preview or production environment, and never as a workaround for a real
  auth problem — fix the auth path instead. The fail-closed policy above refuses it outside development/test
  anyway, but do not rely on that alone;
- when you finish, stop the API and remove the variable (`unset SEMSE_ALLOW_HEADER_IDENTITY`, or drop the line
  from your local `apps/api/.env`, which is git-ignored — never commit it).

**Web against this API:** run the web with `next dev` (development), which forwards the signed session's
identity as headers. `next start` runs in production mode: it requires `SEMSE_BOOTSTRAP_TOKEN` to reach the API
and rejects sessions of the seeded demo users (`usr_client_001`, `usr_worker_001`, `usr_admin_001`) by design —
create your own synthetic users/memberships for browser tests.

## Start the services (log to files; nothing useful is on screen, so do not record)
```bash
cd project-manager-app
pnpm dev:api      > /tmp/api.log      2>&1 &   # ~60s: builds packages + prisma generate; wait for "api_bootstrap_complete"
pnpm dev:worker   > /tmp/worker.log   2>&1 &   # wait for "worker started"
pnpm start:autonomy > /tmp/autonomy.log 2>&1 & # 127.0.0.1:4310, POST /api/run
```
`apps/api` dev is `nest start --watch`, so temporary source edits recompile in ~20-30s — useful for
before/after regression controls (always restore the file and verify with `git diff -- apps packages`).

## Triggering the flows
- **Agent-run job (API → BullMQ → worker → API):**
  `POST /v1/agents/runs` with `{"agentType":"pricing","triggerType":"manual","correlationId":"..."}`.
  Valid agentTypes: `packages/agents/src/index.ts` `agentCatalog`. The run will fail with
  "Delegated run requires at least projectId or jobId in its context." without LLM/context — that is
  fine for observability testing; the job log lines are still emitted.
- **Domain-event job:** `POST /v1/domain-events/emit` does **not** write to the outbox (only
  `evidence.repository.ts` does). To get a queue job, seed a `PENDING` row in `DomainOutboxEvent`
  via SQL and let the API's outbox dispatcher enqueue it. Requires in env:
  `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED=true`, `SEMSE_EVENT_CONSUMERS_ENABLED=true`,
  `SEMSE_EVENT_CONSUMER_ALLOWLIST=evidence-readiness.v1`, `SEMSE_EVENT_TYPE_ALLOWLIST=<eventType>`.
  Only `evidence.uploaded` is actually consumable — other types terminate with HTTP 422, which is
  expected and still proves the job/payload path.
  `POST /v1/domain-events/:eventId/replay` with a `consumerName` enqueues **inside** the HTTP request
  context (`outbox-ops.service.ts`), which is the only path where request-scoped queue payload
  enrichment shows up; a replay without `consumerName` goes through the background dispatcher instead.
  Replay requires the outbox row (or the `DomainEventConsumption` row) to be in a terminal state —
  set `status='DEAD_LETTER'` via SQL first.
- **Autonomy server:** `curl -X POST http://127.0.0.1:4310/api/run -H "content-type: application/json" -H "x-trace-id: <id>" -d '{"task":"noop"}'`.
  It fails without an LLM and also refuses to run if the git worktree is dirty ("Repository is not clean"),
  but it still emits the per-request JSON logs, which is what trace testing needs.

## Observability expectations (as of PR #423)
- Trace header constant: `x-trace-id` (`SEMSE_TRACE_HEADER_NAME` in `@semse/shared`).
- API echoes the inbound `x-trace-id` back as a response header and logs it in `http_request_completed`;
  with no inbound header it generates a UUID. `requestId` is always a separate UUID.
- Worker per-job logs: `service: "semse-worker"`, `runId` = BullMQ job id, span `process_job`
  (`[span.start]` / `[span.end]` / `[span.error]`), plus `job started` / `job completed` / `job failed`.
- The worker stores the traceId in AsyncLocalStorage and adds `x-trace-id` to every outbound API call,
  so end-to-end propagation is verifiable purely by grepping the API log for the same traceId.
- The **domain-events queue payload must contain only `eventId`** (invariant F1-D,
  `parseDomainEventJobData` in `apps/worker/src/domain-event-worker.mjs`). Adding any extra key
  (e.g. `traceId`) breaks those jobs with "Domain event job data may contain only eventId" — watch for
  this whenever queue payloads are enriched.
- Not everything in the worker log is SEMSELogger output: pino lines (`msg`/`time`) and a plain-text
  `[curator] skipped …` line are pre-existing; api.log also contains pnpm/Nest bootstrap banners.
  Filter by message name before asserting "every line is JSON".

## Devin Secrets Needed
None for this flow (no LLM keys, no GitHub token). LLM-dependent behaviour (autonomy runs, agent
execution) cannot be validated locally without an Ollama instance or an external LLM API key.
