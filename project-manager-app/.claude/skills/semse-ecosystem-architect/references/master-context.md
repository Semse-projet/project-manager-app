# SEMSE Master Context

## Strategic identity

SEMSE Project is an intelligent operating ecosystem for turning intention into coordinated real-world execution.

Its conceptual connective tissue includes:

- people;
- organizations;
- knowledge;
- opportunities;
- services;
- operations;
- trust;
- payments;
- integrations;
- AI agents.

Do not reduce SEMSE to a website, marketplace, productivity app, or miscellaneous tool suite.

## Provisional ecosystem map

Confirm names and actual scope against repository evidence before presenting them as facts.

### Prometeo AI
Intelligence and orchestration layer.

### SEMSE Connect
Connection layer for people, organizations, opportunities, and collaboration.

### BuildOps
Operational planning and execution layer.

### Marketplace
Discovery and exchange layer for services, products, resources, talent, or opportunities.

### Trust
Identity, credentials, reputation, validation, risk, and confidence signals.

### Payments
Transaction, billing, payment, payout, or value-transfer layer.

### Knowledge
Knowledge capture, organization, retrieval, synthesis, and activation.

### Integrations
Connections to external systems, data sources, and tools.

### Agro
A specialized vertical that should reuse shared ecosystem capabilities while adapting language, data, workflows, and constraints to the sector.

## Five-level decision model

For each experience, evaluate:

1. **Emotion:** What should the user feel?
2. **Narrative:** What transformation are they experiencing?
3. **Experience:** What do they discover and do?
4. **System:** Which ecosystem capabilities connect?
5. **Conversion:** What is the clearest next action?

## Strategic tests

A proposed feature or design should answer:

- What user need does it solve?
- Which module owns it?
- Which shared capabilities does it reuse?
- What evidence supports it?
- What permissions or risks exist?
- How does it strengthen the ecosystem?
- How will success be measured?

## Truth discipline

Classify material as:

- **Confirmed:** supported by code, product, current documentation, or explicit team decision.
- **Provisional:** concept, hypothesis, planned capability, or working name.
- **Unknown:** insufficient evidence.

Never silently convert provisional material into confirmed product claims.

## Reconciliation with `project-manager-app` (this repository)

The map above is the aspirational/conceptual frame. This repository already has real, confirmed implementations for several of these layers — do not treat them as provisional when working in this codebase:

- **BuildOps** → `apps/api/src/modules/{jobs,milestones,escrow,change-orders,labor-engine}/`.
- **Marketplace** → `jobs`/`marketplace` modules + `matching/` (SmartMatch).
- **Trust** → `trust`, `worker-verification/`, ratings.
- **Payments** → `payments/` + `escrow/`, Stripe (Connect included).
- **Prometeo AI** → confirmed real, `apps/api/src/modules/ai-models/` (orchestrator + Ollama provider), `prometeo/`, `prometeo-copilot/`, 16 conversational agents at `/agents`.
- **Knowledge** → `packages/knowledge/`.
- **Agro** → `apps/api/src/modules/agro/`.
- **SEMSE Connect / Integrations** → no matching module name found in the repo as of 2026-07-21. Treat as provisional/unconfirmed until verified against code.

No marketing/landing directory exists in `apps/web` today. The audited, actionable surface (`docs/AUDIT_REMEDIATION_PLAN.md`, `docs/specs/ui/pro-flows-remediation.spec.md`) is the authenticated operational app (`/client/*`, `/worker/*`, `/admin/*`), not a public site. Apply the website-narrative sections of this skill when that specific work exists — do not assume it is the current priority.
