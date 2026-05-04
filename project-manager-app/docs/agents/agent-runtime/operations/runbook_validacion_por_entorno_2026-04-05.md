# Runbook de Validacion por Entorno

## Objetivo

Cerrar la migracion del runtime por entorno, no por intuicion.

## Secuencia correcta

1. Aplicar esquema

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npx prisma db push --accept-data-loss
```

2. Inventario inicial

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npm run runtime:inventory
```

3. Backfill

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npm run runtime:backfill
```

4. Inventario posterior

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npm run runtime:inventory
```

5. Dry-run de limpieza

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
npm run runtime:cleanup-legacy
```

6. Si el entorno ya esta sano, limpieza real

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
APPLY=true npm run runtime:cleanup-legacy
```

## Criterio de entorno sano

- `legacyCount = 0`
- `migrationHealthy = true`
- recomendacion = `safe_to_disable_legacy_and_cleanup`

## No declarar production-ready si

- `legacyCount > 0`
- `skipped > 0` en backfill
- el inventario por tenant no cuadra
- no existe prueba equivalente en staging
