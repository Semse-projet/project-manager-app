# Plan — DEC-R1

- Base: main 4b3b51625167045e1549cbe14e80e12aa55d133c; no main / Railway writes.
- Verify constitution, AGENTS.md, ADR-040, session-revocation-architecture REVIEW, SDD_GOVERNANCE and auth bootstrap consumers.
- Use AuthSession as authoritative persisted session; query User/ACTIVE memberships. Restrict roles to the intersection of signed claims, persisted session roles and currently active role keys. Reject empty intersection; other organizations remain unaffected.
- Use guarded deadline for auth lookup (default 1000ms); fail closed 503 on dependency failure, 401 on invalid session. No positive authorization cache across requests. No migrations.
- Issue bearer only after session write succeeded; prevent refresh replay using updateMany guard on current refresh hash, ACTIVE and non-revoked status. Renew only active effective roles. Implement narrow unit tests first.
- Organization reads must not call ActorContextService.ensureActorContext (which upserts records). Query Org.users with ACTIVE membership. Apply canReadOrg and permission decorators, OPS_ADMIN tenant-only.
- Preserve worker/BFF bootstrap compatibility only when the machine identity has a server-proved grant; an arbitrary bootstrap request cannot elevate human roles.
- Run builds/unit tests and strict SDD validation; draft PR and CI; stage a two-org synthetic canary only after separate release approval.
- Recovery must not restore claims-only access. Roll back traffic to a safe gate / disable affected route if strict validation breaks.
