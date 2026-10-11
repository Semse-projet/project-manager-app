# SEMSE Field Memory 4D — Incremental delivery, backlog, test matrix and evidence gates
**Date:** 2026-10-11 · **State:** IMPLEMENTATION PLAN PROPOSED. No application code changed by this documentation.
**Product source:** PRODUCT_REQUIREMENTS.md · **architecture source:** SYSTEM_ARCHITECTURE.md.

## 1. Delivery strategy and dependencies
Start with observable, genuinely useful field workflows, then add precise spatial indexing, then historical playback. A working site/time/task/photo flow is more valuable than an impressive empty 3D viewer. Preserve client systems, use existing SEMSE domain owners and expand by backward-compatible adapters.

**Sequence:** (0) confirm current truth and governance -> (1) workforce attendance reliability -> (2) teams + assignments -> (3) evidence before concealment and cross-party handoff -> (4) location and historical timeline -> (5) advanced BIM/4D -> (6) connector expansion and AI. Order can overlap for independently testable features, but cannot bypass required safety gates.

**Release status vocabulary:** INVENTORIED, SPECIFIED, CODED, TESTED, MERGED, DEPLOYED, CANARY_VERIFIED, ENABLED. A document with "IMPLEMENTED" in front matter is not enough to assert actual release.

## 2. Workstreams and candidate PR slices
### W0 — Exact baseline, product clarification and no-regression (P0)
**Deliverables:**
- Inventory current main with exact SHA, dated CI report, Railway deployment provenance for API, web, worker, vision and mobile build status; distinguish deployed from repository only.
- Crosswalk existing code vs REQ IDs and decisions; assess current modules: Labor Engine/time-tracker; JobTask/BuildOpsTask; Evidence/evidence-gateway; Vision; Prometeo active route vs orphaned routes; Universal Connector feature readiness.
- Resolve (or issue for owner) existing ADR-042 duplicate ID without overwriting previously accepted/proposed decisions.
- Validate staffing/GC site rights, break policy & payroll rules, photographic rights, worker consent/privacy and retention for initial jurisdiction.
- Inspect existing Org/Membership/multi-role and registration flows before coding worker company enrollment; design safe company owner onboarding, invite/accept/revoke and no-smartphone fallback (REQ-ORG-001…011).
- Define minimal worker, crew lead and outside supervisor journeys with accessible Spanish/English screens.
**Tests/gates:** baseline build/tests on exact SHA, security and tenant matrix, field pilot readiness checklist, approved SDD 2.0 spec per slice; maintain legacy mobile compatibility.

### W1 — Trustworthy attendance and configured schedules (P0)
**Candidate PRs:** W1-A canonical labor path (tests first), W1-B shift/break revisions, W1-C geofence exit UX and dual notifications, W1-D offline and edit reconciliation.
**Changes:**
- Ensure every start/pause/resume/stop/manual entry path reaches canonical Labor Engine; leave field-ops as adapter until verified. No destructive one-shot migration.
- Per-site/project/crew/worker schedule overrides, target work hours, actual break intervals, pay classification and separation from geofence presence. Include 8×5 and 10×4 Monday–Thursday patterns with 40h/week, site-specific break policies, actual-time alerts, multi-site aggregation and applicable wage rules (REQ-SCH-001…004).
- Configurable notifications to worker and lead at e.g. 15m-before and on daily work target; once/event semantics and opt-in delivery.
- Proximity mode ASK/AUTO/OFF; add robust EXIT and action choices Finish/Pause/Continue, location accuracy/hysteresis, notifications but no silent stop or wage deduction.
- Add versioned timesheet correction proposals, employer review/audit, worker self-view and offline conflict reporting.
**Accept:** site A 8h with project-specific noon break, site B different shift; worker leaving to buy supplies clicks Continue and time persists; missing checkout corrected via reviewed request; repeated geofence crossing causes no duplicate shift.
**Blockers:** legal/privacy review, actual iOS/Android device testing, migration rollback and phantom migration regression scenario documented in ADR-029.
**Not a shortcut:** existing proximity auto-start only proves that code path exists; it does not prove native OS reliability or exit logic.

