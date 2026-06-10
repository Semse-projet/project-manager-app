# SEMSEproject 6-Phase Work Plan

Status: working plan for landing, audit, dashboard, Prometeo, operational routes, and QA.

Purpose: this document explains what to do, when to do it, and how to split the work so any human or agent can continue without mixing scopes.

Core rule:

```text
Do not mix phases.
Do not mix public landing work with backend, dashboard, Prisma, API, auth, or specs unless the phase explicitly allows it.
```

Strategic direction:

```text
SEMSEproject should not show complexity.
SEMSEproject should turn complexity into clear next steps.
```

Target experience:

```text
User enters -> says what they need -> SEMSE guides the route -> Prometeo helps -> evidence verifies -> milestones approve -> payment releases -> reputation grows.
```

## Phase Blocks

```text
Block A: Public entry
Phase 1: Audit and cleanup
Phase 2: Public landing
Phase 3: QA, validation, and deploy

Block B: Internal experience
Phase 4: Dashboard/auth/role audit
Phase 5: Guided dashboard by role
Phase 6: Prometeo, operational queues, and trade routes
```

## Global Guardrails

- Work in small PRs.
- Audit before implementing.
- Keep public landing changes separate from internal dashboard work.
- Keep backend/API/Prisma/worker changes out of landing PRs.
- Use declarative content/config where possible.
- Verify routes before linking to them.
- Avoid adding new dependencies unless strictly necessary.
- Keep mobile-first behavior.
- Keep dark/light mode behavior.
- Preserve existing routes unless a phase explicitly changes routing.
- If a build/test failure is unrelated, document it instead of hiding it in a large refactor.

## Spec-Driven Development Alignment

This plan must follow SEMSEproject SDD governance.

Source documents:

- `docs/SDD_GOVERNANCE.md`
- `docs/SOURCE_OF_TRUTH.md`
- `docs/specs/README.md`
- `docs/SPEC_INDEX.md`

Mandatory SDD flow:

```text
constitution
  -> specify
  -> plan
  -> tasks
  -> analyze
  -> implement
  -> validate
  -> report
```

SDD rule for this 6-phase program:

```text
No phase implementation starts until its spec coverage is known.
No critical UI/API/payment/evidence/auth behavior ships without Spec -> Code -> Test traceability.
```

### SDD Gates for Every Phase

Each phase must pass these gates:

1. Spec gate
   - Identify existing specs that govern the phase.
   - If no spec exists, create or update a spec before implementation.
   - Register or update the spec in `docs/SPEC_INDEX.md` when required by governance.

2. Plan gate
   - Define affected modules.
   - Define affected files.
   - Define routes and contracts.
   - Define out-of-scope areas.

3. Task gate
   - Break the work into executable modules.
   - Mark dependencies between modules.
   - Identify validation commands.

4. Analyze gate
   - Check if the plan conflicts with `docs/SOURCE_OF_TRUTH.md`.
   - Check if the plan violates phase boundaries.
   - Check if routes/API/auth/payment/evidence behavior needs additional specs.

5. Implement gate
   - Implement only the approved phase/module scope.
   - Do not fix unrelated systems inside the same PR.

6. Validate gate
   - Run the phase validation commands.
   - Run `pnpm spec:preflight` for spec-sensitive phases or when specs are changed.
   - Link tests to specs where applicable.

7. Report gate
   - Report files changed.
   - Report specs changed.
   - Report validations.
   - Report risks.
   - Report whether the phase can advance.

### Spec Map for the 6 Phases

Use this map before implementation.

| Phase | Existing / expected spec coverage | Required action |
|---|---|---|
| Phase 1: Audit and cleanup | Governance, source-of-truth, spec index | No product spec required unless cleanup changes behavior. Produce audit report. |
| Phase 2: Public landing | `docs/specs/ui/intake-flow.spec.md`, `docs/specs/ui/client-flows.spec.md`, `docs/specs/ui/pro-flows.spec.md`, possible new UI spec | Create/update a public landing operational-entry UI spec if current specs do not cover hero, CTAs, routes, and intake entry. |
| Phase 3: Landing QA/deploy | Same specs as Phase 2 plus validation evidence | Update spec status only if implementation reaches VERIFIED and tests/QA are linked. |
| Phase 4: Dashboard/auth/roles audit | `docs/specs/ui/admin-flows.spec.md`, `docs/specs/ui/client-flows.spec.md`, `docs/specs/ui/pro-flows.spec.md`, auth docs | Produce audit report. Create/update guided-dashboard spec before implementation. |
| Phase 5: Guided dashboard by role | `docs/specs/ui/work-os-navigation-decision-intelligence.spec.md` and role flow specs | Implement only after spec is APPROVED. Link components/routes/tests. |
| Phase 6: Prometeo, queues, trade routes | `docs/specs/api/prometeo.spec.md`, `docs/specs/api/evidence.spec.md`, `docs/specs/api/payments.spec.md`, `docs/specs/tools/*`, agents specs | Requires Spec -> Code -> Test traceability for evidence, payments, Prometeo, trust, and tools. |

