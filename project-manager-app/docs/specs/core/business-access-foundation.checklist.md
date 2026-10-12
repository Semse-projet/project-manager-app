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
