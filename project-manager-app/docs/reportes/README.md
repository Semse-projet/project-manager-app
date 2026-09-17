# Reportes

Esta carpeta agrupa evidencia fechada del trabajo hecho sobre `labsemse` y `project-manager-app`.

## Convención de nombre para reportes nuevos

```
YYYY-MM-DD_topic-corto-en-kebab-case.md
```

Ejemplo: `2026-09-17_labor-engine-boundary-cleanup.md`.

Esta carpeta (y sus subcarpetas) tiene archivos históricos con al menos 3 convenciones de nombre distintas (fecha al principio, fecha al final con guiones, fecha al final con guiones bajos) — **no se renombraron** para no romper las decenas de citas cruzadas que ya apuntan a esos nombres exactos desde `docs/specs/**`, runbooks, ADRs y comentarios de código (ver `packages/forge/src/creator.ts`, `apps/api/src/infrastructure/forge/forge-lease.service.ts`). Este README solo fija la convención para reportes **nuevos**, no reescribe el pasado. Ver `.claude/skills/semse-report-writer/SKILL.md` para el detalle de esta decisión (2026-09-17).

### Estructura sugerida para el contenido (no obligatoria)

No hay una plantilla `.specify` para reportes (a diferencia de spec/plan/tasks/checklist, que sí tienen override en `.specify/templates/overrides/`). Reutilizar la misma forma que ya pide el PR template del repo (`.github/pull_request_template.md`) mantiene consistencia con lo que un reviewer ya espera: **Resumen** (qué cambió y por qué), **Checklist final** (items concretos hechos, ✅/❌), **Evidencia** (comandos de validación corridos y su resultado), **Siguientes pasos** (qué debería recoger una sesión futura).

## Taxonomía

### Raíz de `reportes/`

Aquí viven:

- cierres técnicos;
- validaciones;
- diagnósticos;
- reportes de implementación;
- auditorías de estructura o consistencia.

Reporte activo reciente:

- `2026-06-28_ecosystem_improvement_audit_and_plan.md` — auditoría multiagente y plan de mejora del ecosistema SEMSE.
- `2026-06-28_api_readiness_gate.md` — implementación de `/v1/ready` con DB, migraciones, Redis y storage.
- `2026-06-28_rbac_explicit_auth_boundary.md` — cierre L2 de RBAC deny-by-default para handlers sin metadata explicita.
- `2026-06-29_domain_rbac_permissions.md` — migración L2 de knowledge/tools/vision/weather a permisos de dominio.
- `2026-06-29_legacy_evidence_rbac_permissions.md` — migración L2 de evidencia/change-orders legacy a permisos granulares.

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