### W2 — Work packages, crew scheduling and field task UX (P0/P1)
**Candidate PRs:** W2-A crew membership and lead permissions, W2-B instruction -> work package -> TaskAllocation, W2-C worker offline task UX, W2-D foreman dashboards and notification.
**Changes:**
- Model staffing employer separate from site contractor and restricted external guests. Reuse User/Org/Membership: company owner invites users, workers register/accept with personal identities, crew leads receive scoped assignment rights; avoid a parallel Workspace and respect project-derived capacity.
- GC instruction captured via text/voice/import as an incoming source; lead decomposes seventh-floor wiring and box installation by zone, crew and prerequisite. Prometeo may propose, cannot silently assign.
- Task carry-over, blocked/waiting/on-hold, accountability per worker/shared crew, dependent tasks and acceptance records.
- Each worker sees their own jobs/tasks, attachments, latest instructions; foreman sees own team, employer sees own labor and permitted reports. Other companies see no private payroll.
**Accept:** thirty workers split among 15/15, 5/25, etc; first wiring task spans two days; task closes without stopping work clock; worker submits blockage and lead reassigns; tenant isolation and project relationship enforced.
**Dependencies:** JobTask unification phase status re-audit, effective permission tests.

### W3 — Before-concealment evidence and approvals (P0)
**Candidate PRs:** W3-A media storage reliability and provenance, W3-B evidence/task bindings, W3-C inspection workflow and handover, W3-D access-controlled export/share.
**Changes:**
- Capture native original photo/video with hash, versions, job/task/floor/zone/element context; marker/scale attachment. Background upload with resume; annotation separately.
- Trade-specific checklist: before concealment (wall, ceiling, slab), during installation, after completion. Distinguish QA file validation vs human installation verification.
- Crew lead review -> site reviewer -> correction/reject/approve; never let one actor fabricate both evidence and independent approval without authorization.
- Secure package share by tenant/organization with recipient, purpose, expiry, revocation and redaction. GC without SEMSE uses restricted invite/export, not full account access.
**Accept:** work on floor seven cannot be marked "pre-concealment verified" without correct scoped evidence/reviewer when policy requires; private files not accessible from different tenant; revoked link unavailable; lost upload retries without duplicate evidence.
**Dependencies:** Evidence/evidence-gateway ownership convergence, private object storage backup/restore, video limits, metadata quality, tenant isolation.

### W4 — Spatial Registry and retrospective 2D timeline (P1)
**Candidate PRs:** W4-A site/floor/zone/reference models, W4-B plan revision and manual pin/QR, W4-C temporal projection & search, W4-D cited Prometeo retrieval.
**Changes:**
- Registered building/floor/room/wall/surface names and coordinates, attachments to plan revisions. Manual annotations support accuracy and confidence classes.
- QR or marker IDs for worker-friendly capture at a wall/room; prevent cross-revision coordinate confusion.
- Event ingestion of verified Task/Evidence/drawing records, event time/recorded time, supersession without rewriting history.
- 2D plan timeline and exact image/video retrieval by location/date; Prometeo uses read-only cited query tools and 'unknown/estimate/verified' classification.
**Accept:** months after wall concealment, authorized maintenance technician sees floor/zone + dated pre-cover photo, reviewed evidence and drawing revision, with a missing-source uncertainty warning; replay yields correct past state.
**Dependencies:** W3 original image provenance, reference coordinate contract, source event completeness.

### W5 — BIM interoperability and 4D viewer (P2)
**Candidate PRs:** W5-A IFC import boundary and revision metadata, W5-B element mapping/spatial transform, W5-C 3D visualization, W5-D timeline overlay and contradictions.
**Changes:**
- IFC/BCF compatible pathway only where data rights, provider API and import format are confirmed; IFC GUID -> BuildingElement IDs, mapping to verified evidence.
- Coordinate frames, transformations, units, model revision and geometrical tolerance. Document model coverage and unknowns.
- Interactive model + timeline: historical coverage from real evidence/verified records; visual estimates clearly marked, not represented as hidden-cable certainty.
- Grounded defect search and scoped maintenance export.
**Accept:** model element + selected historical date resolves exact cited associated media and confidence; import from changed model revision does not remap evidence incorrectly; viewer distinguishes unverified geometry.
**Dependencies:** W4 references, test IFC samples with explicit rights, transformation/calibration expertise, performance budgets.

