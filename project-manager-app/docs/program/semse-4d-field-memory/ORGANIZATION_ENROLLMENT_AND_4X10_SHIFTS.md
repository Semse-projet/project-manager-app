# SEMSE Field Memory — Staffing organization, worker enrollment, crews and 4×10 schedules
**Captured:** 2026-10-11 · **Status:** PROPOSED continuation of live founder discovery. Not verified as a currently available onboarding journey.
**Context:** Owner asked whether employer creates a company account and all 5–30 workers download/register under that company; also specified 40h/week sometimes scheduled as 10 working hours per day Monday–Thursday.

## A. Founder decision and recommended answer
**Recommended operating model:** One global personal identity per person; employer creates/manages a company **Org** within SEMSE's existing Tenant/Org architecture; each worker receives an expiring, role-scoped invitation to become a **Membership** of that Org. Never share a single company login among workers. Worker can install the SEMSE mobile app for proximity/notifications/photo evidence/offline functionality, but also support secure web invitation registration and manual/assisted clock-in in early deployments; app installation need not be the only valid enrollment route. A confirmed mobile install may be required for a particular optional phone-only capability.

**Actor separation:**
- **Company owner/employer:** Owns company Org profile, chooses tenant-level admin(s), authorizes sites, sets policies/roster, invites users, sees own staffing timesheets, approvals and reports.
- **Company admin/dispatcher:** Company membership management only by delegated org permissions. Cannot impersonate or alter a worker clock without correction audit.
- **Crew lead (encargado):** A worker/member with additional permissions for **specific site/crew**, schedules task allocation, receives evidence and reviews assigned crew. May lead 5/10/15/20 workers; staffing owner can delegate without granting global payroll data or cross-crew reach.
- **Worker:** A single personal User identity; can view own assignment, schedule, location consent, timesheet, alerts and evidence. Worker submissions identify their personal user ID.
- **External general contractor's superintendent/site foreman:** They may remain in their own software. A specific worksite/grant may allow them to submit an instruction, review a restricted evidence package or receive an export. They do not become a member of the staffing company automatically.
- **Prometeo:** Guides registration, onboarding and work, never invents membership, authorizes own capabilities or joins people to an org without permitted admin decision.

**IMPORTANT:** An Org can share a top-level Tenant with other Orgs; do not mistake Org ID for Tenant ID or permit payroll/evidence access on Tenant ID alone. A person may serve several companies with distinct memberships and roles; effective authorization derives from opened organization/project context, not an arbitrary remembered global role.

## B. Company + worker onboarding (preferred UI)
1. Employer signs up using a **personal** verified login and chooses **Create my company**; under an authorized bootstrap workflow, SEMSE creates or associates an existing Org with legal/trade company profile, timezone, billing/contract requirements, and initial owner membership. Do not create a second User/password identified as the company. Existing Org is reused; duplicate names/legal identities require conflict review.
2. Company admin opens **Team / Workers** and invites by verified email/SMS (or secure one-time invite link); chooses role Worker or Crew Lead, optionally site/crew/trade/validity and effective dates. Admin may upload a CSV roster for bulk **invitations**, but CSV cannot silently grant active accounts. No open public organization join by guessing an org code.
3. Worker receives invite link to web or app. If already a SEMSE user, signs in to the **same personal account**; if new, creates a personal account, verifies identity/phone/email per policy, sees invited company name and minimum data privacy/attendance notices; explicitly accepts. Server validates token signature, org binding, expiry, nonce, intended recipient and allowed actor; single-use invitation; membership is attached only after safe acceptance.
4. Admin sees PENDING/INVITED -> ACTIVE (or rejected/expired) membership; confirms and grants site/crew membership, job scope and schedules where needed. A lead may be a normal Worker in one Org and Lead in a different project/Org.
5. Worker selects their assigned site/shift (or app displays automatically after server authorization), sees whom to report to, expected schedule, break policy and clock method. Optional location permissions requested separately and transparently: ASK/AUTO/OFF; no indefinite off-work tracking. Manual entry should still be possible subject to review.
6. At the end of assignment, worker remains a valid User but the employer can suspend/revoke **that company's** membership or project access, invalidate outstanding invitations/sessions under safe enforcement, end site proximity monitoring, and preserve timesheets, media, audit and historical approvals under lawful retention. Workers should be able to request their own lawful records. No rewriting past evidence to substitute another user ID.
7. If a person moves across staffing companies, create another authorized Membership for the existing User. History is partitioned by authorized Org/resource scope; never merge confidential payroll across companies without explicit granted authorization.

