# SEMSE Field Memory 4D — Product requirements and conversation capture
**Edition:** 2026-10-11 · **Status:** PROPOSED / DISCOVERY CAPTURE (not a shipped feature)
**Evidence basis:** Spanish founder discovery conversation on 2026-10-11, plus targeted GitHub read of main at 4e4fd4f5818dd4c63ee25a69e49781cb2b62ec49.
**Companions:** README.md, SYSTEM_ARCHITECTURE.md, IMPLEMENTATION_AND_VERIFICATION.md, ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md in this folder.
**Rule:** Preserve founder intent. Treat every proposal as a proposal until product review. Existing source files prove code presence, not deployment, activation, completeness, or runtime correctness.

## 1. Why this product exists
SEMSE Project should support the actual relationship among (1) a staffing employer who sends electricians to a remote worksite, (2) a general contractor/site superintendent who already has software and a plan, (3) subordinate foremen who issue daily instructions, (4) a staffing crew lead who allocates those instructions across 5–20 workers, (5) individual workers, and (6) the owner/future maintenance team who needs reliable as-built history. Do not require the general contractor to replace its system.

The discovery starts with timekeeping friction and expands into construction memory:
- Workers currently sometimes sign in on paper. Others using attendance apps occasionally clock out while already driving home or much later. The product should reduce accidental errors without assuming fraud or over-surveillance.
- Example site shift: sign-in 06:30, nominal breaks around 09:00 (15m), 11:00 (30m), 14:00 (15m), end 17:00. Some crews instead take a consolidated 11:00–12:00 break. **This is an observation, not permission to override policy.** Every site/project is different; an authorized administrator configures shifts and break rules.
- An 8-hour planned work target should cause configurable approaching-target and reached-target notices to worker AND foreman. Time beyond target is separately tracked; authorization rules must never erase actual work. A nominal 8-hour day is not itself a statutory overtime rule.
- Location-aware check-in should be opt-in/permission-based, with a configurable worksite radius. If a worker leaves the perimeter, offer Finish, Pause, or Continue (with reason or destination), rather than presuming departure means unpaid time. Physical proximity cannot alone establish hours or billability.
- A foreman may lead 15 electricians while another has 5, 10, or 20. Site staff relay broad tasks (e.g., finish seventh-floor wiring, then install boxes). The crew lead distributes and sequences those tasks. Individual assignments can be separate or shared among a crew. A single task might last two days; workers may do 3–5 tasks per day.
- Workers capture before/during/after photo/video proof; crew leads review and share an authorized evidence package with the site team. Six to eight months later, a different crew should be able to consult what was behind drywall at a past point in time. The user calls this a fourth-dimension view: spatial context + historical time.
- Prevent destructive rework and paid repair from unnecessary exploratory holes. Do not claim imagery alone guarantees exact hidden locations or replaces field verification.
- Use Prometeo to organize, retrieve, explain, and suggest, with auditable citations and uncertainty. Use connectors to existing site/BIM/PM tools, never force migration and never cede authority to providers.

## 2. Product goal, boundaries and non-goals
**Goal:** End-to-end field coordination and durable as-built evidence: workforce time -> tasks -> location-linked capture -> human verification -> authorized information sharing -> historic/spatial retrieval -> defect investigation.

**Non-goals for initial release:** build a proprietary CAD or BIM editor, claim complete 3D reconstruction from arbitrary photos, replace GC ERP, use GPS as exact indoor coordinates, auto-pay/auto-release escrow from an AI finding, automatically certify trade workmanship, or continuously track workers outside a legitimate attendance purpose.

**Principles:** mobile-first, bilingual Spanish/English, useful offline, subcontractor/tenant isolation, one canonical record per business object, human-controlled publication, provenance first, accessible for field gloves/poor connectivity, right to correct through append-only history.

