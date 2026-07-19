# Reporte: SEMSE Forge Security Review Provider (dry-run)

**Fecha:** 2026-07-17
**Rama:** `agent/forge-security-review-provider`
**Dominio:** `packages/forge`

## Resumen

Implementé el `SecurityReviewProvider` como componente puro de SEMSE Forge para el phase `verifying` del ciclo de vida. Opera en modo `dry-run`, analiza archivos permitidos y un `ForgePatchPlan` opcional en busca de patrones sensibles (secretos, credenciales, schema DB, CI, infraestructura, auth, pagos/identidad) y produce un `ForgeSecurityReport` auditable con `decision`, `findings`, `requiredApprovals` y `violations`.

## Especificación

- `docs/specs/forge/SEMSE_FORGE_SECURITY_REVIEW_PROVIDER.spec.md` (APPROVED)
- `docs/specs/forge/SEMSE_FORGE_SECURITY_REVIEW_PROVIDER.plan.md` (APPROVED)

## Cambios principales

### `packages/forge`

- `src/types.ts`: nuevos tipos `ForgeSecurityFinding` y `ForgeSecurityReport`; nuevo evento `FORGE_SECURITY_REVIEW_COMPLETED`.
- `src/security-review-provider.ts`: `DryRunSecurityReviewProvider` + stub `LiveSecurityReviewProvider`.
  - Detecta archivos prohibidos: `.env*`, `*.key`, `*.pem`, `*.p12`, `credentials*`, `secrets*`.
  - Detecta patrones sensibles: env files, credenciales, schema/migraciones Prisma, workflows CI, Dockerfile/railway/docker-compose, auth, runtime de agentes, pagos/identidad.
  - Requiere `dual_control` para `riskLevel: "critical"` o hallazgos `critical`.
  - Requiere `security`/`ops_admin` para `riskLevel: "high"` o hallazgos `high`.
  - Requiere `security` para hallazgos `medium`/`low`.
- `src/policy.ts`: `security.review`, `threat.model` y `dependency.audit` se marcan como branch-agnostic (lectura segura sobre `main`/`master`).
- `src/index.ts`: exporta `createSecurityReviewProvider`, `SecurityReviewProvider`, `SecurityReviewProviderInput` y tipos.

### `packages/agents`

- `src/runtime.ts`: `buildForge` invoca `createSecurityReviewProvider` para `action === "security.review"` e incluye `securityReport` en el payload.

### `apps/api`

- `src/modules/forge/forge.service.ts`:
  - Extrae `payload.securityReport` en `applyTaskResult`.
  - Registra aprobaciones requeridas del reporte.
  - Fuerza `nextState = "blocked"` si `securityReport.decision === "deny"`.
  - Emite `FORGE_SECURITY_REVIEW_COMPLETED` con `securityDecision`, `findingCount`, `criticalCount` y `requiredApprovals`.

### Documentación

- `docs/foundation/EVENT_CATALOG.md`: añadido `forge.security.review.completed`.
- `docs/SPEC_INDEX.md`: regenerado con `pnpm spec:index`.

### Tests

- `tests/unit/forge-security-review-provider.test.mjs`: 11 casos (allow, env deny, credential deny, auth module, database schema, CI workflow, infrastructure, critical risk, policy approvals, policy deny, live not implemented).
- `tests/unit/forge-runtime-integration.test.mjs`: añadido caso `security.review` que verifica `payload.securityReport` con hallazgo de auth y aprobación `dual_control`.

## Validación

```text
pnpm --filter @semse/forge build    PASS
pnpm --filter @semse/agents build   PASS
pnpm typecheck                       PASS
pnpm lint                            PASS (0 errors, warnings preexistentes)
pnpm spec:preflight                  PASS
pnpm spec:validate:strict            13 errores preexistentes (ninguno del nuevo spec; +1 respecto a la rama anterior por `docs/specs/tasks/task-unification-fase1.spec.md` añadido en main)
pnpm spec:index                      regenerated (88 specs)
```

`pnpm test:unit` se verificó con los tests objetivo; la suite completa se ejecutará en CI.

## Notas

- No se modificó `packages/db/prisma/schema.prisma`.
- No se añadieron dependencias.
- No se expusieron secretos.
