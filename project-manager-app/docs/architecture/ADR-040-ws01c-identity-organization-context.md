# ADR-040 — WS-01C Identity/Organization Context: canonical tenancy boundary and first compatibility slice

- **Date:** 2026-09-18
- **Status:** Proposed — human GO received 2026-09-18 for "first compatibility slice only"; same day, implementation-time research found `universal-identity-multi-role.spec.md` (Addendum below) and the owner then issued a **reconciliation decision** (see "Reconciliation decision 2026-09-18 (owner)" below), which is now the live architecture: `Membership.status` is implemented and shipped in this slice; the session-level "context switch" mechanism as originally specified is **rejected**, not merely blocked, superseded by a to-be-designed, non-authoritative "preferred organization" UX preference.
- **Owners:** WS-01C reconciliation (this session), pending a named product/eng owner for implementation
- **Affected domains:** `packages/auth/`, `apps/api/src/modules/auth/`, `apps/api/src/infrastructure/persistence/actor-context.service.ts`, `apps/web/lib/auth.ts`, `apps/web/middleware.ts`, `packages/db/prisma/schema.prisma` (`Org`, `Membership`)
- **Depends on:** [`WS-01C-G0-Scope-Contract.md`](../ws-01c/WS-01C-G0-Scope-Contract.md), [`WS-01C-G1-AS-IS-Reconciliation.md`](../ws-01c/WS-01C-G1-AS-IS-Reconciliation.md), [`WS-01C-Naming-Collision-Register.md`](../ws-01c/WS-01C-Naming-Collision-Register.md)

## Context

An external design document (`SEMSE_WS-01C_Master.md`, not versioned in this repo) proposes a generic identity/workspace/capability/Intent-continuity architecture for SEMSE, followed by a control pack (`CLAUDE_WS-01C_CONTROL_PACK.md`, also external) that requires a formal Scope Contract (G0) and AS-IS Reconciliation (G1) before any implementation. Both are now produced (linked above). This ADR answers the 11 questions the control pack requires before G2 (Architecture & Contract Freeze) can proceed, using only evidence gathered from `main@5d1c4b24` — not the external document's assumptions where the repo disagrees.

The single most important finding driving this ADR: **the external document's proposed vocabulary collides with real, already-shipped code** — not just informally similar names, but an entire production module literally called `Workspace` (UI shell/mission-control state, `apps/api/src/modules/workspace/`, live `v1/workspace/*` API) and a service literally called `ActorContextService` (row-bootstrap/upsert, `apps/api/src/infrastructure/persistence/actor-context.service.ts`). Adopting WS-01C's suggested names as-is would silently overload or shadow both. See the Naming Collision Register for full detail.

## Existing implementations found

Verified directly, not assumed:

- `User` (Prisma) is already a global identity with no permanent role field — D-01/D-02 of the external document are already true today, no work needed.
- `Tenant` → `Org[]` → `Membership` (`userId, orgId, roleId`, no `status`) is the real multi-tenancy skeleton. A single `Tenant` can and does hold multiple `Org`s (seed data: `ACME Corp (Cliente)` type `CLIENT` and `ProServicios SRL` type `PRO`, same `TENANT_ID`).
- `packages/auth/src/rbac.ts` (`rolePermissions`, ~150 permission strings, `@RequirePermissions` gate) is already, functionally, a capability service — it authorizes on `roles: string[]`, not yet on a resolved membership.
- Active org selection today: login picks `memberships[0]` (first membership found, undefined order) and that persists for the session's lifetime. No switch endpoint, no UI, no revalidation exists anywhere in the codebase.
- Session/cookie: the real production cookie (`apps/web/lib/auth.ts`, `semse_session`) is HMAC-SHA256 signed, `HttpOnly`/`SameSite=Lax`/conditional `Secure`. A second, unsigned `encodeSession`/`decodeSession` pair exists in `packages/auth/src/session.ts` with zero real call sites — dead code, not a production risk, but a naming/shape trap for future readers.
- API-side session verification (`apps/api/src/modules/auth/auth.service.ts:105-148`) verifies a signed JWT and deliberately skips a per-request DB membership lookup — the code comment cites a real prior incident (15s hangs when Postgres is slow) as the reason. Revocation today is bounded only by access-token TTL, not by real-time membership state.
- `payment-governance.service.ts` scopes every query by `tenantId` only, never `orgId` — and `Tenant.orgs: Org[]` confirms this is a structurally real gap (client org and professional org can share a tenant), not a hypothetical one. Exploitability is not confirmed; see Risk register.
- SSE endpoints (`apps/api/src/infrastructure/sse/sse.controller.ts`) are `@Public()` and rely on a client-supplied `x-tenant-id` header plus an ownership check added after a prior cross-tenant leak fix — they do not go through the same actor-resolution path as REST endpoints.

