# DEC-R1 security checklist

- [x] User authorized branch/PR scope; no production release.
- [x] Contradiction with prior session-revocation REVIEW and Railway latency incident documented.
- [x] Existing Org / User / Membership / AuthSession contract inventoried.
- [ ] Test-first red/green evidence recorded.
- [ ] AuthSession persisted before bearer issuance.
- [ ] 401 at next request after revoked session or membership.
- [ ] 503 fails closed on DB failure and timeout.
- [ ] Refresh replay/concurrent revocation race covered.
- [ ] Org GET causes zero writes or placeholder upserts.
- [ ] Bootstrap BFF and Worker behavior proven with real roles.
- [ ] Full build, unit, strict SDD, CI PASS.
- [ ] Draft PR reviewed; release explicitly approved.


## v0.3 follow-up

- [x] Main/PR #877 verified before editing; no duplicate implementation.
- [x] Target-org privilege borrowing reproduced before fix: 4 failures.
- [x] Target roles enforced without changing tenant/session context.
- [x] 29 local tests green; focused Prisma-backed typecheck green.
- [x] Evidence and limitations recorded in 2026-10-12 follow-up report.
- [ ] Full monorepo build, PostgreSQL/HTTP integration and strict SDD.
- [ ] CI on follow-up SHA green.
- [ ] Real worker/BFF identity, revocation and latency canary.
- [ ] Release approval, merge, deploy and functional verification of v0.3.