### W6 — External connector pilots and governed automation (P1/P2)
**Candidate PRs:** W6-A Universal Connector CI recovery, W6-B one provider READ_ONLY, W6-C authorized handoff/export, W6-D change sync & replay, W6-E Prometeo capability expansion.
**Changes:**
- Repair any current connector CI/spec gaps, refresh production evidence. Align ADR-042 universal trust chain and Tool Registry boundaries.
- Choose real partner with authorized access for external GC tasks/drawings or BIM docs, start read-only, then limited write capabilities only per approved scope.
- Track provider cursor, external IDs, version, consent, idempotency, webhook integrity, retries, tombstones, disconnect and export portability.
- Prometeo may request approved actions, never override site/tenant policy, run direct provider writes or obtain provider secrets.
**Accept:** malicious external task text cannot instruct Prometeo to bypass authorization; revoked read connection fails; same webhook 10x produces a single canonical effect; imported record conflicts do not overwrite manually verified as-built.
**Dependencies:** W0 contract conformance, W3 share rights, W4 canonical external mapping.

## 3. Verification matrix (minimum)
| ID | Level | Scenario | Expected |
|---|---|---|---|
| VT-01 | unit/integration | 06:30–17:00 with *actual* 60m unpaid break | 10h30 presence, 9h30 worked; no implicit deduction |
| VT-02 | integration | Two projects configure different break/target schedules | independent alert and pay calculation |
| VT-03 | mobile device | Arrival in ASK vs AUTO vs OFF | consent-respecting prompt/start/none; no ghost shift |
| VT-04 | mobile device | GPS drift, exit, reentry, background restrictions | one prompt per threshold/dwell; no silent stop |
| VT-05 | API | Repeated start/stop/offline client ID | idempotent canonical entry; no duplicate |
| VT-06 | API | Worker corrects clock-out after driving home | old and amended values retained; reviewer and reason |
| VT-07 | API | Target 8h with 30m unpaid break | alert based on worked minutes, not wall time |
| VT-08 | API/UI | 15/15 crews + 2-day task + 3–5 daily tasks | allocation and progress correctly retained |
| VT-09 | API | Workers assigned same crew task | each sees assignment; single canonical Task |
| VT-10 | API | GC attempts staffing payroll read | denied unless explicit data grant (default denied) |
| VT-11 | API | Tenant B reads Project A evidence by guessing ID | 403/404 no data |
| VT-12 | storage | Original capture replaced/annotated | hash and original preserved; history linked |
| VT-13 | E2E | Photograph uploaded offline then synced | one original object/evidence row, traceable |
| VT-14 | E2E | Before-concealment checklist incomplete | no false approved-as-built status |
| VT-15 | E2E | Worker -> crew lead -> authorized site handover | distinct review chain and limited recipient scope |
| VT-16 | authorization | Evidence share expires or is revoked | immediate deny on new access |
| VT-17 | import | Room renumbered/model revision updates | historic anchor references correct original revision |
| VT-18 | query | Ask 'what was behind floor 7 wall in February?' | sourced dated photos, reviewer, confidence |
| VT-19 | AI safety | No photos behind specified wall | uncertainty and follow-up verification, no invented wiring |
| VT-20 | connector security | Forged webhook, replay and tenant mismatch | rejected before canonical write |
| VT-21 | connector policy | Valid provider signature but Policy DENY | no business effect |
| VT-22 | E2E | Six-month replay after worker account deactivation | authorized historical view still works |
| VT-23 | observability | Crash between object upload and DB commit | reconciliation, no orphan exposure and audit trail |
| VT-24 | disaster recovery | Media restore from encrypted backup | original hash validated and permitted view restored |
| VT-25 | load | 30+ active crew members, concurrent photos/videos | acceptable latency, no data cross-leak |
| VT-26 | contract | all time mutation APIs converge on Labor Engine | no dual source of truth |
| VT-27 | contract | Evidence Gateway uploads resolve to canonical Evidence | equivalent identity/state and no duplicate approval |
| VT-28 | mobile accessibility | poor signal + Spanish/English prompts | actionable controls without losing reports |
| VT-29 | data governance | AI external provider disabled by tenant | no image/data exfiltration, local/manual path works |
| VT-30 | 4D/model | imported IFC element moved or conflicts with site photo | mismatch surfaced for human review |
| VT-31 | identity/e2e | company owner invites 15 workers, all enroll personally | membership bound to correct Org, no shared company account |
| VT-32 | security | invitation replay/expired token, membership revoked, cross-company context | all denied with audit; no role leakage |
| VT-33 | schedule | 10h×4 and 8h×5 in different projects | right per-day alerts, 40h weekly actual total, no wrong break deduction |
| VT-34 | schedule | 10h presence with 1h unpaid meal | 9h actual worked, not 10h |
| VT-35 | onboarding | invited worker lacks smartphone | authorized identity-specific kiosk/manual alternative, retained audit |

