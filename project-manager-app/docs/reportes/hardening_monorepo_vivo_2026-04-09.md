# Hardening del monorepo vivo `project-manager-app`

Fecha: 2026-04-09
Tipo: Endurecimiento estructural y estabilización operativa

## Objetivo

Fortalecer el monorepo vivo [project-manager-app](/home/yoni/labsemse/project-manager-app) para dejarlo más estable, menos frágil y con una superficie de verificación más confiable.

## Hallazgos priorizados

### Crítico

1. `apps/web/next.config.ts` tenía bypasses activos:
   - `eslint.ignoreDuringBuilds = true`
   - `typescript.ignoreBuildErrors = true`

   Eso permitía que `next build` ocultara fallos reales.

2. `@semse/auth` mezclaba exports isomórficos con utilidades Node-only (`node:crypto`) en el entrypoint principal. Eso rompía `build:web` con:
   - `UnhandledSchemeError: node:crypto`

### Alto

3. Había un `package-lock.json` anidado en [apps/web](/home/yoni/labsemse/project-manager-app/apps/web), innecesario dentro de un workspace npm.
4. Runbooks y README del monorepo seguían apuntando a la ruta vieja `/home/yoni/project-manager-app`.
5. El root no tenía un comando de verificación del workspace que reflejara el estado real de producción interna.

### Medio

6. El build del web emitía un warning CSS por orden incorrecto de `@import`.

## Cambios ejecutados

### 1. Endurecimiento real de `next build`

Se eliminaron los bypasses de:

- [apps/web/next.config.ts](/home/yoni/labsemse/project-manager-app/apps/web/next.config.ts)

Resultado:

- `next build` volvió a validar lint y tipos;
- el build del web ya no depende de silencios artificiales.

### 2. Separación isomórfica en `@semse/auth`

Se separó el entrypoint del paquete:

- [packages/auth/src/index.ts](/home/yoni/labsemse/project-manager-app/packages/auth/src/index.ts)
- [packages/auth/src/session.ts](/home/yoni/labsemse/project-manager-app/packages/auth/src/session.ts)
- [packages/auth/package.json](/home/yoni/labsemse/project-manager-app/packages/auth/package.json)

Decisión:

- `index.ts` queda isomórfico para web y middleware;
- `session.ts` encapsula utilidades Node-only de sesión;
- el package exporta `./session` como submódulo explícito.

También se ajustaron tests:

- [tests/unit/auth.test.ts](/home/yoni/labsemse/project-manager-app/tests/unit/auth.test.ts)

Resultado:

- `build:web` dejó de romper por `node:crypto`;
- quedó una frontera más limpia entre browser/edge y Node.

### 3. Surface de verificación del workspace

Se añadió y promovió:

- [package.json](/home/yoni/labsemse/project-manager-app/package.json)

Nuevo script:

- `npm run verify:workspace`

Ese comando ejecuta:

- typecheck de API y web;
- tests unitarios de API;
- `build:api`;
- `build:web`.

### 4. Alineación de CI al gate real

Se actualizó:

- [ci.yml](/home/yoni/labsemse/project-manager-app/.github/workflows/ci.yml)

El job `quality-gates` ahora usa:

- `npm run verify:workspace`

en lugar de depender de una combinación más frágil de pasos separados.

### 5. Higiene de workspace y documentación operativa

Se eliminó:

- [apps/web/package-lock.json](/home/yoni/labsemse/project-manager-app/apps/web/package-lock.json)

Se corrigieron rutas absolutas viejas en:

- [README.md](/home/yoni/labsemse/project-manager-app/README.md)
- [apps/worker/README.md](/home/yoni/labsemse/project-manager-app/apps/worker/README.md)
- [LOCAL_BOOTSTRAP.md](/home/yoni/labsemse/project-manager-app/docs/runbooks/LOCAL_BOOTSTRAP.md)
- [AGENTS_SMOKE_TEST.md](/home/yoni/labsemse/project-manager-app/docs/runbooks/AGENTS_SMOKE_TEST.md)
- [API_INTEGRATION_TEST.md](/home/yoni/labsemse/project-manager-app/docs/runbooks/API_INTEGRATION_TEST.md)

### 6. Limpieza del warning CSS

Se corrigió el orden de imports en:

- [globals.css](/home/yoni/labsemse/project-manager-app/apps/web/app/globals.css)

Resultado:

- `build:web` dejó de emitir el warning por orden de `@import`.

### 7. Primer corte de lint del API

Se añadió:

- [apps/api/eslint.config.mjs](/home/yoni/labsemse/project-manager-app/apps/api/eslint.config.mjs)

Esto deja una base explícita para lint del backend, aunque el binario de ESLint sigue mostrando comportamiento no determinista en este entorno y no se usó como gate principal del cierre.

## Checks ejecutados

Se validó con:

```bash
npm run test:unit
npm run test:unit --workspace @semse/api
npm run build:api
npm run build:web
npm run verify:workspace
```

## Estado final

- `test:unit` root: OK
- `test:unit --workspace @semse/api`: OK
- `build:api`: OK
- `build:web`: OK
- `verify:workspace`: OK

## Riesgos remanentes

1. `eslint` como binario directo sigue teniendo comportamiento colgado/no determinista en este entorno. El monorepo ya no depende de eso para su gate principal, pero conviene revisarlo aparte si se quiere volver a una superficie de lint standalone confiable.
2. La configuración del web todavía declara `experimental.webpackBuildWorker = false` y `useWasmBinary = true`; hoy no bloquea el build, pero merece revisión si se quiere endurecer más la toolchain de Next.

## Resultado práctico

El monorepo quedó más duro que antes en cuatro puntos reales:

- el web ya no oculta errores de tipos ni lint en build;
- el package `@semse/auth` ya no filtra código Node-only al frontend;
- el workspace tiene un gate reproducible y alineado a producción interna;
- la documentación operativa volvió a apuntar a la ruta canónica viva del repo.