## Options considered

### Option A — Adopt WS-01C's original vocabulary (`Workspace`, `WorkspaceMembership`, `ActorContextService`) as-is
Rejected. Both names are already bound to unrelated, shipped systems (Naming Collision Register, Collisions B and C). Adopting them would either silently shadow existing symbols in the same language (TypeScript allows same-name types in different modules, which is exactly how confusing collisions survive code review) or force a disruptive rename of live, working systems that are explicitly out of scope (G0 non-goals).

### Option B — Introduce a brand-new `Workspace` Prisma table parallel to `Org`, to match the external document literally
Rejected. `Org` + `Membership` already model the real tenancy boundary in every dimension WS-01C needs (tenant-scoped, N:M with `User` via `Membership`, has a `type` axis). A parallel `Workspace` table would create a third source of truth for "what space does this user belong to" — after `Org` and the already-existing UI-shell `Workspace` — which is precisely the outcome the control pack instructs against ("If `Organization + Membership` already represents the real business tenancy boundary, do not add a new `Workspace` table merely to match the original WS-01C document").

### Option C — Extend `Org`/`Membership` additively, name the new resolved-context type/service to avoid every confirmed collision, and treat context switching as the first real implementation gap (chosen)
Matches the evidence: nothing about the *data model* is missing structurally: `Org` already has a `type` axis and `Membership` already links `User`↔`Org`. What is missing is (1) a lifecycle on `Membership` (`status`), (2) a server-side switch mechanism, and (3) a resolved context type/service with a name that does not collide with anything found in the register.

## Decision

1. **Canonical business tenancy boundary is `Org` (scoped by `Tenant`), not a new `Workspace` table.** `Membership` remains the join. This answers Q1-Q3 of the control pack.
2. **One identity can belong to several `Org`s today** (Q4) — the schema and seed data already support and exercise this; what's missing is only the runtime mechanism to operate in more than one per session.
3. **Active org selection today is `memberships[0]` at login time, with no later change mechanism** (Q5) — confirmed, not inferred.
4. **Switching must be a new, explicit, server-verified endpoint** (Q6): authenticate → verify target `Membership` is `ACTIVE` → resolve capabilities → persist active org server-side (session-bound) → rotate/rebind session metadata → audit → return refreshed context. This does not exist in any form today and is the actual center of gravity of WS-01C — everything else is substantially already built.
5. **Permissions resolve as today** (Q7-Q8), via `packages/auth/src/rbac.ts` `rolePermissions`, extended to take a resolved `Membership` (with `orgId` + `roles` for that org) as input instead of a bare `roles[]` array disconnected from which org they apply to. No new capability engine is introduced; `rbac.ts` is wrapped, not replaced. Global vs. org-scoped vs. project-scoped permissions: today everything in `rbac.ts` is effectively org-scoped already (permissions are checked against the roles the active membership carries); project-scoped relationships (customer/prime/sub/crew on a specific job) already live on domain resources per WS-01C's own D-04/D-05 and are out of this ADR's scope.
6. **Current role fields stay compatible** (Q9): `SessionPayload.roles: string[]` continues to exist; the new resolved-context type carries `roles` for the *active* org specifically, sourced from the same `rbac.ts` roles, not a parallel role system.
7. **Intent continuity references context by `orgId`+`membershipId` id only, never by embedding permissions or consent** (Q10) — consistent with the security invariants in G0.
8. **`OperatorContext`, its `workspaceId`, and the `v1/workspace` UI-shell module are never touched, imported from, or renamed by this work** (Q11) — hard boundary, verified in the collision register.

### Naming decision (resolves the Collision Register's open proposal)

