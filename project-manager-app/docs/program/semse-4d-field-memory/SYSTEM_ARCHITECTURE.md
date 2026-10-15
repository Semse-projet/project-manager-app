# SEMSE Field Memory 4D — Architecture, data and authority boundaries
**Edition:** 2026-10-11 · **Status:** DESIGN PROPOSAL. No runtime or production claim.
**Baseline inspected:** Semse-projet/project-manager-app main commit 4e4fd4f5818dd4c63ee25a69e49781cb2b62ec49; file-structure and selected source/spec reads. This is a targeted audit, NOT exhaustive code coverage, CI evidence or Railway smoke test.
**Scope:** Field staffing, site supervision, evidence, spatial-temporal historical construction memory, Prometeo and third-party connectors.

## Additional discovery continuity
For company-owner organization creation, worker invitation and membership, one account per person, crew lead authorization and Monday–Thursday 4×10 actual-hour schedules, see [ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md](ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md). Reuse existing \`Org\`, \`Membership\` and project-derived capability boundary; the organizations controller reviewed on main has read-only GET routes and should not be assumed to offer an invitation/product journey.

## 1. Audit: reusable code vs decision vs unverified capability
| Domain | Observed on main | Reuse/next action | Verification still needed |
|---|---|---|---|
| Labor / mobile | apps/api/src/modules/labor-engine/* and field-ops/time-tracker.controller.ts, apps/mobile/src/api/labor.ts, TimerScreen.tsx, geo/proximityService.ts / backgroundLocation.ts | **REUSE Labor Engine**, ADAPT field-ops, extend mobile geofence and schedule policy. Existing proximityService has an 'auto' mode that calls startTimer on nearby sites. | Exit prompts, background OS delivery, reconciliation, pay accuracy and canary not proven |
| Crew / task | apps/api/src/modules/tasks/*, buildops/*; models JobTask/BuildOpsTask/AgroFarmTask documented in task-unification spec | **REUSE/CONVERGE JobTask**; add explicit crew, assignment, work package and cross-organization share contracts | Confirm current task unification migration status and multiworker allocation |
| Evidence | apps/api/src/modules/evidence/*, evidence-gateway/*, evidence-exif.ts, evidence-metadata.ts, apps/mobile/src/api/evidence.ts | **REUSE Evidence** canonical, adapt gateway for ingestion, add location/asset/temporal refs. EXIF parser exists; EXIF is corroborating metadata, not a proof of truth. | Reliable secure media storage, originals, versioning, long-term retention and complete upload-review-access flow |
| Vision | apps/api/src/modules/vision/*, apps/vision-service/app, vision-service client | **REUSE as analysis adapter**; detect quality/issues and provide low-confidence suggestions only | Real-world recognition performance, accepted model benchmarks and privacy controls |
| Prometeo | apps/api/src/modules/agents, prometeo, prometeo-copilot, orchestration; packages/agents, tools, knowledge | **REUSE existing product Copilot pathway** with governed tools. ADR-038 documents multiple reachable but UI-orphaned surfaces. | Do not accidentally wire an orphaned endpoint or claim every Prometeo surface is active |
| Connector | packages/shared/src/universal-connector/* (contracts, enforcement, runtime trust, idempotency, webhook trust), satellites and integrations adapters | **REUSE universal trust boundary** and external Tool Registry. Add BIM/PM connectors only after conformance gates. | Spec documents CI FAIL / UNMERGED / NOT_DEPLOYED at last recorded verification (2026-10-06), which may be stale; refresh with CI/production evidence |
| Events / audit | domain-events, audit and Operational Intelligence Graph proposal | **REUSE existing outbox/audit patterns**, add stable evidence lineage and spatial event projections | Current authority path and duplicates need focused audit |
| BIM / 4D | No verified canonical construction-spatial/temporal subsystem found during targeted review; 'spatial' search yielded unrelated canvas awareness | **DESIGN NEW capability** under BuildOps + Evidence/Known Building State | Full repo inventory still required before asserting absence |

Key ADRs: ADR-029 canonical Labor Engine, ADR-028 canonical Evidence adapter, ADR-038 orchestration reachability, ADR-042-universal-connector-trust-boundary and ADR-044-operational-intelligence-graph (renumeración documental propuesta y registrada en `docs/architecture/ADR_ID_RECONCILIATION_2026-10-15.md`; no cambia el estado PROPOSED del grafo).

## 2. Logical component topology
1. **Mobile/web capture surfaces** — worker, lead, employer and invited site viewer. Expo location, notifications, media picker, offline queue and PIN/QR/plan placement. UX does not own authoritative time, task or evidence state.
2. **SEMSE API NestJS boundary** — identity, tenant context, org membership, project membership, authorizations, anti-cross-tenant guards and precise resource scopes.
3. **Canonical Labor Engine** — clock session/time entries, schedule policy, actual breaks, corrections, audit and payroll/export. Field Ops is an adapter; no second mutable timer truth.
4. **Canonical Tasks/BuildOps** — work packages, dependencies, staffing crew assignment, job/task state, lead vs site instructions, stage review.
5. **Canonical Evidence** — object registration, original media + hashes, metadata, review state, versions, tenant grant controls, media access. Evidence Gateway is integration ingress only.
6. **NEW Spatial Registry** — building/floor/zone/room/surface/asset reference dictionary, drawing and IFC model versions, coordinate transform, confidence scores.
7. **NEW Temporal/As-Built Projection** — append-only events and read-optimized timeline, effective/observation time, linkage to existing sources; no replacement of canonical domain owners.
8. **Prometeo bounded retrieval/action adapter** — tools to search spatial registry/evidence/tasks/time with existing Policy/Approval. Human-review action requests never self-approve.
9. **Universal Connector boundary + provider adapters** — external GC project management, BIM repositories, QR plans, webhooks, exports. Read-only first; no direct provider-initiated privileged writes.
10. **Storage/search and data plane** — PostgreSQL/Prisma for metadata and authority, controlled object storage for media, Redis/BullMQ for queued derivatives/retries, search index optional projection, model/IFC file storage. No AI-generated response is a canonical construction record.

Data direction (illustrative):
GC instruction or external import -> authorized WorkPackage -> crew lead task assignments -> worker time and captures -> Evidence verification -> spatial anchor and asset linkage -> authorized handover -> Temporal Projection -> Prometeo query -> cited evidence with confidence.
Third-party software -> Universal Connector (trust check) -> normalized inbound reference -> canonical service (policy/approval) -> audit/outbox. Never bypass.

## 3. Proposed canonical data contracts (schemas NOT yet implemented)
Use tenant-scoped UUID/CUID identifiers and explicit actor metadata. Avoid committing DB schema until migration ownership is reviewed.

**Worksite and geography:**
- ConstructionSite {id, tenantId, name, externalIds, timeZone, lat?, lon?, radiusMeters?, policyId?, activeRevisionId?}
- BuildingLevel {id, siteId, buildingId, label, elevation?, coordinateFrameVersion}
- ConstructionZone {id, levelId, roomOrSector, polygonOrPlanRegion?, aliases?, parentZoneId?}
- BuildingElement {id, zoneId, elementType, trade, circuitOrSystemId?, surfaceRef?, externalIfcGuid?, physicalState?, supersededBy?}
- SiteCoordinateFrame {id, siteId, type: PLAN_2D | LOCAL_3D | GIS, units, origin, rotation, calibrationMethod, calibratedBy, version, errorEstimate?, createdAt}
- DrawingRevision {id, siteId, fileRef, revision, status: DESIGN | IFC_ISSUED | FIELD_MARKUP | AS_BUILT_VERIFIED, coordinateFrameId?, sourceConnectionId?, recordedAt}
- SpatialAnchor {id, tenantId, evidenceId, siteId, zoneId?, elementId?, drawingRevisionId?, planX?, planY?, localX?, localY?, localZ?, anchorMethod: MANUAL_PIN | QR_MARKER | DEVICE_GPS | SURVEYED | MODEL_ELEMENT | AI_SUGGESTION, estimatedErrorMeters?, confidenceClass: VERIFIED | ESTIMATED | UNKNOWN, verifiedBy?, evidenceRef?}

**Labor and crews:**
- ShiftPolicyVersion {id, tenantId, worksiteId, validFrom, validTo?, timeZone, dailyTargetMinutes, breakRules, paidBreakRules, notificationOffsets, approvedBy, revision}
- Crew {id, tenantId, siteId, trade, leadUserId, effectiveFrom, effectiveTo?}
- CrewMembership {crewId, workerId, effectiveFrom, effectiveTo?, skillClaims?, sourceOrgId}
- ExternalWorkInstruction {id, siteId, gcSourceRef?, createdByActor, description, priority, issuedAt, sourceFormat, trustLevel}
- WorkPackage {id, tenantId, instructionId?, zoneIds, scope, dependencyIds, crewId?, plannedDate, status}
- TaskAllocation {id, taskId, workerId?, crewId?, assignedBy, assignedAt, acceptedAt?, status, dueAt?, effectiveFrom?, effectiveTo?}
- TimeCorrectionRequest {id, canonicalTimeEntryId, originalInterval, proposedInterval, reason, actorId, reviewerId?, result?, timestamps, sourceEventIds}; actual TimeEntry remains in canonical labor model.

**Evidence/history:**
- FieldCapture {id, canonicalEvidenceId, captureIntent: BEFORE | DURING | AFTER | PRE_CONCEALMENT | INSPECTION | REPAIR, originalObjectRef, sha256, mediaType, sourceDeviceTime?, serverReceivedAt, exifTimestamp?, exifGps?, uploaderId, taskId?, reviewStatus}
- EvidenceReview {id, evidenceId, reviewerId, stage: CREW_LEAD | SITE_SUPERVISOR | INDEPENDENT_INSPECTOR, verdict, criteriaVersion, reason?, occurredAt}
- ConcealmentGate {id, siteId, zoneId, trade, requiredCaptureKinds, acceptedEvidenceIds, requiredReviewerRole, gateStatus, approvedBy?, approvedAt?}
- BuildingEvent {id, tenantId, siteId, eventType, sourceEntityType, sourceEntityId, occurredAt?, recordedAt, validFrom?, validTo?, correlationId, actorId, provenanceRef, spatialRef?, supersedesEventId?}
- CrossOrgEvidenceShare {id, sourceTenantId, recipientTenantIdOrExternalPrincipal, siteId, authorizedEvidenceIds, purpose, scopes, expiresAt, revokedAt?, createdBy, approvalId, redactionPolicy}
- AsBuiltClaim {id, elementId, claimType, assertedValue, sources: evidence/drawing/inspection, confidenceClass, verifierId?, verifiedAt?, validFrom?, supersededBy?}. AI-inferred claims must remain suggestions until qualified verification.

**Design rules:** never store employer HR/pay rates in cross-tenant site-shared projection. Share GRANTS, not broad raw DB relationships. Evidence stored once; linked entities via relationship table as needed. Spatial & temporal objects reference canonical Task/Evidence/Project IDs instead of duplicating mutable business state.

## 4. Time semantics and state integrity
- Work interval clock: startedAt, paused intervals, end and corrections. Worked minutes = sum of actual work intervals; presence elapsed and payable classification reported separately.
- Time zone: preserve UTC instants plus project IANA time zone for schedules and user presentation; daylight-saving and overnight work must be tested.
- A 6:30–17:00 shift spans 10h30m; only **actual** unpaid break minutes may be subtracted. If 11:00–12:00 unpaid meal actually occurred, worked = 9h30m; attendance target 8h is alert threshold, not automatic clock stop.
- Current mobile code has location updates and a *nearby* auto-start branch; a corresponding confirmed reliable exit-stop algorithm was NOT found in the inspected file. New exit logic needs inside/outside hysteresis, minimum dwell time, stale point/accuracy gate, configurable notifications, and 3 explicit options. Avoid automatic stopping as a default.
- Device event data is untrusted evidence; server adjudicates authenticated actor, allowed site/task, sequence/idempotency and clock state. All manual corrections append a review record.
- Waiting for a foreman's next instruction is not automatically unpaid. Labor classification is policy/legal review, independent of tasks.

## 5. Event model and temporal queries
Build read projections from append-only domain/asset events, preserving source record pointers and a stable event time vocabulary:
- received work instruction; work package decomposed; task assigned/accepted/started/blocked/completed;
- worker entered/exited geofence (only if consented); clock started/paused/resumed/stopped; correction requested/approved;
- media captured/uploaded/validated; spatial anchor suggested/confirmed; evidence reviewed/returned/approved;
- drawing/model revision received; element claimed installed/inspected/concealed/opened/repaired/replaced;
- cross-company share granted/revoked; AI question/citation and human-verification outcome where meaningful.

**Bitemporal minimum:** occurredAt (event claimed physical occurrence), recordedAt (server observation), effective/valid period (when claim pertains), provenance and supersession. Data arriving six months late cannot rewrite what system historically knew at day one.

Query contract examples:
- GET site/:id/locations/:zoneId/timeline?asOf=<instant>
- GET site/:id/locations/:zoneId/evidence?from&to&beforeConcealment=true
- GET building-elements/:id/history?asOf=<instant>
- POST prometeo/field-memory/query (read only, explicit project/site + spatial anchor and actor)
Routes are **proposals** and must pass existing API style, DTO/RBAC review before coding. Response always includes permitted sourceRefs, model revision, location precision and uncertainty.

## 6. Multimedia, spatial and BIM integration architecture
**F0 2D:** Store floor plan PDFs/rasters with revision and calibration, QR tags per room/wall, manual pin and photos with marker/measurement reference. Camera GPS is site-level corroboration, not precise indoor position.
**F1 3D interoperability:** Provider adapter ingests IFC building element IDs, units and placement matrices with coordinate frame transformation/version; validates IFC and records source rights. Optional browser-based viewer is a projection, not source of truth.
**F2 4D:** Playback overlays historically verified element and capture states by date. Timeline relies on actual captured/recorded claims; visually interpolated elements are clearly marked estimates, not confirmed concealed services.
**F3 specialty:** Change detection, issue clustering, asset-repair provenance, facility maintenance queries and eventually photogrammetry/point clouds when required capture coverage and scale justify cost.

Standards/provider choices are candidates (IFC, BCF, Autodesk Construction Cloud, Procore or equivalent), not a claim of contracted access/API availability. Authenticate provider and check licensing, rate limits, deletion semantics, webhook verification and exportability before implementation.

## 7. Prometeo grounding and action policy
Retrieval pipeline:
1. Resolve authenticated user/tenant/org/site, purpose and authorized grant.
2. Resolve precise spatial identity (room/wall and drawing revision); request clarification when multiple walls match.
3. Build allowed query to canonical Evidence/Task/BuildingEvent index. For images, pass through approved vision provider with privacy controls.
4. Attach precise source IDs, timestamps, media locations, approval roles and confidence. Detect conflicts among evidence, IFC model and site events.
5. Respond using categories: Verified (human-reviewed), Documented (original capture only), Estimated (derived), Unknown (insufficient evidence).
6. For actions such as assignment/review/share, use existing governed registry/Policy/Approval; produce proposal and await human authorization when required.
7. Log tool name/version, decision, actor, scope, input/output refs and audit correlation. Never let tool result alter granted permissions.

Example answer: 'La foto E-129 fue tomada antes del cierre según la declaración de la cuadrilla; muestra tres conduits en zona Z-7-B. La ubicación exacta respecto a esta pared no fue verificada mediante levantamiento, por lo que no debe usarse como referencia de perforación sin inspección en campo.'

**No safety claims:** neither AI nor imagery guarantees wall integrity, conductor exact path, compliance, energized state or absence of other hidden utilities.

## 8. Connector trust and the 'no replacement' promise
Use packages/shared/src/universal-connector existing trust boundary. The security chain from ADR-042:
Identity -> Tenant -> Runtime Binding -> Capability -> Scope -> Delegation -> Trust/Risk -> Policy -> Approval -> Execution -> Evidence.
Trust decisions are made internally. READ_ONLY must reject writes; webhook authenticity does not grant a business action. Credentials are opaque provider secret references, invisible to LLMs/logs. Idempotency, nonce/replay defense, reconciliation, checkpoint and emergency controls are required.
Provider lifecycle: request -> consent -> verify -> activate per capability -> monitor -> suspend/revoke. Tenant chooses READ_ONLY, HYBRID, MANAGED_MIGRATION or FULL_CUTOVER; default read-only for a new GC integration. No GC migration forced.
If provider unavailable or contract limits apply, manual instructions/capture and export remain functional. Never backfill unverified external facts as canonical approvals.

## 9. Authorization and privacy threat model (non-exhaustive)
| Threat | Required defense / negative test |
|---|---|
| Staffing firm accesses GC's private drawings or vice versa | Explicit scoped cross-org grant; 403/404 for no grant, revocation verified |
| Tenant A finds images/site GPS from tenant B | Tenant-bound object access and signed URL scope with server-side checks |
| Worker forges clock or EXIF timestamp | Keep original, distinguish device claim vs server record, manual correction workflow; no forged fact upgrades |
| Location crosses boundary due to GPS drift | Accuracy threshold, debounce, worker prompt, no wage deduction |
| Worker off-duty tracking | opt-in location permissions, minimal event retention, stop monitoring outside allowed modes |
| AI fabricates buried wiring location | verified evidence refs, confidence/uncertainty, no autonomous high-stakes action |
| Connector webhook impersonation/replay | per-provider HMAC, nonce+TTL, runtime/policy/authz checks, idempotency |
| Mass export or ransomware | least privilege, audit, object versioning, encryption, backup/restore drill, rate limits |
| Malicious external document instructs Prometeo to bypass policy | untrusted data treatment; separate model context from policy authority |
| Lost mobile network, duplicate events | local durable queue, stable clientEventId, dedup, conflict UI and reconciliation |
| Building model revision conflicts with field photo | explicit mismatch state; manual review; never silent last-write-wins |
| Long-term records inaccessible after staff departure | contract-defined data custodianship, access grants, export and retention plan |

Legal: FLSA and state-level wage/time rules, worker consent/privacy, site photography rights, commercial copyright and regulated workplace data require counsel/tenant policy review. No final legal conclusion implied.

## 10. Operational readiness and SDD constraints
- All APIs reject cross-tenant/resource mix, absent evidence share grant and unauthorized Prometeo capability before provider invocation.
- Idempotency applies separately to clock, upload, share, revision and connector sync; event ordering/replay covered.
- Zero lost time entries under transient offline use; durable media retries and signed URL expiry tested.
- Load/failure tests for >30-worker crew and multi-tenant sites, large video uploads, hours-long projects, revisiting historical snapshots months later.
- Provenance package per release: exact SHA, schema migration+rollback, tests, security scan, verified photos/plan sample, canary mobile iOS+Android, API/web/worker/vision health, secure storage and recovery validation.
- Never claim deployed/active until CI, merge, Railway SHA + smoke and exact feature activation are verified.
- ADR-042/ADR-044 collision reconciled documentally in `docs/architecture/ADR_ID_RECONCILIATION_2026-10-15.md`; ADR-044 remains PROPOSED, not ratified.

## 11. Implementation ownership map
- BuildOps/Tasks owns WorkPackage/TaskAllocation and leadership hierarchy references.
- Labor Engine owns all time commands, schedule/paid-balance business state and corrections.
- Evidence owns capture registration and review history; gateway accepts ingress but no competing lifecycle.
- Spatial Registry owns coordinates/reference entities and placement confidence.
- Temporal Projection owns derived timeline only; canonical source events remain with domain.
- Prometeo/Agent runtime owns reasoning, bounded tool invocation and explanation, never data/legal approval authority.
- Universal Connector owns inbound/outbound trust boundary and provider health but not payment, payroll or evidence authorization policies.
- Mission Control/Omniverse are observability projections, not alternate sources of truth.
