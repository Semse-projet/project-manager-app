# Automatizacion de Validacion por Entorno

## Objetivo

Reducir error manual y dejar una salida unica `GO / NO_GO` por ambiente.

## Script

Archivo:

- `/home/yoni/app semse/project-manager-app/packages/db/prisma/validate-runtime-environment.ts`

Script npm:

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npm run runtime:validate-environment
```

## Variables utiles

```bash
ENV_NAME=staging
REPORT_PATH=/tmp/runtime-validation-staging.json
APPLY_CLEANUP=false
```

## Ejemplo

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging REPORT_PATH=/tmp/runtime-validation-staging.json npm run runtime:validate-environment
```

## Salida

El script genera:

- inventario inicial
- backfill
- inventario final
- cleanup `dry-run` o real
- decision final
- razones de `NO_GO` si aplica

## Criterio

- `GO`
  cuando no quedan `legacyCount`, no hay `skipped` y la recomendacion final es segura
- `NO_GO`
  cuando queda deuda de migracion o inconsistencias
