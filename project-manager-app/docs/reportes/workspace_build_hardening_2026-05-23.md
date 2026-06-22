# Workspace Build Hardening 2026-05-23

## Resumen ejecutivo

Entre 2026-05-21 y 2026-05-23 Railway expuso una inestabilidad de `BUILD_IMAGE` causada por dependencias internas del monorepo, no por runtime de Railway. La señal dominante fue la caída coordinada de `project-manager-app`, `semse-worker` y `semse-web` cuando los paquetes base no se construían en orden reproducible.

En el estado actual del repositorio, el problema histórico se reproduce si los paquetes se construyen en paralelo:

- `@semse/shared` falla si `@semse/schemas` todavía no terminó.
- `@semse/auth` cae después de `@semse/shared`.
- `@semse/agents` cae después de `@semse/schemas`, `@semse/shared` y `@semse/knowledge`.

El hardening aplicado define una ruta única y secuencial para:

- auditar el workspace
- construir paquetes base
- generar Prisma Client
- construir apps
- validar typecheck
- bloquear deploys si cualquiera de esos pasos falla

## Causa raíz inferida

La causa más probable del incidente fue la ausencia de una puerta de validación reproducible para el workspace. El repositorio dependía de cadenas manuales de build copiadas en varios scripts y Dockerfiles, lo que dejaba espacio a:

- orden de compilación inconsistente entre local y Railway
- drift entre scripts raíz y Dockerfiles
- instalaciones no reproducibles por `pnpm install --no-frozen-lockfile`
- carreras alrededor de `prisma generate` si varias validaciones corrían en paralelo

## Servicios afectados

- `project-manager-app`
- `semse-worker`
- `semse-web`

## Paquetes auditados

- `@semse/schemas`
- `@semse/tools`
- `@semse/shared`
- `@semse/auth`
- `@semse/db`
- `@semse/agents`
- `@semse/knowledge`
- `@semse/autonomy`
- `@semse/ui`
- `@semse/api`
- `@semse/web`
- `@semse/worker`

## Cambios realizados

### Scripts de hardening

Se agregaron:

- `scripts/workspace-runner.mjs`
- `scripts/validate-workspace.mjs`

Nuevos scripts raíz:

- `validate:workspace`
- `build:packages`
- `build:apps`
- `typecheck:all`
- `railway:preflight`
- `check:worker`

Además, `dev:web`, `dev:api`, `dev:worker`, `build:web`, `build:api`, `typecheck` y `verify:workspace` ahora reutilizan la misma secuencia central en vez de repetir comandos a mano.

### Worker

Se agregó:

- `apps/worker/package.json` → `scripts.check = "node --check src/main.mjs"`

Esto permite que el worker participe del preflight aunque hoy sea runtime-only.

### Dockerfiles

Se endurecieron:

- `Dockerfile.api`
- `Dockerfile.web`
- `Dockerfile.worker`

Cambios principales:

- `pnpm install --frozen-lockfile` en `deps`
- uso de scripts raíz (`build:api`, `build:web`, `build:packages`, `check:worker`)
- eliminación del build order duplicado a mano dentro de cada Dockerfile

## Archivos modificados

- `package.json`
- `apps/worker/package.json`
- `Dockerfile.api`
- `Dockerfile.web`
- `Dockerfile.worker`
- `scripts/workspace-runner.mjs`
- `scripts/validate-workspace.mjs`
- `docs/reportes/workspace_build_hardening_2026-05-23.md`

## Comandos ejecutados

```bash
git checkout -b fix/workspace-build-hardening
pnpm install --frozen-lockfile
pnpm --filter @semse/schemas build
pnpm --filter @semse/tools build
pnpm --filter @semse/shared build
pnpm --filter @semse/auth build
pnpm --filter @semse/agents build
pnpm --filter @semse/api build
pnpm run validate:workspace
pnpm run build:packages
pnpm run typecheck:all
pnpm run build:apps
pnpm run railway:preflight
```

## Resultados de validación

### Reproducción del patrón histórico

La ejecución paralela inicial de paquetes base reprodujo el patrón histórico:

- `@semse/shared` falló con `TS2307: Cannot find module '@semse/schemas'`
- `@semse/auth` falló con `TS2307: Cannot find module '@semse/shared'`
- `@semse/agents` falló en cascada por `@semse/schemas`, `@semse/shared` y `@semse/knowledge`

Esto confirmó que el problema principal era de build order y no de Railway runtime.

### Validaciones después del hardening

- `pnpm run validate:workspace` → OK
- `pnpm run build:packages` → OK
- `pnpm run typecheck:all` → OK
- `pnpm run build:apps` → OK
- `pnpm run railway:preflight` → OK

### Hallazgos secundarios

1. `build:apps` y `typecheck:all` en paralelo disparan una carrera de `prisma generate` sobre `node_modules/@prisma/engines`.
   Esto refuerza que el preflight debe correr en serie.

2. `apps/web` emite warnings de lint/hooks durante `next build`, pero no bloquea el build.

3. `next.config.ts` emite una advertencia:

```text
Unrecognized key(s) in object: 'nodeMiddleware' at "experimental"
```

No bloqueó el build, pero debe revisarse contra la versión exacta de Next.js usada en el repo.

## Riesgos restantes

1. El preflight quedó endurecido, pero no existe todavía un workflow CI obligatorio en este cambio.
2. `next.config.ts` tiene una advertencia de compatibilidad que conviene limpiar.
3. La carrera de Prisma puede reaparecer si alguien ejecuta gates pesados en paralelo fuera del `railway:preflight`.
4. No se tocaron tests de negocio; el hardening fue sobre build/reproducibilidad.

## Regla operativa

Ningún deploy a Railway debe ejecutarse si falla:

```bash
pnpm run railway:preflight
```

Ese comando debe considerarse el gate mínimo para validar:

- integridad del workspace
- orden de compilación
- generación de Prisma Client
- build de API y Web
- validación sintáctica del worker
- typecheck de apps
