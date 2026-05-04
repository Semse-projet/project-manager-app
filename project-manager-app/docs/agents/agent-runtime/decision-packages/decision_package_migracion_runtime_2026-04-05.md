# Decision Package: Migracion Agent Runtime

## Objetivo

Dejar una pieza ejecutiva para revisar la migracion con criterios de arquitectura, operacion y despliegue.

## Scope

Se migro la fuente canonicadel runtime desde:

- `AgentMemory` legacy

hacia:

- `RuntimeProviderAttachment`

Tambien se agrego:

- backfill legacy
- inventario por entorno
- cleanup legacy controlado
- healthcheck en admin
- validador automatizado `GO / NO_GO`

## Estado Tecnico

### Implementado

- tabla canonica `RuntimeProviderAttachment`
- `AgentRuntimeRegistry` sin lecturas ni escrituras legacy
- `Admin > Agent Runtime` con:
  - `Legacy fallback`
  - `Migration health`
  - `Legacy records`
- scripts:
  - `runtime:inventory`
  - `runtime:backfill`
  - `runtime:cleanup-legacy`
  - `runtime:validate-environment`

### Validado en local

- esquema aplicado
- inventario inicial ejecutado
- backfill ejecutado
- inventario final ejecutado
- cleanup `dry-run` ejecutado
- validador automatizado ejecutado
- resultado:
  - `decision: GO`
  - `legacyCount: 0`
  - `attachmentsCount: 0`
  - `migrationHealthy: true`

### Validado en staging

- esquema aplicado
- inventario inicial ejecutado
- backfill ejecutado
- inventario final ejecutado
- cleanup `dry-run` ejecutado
- resultado:
  - `decision: GO`
  - `legacyCount: 0`
  - `attachmentsCount: 0`
  - `migrationHealthy: true`

### Validado en production

- esquema aplicado
- inventario inicial ejecutado
- backfill ejecutado
- inventario final ejecutado
- cleanup `dry-run` ejecutado
- resultado:
  - `decision: GO`
  - `legacyCount: 0`
  - `attachmentsCount: 0`
  - `migrationHealthy: true`

### No validado todavia

- `preprod` solo si la politica interna lo exige

## Beneficio Esperado

- una sola fuente de verdad para runtime
- menor deuda tecnica
- mejor trazabilidad operativa
- mejor separacion de dominio respecto a `AgentMemory`
- migracion repetible por entorno

## Riesgos

### Riesgo bajo en local

- no habia datos legacy
- no habia datos adjuntos
- el corte a fuente canonica no perdio informacion

### Riesgo bajo con la evidencia actual

- local, staging y production quedaron en `GO`
- no hay datos legacy remanentes
- la tabla canonica es la unica fuente real

### Riesgo residual

- no hubo payloads legacy reales en los entornos validados
- sigue siendo importante conservar los artefactos de evidencia
- `preprod` puede seguir siendo un requisito organizacional, no tecnico

## Criterio GO / NO_GO

### GO

- `legacyCount = 0`
- `migrationHealthy = true`
- `skipped = 0`
- `recommendation = safe_to_disable_legacy_and_cleanup`

### NO_GO

- `legacyCount > 0`
- `skipped > 0`
- `recommendation != safe_to_disable_legacy_and_cleanup`
- evidencia incompleta por entorno

## Rollback

### Si algo sale mal

1. pausar cleanup real
2. preservar evidencia del entorno
3. no declarar cierre global
4. reintroducir compatibilidad temporal solo si el entorno lo exige
5. corregir datos o dependencias y rerun del validador

### Senales de rollback

- errores funcionales del runtime
- discrepancias entre inventory y datos esperados
- datos legacy residuales no explicados
- fallos de acceso a la tabla nueva

## Comandos Ejecutivos

### Validacion por entorno

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging REPORT_PATH=/tmp/runtime-validation-staging.json npm run runtime:validate-environment
```

### Cleanup real

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging APPLY_CLEANUP=true REPORT_PATH=/tmp/runtime-validation-staging.json npm run runtime:validate-environment
```

## Decision Actual

- local: `GO`
- staging: `GO`
- production: `GO`
- cierre global tecnico: `GO`

## Siguiente Paso Inmediato

1. completar firma operativa
2. archivar evidencia final
3. tratar `preprod` solo si la gobernanza interna lo pide
