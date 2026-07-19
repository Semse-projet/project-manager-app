# Corrección de hallazgos Devin Review en PRs #335 y #336

**Fecha:** 2026-07-17  
**Repo:** `Semse-projet/project-manager-app`  
**Rama:** `fix/forge-review-findings-335-336`  
**Corte base:** `main@cbc7e2c`  
**Objetivo:** Resolver bugs concretos reportados por Devin Review en los PRs de `DryRunPatchPlanner` (#335) y `DryRunToolAdapter` (#336).

## Hallazgos corregidos

### PR #336 — Tool Adapter

- `ACTION_TO_TOOLS` exigía herramientas que ciertos roles no tienen en `allowedTools`, bloqueando acciones legítimas:
  - `pr.prepare` ya no exige `command.run` (el supervisor no lo posee).
  - `schema.propose` ya no exige `test.write` para permitir también a `domain-architect`.
  - `rollback.plan` ahora usa `migration.propose` en lugar de `deployment.propose` y `approval.request`, consistente con `data-engineer`.
- `registry.ts`:
  - `creator-mentor` ahora tiene `repo.read` y `approval.request` para soportar `blueprint.create`, `curriculum.structure` y `publication.propose`.
  - `ux-composer` ahora tiene `command.run` para soportar `ui.compose` y `accessibility.verify`.

### PR #335 — Patch Planner

- `matchesScope` en `policy.ts` ahora:
  - Exige separador `/` en patrones `/**`, evitando que `packages/api/src/**` coincida con `packages/api/src2/evil.ts`.
  - Soporta patrones `**/railway.json`, `**/Dockerfile*` y `**/docker-compose*` para detectar archivos críticos en cualquier carpeta.
- `CRITICAL_PATTERNS` en `patch-planner.ts` actualizados a `**/railway.json`, `**/Dockerfile*`, `**/docker-compose*`.
- `validateChange` también bloquea la rama `master` además de `main`.

## Tests añadidos

- `tests/unit/forge-tool-adapter.test.mjs`:
  - Cobertura para `pr.prepare`, `schema.propose`, `blueprint.create`, `publication.propose`, `ui.compose` y `rollback.plan` con los roles correspondientes.
- `tests/unit/forge-patch-planner.test.mjs`:
  - `infra/railway/railway.json` se marca crítico.
  - `apps/vision-service/Dockerfile` se marca crítico.
  - `packages/api/src2/evil.ts` se rechaza por `patch.file_out_of_scope`.
  - Rama `master` también bloqueada.

## Validación

- `pnpm --filter @semse/forge build` PASS
- `pnpm --filter @semse/agents build` PASS
- `pnpm typecheck` PASS
- `pnpm lint` PASS (sólo warnings preexistentes)
- `pnpm test:unit` PASS (895 pass / 0 fail)
- `pnpm spec:preflight` PASS
- `pnpm spec:validate:strict` 10 errores preexistentes, 0 nuevos

## Archivos modificados

- `packages/forge/src/tool-adapter.ts`
- `packages/forge/src/registry.ts`
- `packages/forge/src/policy.ts`
- `packages/forge/src/patch-planner.ts`
- `tests/unit/forge-tool-adapter.test.mjs`
- `tests/unit/forge-patch-planner.test.mjs`