## 3. Actors and reporting topology
| Actor | Relationships | Minimum capabilities |
|---|---|---|
| Platform / tenant administrator | Operates a staffing/subcontractor tenant | Own projects and shifts, geofence policy, retention, roles, connectors, exports, notifications |
| Staffing employer / operations manager | May never visit site | See own workers' approved time, assignments and permitted evidence; approve payroll adjustments per rules |
| GC/site superintendent | Owns site execution and often a different software platform | Assign to subcontractor crew lead, request evidence, review scoped shares when invited/contracted |
| GC trade foreman | Works below superintendent | Issue tasks, inspect/reject deliverables if authorized, clarify prerequisites |
| Staffing crew lead (encargado) | Runs own crew of variable size | Break work into tasks, allocate, reprioritize, receive evidence, review and escalate |
| Worker | May work solo, with buddy, or in a team | See own schedule/tasks, capture time and media, report blockers, request corrections |
| Owner/facilities/maintenance | Can arrive months/years later | Search authorized historic/as-built evidence by building, floor, zone, element, and date |
| Prometeo | Bounded assistant, not owner/approver | Suggest assignments, summarize, retrieve sources, surface anomalies, request explicit approval for actions |

**Important security split:** Physical worksite access, subcontracting relationship and membership in one building do NOT grant cross-tenant access. Sharing needs explicit grants, resource scope, purpose, expiry and revocation. A GC can receive authorized evidence without obtaining the staffing firm's private HR/payroll data.

## 4. Product requirements with stable identifiers
### A. Scheduling, attendance and geofence
- **REQ-TIM-001** Administrator configures per-worksite / per-project shifts, effective dates, time zone, worker/crew overrides and an explicit paid/unpaid break policy; retain version history.
- **REQ-TIM-002** Track scheduled hours, clocked elapsed time, actual worked intervals, actual breaks, compensated time and overtime classifications as separate concepts.
- **REQ-TIM-003** Support foreground check-in/out and optional proximity-based automatic arrival capture after appropriate worker permissions and transparent disclosure.
- **REQ-TIM-004** Worksite exit notice offers Finish / Pause / Continue, captures a reason where appropriate, and does not automatically delete recorded time. No silent geofence payroll deduction.
- **REQ-TIM-005** Worker and crew lead receive customizable warnings approaching target hours (e.g., 15m) and at the exact work target; deduplicate notices and allow quiet-hour/accessibility settings.
- **REQ-TIM-006** Support breaks that vary by project; manual confirmation of actual break; no deduction solely because a break was scheduled. Record unexpected/on-duty break work.
- **REQ-TIM-007** If a worker forgets clock-out, issue reminders and provide a correction request with original time, requested time, reason, submitter, reviewer, timestamps and immutable audit trail.
- **REQ-TIM-008** Distinguish normal duration target from legal overtime and employer approval; unapproved actual time remains recorded and flagged, not lost.
- **REQ-TIM-009** Tolerate delayed background OS callbacks, inaccurate GPS, battery saver, permission denial, offline periods, duplicate arrival events and crossing the radius repeatedly (hysteresis/debounce and server-side validation).
- **REQ-TIM-010** Collect only location events needed for worksite presence and audit; visible recording state, explicit off controls, retention and access boundaries; no blanket 24/7 monitoring.
- **REQ-TIM-011** Permit reasonable manual alternatives where geolocation is unavailable or declined; do not force false location data.
- **REQ-TIM-012** Offline interval recording must reconcile with one canonical labor owner using stable client event IDs, conflict review and idempotency.

