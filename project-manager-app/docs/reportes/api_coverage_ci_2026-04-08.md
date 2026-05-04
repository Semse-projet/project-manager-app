# API Coverage CI - 2026-04-08

## Objetivo

Eliminar la cobertura heredada basada en `logic.mjs` y mover el pipeline a cobertura útil del backend real en `apps/api`.

## Cambios realizados

### 1. Nuevo script de cobertura en `@semse/api`

Se agregó en `apps/api/package.json`:

```json
"test:coverage": "node ../../node_modules/c8/bin/c8.js --reporter=text --reporter=text-summary --reporter=html --reporter=lcov --reporter=json-summary --include=src/**/*.ts --exclude=test/**/*.test.ts --exclude=**/*.d.ts --check-coverage --lines 90 --functions 85 --branches 85 --statements 90 node --experimental-strip-types --test test/**/*.test.ts"
```

### 2. Script raíz actualizado

En `package.json` raíz:

- `test:coverage` ya no apunta a `logic.mjs`
- ahora delega a `npm run test:coverage --workspace @semse/api`

### 3. Documentación actualizada

Se actualizó `README.md` para reflejar:

- nuevo scope de cobertura: `apps/api/src/**`
- umbrales vigentes reales
- CI actual con `quality-gates` + `unit-coverage`

## Validación local

Se ejecutó cobertura real del backend con `c8` sobre el runner actual del API.

Resultado:

- Statements: `95.45%`
- Branches: `90.90%`
- Functions: `86.66%`
- Lines: `95.45%`

Eso deja el gate verde con estos umbrales:

- lines `>= 90`
- statements `>= 90`
- branches `>= 85`
- functions `>= 85`

## Efecto en CI

El job `unit-coverage` de `.github/workflows/ci.yml` ya puede seguir usando `npm run test:coverage`, pero ahora ese comando mide backend real del monorepo actual y no el legado de frontend.

## Nota técnica

El script usa `node ../../node_modules/c8/bin/c8.js` en vez de `c8` desde `.bin` porque el workspace local tiene resolución inconsistente de binarios.  
Con esa ruta explícita, el comando queda estable en este repo y en CI.
