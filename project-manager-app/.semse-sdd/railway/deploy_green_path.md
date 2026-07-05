# Railway Green Path

## Goal

Keep Railway green while introducing Admin modular UI.

## Fase 1 expectations

Only Web service should be affected. API, Worker, Postgres and Redis should not change.

## Local equivalent validation

```bash
pnpm exec tsc --noEmit --project apps/web/tsconfig.json
pnpm build:web
```

## If Railway fails

Capture:

- Service name.
- Build command.
- Error exact text.
- File path.
- Commit SHA.
- Whether it fails locally.

Then apply the smallest fix possible.