Additional privacy/security tests: retention expiry, legal hold, cross-tenant search index leak, revocation against cached media URLs, logged coordinates/redaction, URL signing and secret leak scans. Acceptance requires documented results, not just test definitions.

## 4. Release gates per slice
**Gate G0 — Design/identity:** product owner approves scope, actor/tenant matrix, source-of-truth domain and SDD 2.0 spec. Legal/contract review for timekeeping and evidence.
**Gate G1 — Contract/data:** migration backwards compatible, explicit ownership of tables, indexes/foreign keys, schema and client DTO, idempotency, concurrency and recovery model.
**Gate G2 — Tests:** TypeScript/build/lint as applicable, unit/integration/e2e, tenant/isolation/privacy, background location on real iOS/Android, provider replay; strict spec validator and CI green at exact commit.
**Gate G3 — Merge & provenance:** reviewed PR, no bypassed protection, exact SHA and deploy manifest. Non-destructive migration with rollback before canary.
**Gate G4 — Real canary:** authenticated tenant/role smoke on Railway for API/web/worker/vision and physical phones; durable storage/retrieve, break and exit events observed; disable flag on regression.
**Gate G5 — Activate:** monitor error rates/denials, field worker feedback, false location alerts, missing evidence and retention jobs; update production evidence only after verification.

A failed phase stays PARTIAL/UNVERIFIED. Never turn partial CI or docs into "COMPLETE." All production feature flags default off until permitted canary; dangerous permission failures fail closed.

## 5. Key API/design questions for human approval
- W1: if worker declines location permissions, permit manual attendance? Recommended yes. Can organization turn on auto-start by default? Recommend ASK after consent.
- W2: can a GC external foreman create instructions directly? Recommend only through explicit shared-project authorization; default internal lead capture.
- W3: is site superintendent's review mandatory for every task, or only pre-concealment gates? Define per site/trade scope.
- W3: who owns long-term evidentiary copies if staffing contract terminates? Require legal terms and exportability.
- W4: minimum location metadata: building+level+zone/room+wall surface vs exact world XYZ? Start with reliable human labels and revision-linked 2D pin.
- W5: first BIM partner/file format and model usage rights; cannot promise adapter before confirmed API and sandbox.
- W6: whether legacy evidence/clock adapters may keep read-only endpoints indefinitely; write-state must converge to canonical owners.

## 6. Required implementation handoff and risk management
Each engineering PR must cite REQ IDs, new/changed APIs, migration path, feature flag, test cases, cross-tenant threat model, real sample event/media, rollback and linked exact CI runs. Update docs/SPEC_INDEX.md using repo's canonical generation/validation workflow when child SDD specs are approved. Do not register this exploratory folder as implemented product behavior.

**Risk register:**
- Critical: privacy/cross-org media disclosure; inaccurate worked-time deductions; forged evidence approvals; unsupported hidden utility location assurances; leaked provider credentials; unsafe agent writes.
- High: dual-write time or evidence inconsistencies; orphan uploads; offline replay; model revision displacement; retention inability after personnel turnover; incorrect PDF/video timestamps.
- Medium: notification fatigue; project floor naming conflicts; storage/index cost; external provider rate limits; partial adoption by subcontractors.
Mitigations: canonical owners, human review, explicit uncertainty, permission tests, idempotency, emergency controls, durable originals, canary + rollback, actual field usability research.

## 7. Initial thin-slice success definition
Pilot with one electrical site, one crew lead, 2–15 workers (then test up to 30), an 8-hour configured target and at least two distinct worksite schedules. A worker checks in with permissions or manually, lead distributes wiring/boxes tasks, one task rolls to next day, photo is captured before wall closure and reviewed, GC receives only scoped evidence, worker gets target/exit alerts without false deductions, future viewer retrieves same media by floor/zone/date. This is the first defensible 'field memory' release; BIM/3D remains a later extension, not a dependency for value.
