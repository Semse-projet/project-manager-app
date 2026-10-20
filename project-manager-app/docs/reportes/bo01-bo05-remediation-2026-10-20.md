# BO-01 / BO-05 corrective implementation — 2026-10-20

Base: main 7bcdb71cc072813bfc4bd71814345b210c75755c; stacked on approved contracts #1017, ed2e4c87ff88dd68f30060198014a472efd77446. The user explicitly approved the contracts and requested corrections, automated catalogs/variables/critical-translations validation, then authenticated smoke. Approval is recorded in the specs; it is not an independent security review.

## Implemented

- Invitation links use fragment-only secrets, scrubbed before preview, retained in component memory only. Reject legacy query and ambiguous fragments. Server email links match. Company names HTML-escaped in email.
- Invitation and offer management bind to authenticated session organization, display it, verify again before mutation and clear sensitive state on org change. No implicit orgs[0]. All invitation/offer BFF reads/writes require the authenticated helper; no static server-identity fallback. Secret-bearing responses explicitly no-store. Keep drafts on language changes. Real cancellation/termination reason; PRO invitation route on worker surface. Neutral localized errors.
- Authoritative OrgOwnership registry, additive migration with composite tenant/org FK, no automatic legacy owner assignment. Offer management reads/writes require active effective scoped OPS_ADMIN or an active CLIENT matching verified owner. Provisioning is explicit scoped OPS, evidence/reason/ticket, denies reassignment. PRO and supervisor do not read management compensation; recipient keeps own offers. Classification input rejected and no W2/1099 collected.
- Offer mutation plus audit use Serializable transactions/retries. Invitation acceptance/registration membership audits share their transaction. Audit failure rolls back domain changes.
- Public invitation ingress uses HMAC method/canonical-route/IP/timestamp assertion from BFF and an atomic shared Redis bucket. Production unsigned requests are denied. Matched Nest route metadata determines protected endpoints, preventing URL spelling bypass. Store failure denies service. Other routes retain existing ThrottlerGuard behavior.
- Automated validator covers 1,098 ES/EN messages in four declared dictionaries; detects duplicate keys/flattened collisions, missing/empty keys, invalid ICU, variable/type mismatch and stale/unapproved critical metadata. Sixteen exact critical texts remain inReview, with no fabricated reviewer approval.

## Executed verification

- Prisma 6.19.3 schema validate: PASS, dummy local DATABASE_URL, no database connection/migration execution.
- 19 actual offer service tests: PASS using transpiled implementation with in-memory Prisma/audit doubles; controller metadata test excluded from this local harness.
- 13 actual invitation service tests: PASS with in-memory doubles, including audit-failure rollback/retry; controller metadata test excluded locally.
- Two actual invitation guard tests: PASS, fake shared Redis interface; mandatory signature, spoofed raw forwarded IP denied, store failure, flag OFF, quota shared by two guard instances, client/route isolation. This is not two live API replicas or a real Redis integration test.
- Three token/proxy tests: PASS, including query rejection/scrub and signature method/path/time/client tampering.
- Five validator regression tests: PASS; 1,098-message structural catalog validation PASS. Critical gate FAIL with 16 CRITICAL_REVIEW_REQUIRED entries, expected outstanding human review.
- spec-index check: PASS, 203 specs. Approved contract head CI run 39380580728 SUCCESS. This doc CI does not validate implementation.

Added a real PostgreSQL owner/tenant-FK/concurrent-provisioning/audit-rollback integration test; pending CI execution, not counted as PASS. First CI exposed an ioredis default-import NodeNext compile error, corrected with the package named Redis class export.

Full monorepo build/typecheck, real PostgreSQL migration/rollback/concurrent-owner proof, real Redis/multiple replicas, and new-code deployment smoke remain required. Local snapshot is partial; isolated service tests cannot establish these gates.

## Authenticated preview smoke evidence

TinyFish run https://agent.tinyfish.ai/runs/dcec88a0-4665-4d23-9e57-e67480724c33, 2026-10-20, CLIENT QA session confirmed by user, desktop. Preview https://semse-web-pr969-preview-production.up.railway.app (identified as #969, deployed SHA not independently established).

Observed authenticated /client/dashboard and GET /api/semse/users/me 200. ES→EN→ES navigation switched; /client/jobs/new title/description dummy draft survived language switch, without submission. /client/payments empty state and $0 figures visible. No payments or invitations made. Raw tool report contained account identifiers; deliberately excluded here.

Limitations/observations: the tool's overall PASS overstates evidence. It reports role label «Cliente» remaining in EN; retain as localization observation. $ visibility does not establish ISO currency or raw monetary equivalence. No actual attachments, mobile, denied routes or PRO/WORKER/OPS_ADMIN sessions checked. Existing preview response has user data, not proof of the new explicit BFF organization context. This smoke does not cover the unpublished remediation or prove exact runtime SHA.

## Ingress activation and rollback

No production configuration changed. Before invitation activation verify on staging that Railway edge overwrites X-Real-IP and the BFF cannot be reached through an untrusted alternate ingress. Only then configure SEMSE_INVITATION_TRUST_RAILWAY_EDGE=true on web and a shared random SEMSE_INVITATION_PROXY_KEY (at least32 characters) on API/web through secret configuration; never put values in git/reports. API needs shared REDIS_URL. Assert direct unsigned production invitation calls return401, spoofed X-Real-IP cannot change signed identity, two real client IPs have independent quotas, and two API replicas share quotas. Missing/invalid ingress config returns503/401. No secrets in logs. BFF becomes the required production transport for public preview/register/accept; direct callers require the trusted transport and are not silently permitted.

Keep invitations/offers flags OFF pending these gates, human exact-text review, independent security review, full CI and deployed acceptance. Additive ownership migration performs no backfill. Rollback application while flags OFF; retain ownership/audit data. Do not DROP table or erase provenance as a routine rollback. No owner transfers or automatic legacy migration. Coordinate shared AuditService changes with concurrent #1013 before integration.
