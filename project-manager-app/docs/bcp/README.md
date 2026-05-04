# SEMSE BCP

Este directorio contiene los runbooks canonicos de continuidad para `project-manager-app`.

## Documentos activos

- `BCP_OVERVIEW.md`: objetivos, RTO/RPO y cobertura general.
- `OPERACION_ASISTIDA_BACKUP_RECOVERY_RUNBOOK.md`: procedimiento de recuperacion para la capa de operacion asistida.
- `OPERACION_ASISTIDA_RECOVERY_CHECKLIST.md`: checklist auditable para drills y recuperaciones reales.

## Verificacion

Ejecutar:

```bash
npm run verify:operacion-asistida:bcp
```

La verificacion comprueba que los documentos minimos existen y contienen las secciones
necesarias para operar `backup_recovery` sin depender de conocimiento informal.

## Drill local y cambio a API

Simulacion local sin API ni DB viva:

```bash
npm run drill:operacion-asistida:bcp
```

El resultado se guarda por defecto en dos rutas:

```text
docs/bcp/evidence/operacion-asistida-bcp-drill-local-latest.json
docs/bcp/evidence/operacion-asistida-bcp-drill-local-<timestamp>.json
docs/bcp/evidence/manifest.json
```

`manifest.json` conserva el ultimo resultado y un historial resumido de las ultimas 50 corridas.

Para cambiar el mismo flujo a API viva:

```bash
SEMSE_BCP_DRILL_MODE=api SEMSE_API_URL=http://127.0.0.1:4000 npm run drill:operacion-asistida:bcp
```

Atajo equivalente:

```bash
npm run drill:operacion-asistida:bcp:api
```

Runner local de API:

```bash
npm run drill:operacion-asistida:api-local
```

Este runner usa por defecto la base del compose local:

```text
postgresql://semse:semse@127.0.0.1:5433/semse?schema=public
```

Variables utiles:

```bash
SEMSE_API_DRILL_DATABASE_URL=postgresql://semse:semse@127.0.0.1:5433/semse?schema=public
SEMSE_API_DRILL_PORT=4140
SEMSE_API_DRILL_MIGRATE=true
```

Si Postgres o Redis local no estan arriba, levantarlos antes con:

```bash
docker compose -f infra/docker/compose.semse-mvp.yml up -d postgres
docker compose -f infra/docker/compose.semse-mvp.yml up -d redis
```

Verificacion local compuesta:

```bash
npm run verify:operacion-asistida:local
```

Verificacion API local compuesta:

```bash
npm run verify:operacion-asistida:api-local
```

Verificacion API local usando el store dedicado:

```bash
npm run verify:operacion-asistida:dedicated-store
```

Gate completo del modulo:

```bash
npm run verify:operacion-asistida:module
```

Revision de riesgo desde el manifiesto:

```bash
npm run review:operacion-asistida:risk
```

Sincronizacion de governance y backlog desde la revision de riesgo:

```bash
npm run review:operacion-asistida:governance
```

Simulacion de restore aislado desde la ultima evidencia:

```bash
npm run drill:operacion-asistida:restore
```

Restore multi-entorno con dos API locales aisladas por puerto:

```bash
npm run drill:operacion-asistida:restore:multienv
```

Auditoria del legado `workspace_memory` sobre `KnowledgeFact`:

```bash
npm run audit:operacion-asistida:workspace-memory-legacy
```

Para absorber registros legacy faltantes:

```bash
SEMSE_WORKSPACE_MEMORY_LEGACY_APPLY=true npm run audit:operacion-asistida:workspace-memory-legacy
```

La lectura legacy ya fue retirada del reader de `workspace_memory`.

## Regla de uso

Los respaldos se usan para recuperar o auditar. No se usan como runtime activo ni como
ubicacion primaria de memoria operativa.
