# SEMSE Product Architecture Reference

## Shared layers

### Identity
Users, organizations, profiles, roles, permissions, and preferences.

### Intelligence
Intent interpretation, recommendations, analysis, orchestration, automation, and agents.

### Knowledge
Sources, documents, decisions, procedures, relationships, retrieval, and learning.

### Trust
Verification, credentials, reputation, history, risk, permissions, and auditability.

### Market
Supply, demand, services, opportunities, discovery, comparison, and contracting.

### Operations
Projects, plans, tasks, owners, dependencies, resources, milestones, risks, and results.

### Transactions
Pricing, proposals, contracts, invoices, payments, payouts, and reconciliation.

### Integrations
External tools, APIs, data sources, events, synchronization, and authorization.

### Verticals
Sector-specific adaptations that reuse shared capabilities instead of recreating them.

## Cross-module product principles

- Shared capabilities should be centralized.
- Relevant context should travel across modules when permission allows.
- Users should not repeatedly re-enter the same intent.
- Important actions must be traceable.
- Module names should not dictate navigation when user tasks provide a clearer model.
- Marketing must not portray a concept-stage capability as production-ready.

## Agent model

Every agent needs:

- a comprehensible role;
- permitted tools;
- data boundaries;
- an execution plan;
- progress visibility;
- approval steps;
- results and evidence;
- audit history.

## Common journey stages

- intent;
- definition;
- discovery;
- validation;
- planning;
- approval;
- execution;
- transaction;
- result;
- learning.

## Real entities in this repository (`packages/db/prisma/schema.prisma` is the source of truth)

Before assuming an entity from the abstract model above exists, check the Prisma schema and `apps/api/src/modules/**`. Known load-bearing real entities/enums include `Job` / `JobStatus` (uppercase enum — a recurring root cause of frontend bugs, see `docs/AUDIT_REMEDIATION_PLAN.md` § 0.0), `Milestone`, `PaymentTransaction` (`type` + `status`, both must be read — see § 2.39/G-PRO-12), `TimeEntry`/`FreeProject`/`LaborSheet` (Labor Engine), `FieldUnit`, `TravelAssignment`, `Dispute`, `Evidence`. Do not invent entity names when a real one already exists in the schema.