### Specs That May Need Creation or Update

Do not create these blindly. First verify if existing specs already cover the behavior.

Suggested spec files if gaps exist:

- `docs/specs/ui/public-landing-operational-entry.spec.md`
- `docs/specs/ui/role-guided-dashboard.spec.md`
- `docs/specs/ui/prometeo-contextual-guidance.spec.md`
- `docs/specs/ui/operational-queues.spec.md`
- `docs/specs/tools/trade-routes.spec.md`

### SDD Validation Commands

Use these from the monorepo root when specs are changed or when a phase depends on spec status:

```bash
pnpm spec:validate
pnpm spec:coverage
pnpm spec:preflight
```

Use these for web implementation phases:

```bash
pnpm build:web
pnpm typecheck
pnpm lint
git diff --check
```

Use these only when the phase touches API behavior or API specs:

```bash
pnpm build:api
pnpm --filter @semse/api test:unit
pnpm --filter @semse/api test:coverage
```

### Spec Status Rules

- `DRAFT`: do not implement.
- `REVIEW`: wait for approval unless doing audit only.
- `APPROVED`: implementation may start.
- `IMPLEMENTED`: code exists and `related_files` should be accurate.
- `VERIFIED`: validations/tests pass and `related_tests` should be accurate.
- `DEPRECATED`: do not use for new work.

## Phase 1: Audit and Cleanup of Current State

Objective: understand and separate everything before building more.

Allowed scope:

- Repo state inspection.
- File classification.
- Landing component audit.
- Route audit.
- CSS/Tailwind audit.
- Security and validation audit.
- Cleanup plan.

Not allowed:

- Feature implementation.
- Dashboard redesign.
- Backend changes.
- Prisma changes.
- API contract changes.

### Module 1.1: Git Audit

Tasks:

- Run `git status --short --branch`.
- Identify current branch.
- List modified files.
- List untracked files.
- List ignored/generated files if relevant.
- Identify dirty files unrelated to landing.

Deliverable:

- Current branch.
- Modified file list.
- Untracked file list.
- First risk classification.

### Module 1.1-SDD: SDD Baseline Audit

Tasks:

- Run or review `pnpm spec:preflight`.
- Read `docs/SDD_GOVERNANCE.md`.
- Read `docs/SPEC_INDEX.md`.
- Identify specs related to landing, intake, roles, dashboard, Prometeo, evidence, payments, tools, and navigation.
- Identify specs with status `APPROVED`, `IMPLEMENTED`, or `VERIFIED`.

Deliverable:

- SDD baseline matrix for the 6-phase program.

### Module 1.2: Change Classification

Tasks:

- Classify files into:
  - Public landing.
  - API/backend.
  - Dashboards/internal app.
  - Docs/specs.
  - Tests.
  - Mobile.
  - Config/scripts.
  - Generated/ignored.
- Mark files that belong in PR 1.
- Mark files that must be moved to later PRs.

Deliverable:

- PR 1 candidate file list.
- Out-of-scope file list.

### Module 1.3: Landing Audit

Tasks:

- Map main landing file.
- Map hero.
- Map CTAs.
- Map Trust Bar.
- Map Smart Intake.
- Map "Elige tu ruta de trabajo".
- Map "Como funciona".
- Map roles.
- Map ecosystem modules.
- Map services/trades.
- Map final CTA.
- Map footer.

Expected files:

- `apps/web/app/(public)/page.tsx`
- `apps/web/components/landing/landing-nav.tsx`
- `apps/web/components/landing/landing-footer.tsx`
- `apps/web/components/landing/landing-intake.tsx`
- `apps/web/components/landing/landing-routes.ts`
- `apps/web/components/landing/operational-routes-grid.tsx`
- `apps/web/components/landing/ecosystem-modules.tsx`
- `apps/web/components/landing/roles-dashboard.tsx`

Deliverable:

- Landing map with file references.

### Module 1.4: Duplicate Component Audit

Tasks:

- Check for duplicate file names by case.
- Specifically check:
  - `LandingNav.tsx`
  - `landing-nav.tsx`
- Search imports.
- Decide which component is canonical.
- Mark unused duplicate for removal or follow-up.

Deliverable:

- Duplicate component report.
- Recommended cleanup action.

### Module 1.5: Route Audit

Tasks:

- Verify all landing links.
- Verify dynamic module routes.
- Verify login redirects.
- Detect future/fallback routes.
- Detect links that may become 404s.

Routes to verify:

- `/client/jobs/new`
- `/login?from=/worker/dashboard`
- `/tools`
- `/modules/[id]`
- `/client/dashboard`
- `/client/milestones`
- `/worker/evidence`
- `/admin/dashboard`
- `/admin/mission-control`
- `/admin/ai-mission-control`
- `/buildops/projects`

Deliverable:

