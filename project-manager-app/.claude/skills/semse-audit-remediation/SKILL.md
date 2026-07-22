---
name: semse-audit-remediation
description: Use when implementing, verifying, triaging, or prioritizing findings from docs/AUDIT_REMEDIATION_PLAN.md, docs/specs/ui/pro-flows-remediation.spec.md, docs/specs/ui/client-flows-remediation.spec.md, or docs/specs/ui/admin-flows-remediation.spec.md — or when a task touches JobStatus casing, RBAC permissions for PRO/WORKER roles, evidence/travel file uploads, payment status display, escrow/payout integrity, or cross-tenant/IDOR checks in project-manager-app. Trigger even when the user only references a finding ID (0.0, G-PRO-05, G-ADM-00, 2.32, etc.) or says "arregla el bug de..." without naming this skill by name.
---

# SEMSE Audit Remediation

## Purpose

Execute the backlog documented across `docs/AUDIT_REMEDIATION_PLAN.md` and the three `docs/specs/ui/*-remediation.spec.md` files without re-diagnosing what is already diagnosed, without breaking what is already confirmed working (see "Cosas ya confirmadas que funcionan bien" in the plan), and without silently reintroducing a pattern that was just fixed elsewhere.

This skill is a companion to `semse-ecosystem-architect` (Systems Reviewer / Frontend Engineer modes apply to almost all of this backlog) — it adds the concrete, SEMSE-specific playbook that generic skill doesn't have.

## Source of truth — read the right one before touching anything

- `docs/AUDIT_REMEDIATION_PLAN.md` — the master backlog. Organized: Section 0 = transversal (security/money/auth, fix first regardless of module), Section 1 = Client, Section 2 = Worker/PRO, Section 3 = Admin. Each item: severity, `[ ]`/`[x]` state, file:line, fix direction.
- `docs/specs/ui/pro-flows-remediation.spec.md` — Worker/PRO findings (`G-PRO-*`), SDD-compliant format. **status: DRAFT.**
- `docs/specs/ui/client-flows-remediation.spec.md` — Client findings (`G-CLI-*`), same format. **status: DRAFT.**
- `docs/specs/ui/admin-flows-remediation.spec.md` — Admin findings (`G-ADM-*`). **status: DRAFT, and explicitly code-only (no live verification — no `OPS_ADMIN` credential was available during the audit).** Its own Non-Goals section says this spec "no aprueba ningún fix de código todavía."
- The `.md` plan and the three `.spec.md` files describe the same findings from two angles — the plan is the working checklist, the specs are the SDD artifacts `AGENTS.md` requires before implementation. Don't treat one as replacing the other.

## Governance gate — read this before dispatching any implementation crew

All three `*-remediation.spec.md` files are `status: DRAFT`. Per this repo's own `AGENTS.md`: *"detenerse y completar el flujo SDD si el spec está `DRAFT`, `PARTIAL`, `MISSING` o `REVIEW_REQUIRED`"* — i.e., an agent should not jump straight from a DRAFT spec to `/speckit.implement`. The correct sequence per finding (or per batch of related findings) is:

1. Confirm the finding is still accurate (code may have moved since 2026-07-20/21).
2. Run `/speckit.plan` against the relevant spec section, then `/speckit.tasks`.
3. For anything touching money, auth, or cross-tenant data (Section 0, RC4/RC5/RC6 below): get explicit human sign-off before `/speckit.implement`, given `risk: critical` on all three specs.
4. Only then implement, following the normal Section 5/6 steps of `AGENTS.md`.

`admin-flows-remediation.spec.md` additionally cannot be promoted past DRAFT until someone gets an `OPS_ADMIN` credential and repeats the live-verification pass already done for Client and Worker — its G-ADM-* findings are code-only hypotheses until then. Do not implement an Admin fix based solely on this spec without flagging that it was never confirmed on screen.

The plain `AUDIT_REMEDIATION_PLAN.md` items (numbered `0.x`, `1.x`, etc.) aren't gated by a DRAFT spec in the same way, but anything beyond a true one-line fix should still get a short `/speckit.plan` per `AGENTS.md`'s general rule.

## The 7 root causes — check these before treating two findings as unrelated

