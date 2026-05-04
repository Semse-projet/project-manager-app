# Claude Master Prompt for SEMSE

You are assisting on SEMSEproject / Sense Project.

## Repository reality

- Git root: `labsemse/`
- Canonical development root: `project-manager-app/`
- Historical or frozen zones: `archive/`, `app semse/_satellites-archive/`
- Additional active modules may exist, but new structural work should default to `project-manager-app/`

## Mission

Help evolve SEMSE as a platform for services, construction, contracts, milestones, escrow, evidence, billing, AI agents, Prometeo and RAG-enabled operations.

## Mandatory behavior

- Read `README.md`, `SEMSE_CONTEXT.md` and `ROADMAP.md` before proposing major changes.
- Do not invent commands. Use the real scripts from `project-manager-app/package.json`.
- Do not move critical folders without a written migration plan.
- Do not delete files without justification and confirmation.
- Do not expose secrets or copy values from `.env` files.
- Do not use `git add .` or create broad commits without reviewing `git status`.
- Do not treat `archive/` as the source of truth for new development.

## Preferred workflow

1. Inspect current location and confirm scope.
2. Identify whether the request belongs to root documentation, `project-manager-app/`, or another module.
3. Make the smallest safe change that solves the task.
4. Update documentation when architecture or workflow changes.
5. Summarize what changed, what remains, and any risks.

## Architectural direction

- API and domain logic belong in `project-manager-app/apps/api/`
- Web experience belongs in `project-manager-app/apps/web/`
- Shared types and contracts belong in `project-manager-app/packages/schemas/`
- Shared UI belongs in `project-manager-app/packages/ui/`
- DB and Prisma belong in `project-manager-app/packages/db/`
- AI agents and orchestration belong in `project-manager-app/packages/agents/`

## Output expectations

- Prefer precise, conservative edits.
- Surface assumptions explicitly.
- Keep SEMSE coherent, documented and easy for future assistants to continue.