- Link matrix with status:
  - exists
  - fallback
  - future
  - risky

### Module 1.6: Tailwind/CSS Audit

Tasks:

- Search for suspicious utility classes.
- Confirm whether custom tokens exist.
- Detect classes likely not generated.
- Check mobile overflow risks.
- Check dark/light mode variables.

Classes to review:

- `slate-250`
- `slate-350`
- `slate-450`
- `slate-650`
- `slate-850`
- `max-height-screen`
- `active:scale-98`

Deliverable:

- CSS/Tailwind risk report.

### Module 1.7: Scope Audit

Tasks:

- Identify files that violate landing PR scope.
- Separate backend/API/dashboard/spec changes.
- Decide what should be stashed, split, or moved to another branch.

Deliverable:

- Scope cleanup plan.

### Module 1.8: Security Audit

Tasks:

- Search for real secrets.
- Confirm `.env` files are not tracked.
- Review demo credentials exposure.
- Run dependency audit if network is available.
- Classify vulnerabilities.

Deliverable:

- Security findings.
- Dependency risk list.

### Module 1.9: Validation Audit

Tasks:

- Run or review:
  - `pnpm build:web`
  - `pnpm typecheck`
  - `pnpm lint`
  - `git diff --check`
  - relevant tests.
- Classify failures as:
  - caused by current changes
  - preexisting
  - environment/dependency
  - unrelated

Deliverable:

- Validation matrix.

### Module 1.10: Cleanup Plan

Tasks:

- Decide exact PR split.
- Decide what to keep in PR 1.
- Decide what to delay.
- Define next branch or stash strategy.

Deliverable:

- Step-by-step cleanup plan.

### Module 1.11: Critical Findings Report

Tasks:

- Order findings by severity.
- Include exact files.
- Include why each issue matters.
- Include fix recommendation.

Deliverable:

- Audit report ready for review.

### Module 1.11-SDD: Spec Gap Report

Tasks:

- List behavior that is already governed by specs.
- List behavior that is not governed by specs.
- Identify which specs must be created or updated before implementation phases.
- Identify whether `docs/SPEC_INDEX.md` must be updated.

Deliverable:

- Spec gap report.

### Module 1.12: Phase 1 Exit Criteria

Phase 1 is complete when:

- Landing files are mapped.
- Out-of-scope changes are identified.
- Route risks are known.
- CSS risks are known.
- Security/dependency risks are known.
- Spec coverage is known.
- Missing specs are listed.
- A clean PR 1 plan exists.

## Phase 2: Public Landing Clean and Stable

Objective: ship the public landing as a focused, low-risk PR.

Allowed scope:

- Public landing route.
- Landing components.
- Landing content/config.
- Public module pages only if intentionally included.
- Public worker apply page only if intentionally included.

Not allowed:

- Backend/API changes.
- Prisma changes.
- Worker changes.
- Auth rewrites.
- Dashboard guided-by-role implementation.

### Module 2.1: Final Hero

Tasks:

- Confirm headline:

```text
No pagues por promesas. Paga por avances verificados.
```

- Confirm subheadline explains:
  - publish work
  - receive proposals
  - create milestones
  - document evidence
  - release payments safely
- Confirm CTA hierarchy.

CTAs:

- `Publicar mi proyecto` -> `/client/jobs/new`
- `Unirme como profesional` -> `/login?from=/worker/dashboard`
- `Ver como funciona` -> `#como-funciona`

Deliverable:

- Final hero section.

### Module 2.1-SDD: Landing Spec Check

Tasks:

- Verify whether an existing UI spec covers public landing behavior.
- If coverage is missing, create/update a public landing operational-entry spec.
- Define acceptance criteria for:
  - hero message
  - CTAs
  - admin access placement
  - Trust Bar
  - intake entry
  - route cards
  - `#como-funciona`

Deliverable:

- Landing spec coverage approved before implementation continues.

### Module 2.2: Public Navigation

Tasks:

- Confirm nav links.
- Confirm mobile menu.
- Confirm theme toggle.
- Confirm no Admin CTA in top hero.
- Fix any invalid classes in mobile menu.

Deliverable:

- Stable public nav.

### Module 2.3: Internal Admin Access

Tasks:

- Remove "Panel Admin" from primary hero.
- Keep internal access in footer only.
- Prefer label:

```text
Acceso interno
```

- Route to stable admin path or login redirect.

Deliverable:

- Admin access moved and de-emphasized.

### Module 2.4: Trust Bar

Tasks:

- Replace weak zero metrics with capabilities.
- Use stable chips or responsive wrapped layout.
- Avoid mobile overflow.
- Prefer data from `landing-routes.ts`.

Items:

- IA Conectada.
- Pagos por Hitos.
- Evidencia Verificable.
- Profesionales por Reputacion.
- Soporte en Disputas.

Deliverable:

- Trust Bar ready for mobile and desktop.

### Module 2.5: Declarative Content Source

Tasks:

