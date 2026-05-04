# Cleanup Legacy y Healthcheck

## Objetivo

Cerrar la transicion dejando:

- limpieza legacy controlada
- healthcheck visible en admin

## Script de limpieza

Archivo:

- `/home/yoni/app semse/project-manager-app/packages/db/prisma/cleanup-runtime-provider-legacy.ts`

Comandos:

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npm run runtime:cleanup-legacy
APPLY=true npm run runtime:cleanup-legacy
```

## Politica

- `runtime:cleanup-legacy` corre en `dry-run` por defecto
- solo borra si `APPLY=true`

## Healthcheck

Campos nuevos en `RuntimeStatusView`:

- `legacyRecordCount`
- `migrationHealthy`

Criterio de saludable:

- fallback legacy desactivado
- `legacyRecordCount = 0`

## UI

`Admin > Agent Runtime` ahora muestra:

- `Legacy fallback`
- `Migration health`
- conteo de `Legacy records`