**Fallback:** Small employer can manage attendance for staff without personal devices using supervised kiosk/assisted check-in with individually verified worker identity and tamper-evident approvals; employer acts as recorder, not as the worker. Paper import requires source evidence and review. Avoid excluding legitimate workers without smartphone, storage or reliable data.

## C. Existing code evidence and exact gaps (targeted Oct-11 audit)
- **Present:** `packages/db/prisma/schema.prisma` has `User`, `Org` and `Membership`; architecture ADR-040 describes that Membership links user/org/role. `GET /v1/organizations`, `GET /v1/organizations/:orgId`, `GET /v1/organizations/:orgId/members` exist in `apps/api/src/modules/organizations/organizations.controller.ts`. `POST /v1/auth/register` in `apps/api/src/modules/auth/auth.controller.ts` accepts individual name/email/password and role. `GET /v1/users/me/capabilities` is documented by the F10 multi-role spec. `docs/specs/core/org-membership-status.spec.md` describes INVITED/ACTIVE/SUSPENDED/REVOKED; current code and deployed status require re-verification.
- **Unverified/missing from inspected organizations controller:** Self-service company-Org creation and invitations, accepting invitation through one-time link, role-assignment UI, company-specific worker roster onboarding, kiosk fallback and project/crew membership automation. The inspected controller currently has read routes only. There could be related flows elsewhere—inventory them before adding endpoints.
- **Identity pitfall:** ADR-040 explicitly reconciles against a separate session-level 'switch active org' implementation; org/project capability must be derived from actual authorized context per `universal-identity-multi-role`, not a new conflicting session override. Review live main for later changes.
- **Never add a parallel 'CompanyWorkspace' authority/table** when Org + Membership can own the relationship.

## D. A flexible 4×10 working-week pattern (not hardcoded overtime)
The employer can configure **four days of ten hours of actual work**, Monday–Thursday = 40 working hours total; Friday scheduled off. This is a *scheduled pattern*, not necessarily a statement of what counts as paid hours under every labor jurisdiction.

A shift configuration needs all of:
- workweekStart and timezone (explicit payroll week boundary, daylight-saving handling),
- effectiveDateRange, pattern days [Mon,Tue,Wed,Thu], dailyTargetWorkedMinutes 600, weeklyTargetWorkedMinutes 2400; Friday off (with exceptions/holiday policy),
- actual on-duty work interval and break paid/unpaid classification; if a full 60-minute **unpaid** break really occurs, scheduled on-site elapsed presence must span **11 hours** for **10 actual worked** hours. A 06:30–17:00 presence period spans 10h30m and with 60m unpaid break produces only 9h30m worked,
- supervisor and worker notifications when approaching 10h day or 40h week, and optional separate reminders at a supervisor-defined overtime authorization threshold,
- separate actual time recorded, planned target, payable classification, authorized time and applicable overtime calculation.
A worker may do 8×5, 10×4, split shifts or site-specific schedules; activity across multiple sites during one workweek must aggregate accurately for the employing entity and avoid double-counting concurrent sessions. Never use a **daily 8h threshold** as the universal rule for overtime. Local/federal wage-hour rules and contractual terms may differ; verify jurisdiction and worker classification with qualified counsel before payroll release. Unauthorized overtime approval does not entitle SEMSE to erase actual work.