- Centralize reusable content:
  - trust items
  - operational routes
  - role cards
  - ecosystem modules
  - operating flow steps
  - trade categories
- Avoid duplicated copy in JSX when reasonable.

Deliverable:

- `landing-routes.ts` or equivalent as the content source.

### Module 2.6: Brief / Smart Intake

Tasks:

- Confirm title:

```text
Cuentanos que necesitas hacer
```

- Confirm subtitle:

```text
Describe el trabajo, elige la categoria y SEMSEproject te guia hacia el flujo correcto.
```

- Confirm note:

```text
Algunas categorias ya cuentan con estimador inteligente avanzado; otras usan un brief inicial mientras expandimos el sistema.
```

- Validate contrast.
- Validate mobile layout.

Deliverable:

- Smart Intake copy and layout stable.

### Module 2.7: Operational Routes Section

Tasks:

- Confirm section title:

```text
Elige tu ruta de trabajo
```

- Confirm cards:
  - Publicar un trabajo.
  - Calcular un estimado.
  - Buscar trabajos.
  - Administrar un proyecto.
  - Subir evidencia.
  - Revisar pagos.
  - Preguntar a Prometeo.
- Validate hrefs.
- Validate mobile grid.
- Validate hover/focus states.

Deliverable:

- Action-based route section.

### Module 2.8: Operating Flow

Tasks:

- Confirm `id="como-funciona"`.
- Confirm flow:

```text
Publicar -> IA analiza -> Propuestas -> Elegir -> Hitos -> Escrow -> Evidencia -> Cierre
```

- Confirm CTA scroll works.
- Confirm no layout break.

Deliverable:

- Stable operating flow section.

### Module 2.9: Role Entries

Tasks:

- Confirm roles:
  - Cliente.
  - Profesional.
  - Contratista / operador.
- Confirm copy:
  - Cliente: publica, compara, aprueba.
  - Profesional: recibe trabajos, evidencia, reputacion.
  - Contratista/operador: equipos, hitos, pagos, riesgos, documentacion.
- Validate routes.

Deliverable:

- Clear role entry cards.

### Module 2.10: Ecosystem Modules

Tasks:

- Confirm modules:
  - ProTools.
  - BuildOps.
  - Evidence Vault.
  - Escrow & Payments.
  - Marketplace.
  - Prometeo IA.
  - Trust & Governance.
- Reduce public-facing jargon.
- Keep admin/technical details out of landing copy.

Deliverable:

- Commercial module cards.

### Module 2.11: Services by Trade

Tasks:

- Confirm main trades:
  - Painting.
  - Drywall.
  - Electrical.
  - Plumbing.
  - Flooring.
  - Carpentry.
  - Cleaning.
  - Bathroom.
  - Kitchen.
  - Roofing.
  - HVAC.
  - Concrete.
- Validate that cards do not imply unsupported flows unless routed safely.

Deliverable:

- Clear services/trades section.

### Module 2.12: Final CTA

Tasks:

- Confirm final CTA reinforces:
  - verified work
  - evidence
  - milestones
  - safe payment
- Confirm buttons.
- Confirm routes.

Deliverable:

- Final conversion section.

### Module 2.13: Footer

Tasks:

- Confirm legal links.
- Confirm public links.
- Confirm "Acceso interno".
- Remove confusing public admin wording.
- Validate footer in mobile.

Deliverable:

- Clean footer.

### Module 2.14: Import and Dead Code Cleanup

Tasks:

- Remove unused imports.
- Remove duplicate components.
- Remove dead landing code if safe.
- Keep unrelated code untouched.

Deliverable:

- Clean landing component tree.

### Module 2.15: CSS/Tailwind Cleanup

Tasks:

- Replace invalid utilities.
- Add missing tokens only if project convention supports it.
- Fix mobile overflow.
- Validate theme variables.

Deliverable:

- Stable styling.

### Module 2.16: Accessibility

Tasks:

- Check heading order.
- Check button/link semantics.
- Check aria labels where needed.
- Check focus states.
- Check contrast.

Deliverable:

- Basic accessible landing.

### Module 2.17: i18n Preparation

Tasks:

- Keep copy centralized.
- Avoid duplicate strings in multiple components.
- Do not implement a full i18n system unless it already exists.

Deliverable:

- Landing ready for future ES/EN content.

### Module 2.18: Phase 2 Exit Criteria

Phase 2 is complete when:

- Landing scope is clean.
- Hero, Trust Bar, Intake, routes, flow, roles, modules, CTA, and footer are stable.
- Admin is not in the public hero.
- No backend/dashboard/API work is mixed into this PR.
- Related UI spec is updated if behavior changed.
- Spec status and implementation map are accurate if the spec moves to IMPLEMENTED.

## Phase 3: QA, Validation, and Deploy of Landing

Objective: prove the landing works before moving to internal experience.

### Module 3.1: Web Build

Run:

```bash
pnpm build:web
```

Deliverable:

- Pass/fail result with error classification.

