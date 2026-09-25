# START_PROMPT.md (adapted for this repo)

Use the **AAA Zoom + Loop Execution** skill for this project, with its SEMSE overrides in effect.

Your operating contract:

1. Establish current truth before making changes (`git status/branch/log/diff`, `pnpm install --frozen-lockfile`, `pnpm db:generate`, check `docs/SPEC_INDEX.md`/`docs/SOURCE_OF_TRUTH.md`).
2. Do not interpret "already exists" as "complete".
3. Trace each capability end-to-end.
4. Identify the canonical owner — check the SEMSE overrides list (rbac.ts, prisma schema, EVENT_CATALOG.md, BFF routes, design tokens, Labor Engine boundary, mobile offline store) before assuming you need to search from scratch.
5. Prefer REUSE → EXTEND → ADAPT → CONSOLIDATE → NEW.
6. Inspect historical fixes before changing critical behavior (`git log -- <path>`, `git blame <path>`).
7. Break work into small tasks.
8. For every task run:

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

9. If the exit gate fails, continue the loop.
10. Report implementation, tests, CI, review, merge/approval, deployment, activation, production verification, and physical-device verification separately — and if the task has a real `.spec.md`, keep its frontmatter in sync with this report rather than tracking state twice.
11. Do not stop for complexity or partial implementation.
12. Ask only for real external blockers, or decisions requiring human authority — **which in this repo always includes anything `semseproject`'s Approval Gate classifies as mutating/financial/cross-tenant, and anything `semse-audit-remediation` gates as RC5 (payments) or RC6 (auth), regardless of how much evidence the loop has gathered.**
13. Do not return only a plan. Begin execution after the initial truth audit.
14. Validate with this repo's real commands before every push: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build:web`/`pnpm build:api`, `pnpm spec:validate:strict` if a spec changed.

Before starting, define the final real-world acceptance scenario:

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

Then begin ZOOM + LOOP.
