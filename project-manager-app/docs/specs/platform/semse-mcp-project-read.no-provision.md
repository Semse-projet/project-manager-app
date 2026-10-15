# D4 — Project status read without implicit provisioning (proposed implementation contract)

**Program:** `platform.semse-prometeo-interoperability`  
**Child spec:** `platform.semse-mcp-project-read` (REVIEW, no S1 code approved).  
**Owner security invariant:** `SEC-S1-02` APPROVED on 2026-10-15 (no Tenant/Org/User or domain mutations from MCP read).  
**Implementation decision D4:** PROPOSED, not yet accepted.  
**Operational state:** NOT_IMPLEMENTED / NOT_DEPLOYED / INACTIVE.

## Code facts independently verified

- `ProjectsController.detail` → `ProjectsService.detail` → `ProjectsRepository.findById`.
- `ProjectsRepository.findById` **first** awaits `actorContextService.ensureActorContext(input)` and then delegates to `findStoredProjectOrThrow`, `assertProjectReadable`, `toRecord`.
- `ActorContextService.ensureActorContext` does `tenant.upsert`, `org.upsert`, `user.upsert`. In a typical request these can be no-op updates, but the method has *write capability*, is cached per process and must not be treated as side-effect-free.
- `AuthGuard` relies on `AuthService.authenticateRequest`; a successfully resolved session has `AuthSession`, `User` and current `Membership.status=ACTIVE`. For external MCP OAuth, the trusted OAuth bridge must verify a corresponding durable SEMSE session and membership **before** calling Project access.
- `ProjectsRepository.findStoredProjectOrThrow` filters `id`, `tenantId`, `job.deletedAt:null`. `assertProjectReadable` checks resource ownership, including OPS_ADMIN *within tenant*. `toRecord` returns more internal fields than S1 should expose.

## Minimal change proposed

**Option A (recommended):** add an internal, explicitly named read path, for example `ProjectsService.detailForTrustedExternalRead` delegating to `ProjectsRepository.findByIdWithoutProvisioning`, with a contract requiring a **server-issued, already authenticated/authorized** `RequestIdentity`. This method performs only existing repository read + domain ownership checks, **never** `ActorContextService.ensureActorContext`. The trusted server-issued actor originates in the OAuth bridge under `AuthGuard` and not from HTTP header/tool payload. Keep existing `ProjectsService.detail` and `GET /v1/projects/:id` unchanged during S1, preserving legacy behavior until a separate migration review. Output projection in adapter is `projectId,status` and a real `correlationId`, not the full ProjectRecord.

**Option B:** remove `ensureActorContext` directly from existing `findById` globally. This is simpler but changes web/worker/legacy callers, so it requires a separate baseline assessment and broader regression testing; **not chosen** for first MCP slice.

**Option C:** bypass domain repository to Prisma raw query. **Rejected**: duplicates tenant/org/soft-delete and resource policy, reopening security bugs.

**Option D:** keep `ensureActorContext` and trust that the ORM upsert has no side effects. **Rejected**: violates approved SEC-S1-02.

## Typed contract proposal

```ts
// Illustrative signature — not implemented.
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

## Acceptance tests — red before implementation

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

Required before writing code: D4 option accepted in child S1/ADR-045 through architecture/security review; first-party OAuth bridge trust and role resolution defined in D2, consent binding in D7; child spec state APPROVED. Then implement in a separate code PR with tests-first evidence, flag OFF by default, rollback independent of existing web API, staging authenticated multi-tenant E2E, and operational evidence. Never mark VERIFIED based solely on unit tests.

**This document is a recommendation for D4, not a claim that no-provisioning is already enforced.**