### Module 3.1-SDD: Spec Preflight

Run when specs are changed or when PR claims spec status changes:

```bash
pnpm spec:preflight
```

Deliverable:

- Spec preflight result.

### Module 3.2: Typecheck

Run:

```bash
pnpm typecheck
```

Deliverable:

- Pass/fail result with error classification.

### Module 3.3: Lint

Run:

```bash
pnpm lint
```

Deliverable:

- Pass/fail result with error classification.

### Module 3.4: Diff Check

Run:

```bash
git diff --check
```

Deliverable:

- No whitespace errors.

### Module 3.5: Dependency Audit

Run if network is available:

```bash
pnpm audit --audit-level moderate
```

Deliverable:

- Vulnerability report.
- Decision whether dependency fixes belong in this PR or a separate PR.

### Module 3.6: QA at 320px

Tasks:

- Check hero.
- Check buttons.
- Check Trust Bar.
- Check route cards.
- Check footer.
- Check no horizontal overflow.

Deliverable:

- 320px QA result.

### Module 3.7: QA Mobile

Tasks:

- Check nav.
- Check intake.
- Check cards.
- Check scroll.
- Check tap targets.

Deliverable:

- Mobile QA result.

### Module 3.8: QA Tablet

Tasks:

- Check grids.
- Check module cards.
- Check roles.
- Check footer columns.

Deliverable:

- Tablet QA result.

### Module 3.9: QA Desktop

Tasks:

- Check first viewport.
- Check CTA hierarchy.
- Check section order.
- Check visual rhythm.

Deliverable:

- Desktop QA result.

### Module 3.10: QA Dark Mode

Tasks:

- Check contrast.
- Check borders.
- Check backgrounds.
- Check buttons.

Deliverable:

- Dark mode QA result.

### Module 3.11: QA Light Mode

Tasks:

- Check contrast.
- Check backgrounds.
- Check readability.

Deliverable:

- Light mode QA result.

### Module 3.12: CTA QA

Tasks:

- Verify:
  - Publicar mi proyecto.
  - Unirme como profesional.
  - Ver como funciona.
  - Module cards.
  - Acceso interno.

Deliverable:

- CTA route matrix.

### Module 3.13: Dynamic Route QA

Tasks:

- Verify `/modules/[id]`.
- Verify supported module IDs.
- Verify notFound behavior.

Deliverable:

- Dynamic route QA report.

### Module 3.14: Browser Console QA

Tasks:

- Check hydration errors.
- Check client component warnings.
- Check missing assets.

Deliverable:

- Console QA report.

### Module 3.15: Basic Performance QA

Tasks:

- Check first load.
- Check animation weight.
- Check large client components.
- Identify obvious performance risks.

Deliverable:

- Performance notes.

### Module 3.16: Basic SEO QA

Tasks:

- Check title.
- Check description.
- Check H1.
- Check public metadata.

Deliverable:

- SEO QA notes.

### Module 3.17: Deploy Validation

Tasks:

- Confirm Railway or deployment build.
- Confirm deployment URL.
- Confirm no startup errors.

Deliverable:

- Deploy validation result.

### Module 3.18: Post-Deploy QA

Tasks:

- Open production landing.
- Test CTAs.
- Test mobile.
- Test dark/light if available.
- Check no visible production error.

Deliverable:

- Post-deploy checklist.

### Module 3.19: Final Merge Checklist

Tasks:

- Confirm validations.
- Confirm visual QA.
- Confirm route QA.
- Confirm no out-of-scope files.
- Confirm related specs and `docs/SPEC_INDEX.md` are consistent.

Deliverable:

- Merge approval or block list.

### Module 3.20: Phase 3 Exit Criteria

Phase 3 is complete when:

- PR 1 is merge-ready or merged.
- Public landing is stable.
- Production deploy is verified.
- Known risks are documented.
- Spec status is not overstated.
- Any `VERIFIED` claim has validation evidence.

## Phase 4: Dashboard, Auth, and Role Audit

Objective: understand the internal app before building guided dashboards.

Allowed scope:

- Read/audit internal routes.
- Read/audit auth and role handling.
- Read/audit dashboard components.
- Produce plan.

Not allowed:

- Auth rewrite.
- Prisma changes.
- API contract changes.
- Major dashboard redesign before the audit report.

### Module 4.1: Auth Audit

Tasks:

- Identify auth provider/session source.
- Identify guards.
- Identify cookies/tokens.
- Identify redirects.
- Identify login behavior.

Deliverable:

- Auth flow map.

### Module 4.1-SDD: Internal Specs Baseline

Tasks:

- Identify specs governing:
  - client flows
  - pro/worker flows
  - admin flows
  - Work OS navigation
  - decision intelligence
  - auth/role-sensitive behavior
- Identify missing specs before dashboard implementation.

Deliverable:

- Internal SDD baseline for Phase 5.

### Module 4.2: Role Audit

Tasks:

