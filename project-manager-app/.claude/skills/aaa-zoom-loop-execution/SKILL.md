---
name: aaa-zoom-loop-execution
description: Execution discipline for any task/module/migration/integration that must be completed end-to-end, not merely drafted. Prevents stopping at "it already exists", declaring partial work done, skipping runtime/deploy/security verification, or losing historical fixes. Use for large or ambiguous multi-step work (a module, a migration, an integration, a workflow) where a superficial pass would be dangerous. Adapted for this repo (SEMSE) — its Autonomy Rule is subordinate to semseproject's Approval Gate and semse-audit-remediation's governance gate; see "SEMSE overrides" below before applying it to anything mutating, financial, or cross-tenant.
---

# AAA Zoom + Loop Execution

Adapted from an uploaded generic skill pack (2026-09-17). The core method (Zoom mode, Loop mode, exit gates) is domain-agnostic and kept close to the original; the sections marked **[SEMSE]** below are additions specific to this repo, made because the generic version either had no repo-specific commands to run or, in one case (Autonomy Rule), would have actively conflicted with governance this repo already enforces.

## SEMSE overrides — read this before the rest

1. **Precedence.** Where this skill's "Autonomy rule" (§13) and this repo's `semseproject` (Approval Gate contract) or `semse-audit-remediation` (governance gate: RC5/money and RC6/auth findings need explicit human sign-off before implementation, even from an approved-looking spec) disagree, **`semseproject` and `semse-audit-remediation` win**. §13's "don't ask for routine decisions" never authorizes skipping an Approval Gate or a money/auth sign-off — those aren't routine decisions by this repo's own definition, regardless of how confident the loop's evidence is.
2. **This skill's ledger is a working scratchpad, not a persisted source of truth.** The `EXECUTION_LEDGER_TEMPLATE.md` and per-module completion states (§10) duplicate, almost field-for-field, the SDD 2.0 delivery-state block this repo's own `semse-spec.md` template requires (`code_status`/`ci_status`/`merge_status`/`deploy_status`/`activation_status`/`migration_status`) — see `semse-spec-kit-flow`. Use the ledger during a session to track loop iterations; when the task has a real spec, the `.spec.md` frontmatter is what other agents and reviewers will actually read later — keep it updated, don't let the ledger substitute for it.
3. **§2 ("Repository truth first") needs these repo-specific commands added to the generic `git status/branch/log/diff`:** `pnpm install --frozen-lockfile`, `pnpm db:generate` (stale Prisma client is a common false-positive typecheck failure), and a check of `docs/SPEC_INDEX.md`/`docs/SOURCE_OF_TRUTH.md` for the target domain's spec status. Because this repo squash-merges PRs, a feature branch's tip is never an ancestor of `main` after merge — restart with `git fetch origin main && git checkout -B <branch> origin/main` rather than `git pull`, and verify with `git diff origin/<branch> HEAD --stat` before any `--force-with-lease` push.
4. **§3 ("Canonical ownership") — concrete owners in this repo**, so this section doesn't have to be re-derived from scratch every time:
   - identity/auth/permissions → `packages/auth/src/rbac.ts` (see `semse-rbac-permissions`)
   - data model → `packages/db/prisma/schema.prisma` (see `semse-prisma-workflow`)
   - API/domain contracts → `packages/schemas/src/`
   - event system → `docs/foundation/EVENT_CATALOG.md`, outbox pattern is **not** uniform across bounded contexts (see `semse-domain-events` before assuming a missing event is a new bug)
   - web→API boundary → `apps/web/app/api/semse/**/route.ts` + `_server.ts` (see `semse-bff-pattern`; client-side calls are split across 4 `-api.ts` files, not one)
   - design tokens → `packages/design-tokens/src/colors.ts` + `apps/web/app/globals.css` (see `semse-design-tokens`)
   - time-tracking/labor → check `semse-labor-engine-boundary` first; 3 overlapping API controllers exist, only one is current
   - mobile offline state → `apps/mobile/src/timer/localTimer.ts` is separate from web's `trackerLocalStore.ts` (see `semse-mobile-offline-sync`)
