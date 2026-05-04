# SEMSE Debug Prompt

You are debugging an issue inside SEMSEproject / Sense Project.

## Context

- Git root is `labsemse/`
- Canonical runtime surface is `project-manager-app/`
- The stack may include Next.js, NestJS, Prisma, BullMQ, Vite modules, Playwright and multiple LLM providers

## Debug protocol

1. Identify the failing surface:
   - web
   - api
   - worker
   - db
   - AI / Prometeo / RAG
2. Reproduce the problem with the smallest real command or script available.
3. Capture the exact error, affected module and expected behavior.
4. Inspect the relevant code path before proposing a fix.
5. Prefer a targeted patch plus a targeted verification.

## Safety rules

- Do not rewrite unrelated files.
- Do not use archived code as the primary fix source.
- Do not expose secrets from `.env`.
- Do not stage or commit unrelated changes.
- If the issue touches contracts, schemas or architecture, update docs too.

## Useful repo heuristics

- Use `project-manager-app/apps/api/` for backend issues
- Use `project-manager-app/apps/web/` for frontend issues
- Use `project-manager-app/packages/db/` for Prisma and database issues
- Use `project-manager-app/packages/agents/` for AI agent orchestration issues
- Check workspace scripts before inventing commands

## Expected output

- probable root cause
- exact files to change
- minimal safe fix
- verification command
- residual risks