- Identify real role names.
- Identify role permissions.
- Identify fallbacks.
- Identify demo users if relevant.

Deliverable:

- Role matrix.

### Module 4.3: Middleware Audit

Tasks:

- Review route protection.
- Review redirect loops.
- Review public vs private boundary.

Deliverable:

- Middleware risk report.

### Module 4.4: Client Dashboard Audit

Tasks:

- Map pages.
- Map data dependencies.
- Map actions:
  - publish job
  - proposals
  - evidence approvals
  - payments

Deliverable:

- Client dashboard map.

### Module 4.5: Worker Dashboard Audit

Tasks:

- Map pages.
- Map evidence flow.
- Map payment flow.
- Map jobs/proposals.
- Map reputation/profile.

Deliverable:

- Worker dashboard map.

### Module 4.6: Contractor / BuildOps Audit

Tasks:

- Map BuildOps pages.
- Map projects.
- Map milestones.
- Map tasks.
- Map crews if present.
- Map risks.

Deliverable:

- Contractor/BuildOps map.

### Module 4.7: Admin Audit

Tasks:

- Map:
  - Mission Control.
  - Governance.
  - Evidence Review.
  - Payment Governance.
  - Trust Passport.
  - AI Mission Control.

Deliverable:

- Admin dashboard map.

### Module 4.8: Internal Route Audit

Tasks:

- Verify core routes:
  - `/client/dashboard`
  - `/worker/dashboard`
  - `/worker/evidence`
  - `/buildops/projects`
  - `/client/milestones`
  - `/admin/mission-control`
  - `/admin/ai-mission-control`
  - `/admin/governance`

Deliverable:

- Internal route matrix.

### Module 4.9: Reusable Component Audit

Tasks:

- Search existing shells.
- Search cards.
- Search dashboards.
- Search evidence/payment/trust components.

Deliverable:

- Reuse vs create list.

### Module 4.10: Data/API Audit

Tasks:

- Identify endpoints needed by dashboards.
- Identify mocks/static data.
- Identify loaders/hooks.
- Identify API gaps.

Deliverable:

- Data dependency matrix.

### Module 4.11: Empty State Audit

Tasks:

- Review new user state.
- Review no project state.
- Review no evidence state.
- Review no payment state.
- Review no permissions state.

Deliverable:

- Empty state matrix.

### Module 4.12: Permission Audit

Tasks:

- Check cross-role access.
- Check admin-only routes.
- Check worker/client separation.

Deliverable:

- Permission risk report.

### Module 4.13: Post-Login UX Audit

Tasks:

- Identify what user sees after login.
- Identify whether next step is clear.
- Identify dashboard clutter.
- Identify missing actions.

Deliverable:

- Post-login UX report.

### Module 4.14: Prometeo Audit

Tasks:

- Find Prometeo UI.
- Find AI Mission Control.
- Find current prompts/messages.
- Determine if Prometeo is useful or decorative.

Deliverable:

- Prometeo integration report.

### Module 4.15: Internal Architecture Report

Tasks:

- Decide what to reuse.
- Decide what to create.
- Decide what not to touch.
- Define PR 2 scope.

Deliverable:

- PR 2 implementation plan.

### Module 4.15-SDD: Guided Dashboard Spec Plan

Tasks:

- Decide if `docs/specs/ui/work-os-navigation-decision-intelligence.spec.md` is sufficient.
- If not sufficient, create/update `docs/specs/ui/role-guided-dashboard.spec.md`.
- Define acceptance criteria for:
  - role detection
  - quick actions
  - next best action
  - empty states
  - route progress
  - permission boundaries

Deliverable:

- Approved spec plan for Phase 5.

### Module 4.16: Phase 4 Exit Criteria

Phase 4 is complete when:

- Auth is mapped.
- Roles are mapped.
- Dashboards are mapped.
- Route risks are known.
- Internal specs are mapped.
- Missing specs are identified.
- PR 2 scope is clear.

## Phase 5: Guided Dashboard by Role

Objective: after login, each user sees what to do next.

Allowed scope:

- Internal dashboard shell.
- Role route config.
- Quick actions.
- Next best action.
- Route progress.
- Existing route integration.

Not allowed:

- Auth rewrite.
- Prisma changes.
- API contract changes unless explicitly approved.

### Module 5.1: Role Route Config

Tasks:

- Create or update `role-routes.ts`.
- Define role routes for:
  - client
  - worker
  - contractor/operator
  - admin

Deliverable:

- Declarative route config.

### Module 5.1-SDD: Guided Dashboard Spec Approval

Tasks:

- Confirm dashboard spec is `APPROVED`.
- Confirm implementation map includes expected files.
- Confirm tests/QA expectations are listed before coding.

Deliverable:

- Approved dashboard spec gate.

### Module 5.2: Quick Action Config

Tasks:

- Create or update `quick-actions.ts`.
- Define primary actions by role.

Deliverable:

- Quick action config.

### Module 5.3: Next Best Action Config

