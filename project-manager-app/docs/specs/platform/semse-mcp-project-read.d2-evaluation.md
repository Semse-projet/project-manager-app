# SEMSE MCP S1 — D2 Authorization Server evaluation and security gate

**Date:** 2026-10-16  
**Decision status:** **RECOMMENDATION / OWNER SECURITY DECISION PENDING**  
**Authority:** [issue #952](https://github.com/Semse-projet/project-manager-app/issues/952); S1 child spec remains **REVIEW**, ADR-045 **PROPOSED**.  
**Approved separately:** SEC-S1-01/02/03 and design D1, D3, D4, D5, D6, D7; **not** any D2 provider, OAuth configuration, production deployment or public enablement.  
**Current proof:** [PR #953](https://github.com/Semse-projet/project-manager-app/pull/953) is merged with CI PASS for the *internal*, non-provisioning Project read, not for external authentication.

## 1. Decision requested

**D2 proposal for owner/security review:** conduct a **nonproduction-only proof of concept with self-hosted Ory Hydra (OAuth/OIDC Authorization Server)**, while retaining SEMSE's User/AuthSession/Membership and SEMSE-controlled login/consent UX as the identity and authorization truth source. Do **not** automatically approve a Railway deployment, register external clients, or accept an OAuth token in the NestJS global AuthGuard. The proof must demonstrate interoperability with an actual 2026-07-28 MCP host, required client registration approach, and revocation **before** considering acceptance of D2.

This recommendation is **not an approved provider selection**. Alternatives stay available until the owner/security decision is recorded.

| Candidate | Fit | Risk / extra work | Decision |
|---|---|---|---|
| **Ory Hydra self-hosted** | Dedicated OAuth2/OIDC AS; existing SEMSE login and identity database can remain authoritative via a custom login/consent application; supports opaque access tokens and introspection | Separate service and PostgreSQL, secure admin API, backup/key rotation, login+consent implementation and patch operations; compatibility with MCP host/client registration must be tested | **Preferred proof of concept**, pending approval |
| Managed OAuth AS | Faster provider operations/keys and possible SLAs; SEMSE still must verify membership, organization and resource at each call | External cost and availability dependencies, hosted client-registration limitations, data-transfer review, consent/grant mapping | Fallback if operations are infeasible |
| Keycloak self-hosted | Integrated OIDC/OAuth ecosystem | Larger user/credential federation and runtime burden; evaluate risk of a second identity authority and admin surface | Alternative if Hydra pilot fails |
| Custom OAuth AS inside SEMSE NestJS | Full implementation control | Hardest protocol/security maintenance (PKCE, mix-up, issuer discovery, consent, redirects, signing, rotation, revocation) | **Not recommended for initial S1** |

**Why Hydra is considered, not presumed compliant:** official material describes separation between an OAuth Authorization Server and the existing login/consent application, opaque tokens with introspection and OAuth2 client management. **This does not prove SEMSE integration, MCP interoperability, licensing suitability, revocation performance, or production security**. Verify the precise self-hosted OSS/OEL feature/licensing matrix and version before procurement or deployment.

## 2. Verified SEMSE AS-IS security boundary

- `apps/api/src/modules/auth/auth.service.ts` authenticates a **SEMSE internal** access JWT containing `sid`; `AuthRepository.findActiveSessionAuthorization` checks persisted session, user status, and ACTIVE Membership for that org/tenant. The authorization lookup has a bounded 1-second deadline and fails closed. It is **not** a generic OAuth Resource Server.
- `apps/api/src/common/auth.guard.ts` is global and invokes `AuthService.authenticateRequest`. `RbacGuard` is also global. Marking a protected MCP route `@Public()` **bypasses both** and is forbidden.
- `ProjectsService.statusForVerifiedActor` from PR #953 returns only `{projectId,status}` via tenant-scoped, soft-delete-aware policy and no `ensureActorContext`. **It accepts caller-provided actor values** and does not authenticate itself; therefore, no HTTP tool may call it without a trusted OAuth-to-SEMSE bridge and current RBAC membership verification.
- API currently uses Zod 3; future MCP SDK v2 protocol schemas are isolated to Zod 4, not a monorepo-wide breaking upgrade.

## 3. Target sequence — fail closed at every step

```text
Registered MCP client → Authorization Code + PKCE S256, exact redirect, state/iss
  → OAuth AS begins login challenge (candidate: Hydra)
  → SEMSE-controlled login validates a real user session (no token returned to client)
  → SEMSE-controlled consent: client_id + org + audience + projects:read + expiry
  → Server-side ACTIVE consent stored and linked to user, org and current SEMSE session
  → AS mints opaque audience-bound resource access token (candidate)
  → MCP resource endpoint (future; DISABLED) receives Bearer on every POST
  → bound verifier validates token via AS introspection (active, iss, aud, exp, client, scope)
  → SEMSE checks consent ACTIVE and session ACTIVE / membership ACTIVE in org
  → server creates trusted actor from DB authorization, never tool arguments
  → RbacGuard requires projects:read; existing domain ownership checked
  → Project status read without provisioning → allowlist projectId,status + real request correlationId
```

**Important:** an opaque token merely being `active` at the AS is not enough to guarantee current SEMSE membership. An extra **bounded, no-cache read** against the SEMSE session/consent authority is mandatory. If the AS or SEMSE auth DB cannot be reached, refuse the request. Never fall back to the current web JWT or headers.

**Token binding and privacy:** use client + issuer + subject + tenant/org + resource audience + scope + session/grant mapping from trusted **server-side records**. No `tenantId/orgId/roles` from request JSON, unverified custom headers, or arbitrary AS token claims may select the tenant. Multi-org users must authorize each org separately; one org's grant never lifts to another org. Never put OAuth secrets or access tokens in Project, Evidence, logs, browser URLs, prompts, or telemetry.

## 4. Resource Server ↔ AuthGuard wiring gate

1. Introduce a **separate protected route marker and verifier** only after D2 is accepted, or a documented guard that safely delegates to a verification strategy. Do **not** annotate MCP `tools/call` as public and do not widen existing REST auth behavior.
2. The global AuthGuard or equally reviewed **pre-auth boundary** validates the resource token and populates a **server-verified** context. RbacGuard must still demand explicit `projects:read`, followed by Project ownership.
3. Serve non-sensitive OAuth Protected Resource Metadata with `authorization_servers` and valid RFC 9728 discovery/WWW-Authenticate behavior; host/client verifies AS issuer metadata. Public discovery metadata is distinct from a public tool route.
4. For protocol `2026-07-28` test POST/header consistency, method and tool metadata, Origin/Host restrictions, and no implicit legacy fallback. `tools/list` never authorizes `tools/call`.
5. Client registration: MCP 2026 favors Client ID Metadata Documents. **Do not assume the chosen AS supports CIMD**: run an interoperability matrix for the specific intended host; any DCR fallback requires a separate versioned compatibility decision.
6. AS **admin** endpoint and introspection credential must stay on private network and never be reachable by an MCP client. Rotate signing/encryption secrets, back up isolated AS DB, and test recovery.

## 5. Security acceptance matrix required before D2=APPROVED

| ID | Scenario | Pass condition |
|---|---|---|
| D2-01 | Authorization Code PKCE S256 + registered exact redirect | Valid client receives resource-scoped token only after SEMSE login and consent |
| D2-02 | Different issuer, audience/resource, expired token, altered signature | 401 before Project read; no `authContext` or provision writes |
| D2-03 | Valid token with missing `projects:read` | 403, no Project lookup |
| D2-04 | Previously valid token but SEMSE session revoked | Denied on **next** tool call, even before token expiry |
| D2-05 | Membership suspended or role removed for same org | Denied on next call; no cached positive authorization |
| D2-06 | Consent revoked, expired, or actor switches org | Denied; grant for A never applies to B |
| D2-07 | Two tenants and two orgs in same tenant | Forbidden/not-found indistinguishable externally; no data leak |
| D2-08 | Forged `authContext`, role, `orgId`, `tenantId` in headers/tool arguments | Ignored/rejected; real actor always from trusted auth |
| D2-09 | Token replay/cross-client and PKCE/redirect/state/issuer mix-up | Deny, no token issuance or Project execution |
| D2-10 | OAuth AS unavailable or introspection slow; SEMSE DB unavailable | Fail closed in bounded time, no fallback identity |
| D2-11 | Read, then revoked consent, then invoke again | First allowed, next denied; **zero** identity/domain writes |
| D2-12 | Real MCP host; 2026-07-28 + tested registration/discovery | `tools/list` and `tools/call` conform and use least privilege |
| D2-13 | Full incident kill switch OFF and recovery | MCP unavailable, REST/web unaffected |
| D2-14 | Logging, backups, key rotation, credentials, rollback | Redacted traces; AS admin/private storage protected and recovery exercised |

**Execution requirements:** tests against a temporary AS and synthetic users/organizations/projects; independent HTTP client or host; negative assertions must inspect DB write attempts and row-count deltas. Simulated mocks alone do not satisfy authenticated E2E. Never use existing real client jobs/evidence for mutation trials.

## 6. Decision record to complete by owner/security

- Selected D2 option and why: **PENDING**.
- AS version, edition/license, release signature and CVE patch plan: **PENDING**.
- MCP host and compatibility evidence (modern-only/CIMD or controlled alternative): **PENDING**.
- AS issuer, resource audience, protected metadata URI, secrets/key custody and deployment architecture: **PENDING**.
- Login/consent owner, `sessionId`/grant binding model, revocation SLA and DB schema review: **PENDING**.
- Threat model reviewers, test run links, rollback and operational approval: **PENDING**.
- Owner decision date, approver and approved scope: **PENDING**.

**No staging/production changes, Prisma migration, OAuth credentials, external route, enabled feature flag, or user/client onboarding are authorized by this document.** S1 stays REVIEW / NOT_DEPLOYED / INACTIVE; ADR-045 remains PROPOSED until D2 is accepted.

## Primary references (verify again for chosen version)

- MCP authorization-server discovery / resource metadata: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/authorization-server-discovery.mdx
- MCP 2026-07-28 authorization profile: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- Ory Hydra product and OSS/enterprise distinctions: https://www.ory.com/hydra
- Ory custom login/consent flow: https://www.ory.com/docs/oauth2-oidc/custom-login-consent/flow
- Ory Hydra official self-hosted quickstart: https://www.ory.com/docs/oel/hydra/quickstart
- Ory Hydra token issuance/opaque introspection and audience grants: https://www.ory.com/hydra and https://www.ory.com/docs/oauth2-oidc/custom-login-consent/flow
