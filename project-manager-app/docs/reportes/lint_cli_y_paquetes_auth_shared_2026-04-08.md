# Lint CLI y Paquetes Auth Shared - 2026-04-08

## Objetivo

Cerrar dos frentes juntos:

1. migrar `@semse/web` desde `next lint` a ESLint CLI explícito;
2. convertir `@semse/auth` y `@semse/shared` de stubs en paquetes reutilizables, compilables y consumidos por el código real.

## Cambios realizados

### 1. Web lint migrado a ESLint CLI

Se cambió `apps/web/package.json`:

- antes: `next lint`
- ahora: `eslint . --ext .js,.jsx,.ts,.tsx`

Se agregó configuración plana en:

- `apps/web/eslint.config.mjs`

Con ignore explícito para:

- `.next/**`
- `coverage/**`
- `node_modules/**`
- `next-env.d.ts`

Resultado:

- desaparece la deprecación operativa de `next lint` como script del workspace;
- el lint del web ya corre sobre ESLint CLI directo.

### 2. `@semse/shared` implementado

`packages/shared/src/index.ts` ya no es solo `API_VERSION`.

Ahora expone:

- `API_VERSION`
- `SEMSE_IDENTITY_HEADER_NAMES`
- `SEMSE_PROXY_HEADER_NAMES`
- `SEMSE_REQUEST_HEADER_NAMES`
- `RequestIdentity`
- `parseRoleList()`
- `serializeRoleList()`
- `buildIdentityHeaders()`
- `buildProxyIdentityHeaders()`
- `trimToUndefined()`
- `assertNever()`

### 3. `@semse/auth` implementado

`packages/auth/src/index.ts` ya no es un stub.

Ahora expone:

- `RBAC_DEFAULT_POLICY`
- `rolePermissions`
- `normalizeRoles()`
- `getPermissionsForRoles()`
- `hasPermission()`
- `AppRole`
- `appRoleFromRoles()`
- `appRoleFromPathname()`
- `defaultDashboardForRole()`

### 4. Código real migrado a usar estos paquetes

#### API

- `apps/api/src/common/rbac.ts` reexporta desde `@semse/auth`
- `apps/api/src/common/request-context.ts` usa `@semse/shared`
- `apps/api/src/main.ts` usa headers canónicos de `@semse/shared`

#### Web

- `apps/web/lib/auth.ts` usa inferencia de roles desde `@semse/auth`
- `apps/web/app/api/semse/_server.ts` usa `@semse/shared`
- `apps/web/app/dashboard/page.tsx` usa `@semse/shared`

#### Worker

- `apps/worker/src/main.mjs` usa `buildIdentityHeaders()` desde `@semse/shared`

### 5. Paquetes endurecidos para runtime

Se agregaron `build`, `exports`, `types` y `tsconfig.json` a:

- `packages/auth`
- `packages/shared`

También se actualizó el root para que `build:api`, `build:web`, `dev:api` y `dev:web` construyan antes:

1. `@semse/shared`
2. `@semse/auth`
3. `@semse/schemas`

## Validación local

Comandos verdes al cierre:

```bash
npm run lint --workspace @semse/web
npm exec tsc --workspace @semse/web -- --noEmit
npm run lint --workspace @semse/api
npm run test:unit --workspace @semse/api
npm run build:api
```

## Nota técnica

La migración a ESLint CLI mostró una diferencia importante contra `next lint`:

- algunos comentarios `eslint-disable` apuntaban a reglas que solo existían en la cadena anterior;
- hubo que limpiarlos para dejar el CLI estable.

## Resultado

- `@semse/web` ya no depende de `next lint` como comando operativo
- `@semse/auth` y `@semse/shared` dejaron de ser promesas vacías
- API, web y worker ya comparten contratos reales de identidad, headers y roles
