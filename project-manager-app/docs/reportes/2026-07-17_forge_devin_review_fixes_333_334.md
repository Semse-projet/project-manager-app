# Reporte: Correcciones Devin Review en SEMSE Forge (PRs #332, #333, #334)

**Fecha:** 2026-07-17
**Rama:** `fix/forge-devin-review-333-334`
**PR:** #348

## Hallazgos corregidos

### 1. Idempotencia del callback asíncrono (PR #333)

**Archivo:** `apps/api/src/modules/forge/forge.service.ts`

En `executeTask` con `input.async === true` se registraba `agentRun.id` en `agentRunIds` inmediatamente después de encolarlo. Cuando el worker reportaba el resultado a `completeTask`, la guarda `if (!current.agentRunIds.includes(input.agentRunId))` fallaba y `applyTaskResult` nunca se ejecutaba, dejando la tarea atascada en `building`.

**Corrección:** no se registra `agentRun.id` en la rama asíncrona; `applyTaskResult` lo añade al completar, manteniendo el mecanismo de idempotencia.

### 2. Bypass de validación de rutas peligrosas en el sandbox (PR #334)

**Archivo:** `packages/forge/src/sandbox.ts`

`validateCommand` emitía violaciones con el token incluido (`sandbox.parent_directory_reference:${token}` y `sandbox.absolute_or_home_path:${token}`), pero `computeDecision` las comparaba por igualdad exacta contra `sandbox.parent_directory_reference` / `sandbox.absolute_or_home_path`, por lo que nunca coincidían. Una ruta con `..` o una ruta absoluta/de home que coincidiera con el `allowedFiles` podía pasar como `allow`.

**Corrección:** `computeDecision` ahora usa `startsWith` para detectar esas violaciones.

**Tests añadidos:**

- `..` dentro de un alcance permitido (`packages/../secret.json` con `packages/**`).
- Ruta absoluta con alcance `**`.
- Ruta home (`~/.ssh/id_rsa`) con alcance `**`.
- Se eliminó el import no usado `getForgeAgentManifest` en `tests/unit/forge-sandbox.test.mjs`.

### 3. Identificador del run descartado al crearlo (PR #332)

**Archivo:** `apps/api/src/modules/forge/forge.repository.ts`

`ForgeHarness.createRun` genera un `id` (UUID) y lo embebe en el run y en el evento `FORGE_RUN_CREATED`. `toPrismaData` no pasaba `id`, por lo que Prisma generaba un id distinto (`@default(cuid())`) y los eventos quedaban con `runId` desincronizado.

**Corrección:** `toPrismaData` ahora incluye `id: run.id`.

## Validación

```text
pnpm --filter @semse/forge build    PASS
pnpm --filter @semse/agents build   PASS
pnpm --filter @semse/api build       PASS
pnpm typecheck                       PASS
pnpm lint                            PASS (54 warnings preexistentes, 0 errores)
pnpm test:unit                       PASS (914 pass / 0 fail / 5 skipped)
node --test tests/unit/forge-sandbox.test.mjs          PASS (17/17)
node --test tests/unit/forge-runtime-integration.test.mjs PASS (13/13)
pnpm spec:preflight                  PASS
pnpm spec:validate:strict            11 errores preexistentes (ninguno nuevo)
```

## Nota sobre `ci.implement` (PR #344)

La revisión #344 planteó reintroducir `ci.implement` en `deploymentActions`. Sin embargo, previamente se había removido para evitar que la rama `deployment` en `applyTaskResult` eclipsara la transición `building/verifying -> ready_for_review` de `prPackage`. Reintroducirla requiere decidir si `ci.implement` debe generar un plan de despliegue además del paquete de cambios y, de ser así, cómo combinar ambos sin perder el avance del flujo. Se deja para decisión de diseño en PR de seguimiento.
