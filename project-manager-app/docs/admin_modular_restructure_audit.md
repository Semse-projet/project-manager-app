# Admin Modular Restructure Audit

Generated: 2026-06-24

## Scope

Target app:

- `apps/web`

Target Admin route root:

- `apps/web/app/(app)/admin`

This audit is the entry point for the SEMSE SDD modular Admin work. It documents the current Admin surface before adding the new module hubs.

## Current Admin Routes

Existing Admin pages:

- `/admin/agents`
- `/admin/ai-mission-control`
- `/admin/algorithm-engine`
- `/admin/autonomy`
- `/admin/browser-agent`
- `/admin/change-orders`
- `/admin/communications`
- `/admin/compliance`
- `/admin/consciousness`
- `/admin/contractors`
- `/admin/coordinator`
- `/admin/dashboard`
- `/admin/developer-runtime`
- `/admin/disputes`
- `/admin/domain-events`
- `/admin/ecosystem`
- `/admin/field-ops`
- `/admin/finance`
- `/admin/governance`
- `/admin/html-in-canvas`
- `/admin/intelligence-rooms`
- `/admin/llm-metrics`
- `/admin/marketplace`
- `/admin/memory`
- `/admin/mission-control`
- `/admin/ops`
- `/admin/pmo`
- `/admin/prometeo`
- `/admin/qa`
- `/admin/reports`
- `/admin/reputation`
- `/admin/semse-x`
- `/admin/settings`
- `/admin/tools`
- `/admin/travel`
- `/admin/trust`
- `/admin/users`
- `/admin/vision`
- `/admin/worker`

## Modular Hub Status

The SDD kit expects the following module hub routes. These are now implemented and deployed:

| Route | Status | Notes |
|---|---|---|
| `/admin/workops` | Implemented | Links field ops, workers, contractors, change orders, PMO, and QA. |
| `/admin/intelligence` | Implemented | Links AI mission control, agents, autonomy, Prometeo, memory, and rooms. |
| `/admin/tool-hub` | Implemented | Includes external-tool grid and Context Bridge MVP. |
| `/admin/verticals` | Implemented | Links active vertical surfaces and future vertical shells. |

## Navigation Sources

Current navigation is split across several files:

- `apps/web/app/(app)/layout.tsx`
  - Contains the role-based shell and a large inline `NAV` object.
  - Admin navigation items are defined directly in this file.
- `apps/web/lib/navigation-shell.ts`
  - Groups Admin navigation into mission-control, operations, marketplace, governance, ai, and system buckets.
- `apps/web/lib/navigation-registry.ts`
  - Contains a structured navigation registry with canonical and legacy hrefs.
- `apps/web/app/nav.tsx`
  - Top-level public/app navigation, not Admin-specific.

Dedicated modular Admin navigation contract:

- Implemented: `apps/web/lib/admin/admin-navigation.ts`

## Suggested Module Mapping

### Mission Control

- `/admin/mission-control`
- `/admin/dashboard`
- `/admin/ecosystem`
- `/admin/consciousness`
- `/admin/ops`
- `/admin/domain-events`
- `/admin/reports`

### WorkOps

- `/admin/field-ops`
- `/admin/worker`
- `/admin/contractors`
- `/admin/change-orders`
- `/admin/pmo`
- `/admin/qa`

### Marketplace

- `/admin/marketplace`
- `/admin/reputation`
- `/admin/contractors`

### Finance

- `/admin/finance`
- `/admin/disputes`
- `/admin/change-orders`
- `/admin/governance`

### Trust

- `/admin/trust`
- `/admin/compliance`
- `/admin/reputation`
- `/admin/users`

### Intelligence

- `/admin/ai-mission-control`
- `/admin/agents`
- `/admin/algorithm-engine`
- `/admin/autonomy`
- `/admin/prometeo`
- `/admin/llm-metrics`
- `/admin/memory`
- `/admin/intelligence-rooms`
- `/admin/browser-agent`

### Tool Hub

- `/admin/tools`
- `/admin/developer-runtime`
- `/admin/coordinator`
- `/admin/semse-x`
- `/admin/html-in-canvas`

### Verticals

- `/admin/vision`
- `/admin/travel`
- `/admin/field-ops`

### Settings

- `/admin/settings`

## Components

Admin component directory:

- Implemented: `apps/web/components/admin`

Reusable UI primitives exist in:

- `apps/web/components/ui`
- `apps/web/components/semse`
- `apps/web/components/context-panel`

New modular Admin UI should prefer small shared components under `apps/web/components/admin` and avoid large rewrites of existing page implementations.

## Pages That Can Be Wrapped In Hubs

The following existing pages can be linked from module hubs without moving or deleting them:

- WorkOps: `field-ops`, `worker`, `contractors`, `change-orders`, `pmo`, `qa`
- Intelligence: `ai-mission-control`, `agents`, `algorithm-engine`, `autonomy`, `prometeo`, `llm-metrics`, `memory`, `intelligence-rooms`, `browser-agent`
- Tool Hub: `tools`, `developer-runtime`, `coordinator`, `semse-x`, `html-in-canvas`
- Verticals: `vision`, `travel`, `field-ops`

## Risks

- Navigation definitions are duplicated between `layout.tsx`, `navigation-shell.ts`, and `navigation-registry.ts`. The first modular pass should add a central Admin contract without removing existing sources.
- Some pages belong to multiple product modules, for example `contractors`, `change-orders`, `reputation`, and `field-ops`. The hub model should allow shared child routes.
- Existing Admin pages may be client components with local fetching and side effects. The hub pass should link to them rather than moving their code.
- Avoid touching Prisma, NestJS API modules, Railway configuration, or database migrations in this phase.
- The repository currently has unrelated uncommitted changes in payment specs, escrow specs, and API tests. This Admin work should not modify those files.

## Implemented First Pass

1. Added `apps/web/lib/admin/admin-navigation.ts`.
2. Added small shared Admin components:
   - `apps/web/components/admin/module-card.tsx`
   - `apps/web/components/admin/module-shell.tsx`
   - `apps/web/components/admin/context-bridge-panel.tsx`
3. Added hub routes:
   - `apps/web/app/(app)/admin/workops/page.tsx`
   - `apps/web/app/(app)/admin/intelligence/page.tsx`
   - `apps/web/app/(app)/admin/tool-hub/page.tsx`
   - `apps/web/app/(app)/admin/verticals/page.tsx`
4. Kept all legacy routes available.
5. Wired Admin sidebar navigation.
6. Added Mission Control module cards.
7. Validated and deployed through GitHub Actions and Railway.

## Remaining Follow-Up

- Decide whether to version the full `.semse-sdd/` kit. It is currently kept out of `main` because the extracted kit includes about 22 MB of visual PNG references.
- Add a lightweight UI smoke script for the new authenticated admin route redirects.
- Expand Verticals beyond linked surfaces when each vertical has a dedicated route spec.