- **Type:** `ActiveOrganizationContext` — carries `identityId`, `orgId`, `tenantId`, `membershipId`, resolved `roles`/permissions for that org, `authStrength`, `capabilityVersion`. Replaces the informal, duplicated shapes found in three places (`packages/auth/src/session.ts`'s `SessionPayload`, `apps/api/src/modules/workspace/workspace.service.ts`'s `WorkspaceActor`, and the local unexported `ActorContext` in `apps/api/src/modules/change-orders/change-orders.service.ts:9`) with one canonical shape, without renaming or touching any of those three existing symbols directly in this slice.
- **Service:** `OrgContextService` — resolves and persists the active org context server-side; explicitly not `ActorContextService` (already taken, different job — row bootstrap) and not `WorkspaceResolver`/anything `Workspace*` (already taken, different job — UI shell state).
- **Capability resolution:** continues to be `rbac.ts`'s existing functions, invoked by `OrgContextService`; no new `CapabilityService` class is introduced in the first slice — `rbac.ts` is wrapped, per Option C.

## Why

- Every alternative that reused an existing name (`Workspace`, `ActorContextService`) either collides with a live, unrelated production system or requires touching code explicitly protected by G0's non-goals.
- Building on `Org`/`Membership` instead of a new `Workspace` table avoids a third parallel source of truth for tenancy, which is the exact failure mode both the collision register and the control pack warn about.
- Naming the gap precisely (context switching, not identity or capability modeling) means the first implementation slice can be small and additive instead of a full architecture rewrite — most of WS-01C's target concepts already exist under other names (see G1 table).

## Invariants

- No code under `apps/api/src/modules/workspace/`, `packages/shared/src/operator-context.ts`, or `packages/auth/src/operator-context.ts` is modified by any WS-01C slice derived from this ADR.
- `ActorContextService` (`apps/api/src/infrastructure/persistence/actor-context.service.ts`) keeps its current name and bootstrap-only responsibility; `OrgContextService` may call it as a sub-step but never replaces or is confused with it in code review.
- `payment-governance.service.ts`'s `tenantId`-only scoping is not silently "fixed" as a side effect of this work — it is a named, separate risk (see Risk register) requiring its own dedicated security-scoped change.
- Any change to per-request membership revalidation must explicitly measure and document latency impact before merge, given the previously reverted DB-lookup-per-request incident.

## First implementation slice

Smallest compatibility-first slice, WRAP before replace, per G0 acceptance criteria:

**New/changed files (proposed, subject to review at `plan` stage):**
- `packages/db/prisma/schema.prisma`: add `Membership.status` (`String`, default `"ACTIVE"`, values `INVITED|ACTIVE|SUSPENDED|REVOKED`) — additive, nullable-safe default.
- `apps/api/src/infrastructure/org-context/org-context.service.ts` (new): `OrgContextService.resolve(identityId, requestedOrgId?)` — wraps `rbac.ts`, reads `Membership`, returns `ActiveOrganizationContext`.
- `apps/api/src/modules/auth/auth.service.ts`: login continues to pick a default org (kept as `memberships[0]` for the first slice — changing default-selection *logic* is explicitly deferred, only the *switch* mechanism is new) but now also persists `membershipId` in the session.
- `apps/api/src/modules/auth/` (new endpoints): `GET /v1/me/context`, `GET /v1/me/organizations`, `POST /v1/me/context/switch` — per WS-01C section 06's contracts, adapted to real NestJS conventions after this ADR's naming.
- `apps/web/lib/auth.ts`: extend `SessionPayload` with `membershipId` (additive field, existing sessions without it fail closed to "reselect org" rather than crash).
- `apps/web/middleware.ts`: no route removal; add active-org awareness to the existing prefix-based guard, additive only.

**Schema impact:** one additive column (`Membership.status`), default backfill `ACTIVE` for all existing rows, documented migration per `semse-prisma-workflow` (never `db push`).

**Migration impact:** additive only; no destructive change; reversible by dropping the new column and new endpoints without touching existing login/session behavior.

**Tests required before this slice is `CODE_COMPLETE`:**
- Existing login/session tests continue to pass unmodified.
- New: switch to an `ACTIVE` membership succeeds and updates server-side session state.
- New: switch to a `SUSPENDED`/`REVOKED` (or nonexistent) membership is denied, fails closed.
- New: cross-organization object access (a resource belonging to org B, requested while active context is org A within the same tenant) is denied — this directly targets the confirmed `payment-governance.service.ts`-shaped gap class, even though that specific service is out of scope for this slice.
- Regression: a session created before this slice (no `membershipId`) does not crash — degrades to "reselect organization" flow.