### B. Crew and task execution
- **REQ-OPS-001** Model organization -> project/site -> trade/scope -> crew -> crew lead -> members, with varying team sizes and substitute leads; member belongs to more than one crew over time if authorized.
- **REQ-OPS-002** Support a GC/site instruction becoming a proposed SEMSE work package; separate externally sourced instruction, lead decomposition and actual worker assignment.
- **REQ-OPS-003** Crew lead can break a task into subtasks by floor, zone, circuit/system, room and prerequisite; publish assignments to one person, multiple people or an entire crew.
- **REQ-OPS-004** Daily execution must support 3–5 tasks or more, task carry-over across days, reassignment, waiting for instructions/materials, blocking reasons, rework and handoff.
- **REQ-OPS-005** Time clock remains independent of task completion; job/task active time may be tracked separately as an optional analytical allocation, not assumed payroll truth.
- **REQ-OPS-006** Prometeo proposes assignments based on explicit skills, availability, dependencies and capacity, shows reasons/uncertainty; human crew lead confirms and can override.
- **REQ-OPS-007** Worker receives clear task detail, location, safety/prerequisites, drawings and required evidence; can acknowledge and report completion/blocker offline.
- **REQ-OPS-008** Supervisor dashboards distinguish requested, in progress, submitted, reviewed, rejected, approved and handed over; no implicit approval from a worker's Done button.
- **REQ-OPS-009** Report daily staffing/attendance, progress, blockers, tasks, exceptions and proof, with filtering and least-privilege views for employer, lead and site.
- **REQ-OPS-010** Support external GC with no SEMSE account: internal capture and controlled export/share via invited read-only view or signed package; no forced account migration.

### C. Evidence and long-life field memory
- **REQ-EVD-001** Record raw original images/videos and derivatives separately; preserve object key, content hash, MIME, capture/upload timestamps, actor, source method, project/tenant and version/replacement chain.
- **REQ-EVD-002** Bind each evidence item to one or more authorized project/job/task/milestone, building, floor, zone/room, trade and optionally physical asset/element/circuit; support explicit unknown location.
- **REQ-EVD-003** Support before/during/after and **before concealment** gate for electrical/conduit/plumbing/HVAC behind drywall, slab or ceiling; required evidence defined per scope.
- **REQ-EVD-004** Worker submits -> own crew lead checks -> authorized site inspector/GC checks -> accepted/rejected/correction; record independent roles and reasons, with configurable stages.
- **REQ-EVD-005** Distinguish evidence submitted, validated for file integrity, visually reviewed and independently verified as-built; no conflation with code/safety inspection approval.
- **REQ-EVD-006** Preserve immutable logical history: corrected placement/annotation creates new version, original remains traceable under applicable retention rules.
- **REQ-EVD-007** Support photos, videos, drawings/PDFs, notes/voice transcription (with consent), inspection reports, RFIs, change orders, asset identifiers and external links.
- **REQ-EVD-008** Evidence privately stored, encrypted in transit and at rest as configured, recoverable from backups, with short-lived scoped delivery URLs and retention/legal hold controls.
- **REQ-EVD-009** Offer a shareable immutable evidence manifest with hashes, refs, approval chain, scope, expiration, redactions and revoked access; subcontractor retains its own records subject to legal/contractual rights.
- **REQ-EVD-010** Treat EXIF/GPS, device clock and user annotations as different-confidence observations; no false claim that EXIF inherently proves exact time/place.
- **REQ-EVD-011** Version drawings/models separately from field captures; show whether a file is design, issued-for-construction, field-marked, surveyed or verified as-built.
- **REQ-EVD-012** Every stage records provenance and correlation to source event, task, reviewer, project and current physical state.

### D. Spatial, temporal and 4D query
- **REQ-4D-001** Spatial hierarchy: building -> level -> area/room -> wall/ceiling/slab -> element/system with stable IDs, human labels, revisions and coordinate references.
- **REQ-4D-002** Anchor media to drawings via operator pin, QR/marker, room/site selection or surveyed reference, including coordinate transform/version and spatial confidence.
- **REQ-4D-003** Time view answers both 'what was recorded on date X?' and 'what was believed/verified at date X?', preserving occurredAt vs ingestedAt and validity intervals where known.
- **REQ-4D-004** View a location's historical timeline across tasks, captures, installations, coverings, inspections, modifications and later repairs.
- **REQ-4D-005** Compare earlier and later authorized evidence; distinguish absence of evidence from evidence of absence.
- **REQ-4D-006** Search by floor/room/wall/circuit/asset/time, including cross references from task, worker, approval and material.
- **REQ-4D-007** Show uncertain positioning and contradictory/obsolete captures as such; never infer exact hidden cable path without strong geometric grounding and expert confirmation.
- **REQ-4D-008** Support incremental 2D plan viewer and annotations before expensive BIM/3D; eventual IFC/BIM import and 4D historical playback behind bounded adapters.
- **REQ-4D-009** Maintain traceable as-built chain from instruction -> task -> installation -> evidence -> review -> concealed/changed -> current known state -> later incident.
- **REQ-4D-010** A future team can inspect authorized evidence six or eight months later without depending on workers' current employment or a particular AI vendor.

