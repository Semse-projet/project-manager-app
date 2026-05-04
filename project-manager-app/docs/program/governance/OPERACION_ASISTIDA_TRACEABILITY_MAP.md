# Mapa de Trazabilidad de la Operacion Asistida

- Fecha: 2026-04-12
- Estado: activo
- Tipo: governance map

## Proposito

Definir la trazabilidad formal de la capa de operacion asistida dentro de `labsemse`: dónde se nombra, dónde se modela, dónde se registra y dónde se preserva su evidencia.

## Regla base

La operación asistida del ecosistema se gobierna por función, no por marca de herramienta.

Las subcapas oficiales son:

1. `operator_identity`
2. `workspace_memory`
3. `agent_runtime`
4. `ephemeral_runtime_state`
5. `backup_recovery`

## Matriz de trazabilidad

| Subcapa | Rol | Documento canónico principal | Documento de apoyo | Evidencia / trazabilidad | Regla operativa |
|---|---|---|---|---|---|
| `operator_identity` | identidad operativa, credenciales, configuración persistente | `constitution/04_AGENTIC_LAYER.md` | `agents/references/infclaude/modelo_capa_operacion_asistida_semse_2026-04-12.md` | `reportes/destilacion_capa_operacion_asistida_labsemse_2026-04-12.md` | no mezclar con dominio de producto |
| `workspace_memory` | memoria contextual por workspace | `constitution/04_AGENTIC_LAYER.md` | `agents/README.md` | `reportes/destilacion_capa_operacion_asistida_labsemse_2026-04-12.md` | tratar como activo del ecosistema vivo |
| `agent_runtime` | runtime local, bundles, sandboxes, imágenes de ejecución | `program/ARCHITECTURE_TARGET.md` | `agents/references/infclaude/modelo_capa_operacion_asistida_semse_2026-04-12.md` | `reportes/destilacion_capa_operacion_asistida_labsemse_2026-04-12.md` | tratar como recreable, no como memoria institucional |
| `ephemeral_runtime_state` | caches, logs, staging temporal | `constitution/04_AGENTIC_LAYER.md` | `repository-rules/CANONICITY.md` | reportes de limpieza o reorganización cuando existan | purgable por defecto |
| `backup_recovery` | respaldo externo y resiliencia | `program/ARCHITECTURE_TARGET.md` | `repository-rules/CANONICITY.md` | reportes de validación y respaldo | no usar como runtime activo si el medio no soporta semántica Unix |

## Flujo documental oficial

### 1. Observacion y destilacion

Cuando se observa un patrón útil en el entorno operativo:

- se analiza;
- se abstrae a función;
- se evita nombrarlo por marca;
- se destila a lenguaje de `SEMSE`.

### 2. Absorcion de referencia

Si el patrón sigue siendo referencia absorbida y no canon constitucional directo:

- vive en `agents/references/infclaude/`

### 3. Formalizacion canónica

Si el patrón cambia arquitectura, autoridad, mapa de capas o gobernanza:

- se refleja en `constitution/`
- y/o en `program/`
- y/o en `repository-rules/`

### 4. Evidencia fechada

Si hubo intervención, reorganización o validación concreta:

- se registra en `reportes/`

## Mapa por carpeta

| Carpeta | Papel respecto a la operación asistida |
|---|---|
| `agents/references/infclaude/` | referencia absorbida estable |
| `constitution/` | definición formal de fronteras y taxonomía |
| `program/` | papel arquitectónico y lugar en el sistema objetivo |
| `repository-rules/` | precedencia y regla de resolución |
| `reportes/` | evidencia fechada y trazabilidad |
| `agents/` | integración conceptual al subsistema agentic |

## Regla de conflicto

Si un reporte, una referencia absorbida y un documento canónico discrepan:

1. manda `constitution/`
2. luego `program/`
3. luego `repository-rules/`
4. luego `agents/references/`
5. luego `reportes/`

## Resultado esperado

La operación asistida deja de ser un conjunto implícito de prácticas del operador y pasa a comportarse como una capacidad trazable del ecosistema.
