# SEMSE Workflows

## Web or product audit

1. Identify page objective, audience, and primary action.
2. Inspect the full journey and relevant implementation.
3. Evaluate narrative, hierarchy, information architecture, credibility, accessibility, responsiveness, and perceived performance.
4. Separate symptoms from root causes.
5. Preserve strengths.
6. Prioritize issues.
7. Recommend a governing redesign direction.
8. Provide phased changes.

## Redesign

1. Define objective and audience.
2. Establish narrative: tension, vision, system, demonstration, evidence, action.
3. Design memorable moments, not merely sections.
4. Specify content, imagery, interaction, motion, and mobile behavior.
5. Challenge each card.
6. Define loading, error, empty, and reduced-motion states.
7. Establish acceptance criteria before implementation.

## Frontend implementation

1. Inspect framework, dependencies, scripts, routes, tokens, components, and tests.
2. Define scope and preservation requirements.
3. Reuse appropriate primitives.
4. Implement semantic, responsive, accessible behavior.
5. Optimize visual assets.
6. Run project-defined checks.
7. Review visually across key breakpoints.
8. Report pre-existing failures separately.

## New feature

1. State the user problem.
2. Define the user and context.
3. Define the expected outcome.
4. Assign ownership within the ecosystem.
5. Identify shared capabilities, data, permissions, and risks.
6. Map primary and alternate flows.
7. Separate must-have, later, and out-of-scope.
8. Define success metrics and acceptance criteria.

## Content

1. Define what the audience must understand or do.
2. Identify objections and required evidence.
3. Write one central message.
4. Build headline, support, proof, and action.
5. Remove repetition and empty adjectives.
6. Validate claims against product reality.

## Code review

Review in order:

1. correctness;
2. security and permissions;
3. data integrity;
4. UX and accessibility;
5. performance;
6. maintainability;
7. tests.

Report findings by priority with file/location, impact, and recommended fix.

## Precedence in this repository

`project-manager-app` already has a mandatory governance flow in its root `AGENTS.md`: Spec Kit / SDD (`/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → tests before code → `/speckit.implement` → `/speckit.checklist` → report in `docs/reportes/`). That flow governs how code actually gets written here and takes precedence over the generic steps above — use this document's workflows as the thinking process *inside* each `/speckit.*` step, not as a parallel process. Real validation commands for this repo: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build:api`/`pnpm build:web`, `pnpm verify:workspace`, `pnpm spec:validate:strict`.

Most currently open work (`docs/AUDIT_REMEDIATION_PLAN.md`, `docs/specs/ui/pro-flows-remediation.spec.md`) is Systems Reviewer / Frontend Engineer work — security, RBAC, data correctness, money integrity — not Experience Director / Content Strategist work. Pick the mode that matches the actual defect.
