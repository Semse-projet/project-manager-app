# Reportes

Esta carpeta agrupa evidencia fechada del trabajo hecho sobre `labsemse` y `project-manager-app`.

## Taxonomía

### Raíz de `reportes/`

Aquí viven:

- cierres técnicos;
- validaciones;
- diagnósticos;
- reportes de implementación;
- auditorías de estructura o consistencia.

Si el documento responde "qué se hizo, qué se verificó y cuál fue el resultado", debe quedarse en la raíz o en una subcarpeta de evidencia equivalente.

### `prompts/`

Aquí viven:

- prompts de trabajo;
- instrucciones de ejecución preparadas para otro agente;
- artefactos de arranque que no son evidencia del trabajo ya ejecutado.

### `planning/`

Aquí viven:

- blueprints;
- backlog de ejecución;
- mapeos;
- DTO packs;
- historias derivadas;
- planes previos a la ejecución.

### `audits/`

Aquí viven:

- auditorías heredadas;
- reportes externos o legacy;
- diagnósticos que no pertenecen al ciclo principal ya trazado en la raíz.

### `agent-runtime/`

Aquí vive evidencia histórica específica del runtime de agentes.

### `infclaude/`

Queda reservado para evidencia o trabajo fechado relacionado con `infclaude`.
El análisis estructural estable ya fue movido a `agents/references/infclaude/`.

## Regla de clasificación

- diseño estable del sistema → `agents/`, `program/`, `vision/`, `constitution/`
- reglas del repositorio → `repository-rules/`
- evidencia de ejecución → `reportes/`
- prompts o paquetes previos al trabajo → `reportes/prompts/` o `reportes/planning/`

## Lectura histórica

Los informes tempranos de `2026-04-04` y parte de `2026-04-05` describen un estado previo a:

- la consolidación final de `project-manager-app/` como ruta canónica;
- la reorganización documental de `labsemse/`;
- la normalización posterior de `reportes/`.

Siguen siendo válidos como evidencia histórica, pero no deben leerse como fotografía vigente del repositorio sin revisar primero los cierres posteriores.

## Subcarpetas actuales

- `agent-runtime/`
- `audits/`
- `infclaude/`
- `planning/`
- `prompts/`