### E. Prometeo and external integrations
- **REQ-AI-001** Prometeo retrieves evidence using permitted tenant/project/scope, cites exact source references, classifies verified fact vs inference and signals insufficient coverage.
- **REQ-AI-002** Prometeo suggests crew allocations, required coverage and missing pre-concealment captures, but cannot silently commit task assignments, approvals or high-impact writes.
- **REQ-AI-003** All agent actions pass canonical Tool Registry, Policy, Approval, authorization, budgets and audit; no self-privilege, silent financial release or provider credential access.
- **REQ-AI-004** Retrieval and model processing follow data residency/privacy settings; no unapproved forwarding of sensitive images/locations to external AI.
- **REQ-CON-001** Work stand-alone when site superintendent uses other software; integrate via opt-in provider connectors and import/export when API exists.
- **REQ-CON-002** Universal Connector must have read-only baseline, tenant/site binding, per-operation scopes, revocable delegation, status/health, provenance, replay protection and emergency stops.
- **REQ-CON-003** Normalize external tasks/drawings/BIM/events into canonical referenced records without blindly overriding human-verified SEMSE data.
- **REQ-CON-004** Treat providers as data sources, not authorization authorities; signed webhooks still require SEMSE business authorization.
- **REQ-CON-005** Provider-specific adapters are replaceable: IFC/BCF file pathways, standards-compatible import, GC PM tools, storage and AI services can evolve without changing authoritative SEMSE objects.
- **REQ-CON-006** Support source revision IDs, synchronization cursors, conflict review, partial failures, retries, lineage, explicit consent and least-privilege connection status.

## 5. End-to-end field scenario (acceptance narrative)
1. Staffing administrator creates worksite A, correct trade, normal 8-hour target, break rules and permitted check-in method. Site foreman sees only explicitly shared scope.
2. Crew lead is assigned 15 workers, and a different lead 5/10/20. On arrival at 06:30, consenting worker's authorized geofence starts a timer or prompts; other worker checks in manually.
3. GC foreman says 'finish cable pulling on floor seven, then install boxes.' The crew lead records incoming instruction, decomposes tasks into zones, delegates to subteams, marks cable pulling as a prerequisite, and Prometeo only suggests.
4. Some workers continue unfinished wiring on day two. Others record waiting for supplies; the time clock remains truthful and separate.
5. Before the wall is closed, each subteam captures original photos/videos with visible measurements or markers, floor/room/wall anchor and task refs. Site photos are not accepted without adequate location/quality metadata; missing exact coords are marked unknown.
6. Crew lead reviews, returns an insufficient photo for correction, then submits an approved evidence package to the site superintendent by explicit grant.
7. Worker receives configurable 7h45m warning. At an 8h target Prometeo warns worker/lead and asks Finish or Continue. Any actual extra work is kept even if approval is pending. Leaving geofence triggers Finish/Pause/Continue prompt but never an automatic wage deduction.
8. Months later new electrician selects seventh-floor wall, historical date before drywall, and receives photos + drawing revisions + dates + task chain + reviewer and confidence notes. A missing wall photo yields 'not enough verified information', NOT a fabricated cable position.
9. Owner can export an authorized audit bundle including exact asset IDs, media hashes, timestamps, review chain and redacted cross-company details. Incident/rework records link back to original installation, without overwriting original history.

