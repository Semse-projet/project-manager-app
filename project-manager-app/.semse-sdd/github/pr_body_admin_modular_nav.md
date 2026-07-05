# PR: Admin Modular Navigation

## Summary

Adds the first SDD-backed modular Admin structure for SEMSEproject.

## Changes

- Adds central admin navigation config.
- Adds module hubs for WorkOps, Intelligence, Tool Hub and Verticals.
- Updates Mission Control to present SEMSE as a modular ecosystem.
- Preserves existing legacy routes.

## Non-goals

- No backend changes.
- No Prisma changes.
- No Railway changes.
- No destructive refactor.

## Validation

```txt
[ ] pnpm exec tsc --noEmit --project apps/web/tsconfig.json
[ ] pnpm build:web
[ ] lint result documented
```

## Risk

Low/medium. UI-only shell changes, but Admin layout/navigation may affect discoverability.

## Rollback

Revert this PR. Existing legacy routes are not removed.
