# Agent Runtime

Indice canónico del bloque documental del runtime de agentes.

Esta carpeta queda reservada para arquitectura, runbooks, automatización y paquetes de decisión que siguen siendo útiles.

La evidencia fechada y los cierres formales ya no viven aquí. Se movieron a:

- `/home/yoni/labsemse/reportes/agent-runtime`

## Estructura actual

### `architecture/`

Blueprints, mapas estructurales, migraciones y heurísticas del runtime.

Documento nuevo destacado:

- `architecture/PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md`
  Prompt maestro para guiar diseño e implementación del Developer Runtime.

### `operations/`

Runbooks, plantillas y guías de operación persistente.

### `automation/`

Comandos, wrappers y automatización de validación por entorno.

### `decision-packages/`

Paquetes ejecutivos o de comunicación para acompañar cambios del runtime.

## Regla de lectura

- si buscas diseño estable del runtime → `architecture/`
- si buscas cómo operarlo → `operations/`
- si buscas cómo automatizar validación o ejecución → `automation/`
- si buscas material de decisión o comunicación → `decision-packages/`

## Movido a reportes

- `cierre_formal_migracion_runtime_2026-04-05.md`
- `evidencia_staging_2026-04-05.md`
- `evidencia_production_2026-04-05.md`
- `matriz_validacion_final_por_entorno_2026-04-05.md`
- `memo_ejecutivo_cierre_runtime_2026-04-05.md`

## Código relacionado

- `/home/yoni/labsemse/project-manager-app/packages/agents`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/agents`
- `/home/yoni/labsemse/project-manager-app/apps/worker/src/main.mjs`