## 6. Explicit open decisions (do not silently assume)
- Contractual rights to field imagery and which party may share it across tenants after worker leaves.
- Required project hierarchy and whether GC user is guest, separate tenant or external recipient (default: explicit scoped share).
- Who defines and can change shift/break policy; when a crew-level exception needs approval. Paid vs unpaid, local labor law and collective agreements require jurisdiction-specific legal review.
- Minimum evidence checklist per trade, wall concealment approval authority and retention period (may be years).
- Whether geofence auto-start is enabled by default (recommended: consent + configurable ask-first); background capabilities vary by OS and cannot guarantee instant boundary events.
- Geographic privacy retention and whether worker can view/download their own timesheet and appeal corrections.
- Which IFC/BCF/BIM and construction-management integrations first; require confirmed provider APIs/licenses before commitments.
- Who certifies as-built fidelity and liability disclaimers; avoid treating AI as an inspector.
- Tenant admin/legal signoff for privacy notices, worker monitoring, property ownership, wage/hour reporting and state/country labor rules.

## 7. Sample acceptance assertions
- Project B schedule never changes Project A time, breaks or reminders.
- 06:30–17:00 is 10h30m presence. With an actually taken **unpaid** 11:00–12:00 break, worked time is 9h30m; with different breaks, compute from real intervals. Never hard-code one-hour deduction.
- Moving outside radius while gathering materials does not silently end payroll time.
- Worker can attach one photo to a crew task shared by several workers, but artifact provenance still identifies submitter.
- No project/tenant or external connector share without specific grant; revoked grant immediately denies future access.
- Before-concealment checklist failure blocks the configurable evidence handoff (not unauthorized wages or unrelated work).
- Conflicting floor labels or image/model versions yield uncertainty, not a plausible-looking invented 3D view.
- Offline repeated start/stop/upload event cannot create duplicated paid time or duplicate canonical evidence.
- Prometeo responds to 'show behind this wall before drywall' with source-linked evidence, revision, date, permission check and spatial confidence.

## 8. Product measures
Adoption: successful check-ins, completion/acknowledgment rate, active crew leads, offline reconciliation success. Quality: missing clock-outs, disputed timesheet corrections, photo resubmission reasons, % concealed assets with approved evidence, % of evidence accurately anchored to a floor/zone/wall. Value: time needed to find historic as-built evidence, avoidable destructive inspection, rework cost and time saved. Guardrails: false-positive geofence actions, wrongful deductions (target zero), unauthorized shares (zero), untraceable evidence, AI hallucinated exact hidden assets (zero), expired shares reused (zero).

## 9. Continuation: staffing account model and compressed shifts (2026-10-11)
The founder further clarified a common 40-hour week with **four days of ten actual working hours (Monday–Thursday)**, and asked how a staffing company owner creates the organization and enrolls every employee via the SEMSE application. Preserve the exact decision context and proposed onboarding workflow in [ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md](ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md). That document adds 11 REQ-ORG and 4 REQ-SCH requirements, for **69 unique requirement IDs across both documents** (54 originally plus 15 new). Company-led enrollment by scoped individual invitations and multi-role membership is the proposed design, not a confirmed existing onboarding feature. Ten paid worked hours are not the same as ten hours of on-site presence when unpaid breaks occur. Overtime requires jurisdiction-specific policy and actual-time tracking.

## 10. Source-of-truth and governance references
The implementation MUST reconcile with existing repo governance, not replace it:
- docs/architecture/ADR-029-labor-engine-canonical-time-owner.md
- docs/architecture/ADR-028-evidence-gateway-adapter-role.md
- docs/specs/tasks/task-unification-fase1.spec.md
- docs/specs/evidence/evidence-canonical-fase1.spec.md
- docs/architecture/ADR-038-prometeo-copilot-orchestration-reachability.md
- docs/architecture/ADR-042-universal-connector-trust-boundary.md
- docs/specs/platform/universal-connector-trust.spec.md

This document captures product intent, not a CI-tested specification under SDD 2.0; convert approved slices to individual governed specs before code work.
