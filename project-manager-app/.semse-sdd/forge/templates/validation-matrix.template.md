# Forge Validation Matrix

| ID | Área | Comando/Método | Requerido | Estado | Evidencia |
|---|---|---|---:|---|---|
| V-01 | Spec | `pnpm spec:validate:strict` | Sí | pending | |
| V-02 | Forge | `pnpm --filter @semse/forge build` | Sí | pending | |
| V-03 | Unit | `node --test tests/unit/forge-harness.test.mjs` | Sí | pending | |
| V-04 | TypeScript | `pnpm typecheck` | Sí | pending | |
| V-05 | API | `pnpm build:api` | según scope | pending | |
| V-06 | Web | `pnpm build:web` | según scope | pending | |
| V-07 | Railway | `pnpm railway:preflight` | release | pending | |
| V-08 | Security | threat review | high/critical | pending | |
| V-09 | Rollback | dry run / review | critical | pending | |
