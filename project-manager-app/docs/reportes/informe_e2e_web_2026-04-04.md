# Informe E2E Web

> Nota histórica: este informe documenta la primera validación E2E de `apps/web`. Debe leerse como base histórica, no como estado final del frontend ni del runner actual.

Fecha: 2026-04-04
Proyecto: `project-manager-app`
Ámbito: app canónica `apps/web`

## 1. Objetivo

Agregar y validar una suite E2E propia para la app canónica `apps/web`, ya que la suite previa del repositorio estaba enfocada en el sistema legacy del root.

## 2. Cambios realizados

### 2.1 Nueva configuración Playwright

Se creó:

- `playwright.web.config.js`

Esta configuración:

- usa `tests/e2e-web`
- levanta `apps/api` en `4000`
- levanta `apps/web` en `3002`
- habilita runtime real de la web con:
  - `SEMSE_API_BASE_URL=http://127.0.0.1:4000`
  - `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true`

### 2.2 Nueva suite E2E de la app canónica

Se creó:

- `tests/e2e-web/semse-web.spec.js`

Cobertura incluida:

1. landing pública
   - navegación principal
   - heading principal
   - selector de rol visible

2. superficies operativas
   - `dashboard`
   - `cortex`
   - presencia de bloques `Infclaude`

3. flujo autenticado real
   - login por API de sesión
   - apertura de `jobs/new`
   - avance del wizard
   - publicación real del job
   - confirmación de éxito

### 2.3 Script root

Se añadió:

- `test:e2e:web`

## 3. Resultado de ejecución

Comando ejecutado:

```bash
npm run test:e2e:web
```

Resultado final:

```text
3 passed
```

## 4. Hallazgos

Durante el cierre de esta suite aparecieron y se resolvieron estos puntos:

- el timeout inicial del `webServer` de Playwright era insuficiente para `build:web`
- el smoke necesitó login real con JWT/sesión para publicar jobs
- hubo que alinear selectores Playwright a elementos únicos por modo estricto

Ninguno de esos puntos terminó siendo bloqueo estructural; quedaron resueltos en la suite final.

## 5. Estado actual

Estado de validación al cierre:

- backend `apps/api`: smoke real pasando
- base local PostgreSQL: levantada y funcional
- app canónica `apps/web`: smoke E2E propio pasando

## 6. Conclusión

La validación principal del sistema quedó mucho más madura:

- ya no depende solo de build y typecheck
- ya no depende solo del frontend legacy
- ahora existe una ruta ejecutable que cubre backend real + web real + publicación real desde la UI canónica