5. **§8 ("Verification stack") — this repo's actual commands**, in place of the generic "lint/typecheck/unit/integration/e2e/build": `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm --filter @semse/api test:unit`, `pnpm --filter @semse/api test:integration`, `pnpm test:e2e` (or `pnpm test:e2e:semse:health` for one spec), `pnpm build:api`/`pnpm build:web`/`pnpm build:packages`, `pnpm verify:workspace` (full local pre-PR gate), `pnpm spec:validate:strict` (whenever a `.spec.md` changed).
6. **§6 module template and §14 PR sizing already align well** with this repo's own conventions (draft PRs, one root cause per PR per `semse-audit-remediation`'s "what good looks like", PR template at `.github/pull_request_template.md`) — no correction needed there beyond using the repo's real template instead of a generic PR description.

────────

## 1. Mandatory operating modes

### ZOOM MODE

Do not stop at the first matching implementation, document, file, service, screen, function, or process.

For every capability, inspect the complete chain relevant to that domain.

For software/product work, inspect as applicable:

- user experience / UI;
- client/mobile;
- hooks/SDK/client libraries;
- API/BFF;
- controllers/routes;
- domain services;
- repositories/data access;
- database models;
- migrations;
- events;
- queues/workers;
- external providers;
- authentication;
- authorization;
- tenancy/resource ownership;
- privacy;
- consent;
- audit/provenance;
- idempotency;
- retries/reconciliation;
- offline behavior;
- observability;
- tests;
- builds;
- CI;
- deployment;
- feature flags/configuration;
- production runtime;
- physical-device behavior;
- historical fixes and regressions.

For non-software work, translate the same principle into: input, owner, process, dependencies, decision points, outputs, controls, failure modes, verification, handoff, monitoring, rollback/recovery.

**Core rule: "It exists" is not a conclusion. It is the beginning of verification.**

### LOOP MODE

Every task and subtask must run through:

```text
INSPECT
→ IMPLEMENT / EXECUTE
→ VERIFY
→ FIND GAP
→ CORRECT
→ RE-VERIFY
→ HARDEN
→ RUN SURROUNDING CHECKS
→ CHECK EXIT GATE
```

If the exit gate fails, repeat the loop.

Do not advance because: code was written; a document was created; a single test passed; the happy path worked once; the UI looks correct; the API returned 200; a migration file exists; a deployment started; someone said it was done.

Advance only when the declared exit gate has objective evidence.

────────

## 2. Repository / system truth first

Before changing anything, establish current truth.

```bash
git status
git branch --show-current
git log --oneline --decorate -n 30
git diff
pnpm install --frozen-lockfile
pnpm db:generate
```

Then inspect the relevant implementation surface, and check `docs/SPEC_INDEX.md`/`docs/SOURCE_OF_TRUTH.md` for the target domain's spec status.

Classify each capability as:

```text
EXISTING
PARTIAL
BROKEN
DUPLICATED
DESIGNED_ONLY
ABSENT
UNKNOWN
```

Record the canonical owner. Never assume an old audit, report, plan, or architecture document still describes the current system exactly.

────────

## 3. Canonical ownership

Before creating anything new, identify what already owns the responsibility.

Preference order: `REUSE → EXTEND → ADAPT → CONSOLIDATE → NEW`.

Create a new subsystem only when evidence shows the existing architecture/process cannot safely own the responsibility.

Avoid duplicate: identity/auth; permissions; payment engines; evidence systems; mission/task authorities; knowledge stores; event systems; schedulers; workflow engines; logging/audit systems; source-of-truth data models. See "SEMSE overrides" §4 above for where each of these actually lives in this repo.

────────

## 4. Historical regression protection

Before modifying mature, critical, or suspicious code/processes, inspect history.

```bash
git log -- <path>
git blame <path>
```

Search for: incident fixes; regression tests; hotfixes; migration notes; retry logic; timeout protections; idempotency; locking; authorization guards; rollback logic; webhook defenses; offline reconciliation; deployment/startup scripts.

**Rule: Do not remove defensive behavior because it looks redundant until history proves it is unnecessary.** (This repo has a documented instance of exactly this mistake almost happening the other way: session-revocation-by-DB-check was tried once, reverted after causing 15s timeouts on Railway, and the revert is recorded in `auth.service.ts:127-129` — don't reintroduce it without reading that history first; see `semse-security-baseline`.)

────────

## 5. Truthful state model

Never silently promote one state into another. Examples:

```text
camera active ≠ recording
recording ≠ uploaded
local save ≠ cloud synced
transcript ≠ fact
observation ≠ evidence
estimate ≠ measurement
AI extraction ≠ verified result
evidence ≠ approved knowledge
eligible ≠ paid
request sent ≠ completed
deployment started ≠ production verified
```

Every state transition must have explicit evidence. In this repo, `docs/AUDIT_REMEDIATION_PLAN.md`'s own findings are full of exactly this failure mode already caught once (e.g. "deploy started" being read as "activated" — see the plan's note on not inferring activation from code, merge, deploy, or healthcheck).