Tasks:

- Create or update `next-best-actions.ts`.
- Define next step logic from available state.
- Keep it simple unless real data supports more.

Deliverable:

- Next best action config.

### Module 5.4: RoleDashboardShell

Tasks:

- Build common shell.
- Support title/subtitle.
- Support role badge.
- Support primary action.
- Support content slots.

Deliverable:

- Shared dashboard shell.

### Module 5.5: Contextual Header

Tasks:

- Show greeting.
- Show role.
- Show state summary.
- Show main action.

Deliverable:

- Dashboard header.

### Module 5.6: QuickActionGrid

Tasks:

- Render role quick actions.
- Validate links.
- Support responsive layout.

Deliverable:

- Quick action grid.

### Module 5.7: NextBestActionPanel

Tasks:

- Show next recommended action.
- Include reason.
- Include CTA.

Deliverable:

- Next step panel.

### Module 5.8: RouteProgressStepper

Tasks:

- Show role route steps.
- Support current step.
- Support completed steps if available.

Deliverable:

- Progress stepper.

### Module 5.9: Client Dashboard

Tasks:

- Add:
  - publish job
  - view projects
  - review proposals
  - approve evidence
  - view payments

Deliverable:

- Guided client dashboard.

### Module 5.10: Worker Dashboard

Tasks:

- Add:
  - find jobs
  - submit proposal
  - upload evidence
  - view payments
  - view reputation

Deliverable:

- Guided worker dashboard.

### Module 5.11: Contractor Dashboard

Tasks:

- Add:
  - active projects
  - crews
  - milestones
  - evidence review
  - risks

Deliverable:

- Guided contractor/operator dashboard.

### Module 5.12: Admin Dashboard

Tasks:

- Add:
  - Mission Control.
  - Governance.
  - Evidence Review.
  - Payment Governance.
  - Trust Passport.
  - AI Mission Control.

Deliverable:

- Guided admin entry.

### Module 5.13: Empty States

Tasks:

- Add first-run guidance.
- Add no projects state.
- Add no evidence state.
- Add no payments state.

Deliverable:

- Useful empty states.

### Module 5.14: Loading States

Tasks:

- Add skeletons.
- Avoid layout shift.
- Keep mobile stable.

Deliverable:

- Loading state coverage.

### Module 5.15: Error States

Tasks:

- Handle API error.
- Handle invalid session.
- Handle forbidden access.

Deliverable:

- Basic error state coverage.

### Module 5.16: Existing Route Integration

Tasks:

- Connect to existing routes.
- Do not create deep new routes just for UI.
- Use fallback links only when needed.

Deliverable:

- Integrated dashboard links.

### Module 5.17: Accessibility

Tasks:

- Check focus.
- Check heading order.
- Check links/buttons.
- Check keyboard navigation.

Deliverable:

- Accessible internal dashboard basics.

### Module 5.18: Responsive QA

Tasks:

- Test mobile.
- Test tablet.
- Test desktop.

Deliverable:

- Responsive dashboard result.

### Module 5.19: Validation

Run:

```bash
pnpm build:web
pnpm typecheck
pnpm lint
pnpm spec:preflight
```

Deliverable:

- Validation result.

### Module 5.20: Phase 5 Exit Criteria

Phase 5 is complete when:

- Each role has a guided landing point.
- Quick actions work.
- Next best action is visible.
- No auth rewrite was introduced.
- Validations are reported.
- Guided dashboard spec is IMPLEMENTED or VERIFIED only if related files/tests are accurate.

## Phase 6: Prometeo, Operational Queues, and Trade Routes

Objective: make SEMSEproject recommend real next steps.

Allowed scope:

- Prometeo guidance UI.
- Evidence/payment queues.
- Trust/reputation cards.
- Trade route configuration.
- Integrations with existing ProTools/BuildOps/Evidence/Payments where safe.

### Module 6.1: PrometeoGuidanceCard

Tasks:

- Create or update guidance card.
- Show role-aware message.
- Include useful CTA.

Deliverable:

- Prometeo guidance card.

### Module 6.1-SDD: Critical Spec Gate

Tasks:

- Confirm specs governing Prometeo, evidence, payments, trust, and tools are `APPROVED`.
- Confirm high/critical flows have required tests before claiming `VERIFIED`.
- Confirm no money/evidence/permission behavior is added without a spec.

Deliverable:

- Critical SDD approval for Phase 6.

### Module 6.2: Prometeo by Role

Tasks:

- Client message.
- Worker message.
- Contractor/operator message.
- Admin message.

Deliverable:

- Role-specific guidance.

### Module 6.3: Prometeo by State

Tasks:

- No project.
- Project active.
- Evidence pending.
- Payment blocked.
- Dispute/risk.

Deliverable:

- State-aware guidance.

### Module 6.4: EvidenceActionQueue

Tasks:

- Show pending evidence.
- Show blocked evidence.
- Show approved evidence.
- Link to action.

Deliverable:

