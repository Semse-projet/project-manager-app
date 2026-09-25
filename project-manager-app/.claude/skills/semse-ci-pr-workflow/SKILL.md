---
name: semse-ci-pr-workflow
description: What the CI workflow actually checks (quality-gates/unit-coverage/e2e jobs, and where the workflow files really live), the squash-merge branch-reset gotcha that bites every PR in this repo, and the "spec:preflight" naming trap (it runs Railway preflight, not spec validation). Use before opening a PR, debugging a CI failure, or investigating why a local script name doesn't match what it does.
---

# SEMSE CI / PR workflow

## Workflow files live at the outer repo root, not under `project-manager-app/`

Despite `CLAUDE.md`'s own rule that "everything that matters... lives under `project-manager-app/`", the actual GitHub Actions workflow files are at `.github/workflows/` in the **outer** checkout root (`ci.yml`, `railway-deploy.yml`, `deploy.yml`, `release.yml`, `api-smoke.yml`, `api-integration.yml`, `operacion-asistida-api.yml`, `autonomy-staged-api.yml`) — there is no `project-manager-app/.github/workflows/`. Every job in `ci.yml` sets `defaults.run.working-directory: project-manager-app` to compensate, so all the `pnpm` commands inside still run from the canonical root; only the YAML files themselves live one level up.

## What `ci.yml`'s jobs actually do

- **`quality-gates`** — spins up a real Postgres 16 service container (port 5433, user/db `semse`), then: `pnpm install --frozen-lockfile` → `pnpm db:generate` → `pnpm db:migrate` → `pnpm verify:prisma-contract:db` (checks schema drift against `scripts/prisma-contract-baseline.json` — this baseline can only shrink, any new drift fails the build) → `pnpm check:toolchain` (Node/pnpm version alignment) → `pnpm spec:preflight` → `pnpm test:unit` → `pnpm verify:workspace`.
- **`unit-coverage`** — separate job, no DB service: `pnpm build:api` → `pnpm test:coverage` (enforces coverage thresholds) → uploads to Codecov if `CODECOV_TOKEN` is configured (skips silently otherwise, doesn't fail).
- **`e2e`** — `needs: quality-gates` (only runs after that job passes).
- A separate CodeQL default setup produces the `Analyze (javascript-typescript)`/`Analyze (python)` checks seen on every PR — not a workflow file in this repo, GitHub's own code-scanning default setup.
- `Devin Review` is a third-party check that, as of this session, reports "trial expired and no credits remaining" — its `success` status doesn't mean a review happened, just that the check isn't blocking.

## `spec:preflight` is a naming trap

`package.json`: `"spec:preflight": "pnpm railway:preflight"`. Despite the name, **this runs Railway deploy-readiness checks, not spec validation** — don't confuse it with `spec:validate`/`spec:validate:strict` (the actual `.spec.md` frontmatter/consistency checks, from `semse-spec-kit-flow`). If CI's `quality-gates` job fails at the "Spec preflight" step, the problem is Railway/environment config, not a spec file.

## Post-deploy health gate — never trigger this yourself

`deploy.yml` ("Production Health Gate") runs on `workflow_run` completion of "Railway Deploy" and `curl`s the **live production** health endpoint (`https://project-manager-app-production-977f.up.railway.app/v1/health`) directly. This is exactly the kind of Railway/CI/CD surface `AGENTS.md`'s NUNCA list forbids touching — don't edit these workflow files, don't manually dispatch them, and don't treat their presence as license to hit production endpoints from a script.

## The squash-merge branch-reset gotcha

This repo squash-merges every PR. That means once a PR merges, its source branch's commit is **not an ancestor of `main`** — `main` gets one new synthetic squash commit instead. If you keep working on the same named branch across multiple PRs in one session (a common pattern here), a plain `git push` or `git pull` after a merge will fail or produce a confusing diff.

**The correct sequence after any merge, before starting new work on the same branch name:**

```bash
git fetch origin main
git checkout -B <branch-name> origin/main
```

Then make your new changes and, when pushing, if `git push` is rejected non-fast-forward:

```bash
git fetch origin <branch-name>
git diff origin/<branch-name> HEAD --stat   # confirm the diff is ONLY your intended new files
git push --force-with-lease -u origin <branch-name>
```

**Always inspect the diff before force-pushing.** A clean diff showing only your new/intended files means the remote branch is just a stale pre-squash pointer — safe to overwrite. If the diff shows unexpected files, that's a real signal something else landed on that branch name (e.g. another unrelated PR got merged into `main` in between, which shows up as a bigger-than-expected diff but is still safe — verify by checking `git log origin/main` for the extra commits before proceeding).

## PR mechanics specific to this repo

- Every PR is opened as `draft: true` first; the repo owner converts it to ready-for-review and merges — don't self-merge.
- Use `.github/pull_request_template.md` (`Resumen`/`Tipo de cambio`/`Checklist`/`Evidencia`) for every PR body.
- Subscribe to PR activity immediately after creating one, and drive it to green per the standing PR-babysitting rules — this is independent of this skill.

## Notas para futuros agentes / hallazgos abiertos

- No se investigaron `api-smoke.yml`, `api-integration.yml`, `operacion-asistida-api.yml`, ni `autonomy-staged-api.yml` en detalle — solo se confirmó que existen y viven en el mismo directorio raíz externo. Si un PR dispara uno de esos checks y falla, hay que leerlo recién en ese momento, esta skill no cubre su contenido.
- No se confirmó el trigger exacto de `railway-deploy.yml` (qué rama, qué condición) — solo se leyó su longitud y que `deploy.yml` depende de su finalización vía `workflow_run`. Si hace falta debuggear un deploy real, leer ese archivo completo primero.
- El script `scripts/prisma-contract-baseline.json` (mencionado en el comentario de `ci.yml` junto a `verify:prisma-contract:db`) no se abrió en esta sesión — si `quality-gates` falla ahí, ese archivo y `scripts/verify-prisma-runtime-contract.mjs` son el punto de partida real, no algo para adivinar desde el mensaje de error solamente.