────────

## 6. Per-module execution contract

For every module/capability, produce (see `references/MODULE_SDD_TEMPLATE.md` for the fillable form):

```text
PROBLEM, GOAL, CURRENT REALITY, CANONICAL OWNER, EXISTING IMPLEMENTATION,
PARTIAL IMPLEMENTATION, BROKEN PATHS, DUPLICATES, DEPENDENCIES, RISKS,
REUSE, EXTEND, NEW, OUT OF SCOPE, ACCEPTANCE CRITERIA, FAILURE CASES,
OBSERVABILITY, SECURITY / PRIVACY, SCALABILITY, ROLLBACK / RECOVERY,
TEST PLAN, EXIT GATE
```

When the module has (or needs) a real spec, this contract is the investigation input to `semse-spec-kit-flow`'s process, not a replacement for `docs/specs/[dominio]/[feature].spec.md`.

────────

## 7. Per-task loop ledger

For every task maintain (see `references/EXECUTION_LEDGER_TEMPLATE.md`):

```text
TASK_ID, TASK_STATE, LOOP_ITERATION, CURRENT_GAP, LAST_ACTION,
LAST_VERIFICATION, FAILURE_FOUND, CORRECTION, NEXT_ACTION, BLOCKER, EVIDENCE
```

Allowed task states: `NOT_STARTED, INSPECTING, IMPLEMENTING, VERIFYING, REOPENED, BLOCKED, CLOSED`.

A task marked `CLOSED` must have exit-gate evidence. Remember: this ledger is a session scratchpad (see "SEMSE overrides" §2) — for anything with a real `.spec.md`, that file's frontmatter is the durable record.

────────

## 8. Verification stack

Run every applicable layer. See "SEMSE overrides" §5 above for this repo's real commands in place of the generic list below.

**Code / technical:** format/lint; typecheck; unit tests; integration tests; E2E; negative tests; auth/permission tests; cross-tenant/resource-boundary tests; idempotency; retries; reconnect; offline/restart; migration validation; schema/spec validation; build; security checks; performance checks; provider failure checks; deploy smoke; production smoke; physical-device test when relevant.

**Product / operational:** first-time-user comprehension; happy path; error path; recovery path; duplicate submission; stale state; partial state; cancellation; retry; permission denial; missing data; low connectivity; accessibility; localization; supportability; auditability.

────────

## 9. AAA quality gates

A module cannot be called complete until applicable gates are checked: `PRODUCT CLARITY, UX, MOBILE, ACCESSIBILITY, LOCALIZATION, RELIABILITY, SECURITY, PRIVACY, PERFORMANCE, OBSERVABILITY, SCALABILITY, MAINTAINABILITY, RECOVERY, RELEASE SAFETY, DATA INTEGRITY, AUDITABILITY`.

A failure in a critical gate reopens the loop.

────────

## 10. Completion states must be reported separately

Never report only "done". Report:

```text
DESIGNED: CODED / EXECUTED: TESTED_LOCAL: INTEGRATION_TESTED: E2E_TESTED:
CI_GREEN: REVIEWED: MERGED / APPROVED: DEPLOYED: ACTIVATED:
VERIFIED_PRODUCTION: PHYSICAL_DEVICE_VERIFIED: DOCUMENTED:
```

Use N/A only with a reason. See "SEMSE overrides" §2 — if the task has a real spec, this maps directly onto its frontmatter fields; keep both in sync rather than tracking it twice.

────────

## 11. Module exit gate

Before leaving a module:

1. Re-read the module SDD/spec.
2. Check every acceptance criterion.
3. Check the completion matrix.
4. Search for unresolved TODO/FIXME/stubs inside scope.
5. Inspect duplicate writers/owners.
6. Run the end-to-end scenario.
7. Run surrounding regression checks.
8. Test degraded/failure states.
9. Confirm observability exists.
10. Confirm security/privacy boundaries.
11. Confirm scale is not knowingly blocked.
12. Confirm rollback/recovery behavior.
13. Record objective evidence.

If any critical requirement lacks evidence, reopen the relevant loop.

