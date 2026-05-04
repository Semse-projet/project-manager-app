# Normalización de enlaces post reordenamiento

Fecha: 2026-04-08
Base: `/home/yoni/labsemse`

## Objetivo

Corregir referencias que seguían apuntando a la estructura anterior del repositorio después del reordenamiento de:

- `constitution/`
- `repository-rules/`
- `_governance/{status,distillation,logs}`
- `agents/references/infclaude`
- `project-manager-app/` como canónico

## Cambios aplicados

### 1. Script operativo corregido

Se actualizó:

- `/home/yoni/labsemse/scripts/semse-health-check.mjs`

Correcciones:

- el canónico ya no apunta a `app semse/project-manager-app`, sino a `/home/yoni/labsemse/project-manager-app`
- `ECOSYSTEM_STATUS.md` ahora se lee desde `_governance/status/`
- `DISTILLATION_QUEUE.md` y `DISTILLATION_LOG.md` ahora se leen desde `_governance/distillation/`
- `01_KERNEL.md`, `06_EXECUTION_ROADMAP.md` y `08_SPRINT_BACKLOG.md` ahora se leen desde `constitution/`
- las acciones sugeridas por el reporte quedaron alineadas a las rutas nuevas
- el cierre del reporte ahora apunta a `_governance/logs/WORK_SESSION_LOG.md`

### 2. Documentación del canónico corregida

Se actualizó:

- `/home/yoni/labsemse/project-manager-app/docs/SOURCE_OF_TRUTH.md`

Correcciones:

- la referencia a `ARCHITECTURE_AUDIT.md` ahora apunta a `program/governance/repository-consolidation/ARCHITECTURE_AUDIT.md`
- el bloque final `Ver también` quedó alineado a la nueva estructura

### 3. Referencia vieja de infclaude corregida

Se actualizó:

- `/home/yoni/labsemse/reportes/observabilidad_agent_runtime_infclaude_2026-04-07.md`

Corrección:

- la fuente estructural ya no apunta a `reportes/infclaude/...`
- ahora apunta a `agents/references/infclaude/analisis_aterrizaje_infclaude_semse_2026-04-05.md`

### 4. Protocolo y comentario transicional alineados

Se actualizaron:

- `/home/yoni/labsemse/_governance/protocol/AGENT_PROTOCOL.md`
- `/home/yoni/labsemse/src/types/index.ts`

Correcciones:

- `AGENT_PROTOCOL.md` ya usa `project-manager-app/` como canónico y rutas nuevas de `_governance`
- `src/types/index.ts` ya referencia `project-manager-app/packages/schemas/src/` y la ubicación actual de `CANONICITY` y `ARCHITECTURE_AUDIT`

## Verificación real

Se ejecutó:

```bash
node /home/yoni/labsemse/scripts/semse-health-check.mjs
```

Resultado:

- el script corre sin fallar por rutas rotas
- genera reporte en `_governance/reports/2026-04-09_health.md`
- el resumen ejecutivo volvió a salir correctamente

## Resultado

El reordenamiento documental ya no deja roto el principal script de navegación operativa del ecosistema.

Quedan todavía referencias históricas dentro de reportes viejos y documentos archivados, lo cual es aceptable mientras no sean fuente de verdad activa. Las rutas vivas de operación y orientación ya quedaron alineadas.