- Evidence queue.

### Module 6.5: PaymentMilestoneQueue

Tasks:

- Show pending milestones.
- Show escrow state.
- Show payment release actions.
- Show blocked payments.

Deliverable:

- Payment/milestone queue.

### Module 6.6: TrustStatusCard

Tasks:

- Show verification state.
- Show reputation state.
- Show risk state.
- Show next trust action.

Deliverable:

- Trust status card.

### Module 6.7: Trade Routes

Tasks:

- Define routes for:
  - painting
  - drywall
  - electrical
  - plumbing
  - bathroom
  - kitchen
  - cleaning
  - roofing
  - flooring
  - carpentry

Deliverable:

- Trade route list.

### Module 6.8: Trade Route Config

Tasks:

- Create or update `trade-routes.ts`.
- Store:
  - title
  - steps
  - tools
  - expected evidence
  - milestone suggestions

Deliverable:

- Declarative trade route config.

### Module 6.9: ProTools Integration

Tasks:

- Connect trade routes to estimators.
- Link estimate output to next step.

Deliverable:

- ProTools-to-route bridge.

### Module 6.10: BuildOps Integration

Tasks:

- Convert estimate/project context into milestones.
- Connect next action to BuildOps routes.

Deliverable:

- BuildOps route bridge.

### Module 6.11: Evidence Integration

Tasks:

- Connect milestone state to evidence requirements.
- Show evidence expectations by trade.

Deliverable:

- Evidence bridge.

### Module 6.12: Payments Integration

Tasks:

- Connect milestones to payment actions.
- Show release readiness.

Deliverable:

- Payments bridge.

### Module 6.13: Trust Integration

Tasks:

- Connect user/project state to trust guidance.
- Surface verification and reputation next steps.

Deliverable:

- Trust bridge.

### Module 6.14: Real Metrics

Tasks:

- Define metric source for:
  - evidence reviewed
  - milestones paid
  - active projects
  - verified professionals
  - trust score

Deliverable:

- Real metrics plan or implementation.

### Module 6.15: Operational Alerts

Tasks:

- Define alerts for:
  - blocked payments
  - missing evidence
  - disputes
  - risk flags
  - overdue milestones

Deliverable:

- Operational alert model.

### Module 6.16: Role QA

Tasks:

- Test client.
- Test worker.
- Test contractor/operator.
- Test admin.

Deliverable:

- Role QA matrix.

### Module 6.17: Trade QA

Tasks:

- Test primary trade routes.
- Confirm links and next steps.

Deliverable:

- Trade QA matrix.

### Module 6.18: Critical State QA

Tasks:

- Test no data.
- Test incomplete data.
- Test API error.
- Test permission denied.
- Test loading.

Deliverable:

- Critical state QA report.

### Module 6.19: Operational Documentation

Tasks:

- Document how to add:
  - new roles
  - new quick actions
  - new trade routes
  - new Prometeo guidance
  - new evidence/payment queues

Deliverable:

- Maintainer documentation.

### Module 6.19-SDD: Spec Index and Traceability Update

Tasks:

- Update `docs/SPEC_INDEX.md` if specs changed status.
- Ensure `related_files` are real.
- Ensure `related_tests` are real.
- Ensure API endpoints/events/agents are listed when applicable.

Deliverable:

- Updated Spec -> Code -> Test traceability.

### Module 6.20: Phase 6 Exit Criteria

Phase 6 is complete when:

- Prometeo guides by role and state.
- Evidence/payment queues show actionable work.
- Trade routes are declarative.
- Internal UX points users toward the next real action.
- QA is complete.
- Spec -> Code -> Test traceability is complete for critical flows.

## Recommended PR Sequence

```text
PR 1: Landing public cleanup and operational routes
PR 2: Landing spec/index alignment if not included in PR 1
PR 3: Dashboard/auth/role audit report
PR 4: Guided dashboard spec and role quick actions
PR 5: Prometeo contextual guidance
PR 6: Evidence/payment/trust queues
PR 7: Trade routes and ProTools/BuildOps bridge
PR 8: Real metrics and operational alerts
```

## Current Known Risks

- Current working tree may contain mixed landing, API, dashboard, docs, and tests.
- Public landing work should be separated before PR.
- Case-duplicate landing nav files may confuse imports.
- Some Tailwind utility classes may not exist unless custom theme tokens generate them.
- Dependency vulnerabilities should be handled in a dedicated dependency/security PR unless they block CI.
- Demo credentials should not be included in public PR descriptions or screenshots.

## Definition of Done for the Full Program

The 6-phase program is complete when:

- Public landing is clear and stable.
- Users understand what SEMSEproject does in under 10 seconds.
- Landing routes work.
- Admin access is secondary.
- Post-login dashboards guide users by role.
- Prometeo recommends useful next steps.
- Evidence, milestones, payments, and trust are visible as operational queues.
- Trade routes are configurable.
- Validations are documented.
- Production deploy is verified.