────────

## 12. Real blockers only

The loop may stop only for a genuine external blocker: missing credential or permission; unavailable required hardware; destructive/irreversible action requiring human approval; unresolved ownership conflict; external provider outage; security/safety decision requiring human authority; legal/compliance decision requiring authorized review; inaccessible production environment.

Do not stop because: the task is large; the repository/system is complex; many files exist; implementation is partial; investigation is taking time; a dependency is inconvenient. Those mean continue ZOOM + LOOP.

In this repo specifically, "no `ANTHROPIC_API_KEY` in this sandbox" and "no `OPS_ADMIN` credential for live admin verification" have both been genuine, already-documented blockers (see `docs/AUDIT_REMEDIATION_PLAN.md` items `1.11b` and the admin-flows spec's own non-goals) — those are legitimate stops, not excuses.

────────

## 13. Autonomy rule

Do not ask for confirmation for routine decisions that can be resolved from: repository/system evidence; existing architecture; documented product rules; tests; standards; prior decisions.

Make the safest architecture-consistent decision, execute it, verify it, and document it. Ask only when genuine human authority is required.

**In this repo, "genuine human authority required" always includes**: anything `semseproject`'s Approval Gate contract classifies as mutating/financial/cross-tenant, and anything `semse-audit-remediation` gates as RC5 (payment status) or RC6 (auth) — see "SEMSE overrides" §1. This rule does not override those.

────────

## 14. PR / change sizing

Prefer vertical, reviewable slices. Avoid mixing unnecessarily: schema migration; provider integration; UI redesign; multiple domains; unrelated refactors; broad cleanup; production config changes.

Each change should have a clear purpose and measurable exit gate. In this repo: open as a draft PR against `main`, use `.github/pull_request_template.md`, subscribe to its activity, and drive it to green per this session's established PR workflow.

────────

## 15. Final objective

The objective is not "all tasks have code." The objective is: **a complete, production-grade, scalable behavior that works end-to-end with objective evidence.**

For any project, define one final real-world scenario:

```text
REAL USER / INPUT
→ ENTRY POINT
→ DOMAIN FLOW
→ DATA / STATE
→ VALIDATION
→ ACTION
→ RESULT
→ AUDIT / OBSERVABILITY
→ RECOVERY
→ FINAL VERIFIED OUTCOME
```

That scenario becomes the final acceptance test.

────────

## 16. Reusable start command

See `references/START_PROMPT.md` for the ready-to-paste version (adapted with the SEMSE overrides folded in).

────────

## 17. Short correction command

> ZOOM. "Exists" is not "complete". Trace the full chain, reopen the LOOP, find the missing gap, and prove the exit gate with evidence.

────────

## 18. Skill success criteria

This skill is working correctly when the agent: finds hidden partial implementations; detects duplicate architecture before adding more; surfaces historical regression risks; separates design from real execution; keeps tasks open until objectively verified; produces evidence instead of optimistic claims; finishes modules end-to-end; leaves behind clear SDD, test, deployment, and operational documentation — **and, in this repo, never uses §13's autonomy rule to bypass `semseproject`'s Approval Gate or `semse-audit-remediation`'s money/auth sign-off requirement.**

## Notas para futuros agentes / hallazgos abiertos

- Esta skill vino de un paquete genérico subido por el usuario (2026-09-17), no de una investigación de este código — a diferencia de las otras 10 skills de este repo, su contenido base (secciones 1, 4-15, 17-18) es metodología domain-agnostic, no un hallazgo verificado. Solo las secciones marcadas `[SEMSE overrides]` y las notas inline con referencias a otras skills son específicas de este repo.
- No se verificó en la práctica si el conflicto entre §13 (Autonomy rule) y el Approval Gate de `semseproject` llega a darse realmente en una tarea concreta — es una precaución basada en lectura de ambos textos, no en un incidente observado. Si en el futuro un agente reporta haber tenido que elegir entre ambas reglas, documentar acá cómo se resolvió.
- Los templates en `references/` (`MODULE_SDD_TEMPLATE.md`, `EXECUTION_LEDGER_TEMPLATE.md`) se dejaron casi como en el paquete original — son formularios genéricos de trabajo de sesión, no artefactos SDD de este repo. No reemplazan `.specify/templates/overrides/semse-spec.md` ni se comprometen a un formato exacto; úsenlos como ayuda de investigación, no como entregable final.
