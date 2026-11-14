# AgentRun organization ownership — #1153

**State:** REVIEW / Draft · 2026-11-14 · **No production authorization**

## Proven incident

QA isolated project `SEMSE AgentRun 1149 Isolated QA` showed `GET /v1/agents/runs/:runId` returning HTTP 200 to another organization in the same tenant. A different tenant was correctly denied. See [#1153](https://github.com/Semse-projet/project-manager-app/issues/1153) and QA evidence.

## Provisional fail-closed contract (requires independent approval)

1. **Organization-owned runs.** The owner is the `orgId` of the authenticated creator or trusted event origin, stored on `AgentRun.orgId` at insertion. A request body, `inputJson.operatorContext`, correlation ID, run ID, or token parameter never establishes ownership.
2. **Human-facing reads and mutations.** `list`, `detail`, `events`, `cancel`, `retry`, manual `start/complete/fail`, Ops runtime projections and Ops retry/requeue use the exact `(tenantId, orgId)` boundary; IDs alone confer no access. Foreign object responds 404.
3. **Authorized worker.** The worker's service principal is a legitimate tenant-scoped executor independent of the run's owning organization. `claim` and `reclaim-stale` remain tenant-scoped only after the controller checks effective `AGENT_RUNNER`. `GET /runs/:id/worker` also requires `AGENT_RUNNER` in addition to `agents:run:worker`. State mutations ignore the actor's org only after the controller verifies a claim capability cryptographically bound to tenant, worker, actor, run ID and attempt generation. They keep the existing fencing/CAS and attempt checks.
4. **Legacy records.** Old rows have `orgId IS NULL` by design. They must not appear in ordinary org views or manual mutations, even if `inputJson` names an org. The worker may process them with verified service authority. Any historical backfill or operational exception requires an independently reviewed, evidence-based migration, not this patch.
5. **Tenant administrators and Mission Control.** Until a separate explicit governance contract authorizes tenant-wide access, an administrator's ordinary org session sees only its own org's AgentRuns. Broader cross-org incident response would require its own privileged, audited endpoint (not a role guessed from a header).
6. **Idempotency.** Include the org in AgentRun's idempotency key to prevent collisions between organizations sharing tenant/correlation IDs.
7. **Event ownership.** Finalization outbox events use the run's persisted owner when known, instead of the worker service org. Unknown historical ownership must not be silently backfilled.
8. **No payment side effects.** This patch must not enable payments, escrow, lien, curated knowledge, or broad autonomy.

## Migration / rollout and verification gates

- Migration `20261114070000_agentrun_org_visibility_v1`: nullable `orgId` and `(tenantId,orgId,createdAt)` index. **No deletes, no non-null default, no legacy backfill.**
- CI must regenerate Prisma Client and pass API build, unit, integration and E2E, including regression of authorized Worker and denied foreign human. The disposable PostgreSQL test uses loopback port 5433; it must not be pointed at any Railway database.
- In isolated QA, run migration **after independent review** and use a NEW synthetic run with an authenticated org owner. The old direct-insert smoke fixture has NULL owner and is intentionally hidden from human reads after the patch.
- Verify read/list/events/ops projections and mutations across two orgs of one tenant, another tenant, revoked sessions, and multi-membership users; also check worker claim/start/heartbeat/complete/fail with fencing token and rejected old generations. Do not replay the 12 historical failed runs.
- Do not merge or deploy on a green CI alone. Require security review of the explicit owner contract, legacy data handling, and privileged worker boundary, followed by rollback plan and SHA-specific staging E2E.
- **Rollback:** revert application code if required while preserving the additive nullable column; dropping the column would destroy newly persisted owner information and is not an automatic rollback. A code rollback that restores tenant-only reads can reintroduce the leak, so block public/affected endpoints during rollback until safe filtering is restored.

## Exclusions / follow-up

- No automatic classification of NULL legacy rows; track how many exist using authorized, read-only metrics before deciding on backfill.
- This change does not certify cross-org access in other domain datasets or the broader Mission Control ledger beyond AgentRun-specific paths.
- HTTP authenticity remains governed by session roles and membership in the authorization middleware, not by `ActorContextService.ensureActorContext` alone.
