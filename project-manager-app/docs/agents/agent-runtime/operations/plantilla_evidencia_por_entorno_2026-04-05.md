# Plantilla de Evidencia por Entorno

Usar esta plantilla cada vez que se ejecute el runbook en un ambiente distinto.

## Entorno

- nombre:
- fecha:
- responsable:
- base objetivo:

## Comandos ejecutados

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npx prisma db push --accept-data-loss
npm run runtime:inventory
npm run runtime:backfill
npm run runtime:inventory
npm run runtime:cleanup-legacy
```

Si corresponde cleanup real:

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
APPLY=true npm run runtime:cleanup-legacy
```

## Resultado inventario inicial

```json
{
  "attachmentsCount": ,
  "legacyCount": ,
  "migrationHealthy": ,
  "recommendation": ""
}
```

## Resultado backfill

```json
{
  "scanned": ,
  "migrated": ,
  "skipped": 
}
```

## Resultado inventario final

```json
{
  "attachmentsCount": ,
  "legacyCount": ,
  "migrationHealthy": ,
  "recommendation": ""
}
```

## Resultado cleanup dry-run

```json
{
  "mode": "dry-run",
  "count": 
}
```

## Resultado cleanup real

```json
{
  "mode": "apply",
  "deletedCount": 
}
```

## Decision

- apto para apagar legacy:
- apto para cleanup real:
- apto para declararse production-ready:
- observaciones:
