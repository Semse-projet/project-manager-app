# D4 — Project status read without implicit provisioning (owner-approved design; implementation in isolated PR)

**Program:** `platform.semse-prometeo-interoperability`  
**Child spec:** `platform.semse-mcp-project-read` (REVIEW; D4-only internal implementation allowed, MCP activation not approved).  
**Owner security invariant:** `SEC-S1-02` APPROVED on 2026-10-15 (no Tenant/Org/User or domain mutations from MCP read).  
**Implementation decision D4:** **APPROVED** by owner in conversation on 2026-10-15; Option A selected. OAuth D2 still pending.  
**Operational state:** IMPLEMENTATION_IN_PR / NOT_DEPLOYED / INACTIVE (no MCP controller or OAuth route).

## Code facts independently verified

- `ProjectsController.detail` → `ProjectsService.detail` → `ProjectsRepository.findById`.
- `ProjectsRepository.findById` **first** awaits `actorContextService.ensureActorContext(input)` and then delegates to `findStoredProjectOrThrow`, `assertProjectReadable`, `toRecord`.
- `ActorContextService.ensureActorContext` does `tenant.upsert`, `org.upsert`, `user.upsert`. In a typical request these can be no-op updates, but the method has *write capability*, is cached per process and must not be treated as side-effect-free.
- `AuthGuard` relies on `AuthService.authenticateRequest`; a successfully resolved session has `AuthSession`, `User` and current `Membership.status=ACTIVE`. For external MCP OAuth, the trusted OAuth bridge must verify a corresponding durable SEMSE session and membership **before** calling Project access.
- `ProjectsRepository.findStoredProjectOrThrow` filters `id`, `tenantId`, `job.deletedAt:null`. `assertProjectReadable` checks resource ownership, including OPS_ADMIN *within tenant*. `toRecord` returns more internal fields than S1 should expose.

## Selected change (Option A approved)

**Option A (selected):** add an internal, explicitly named read path, `ProjectsService.statusForVerifiedActor` delegating to `ProjectsRepository.findByIdWithoutProvisioning`,  with a contract requiring a **server-issued, already authenticated/authorized** `RequestIdentity`. This method performs only existing repository read + domain ownership checks, **never** `ActorContextService.ensureActorContext`. The trusted server-issued actor originates in the OAuth bridge under `AuthGuard` and not from HTTP header/tool payload. Keep existing `ProjectsService.detail` and `GET /v1/projects/:id` unchanged during S1, preserving legacy behavior until a separate migration review. Output projection in adapter is `projectId,status` and a real `correlationId`, not the full ProjectRecord.

**Option B:** remove `ensureActorContext` directly from existing `findById` globally. This is simpler but changes web/worker/legacy callers, so it requires a separate baseline assessment and broader regression testing; **not chosen** for first MCP slice.

**Option C:** bypass domain repository to Prisma raw query. **Rejected**: duplicates tenant/org/soft-delete and resource policy, reopening security bugs.

**Option D:** keep `ensureActorContext` and trust that the ORM upsert has no side effects. **Rejected**: violates approved SEC-S1-02.

## Current isolated-code implementation contract

- `ProjectsRepository.findByIdWithoutProvisioning` calls existing `findStoredProjectOrThrow` and `assertProjectReadable`; **no** `ActorContextService.ensureActorContext`.
- `ProjectsService.statusForVerifiedActor` returns `{projectId,status}` only. It is not a route and **does not itself authenticate callers**. Its documented precondition is trusted server actor, current session and membership, and RBAC `projects:read` supplied by the future D2 global OAuth/AuthGuard bridge.
- Existing `ProjectsRepository.findById` retains its bootstrap and delegates to the same new read method; web REST semantics remain unchanged.
- `apps/api/test/mcp-s1-no-provision-read.test.ts` asserts bootstrap/writes zero, tenant/job deletion filtering, org/OPS_ADMIN policy and legacy parity using mocks. These tests cannot prove OAuth/membership revocation or real Postgres write absence.
- Approval/evidence in [issue #952](https://github.com/Semse-projet/project-manager-app/issues/952). This path must not be callable from a client-provided tenant/org/role payload.

## Typed contract proposal

```ts
// Conceptual external adapter signature — NOT implemented as MCP surface.
type VerifiedMcpProjectActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[]; // from active SEMSE membership, never external tool input
  grants: readonly ["projects:read"]; // checked by guard/policy
  // opaque proof/trusted request context lives server-side
};
type McpProjectStatus = { projectId: string; status: ProjectRecord["status"]; correlationId: string };

// method is not exported to third-party clients, only callable by verified server adapter
readProjectStatus(input: { actor: VerifiedMcpProjectActor; projectId: string }): Promise<McpProjectStatus>;
```

Do not assume a TypeScript type alone is an authentication boundary: enforce the origin of actor at runtime in `AuthGuard`/MCP OAuth adapter and require `projects:read` metadata and domain resource policy. `correlationId` must come from a real request ID, not a fabricated audit record.

## Acceptance tests — D4 local unit tests added; real OAuth/DB integration still pending

1. **Positive:** authenticated `CLIENT` of owning org reads `projectId,status`; `PRO` of assigned org does likewise; correct `RequestIdentity` has current membership.
2. **Negative same-tenant org:** user org unrelated to both owners gets uniform unavailable tool error, no project fields returned.
3. **Negative different tenant:** repository filters tenant before returning; even OPS_ADMIN may not cross tenant.
4. **Negative soft-delete:** Job with `deletedAt` is invisible.
5. **Negative revocation:** session revoked, user disabled, org membership suspended/revoked → no read; no fallback to stale claims.
6. **No provisioning:** spy on `tenant.upsert`, `org.upsert`, `user.upsert` **and** create/update/updateMany for those identity models during `tools/call`, assert zero. Spy on Project/Job/Evidence/Payment mutations, assert zero.
7. **Guard bypass:** `@Public()` forbidden for tool; external OAuth subject must become trusted identity through verified server guard, not `x-org-id`.
8. **No changed legacy API:** old GET `/v1/projects/:id` still follows its existing route and response contract; no service-level behavior change without independent approval.
9. **Failure isolation:** any DB/actor lookup timeout fails closed; endpoint MCP returns sanitized error without leaking existence or causing retries with weaker credentials.
10. **Output allowlist:** `projectId,status,correlationId` only; no tenantId, orgId, jobId, PII, financials, or stack trace.
11. **Audit:** optional `auditRef` only with a persisted retrievable record; do not count a log string as a verified audit artifact.

Test fixtures must cover **two tenants**, **two organizations within one tenant**, a user whose membership has been revoked, and active OPS_ADMIN. Use a real isolated Postgres database at integration stage; in-memory unit mocks are prerequisite but not proof of production behavior.

## Delivery gate

D4 Option A was approved by the owner, permitting a strictly internal **no-endpoint** implementation in a separate code PR with tests-first evidence. Before publishing any MCP endpoint, D2 must be selected/reviewed, the S1 child spec approved and ADR-045 accepted; the OAuth bridge must supply trustworthy identity/current membership/scope and D7 revocation. Staging authenticated multi-tenant E2E and rollback remain mandatory. Never mark VERIFIED based solely on unit tests.

**D4 scope limitation:** this implementation is a new *internal* ProjectsService/Repository path with mocked regression tests, not proof of production no-write guarantees. No MCP transport, authorization bridge, consent storage or deployment is implied.