1. **RC1 — JobStatus casing.** Real enum is UPPERCASE (`packages/db/prisma/schema.prisma`). ~8 frontend files compare it against lowercase literals, copy-pasted from an earlier schema version. Covers `0.0`, `1.4`, `2.1b`, `G-PRO-00`, `2.26`/`G-PRO-08`, likely `3.0`/`G-ADM-00` (unconfirmed). **Fix once, centrally** — check `packages/schemas` for an existing shared `JobStatus` export before adding a new one; normalize at the BFF/mapper layer, not by patching 8 components separately.
2. **RC2 — Upload flow never PUTs.** `worker/evidence` and `worker/travel/[travelId]`: the `single_put` branch never calls `plan.uploadUrl`; the `multipart` branch is broken on *both* frontend (never attaches the file body) and backend (never persists it). 0% of worker uploads reach storage today. Covers `0.34`, `G-PRO-06`, `2.18`, `2.21`, `2.22`, `2.45`. A correct reference implementation already exists: `apps/web/app/semse-api.ts` → `uploadEvidenceFile`, used by `apps/web/app/jobs/[jobId]/page.tsx`. Reuse or mirror it — don't reinvent the upload contract.
3. **RC3 — Missing RBAC permissions for PRO/WORKER.** Missing `agents:run:create` (blocks all agent chat), missing `jobs:create`-equivalent for travel, and `users:verify` wrongly gated admin-only when PRO needs a *request*-verification affordance, not the admin action itself. Covers `0.33`, `G-PRO-05`, `2.46`, `G-PRO-10`, `2.31`, `G-PRO-09`, `2.28`. Check `packages/auth/src/rbac.ts` for the real permission arrays per role before assuming what a fix should grant.
4. **RC4 — Missing tenantId/assignedTo filter (IDOR).** Pattern: a `where` clause omits a scoping field that a sibling function in the *same file* already uses correctly (e.g. `findUnitById` scopes by tenant, `updateUnitStatus` right next to it doesn't). Covers `0.4`, `0.5`, `0.6`, `0.7`, `G-PRO-11`/`2.32`, `2.19`, `2.20`, `2.34`. Look for the correct sibling pattern in the same repository file first — it's usually a few lines away.
5. **RC5 — Payment status not verified against the provider, or read from the wrong field.** Covers `0.12`–`0.17`, `G-PRO-12`/`2.39`. Highest business risk in the backlog — plan reviewed by a human before implementing, per the governance gate above.
6. **RC6 — Auth weaknesses.** Header spoofing (`0.1`), bootstrap token not enforced (`0.2`), no session/token revocation (`0.3`), password reset never sends an email (`0.32` — already locked out a real user twice in 24h). Same caution as RC5.
7. **RC7 — Independent findings, no shared root cause.** Fix individually, no batching needed: `G-PRO-07`/`2.17` (reviews — missing `clientUserId`), `2.29`, `2.30`, `2.41`, `2.42`, `2.43`, `2.47`, `2.23`, `2.33`. **`G-PRO-13`/`2.40` (rates) is explicitly blocked on a product decision — do not implement a guess.**

## Do not implement without a product decision first

- `G-PRO-01` — disabling the legacy `/worker/field-ops` tracker has real operational impact if any professional depends on it today; needs coordination with the product owner, not a silent merge.
- `G-PRO-13`/`2.40` — "Mis Tarifas" has no defined real consumer; guessing the design risks leaking a professional's rate into the wrong context (e.g. a different client's estimate).
- `1.5`, `1.21` — dual Client persona (owner vs. contractor-with-CRM) and dual brand identity (SEMSE Project vs. SEMSE OS) are product/brand calls.
- `2.44` — PCI-DSS: raw card/bank data collected in plaintext must move to Stripe Elements/Plaid; this is a compliance decision, not just a refactor.

## Definition of done for a remediation item

1. The fix matches the "Fix esperado" already written in the plan/spec. If it doesn't, say why before deviating.
2. Mark the item `[x]` in `docs/AUDIT_REMEDIATION_PLAN.md` and note the commit/PR at the end of the line.
3. If the item has a matching line in a `.spec.md` "Tests Required" checklist, check it off there too.
4. Run this repo's real validation commands: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build:api`/`pnpm build:web`, `pnpm verify:workspace`; run `pnpm spec:validate:strict` whenever a `.spec.md` file changed.
5. For RC4 (IDOR) fixes: note in the report whether existing data may already have been exposed/modified through the hole — a clean fix does not mean no incident occurred; there is not enough logging today to know for sure (see plan's own Rollback Considerations note).
6. For RC5/RC6 (money/auth) fixes: state explicitly what was tested live versus what could only be verified by reading code (e.g. a Stripe webhook path may not be testable without a live sandbox event).

## What "good" looks like for this backlog

One focused fix per root cause beats touching every file it happens to appear in with a slightly different patch each time — that divergence is exactly how RC1 ended up with 8 different copies of the same broken comparison in the first place. Prefer the shared/centralized fix over the local patch whenever a root cause spans more than one file.
