# Quality Gates CI - 2026-04-08

## Objetivo

Endurecer el monorepo canónico `project-manager-app` con quality gates reales y verdes, basados en el estado actual del backend y del frontend tipado.

## Cambios realizados

### 1. Limpieza de lint en API

Se corrigieron los errores que impedían usar `eslint` del backend como gate real:

- tipado de hooks Fastify en `apps/api/src/main.ts`
- tipado de request en `apps/api/src/modules/health/health.controller.ts`
- tipado del repository de auth sin `any` en `apps/api/src/modules/auth/auth.repository.ts`
- imports no usados en `apps/api/src/modules/ops/ops.service.ts`
- parámetro no usado en `apps/api/src/modules/projects/projects.policy.ts`
- import no usado en `apps/api/src/modules/trust/trust.repository.ts`

### 2. CI actualizado

Se actualizó `.github/workflows/ci.yml` para agregar un job nuevo:

- `quality-gates`

Ese job corre:

1. `npm run lint --workspace @semse/api`
2. `npm run test:unit --workspace @semse/api`
3. `npm run build:api`
4. `npm exec tsc --workspace @semse/web -- --noEmit`

Además:

- `e2e` ahora depende de `quality-gates`

## Validación local ejecutada

Todos estos comandos pasaron localmente en esta ronda:

```bash
npm run lint --workspace @semse/api
npm run test:unit --workspace @semse/api
npm run build:api
npm exec tsc --workspace @semse/web -- --noEmit
```

## Decisión técnica

No se agregó todavía `npm run lint --workspace @semse/web` como gate duro de CI.

Motivo:

- el frontend tiene una deuda de lint bastante más amplia y heterogénea;
- hoy sí pasa `tsc --noEmit`, que da una garantía útil sin frenar el pipeline por backlog previo;
- conviene cerrar primero ese frente de UI por bloques antes de volverlo obligatorio en CI.

## Estado resultante

- API lint: verde
- API tests unitarios: verde
- API build: verde
- Web typecheck: verde
- CI: ya tiene gate útil sobre el monorepo actual y no solo sobre el legado `logic.mjs`

## Siguiente paso recomendado

1. migrar el coverage legacy para que mida `apps/api` y no solo `logic.mjs`
2. atacar el backlog de `lint` del web por rutas/páginas y luego promoverlo a gate obligatorio
