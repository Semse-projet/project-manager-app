# SEMSE Field Knowledge System — PR-2 (Contributor Mission-First UX) — ZOOM + LOOP report

**Date:** 2026-09-17
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Input:** SEMSE Claude AAA Start Pack (ZOOM/LOOP protocol) + Field Knowledge Control Center spec bundle, both dated 2026-09-16.
**Scope executed this session:** PR-2 only (Contributor Mission-First UX), per the master prompt's explicit instruction to "begin now with repository truth and PR-2." PR-3 through PR-10 were **not** started — see "What remains" below. This is an honest, bounded slice, not a claim that the 10-PR program is complete.

## 1. Repository truth (ZOOM)

`git log --oneline -30` on `main`/this branch showed the Field Knowledge / Contributor Program is **not greenfield**: commit `6ac6718` ("Add SEMSE Knowledge Contributor Program (F1 slice)", PR #627, merged 2026-09-15) already shipped a materially complete backend + web slice *before* this session started, followed by two hotfixes to the terms-seed migration (`c521b5e`, `c2fe1aa`, `540bee9`, `4fd8805`, `c56ca7c`, `b24beb7`). The start pack's own `00_CURRENT_STATE.md` (cut 2026-09-16) independently classifies this as `Contributors: NEW/PARTIAL — public terms flow + contributor foundation` with "Mission UX, acceptance snapshot, submission/capture/review/reward" listed as remaining — but tracing the actual code (not the doc) shows acceptance/submission/review/reward/appeal are *already implemented end-to-end*, just not yet aligned to the PR-2 UX spec's exact copy/flow rules. Concretely, before touching anything, the following was traced screen → API → DB:

- `apps/api/src/modules/contributor-program/{controller,service,repository,policy,module}.ts` — full CRUD/workflow: terms/consent, mission CRUD + publish/pause/close, acceptance (with price/version snapshot), submission + multi-asset + submit, admin review (reason required) + appeal + resolve, reward creation + Stripe Connect payout via the **existing** `StripeConnectService.transferToContractor` (no second payments engine).
- `packages/db/prisma/schema.prisma` — 11 models added in migration `20260916021251_knowledge_contributor_program`, additive only (no existing table touched); a same-day follow-up migration fixed a stuck seed row for `ContributorTermsVersion` v1.0.
- `apps/web/app/contributors/**`, `apps/web/app/(app)/admin/contributors/**`, `apps/web/app/api/semse/contributors/**` — public pages, contributor dashboard, admin console, all BFF routes.
- Reuses (not duplicates): auth/RBAC (`packages/auth/src/rbac.ts`), generic upload pipeline (`StorageService`, new `knowledge_contribution` storage domain), `AuditService.append`, `SseEventBusService`, the web BFF pattern (`app/api/semse/[module]/route.ts` + `app/semse-api.ts`), i18n (`lib/language-context.tsx`, flat `es`/`en` string-key dictionaries, no next-intl).

**Conclusion:** treating this as new work would have created a second Contributor system. Correct action per the architecture invariants was **REUSE + EXTEND**, not NEW — confirmed before writing any code.

## 2. Gap register — PR-2 spec (`15_PR2_CONTRIBUTOR_MISSION_FIRST_UX.md`) vs. code as it stood this morning

| Spec requirement | State found | Evidence |
|---|---|---|
| Mission-first hero copy ("Gana dinero enseñando cómo haces tu trabajo.") | ABSENT | Hero rendered the abstract program name (`contributors.title` = "SEMSE Knowledge Contributor Program") as H1, terms-first framing |
| Primary CTA = "Ver misiones disponibles" | BROKEN (inverted) | Primary hero button was "Participar" → `/login` → dashboard — exactly the anti-pattern the spec calls out ("a generic Participar → dashboard... should not be the main public CTA") |
| Four-step explanation, exact copy | PARTIAL | Six generic/technical steps existed instead of the spec's four plain-language steps |
| Empty/example mission state (rule A/B/C) | EXISTING | `EmptyState` with explicit copy already satisfies rule B; left unchanged |
| "tarea → misión de SEMSE" terminology | ABSENT | Copy used "misión" exclusively, no first-exposure "tarea" |
| Demo/example mission must show "Demo — no disponible para aceptar" and never be acceptable | BROKEN (real bug) | Seed mission `isDemo:true, baseCompensationCents:500` had **no server-side guard** — `acceptMission` would accept it and snapshot a real $5.00 reward; UI showed a real formatted price and an enabled Accept button |
| Auth transition: after login, show terms/consent, return to the same mission | BROKEN | Server correctly throws `CONTRIBUTOR_PROGRAM_CONSENT_REQUIRED` (400) when consent is missing, but the BFF layer (`_server.ts`) and the browser client (`semse-api.ts`) only ever forwarded `message`, dropping `code` — the mission page had no way to distinguish "needs consent" from any other error and just showed a raw error string instead of the consent flow |
| Login returns to selected mission, not dashboard | EXISTING | Already implemented via `from=` query param |

## 3. LOOP — implemented this session

1. **`apps/api/.../contributor-program.service.ts`** — `acceptMission` now rejects `mission.isDemo` missions with `400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO` before any acceptance/snapshot is created. This is a real financial-safety fix, not cosmetic: without it a demo mission was payable.
2. **`apps/web/app/api/semse/_server.ts`** + **`apps/web/app/semse-api.ts`** — extended the BFF error contract to carry a machine-readable `code` end to end (Nest exception body → BFF `SemseProxyError.code` → JSON `{error:{status,message,code}}` → browser `SemseApiError.code`). Additive, non-breaking for every other BFF route.
3. **`apps/web/app/contributors/page.tsx`** + **`lib/language-context.tsx`** — mission-first hero (eyebrow "Tarea (misión de SEMSE)" + heading + spec supporting copy), primary CTA now anchors to `#missions`, "Cómo funciona"/"Leer términos" kept as secondary/tertiary, "Participar" demoted to a small text link ("¿Ya tienes cuenta? Participar"), four-step section replaced with the spec's exact four-step copy, demo missions show "Demo — no disponible para aceptar" instead of a currency amount and "Ver ejemplo" instead of "Ver detalle".
4. **`apps/web/app/contributors/missions/[id]/page.tsx`** — demo missions: Accept button disabled and relabeled; non-demo missions: on `CONTRIBUTOR_PROGRAM_CONSENT_REQUIRED`, the page now renders the existing `ConsentGate` (reused from the dashboard, not duplicated) inline and auto-retries acceptance on completion — the contributor never leaves the selected mission.
5. **Tests**: added `apps/api/test/contributor-program.service.test.ts` case "accepting a demo mission is rejected and never creates an acceptance"; fixed the pre-existing "price/version snapshot" test, which had `isDemo: true` on its fixture mission incidentally and would have started failing against the new guard for an unrelated reason — changed to `isDemo: false` since demo status was never what that test was about.

## 4. Verification (real, not assumed)

No Docker in this sandbox, but PostgreSQL 16 was already installed; started `postgresql@16` locally, created a scratch DB, ran `prisma migrate deploy` (all 40 migrations, including the two 2026-09-16 contributor-program ones, applied cleanly), and ran the suites for real against it — not skipped:

- `node --test apps/api/test/contributor-program.service.test.ts` → **5/5 pass** (previously these were "SKIP" without `DATABASE_URL`; now executed for real, including the new demo-guard test and the corrected snapshot test).
- `pnpm --filter @semse/api test:unit` → **2230/2230 pass**, 1 unrelated skip.
- `pnpm test:unit` (root) → **1058/1058 pass**.
- `node --test tests/unit/contributor-i18n-keys.test.ts` → pass (all new es/en keys added in parity).
- `pnpm build:packages`, `pnpm build:api`, `pnpm build:web` → all clean; `/contributors`, `/contributors/missions/[id]` and every contributor BFF route present in the Next.js route manifest.
- `pnpm lint` → 0 errors (36 pre-existing warnings, none in touched files).
- `pnpm typecheck` → clean across api/web/worker/mobile.

## 5. Status (per-capability, not a single "done")

- CODED: yes (all items in §3).
- TESTED_LOCAL: yes, against a real local Postgres (not just skip-mode).
- INTEGRATION_TESTED: yes, for the demo-mission guard and the existing acceptance/reward/extraction integration suite.
- CI_GREEN: unknown — not run in this sandbox (no access to GitHub Actions from here); relies on the PR's own CI run.
- REVIEWED: no — pending human/PR review.
- MERGED: no.
- DEPLOYED: no.
- ACTIVATED: no.
- VERIFIED_PRODUCTION: no.
- PHYSICAL_DEVICE_VERIFIED: not applicable to this PR (no native mobile surface touched).

## 6. What remains (honest scope boundary)

This session closed the concrete, spec-verifiable gaps in **PR-2 only**. It did **not** attempt PR-3 through PR-10 (native Prometeo Live mobile media, local/offline recording, transcript/observation pipeline, Evidence promotion adapter, human review workspace, Knowledge Registry, Prometeo/RAG ingestion of approved field knowledge, contributor reward hardening beyond the existing mocked Stripe Connect payout, or the electrical EMT physical-device pilot). Per the start pack's own current-state audit, those remain PARTIAL/ABSENT/DESIGNED_ONLY and require native mobile work, device/hardware access, and product decisions (e.g., hybrid/private vs. dataset media retention policy) that are real blockers for a text-only sandbox session — not a reason to claim the program complete. Recommended next step: open a follow-up session scoped explicitly to PR-3 (native Prometeo Live media), continuing the same ZOOM-then-LOOP discipline against the current repository state rather than the 2026-09-16 snapshot.