**Rollout/rollback:**
- Feature-flagged or branch-gated; internal/admin accounts first, then a small set of test accounts with real multi-org membership (see G1 Pending #4 — needs a production read query to size this population before rollout).
- Rollback = disable the new endpoints and the `membershipId` session field consumption; existing `memberships[0]` behavior is untouched and still functions if the new code path is disabled.

### First-slice acceptance criteria (per G0/control pack)

- Existing login still works.
- Client/pro/admin routes still work, unchanged.
- Existing "first membership wins" behavior still works when the new switch path is not exercised.
- Context (`ActiveOrganizationContext`) is 100% server-derived.
- No new client-supplied authority is introduced anywhere.
- `OperatorContext`/Prometeo `workspaceId`/`v1/workspace` semantics are provably unchanged (no diff in those files).
- Revoked/inactive membership has a real test.
- Cross-organization access has a real test.
- Known production incidents (15s DB-lookup hang, P3018 migration failure, `db push` DML skip) are not reintroduced — verified by not adding a per-request DB lookup in the hot auth path and by using `prisma migrate dev/deploy` for the schema change.

## Compatibility

- **API:** additive only — 3 new endpoints, no existing endpoint contract changes.
- **Mobile:** not touched in this slice; `apps/mobile` session handling is out of scope until web/API are validated (per `project-semse-mobile-consolidation` memory — mobile work is already in flight separately and should not collide with this).
- **Events:** no new domain events in this slice; a `context.switched` audit event is written to the existing `AuditLog` (extended additively per G1 row 22), not to a new event type.
- **Database:** one additive `Membership.status` column, backfilled `ACTIVE`.
- **Workflows:** none touched.

## Risks

- **P0 — `payment-governance.service.ts` tenant-only scoping.** Structurally confirmed gap (multi-org-per-tenant is real, per seed data), exploitability not confirmed. Must be triaged as an independent security finding, not silently bundled into this ADR's slice.
- **P0 — SSE endpoints bypass the standard auth/context resolution path** (`@Public()` + client-supplied `x-tenant-id`). Any future `OrgContextService` must explicitly decide whether SSE gets covered or remains a documented exception; leaving it undocumented is the actual risk.
- **P1 — Membership revocation does not fail closed within a request cycle today**, by deliberate, previously-incident-driven design (JWT TTL only). Any WS-01C slice that promises "next protected request fails closed" (as the original external document's Journey D does) must either accept the existing TTL-bounded window explicitly, or propose a specific, latency-safe revalidation strategy and test it under load before merging — not assume it away.
- **P1 — Population impact unknown.** How many real users have >1 `Membership` today is unverified (G1 Pending #4); rollout sizing/blast-radius estimates in this ADR are provisional until that query runs.
- **P2 — Three near-duplicate "actor shape" types exist informally** (`SessionPayload`, `WorkspaceActor`, local `ActorContext` in change-orders). Left unconsolidated in this slice; `ActiveOrganizationContext` supersedes them for new code only, existing ones are not touched.

## Verification

- `grep -n "memberships\[0\]" apps/api/src/modules/auth/` and direct read of the login flow — confirms current org-selection behavior.
- Direct read of `apps/api/src/infrastructure/persistence/actor-context.service.ts` — confirms `ActorContextService`'s real (bootstrap) responsibility.
- Direct read of `apps/api/src/modules/workspace/workspace.service.ts` and its controller — confirms the `Workspace` module's real (UI shell) responsibility and its live `v1/workspace/*` routes.
- Direct read of `apps/web/lib/auth.ts` (full file) — confirms the real, HMAC-signed production cookie mechanism.
- `grep -n "orgId\|tenantId" apps/api/src/modules/payments/payment-governance.service.ts` — confirms tenant-only scoping.
- Schema read confirming `Tenant.orgs: Org[]` and seed data confirming two orgs under one tenant.

## Rollback

Entire ADR is reversible: no code has been written yet, only documents. Once the first slice lands, rollback is disabling the new endpoints/session field per the Rollout/rollback section above — no data-destructive step is part of this decision.

## Addendum 2026-09-18 — implementation-time conflict found, switch mechanism BLOCKED

During Fase 1 (spec) of the first implementation slice, `docs/specs/core/universal-identity-multi-role.spec.md` was found — an **`APPROVED`** spec (approved 2026-08-04 by the product owner, Fase 1-2 `MERGED`/`DEPLOYED` via PR #539) that this ADR's own research pass never surfaced. It changes the picture materially enough that the switch mechanism proposed above must not be implemented as-is without explicit reconciliation:

1. **A near-duplicate read endpoint already ships in production**: `GET /v1/users/me/capabilities` (`apps/api/src/modules/users/users.controller.ts:60-71`, `users.service.ts:81-97`) already returns `[{role, orgId, verifiedAt}]` across every `Membership` row for the caller — functionally the same payload this ADR's `GET /v1/me/organizations` would have produced. Building a second endpoint under `/v1/me/organizations` would recreate exactly the kind of naming/duplication collision the Naming Collision Register exists to prevent. **`GET /v1/me/organizations` is REUSE of this endpoint, not NEW** — extend it (add `status` to its payload) rather than forking a parallel one.
2. **An explicit, owner-approved product decision directly constrains any "switch" mechanism**: `universal-identity-multi-role.spec.md` §1 records that on 2026-08-04 the owner resolved "la capacidad activa se deriva 100% del proyecto/org abierto, nunca de una preferencia guardada" (active capability is derived 100% from the open project/org, never from a saved preference) — specifically to avoid a "stuck capability" failure mode where a session-level role/org selection silently overrides what's contextually correct for the resource actually being viewed.
3. **This is not a flat contradiction of the switch mechanism, but it is a real, unresolved interaction** that must be decided by a human before code ships, not inferred by an agent: WS-01C's context switch is only meant to set a *default* for org-agnostic surfaces (dashboard landing, "create job" default org, notification scoping) — per-resource capability must keep deriving from the resource's own `orgId`/`Membership` regardless of whatever the session's "active org" says, exactly as `universal-identity-multi-role` already mandates. But nothing in the switch endpoint's proposed contract (§06 of the original external document, or this ADR's slice) says that explicitly, and a UI built on top of a "Switch to Business context" action will very naturally treat it as global — reintroducing the exact "capacidad pegada" (stuck capability) risk the owner already rejected once, this time through a new code path instead of the old one.
4. **Resolution needed before code**: either (a) scope `POST /v1/me/context/switch` explicitly and only to org-agnostic defaults, with every resource-scoped read/write continuing to resolve capability from the resource's own org untouched by the session's active-org field (compatible with both specs, but needs an explicit acceptance criterion + test proving resource-scoped capability is never overridden by the switched context), or (b) treat WS-01C's context-switching goal as already substantially superseded by `universal-identity-multi-role`'s per-resource derivation model and scope this ADR down to just the `Membership.status` lifecycle gap, which is valid and useful independent of how (a) resolves.

**Decision for this slice**: proceed only with (b) — the `Membership.status` schema/lifecycle piece, which has no dependency on how the switch-vs-derive question resolves and closes a real, independently-confirmed gap (today a `Membership` cannot be represented as `SUSPENDED`/`REVOKED` at all, so nothing can deny access to one). The `OrgContextService`, the three new `/v1/me/*` endpoints, and any session/middleware changes are **held (`BLOCKED`)** pending an explicit product decision reconciling this with `universal-identity-multi-role.spec.md` — see `docs/specs/core/org-membership-status.spec.md` for the reduced, unblocked scope actually implemented, and `docs/reportes/2026-09-18_ws01c-slice1-membership-status.md` for the full writeup of this finding.

## Reconciliation decision 2026-09-18 (owner) — authorization vs. experience context

The owner (Samuel) resolved the (a)/(b) fork above directly, choosing neither option as originally framed but a synthesis: keep `universal-identity-multi-role.spec.md` as the sole authority for **authorization**, while recognizing that WS-01C's underlying need — the Shell should be able to greet a returning user with the organization they were last working in — is a real, separate, and legitimate concern that this ADR previously conflated with authorization. This section is now the canonical decision; the (a)/(b) framing above is preserved for its evidence trail, not as the live answer.

**Four concepts, deliberately kept distinct, none of which may silently become another:**

1. **Identity** — who the person is. Unchanged from the original ADR decision (`User`, global, no permanent role).
2. **Resource context** — which `Org`/`Tenant` a given resource (`Job`, `Milestone`, `Evidence`, `Payment`, `ChangeOrder`, ...) actually belongs to. Always derived from the resource itself, server-side, at read/write time. Never influenced by session state.
3. **Authorization** — what the actor may do to that resource right now. Resolved per `universal-identity-multi-role.spec.md`'s existing model: from the actor's `Membership` row(s) for that resource's own `orgId`, via `rbac.ts`. **This is the only path that grants capability. A session-level "active org" is never an input to this resolution.**
4. **Experience / preferred organization context** — a UX-only navigation preference (which org's Home/Work/Create/notifications the Shell surfaces first). May be stored server-side or client-side as a plain preference. **Structurally incapable of granting capability**: it is never read by any authorization check, only by UI composition and by pre-filling org-agnostic creation flows.

**Hard rule, restated so it cannot be reintroduced by a future slice through a different code path**: no field named or shaped like an "active org"/"current workspace"/"session context" may ever appear as an input to a `rbac.ts` permission check, a Prisma query's tenant/org scope, or a controller guard. If a future feature needs the resource's org, it reads it from the resource. If it needs the actor's permission, it resolves it from that resource's org plus the actor's `Membership` for that org — never from anything stored on the session.

**Naming**: the earlier "Naming decision" section above (`ActiveOrganizationContext`, `OrgContextService`, `POST /v1/me/context/switch`) described an *authorization*-shaped mechanism and is **superseded** for that reason, not merely renamed. If a preferred-organization UX feature is built later, it must be named to make its non-authority obvious at the call site — e.g. `preferredOrganizationId` (plain field, not a "context" or "session" type) and, if it needs a service, something like `NavigationPreferenceService`, never anything containing `Context`, `Actor`, `Workspace`, or `Session` (all already collision-prone per the Naming Collision Register, and the word "context" specifically is what caused this ADR to conflate authority with preference in the first place). This naming is not final — record it in the Naming Collision Register as a reserved/proposed name before implementing, per that register's own process.

**Rules for when a preferred-organization feature is eventually built:**

- *Resource creation (no existing resource yet)*: the preference may pre-select an org in the creation form. The user must be able to change it. The backend validates membership/capability for the org actually submitted at creation time — never assumes the preference was already authorized. The org recorded as the new resource's owner is the one validated at creation, not the preference.
- *Existing resource*: the preference is never consulted for authorization. Org/tenant is derived from the resource; authorization is checked against that org, full stop.
- *Required test*: at least one negative test proving a preferred org pointing at org B cannot produce access to, or a capability grant on, a resource that actually belongs to org A. This is the regression test for the exact "sticky capability" failure mode `universal-identity-multi-role.spec.md` was written to prevent.

**`POST /v1/me/context/switch` is not implemented under this ADR.** It is not merely `BLOCKED` pending reconciliation (the previous addendum's framing) — it is **rejected as specified** (authorization-shaped) and will not be built in that shape. A future, differently-scoped preferred-organization endpoint is a new, smaller design decision, not a resumption of this one.

**`Membership.status`**: unaffected by this reconciliation — it is an authorization-lifecycle primitive (can a `Membership` be denied), not a context-selection mechanism, and does not contradict `universal-identity-multi-role.spec.md`. It remains implemented as shipped in this slice. No per-request DB lookup was added; the previously-reverted 15s-timeout incident (see "Existing implementations found" above) still governs any future real-time revocation design, which remains a separate, not-yet-designed workstream.

**Two risks from this ADR's original Risk register are explicitly NOT resolved by this reconciliation and need their own workstreams before WS-01C's broader security posture can be called sound**: `payment-governance.service.ts`'s tenant-only (not org-scoped) query filtering, and the SSE `@Public()`/client-supplied-header boundary. Both are P0, both are orthogonal to the authorization-vs-experience-context question this section resolves, and neither should be inferred as "covered" by anything in this ADR.

## Deferred (explicitly out of scope for this ADR)

- Resolving the `payment-governance.service.ts` org-scoping gap (P0 risk above) — separate, security-scoped change.
- Resolving the SSE `@Public()`/header-trust boundary — separate, security-scoped change.
- Deciding whether `Security events` become a table separate from `AuditLog` (G1 row 23) — revisit once `OrgContextService` ships and real audit volume/shape is known.
- Unifying `Estimate` as a first-class domain concept (G1 row 15) — unrelated to identity/context, a domain-modeling question for whoever owns Jobs/BuildOps/Contractor.
- Consolidating the three near-duplicate actor-shape types into `ActiveOrganizationContext` everywhere (P2 risk) — a larger, separate cleanup once the new type has proven itself in the first slice.
- A production read-only query to confirm `Org.type` value range and multi-membership population size (G1 Pending #3-4) — needed before rollout sizing, not before this ADR's approval.