## E. Proposed new requirements (append to existing product requirements; do NOT imply shipped)
- **REQ-ORG-001** Company owner can create or claim one authorized Org, complete company profile and delegate roles using existing Tenant/Org/Membership.
- **REQ-ORG-002** Each worker uses a unique personal account; joining a company is a scoped invitation acceptance, never access through shared company credentials.
- **REQ-ORG-003** Admin can invite one or many workers via email/SMS/one-time token with expiry and explicit org, role and optional crew/site assignment.
- **REQ-ORG-004** Invite acceptance verifies intended identity, records consent/acceptance event, and rejects replay, invalid token or guessed org code.
- **REQ-ORG-005** Org membership and site/crew assignment are separate; supervisors cannot read every company record simply because they lead a crew.
- **REQ-ORG-006** Effective permissions require authorized org/project context; one User can have multiple disjoint Memberships without cross-company privilege bleed.
- **REQ-ORG-007** Revoking an employment/site relationship blocks future access and cancels relevant location features without deleting historic auditable hours/evidence.
- **REQ-ORG-008** Worker can see their own schedule, time, notifications, tasks and evidence, including a path for correction/appeal where policy requires.
- **REQ-ORG-009** An authorized employer can use a documented assisted/kiosk/manual alternative for workers without smartphones, with per-person authentication and audit.
- **REQ-ORG-010** External GC receives only scoped tasks/evidence via approved shares/connectors, not default staffing membership or payroll records.
- **REQ-ORG-011** Registration, invite, role elevation, revocation and cross-org actions are audited, idempotent and resistant to link sharing/replay.
- **REQ-SCH-001** Administrator can version a four-day, 10-actual-hour-per-day, 40h/week pattern and other schedules by site/team/worker.
- **REQ-SCH-002** Day/week alerts derive from real worked intervals minus **actually unpaid breaks**, not fixed 8h nor attendance elapsed time.
- **REQ-SCH-003** Multiple-site shifts and overtime threshold calculations aggregate by authorized employing entity/pay period and applicable jurisdictional policy.
- **REQ-SCH-004** Schedule target, payable hours, overtime classification and prior/actual overtime approval remain distinct; all real work remains recorded.

## F. UAT and negative security tests
1. Employer creates company account, invites 15 workers; 15 personal logins become ACTIVE under correct Org; worker sees only their assignments. Another foreman receives its own 5 or 20 workers and cannot read first foreman's private details outside shared rights.
2. Existing worker accepts an invitation from second company with same User ID; first company's payroll/evidence remains private.
3. Reusing, forwarding, expiring or guessing an invite token cannot join a company, escalate Lead/Admin, or bypass verification. Suspended worker cannot re-enter via a previously granted app/session without policy evaluation.
4. Admin configures 4×10 Mon–Thu and 8×5 for a different project; each employee sees correct schedule and gets 9h45/10h daily alerts versus 7h45/8h respectively.
5. 06:30–17:00 with a real 60m unpaid break results in 9h30 worked, not 10h. A valid 10h workday with 60m unpaid meal requires 11h presence.
6. Worker changes sites midday: no overlapping paid sessions or duplicate elapsed time; all real work preserved; context and assignment scope reconciled.
7. Removed employee keeps rightfully retained historical media attributed to their own identity, but cannot download former employer's confidential evidence anymore.
8. Staff lacking smartphone can individually clock in via authorized kiosk and later see/export a reviewed timesheet.
9. External site supervisor is authorized for a specific reviewed electrical before-drywall photo but cannot list the staffing team's private pay rates or work locations outside the shared site.

## G. Child-spec engineering sequencing
First verify organization registration/bootstrap routes and `Membership.status` deployment against main + Railway. Then write a small SDD 2.0 spec for admin invitations and membership lifecycle with least-privilege authorization, tests before implementation, and data model reuse; second spec for crew assignment and explicit site relationships; third for 4×10 effective-date schedule revisions and actual-time-based alerts. Keep feature flags, idempotent acceptance, migration/backfill + rollback, iOS/Android offline UAT and production SHA provenance gates. No product implementation is claimed by this design document.
