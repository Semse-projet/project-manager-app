# Programa de Ejecucion

Esta carpeta traduce la vision de largo plazo a un sistema de trabajo ejecutable.

## Precedencia

La fuente primaria de vision vive en:

- [vision](/home/yoni/labsemse/vision)
- documento canonico: [VISION_FUSIONADA_SEMSE_PROMETEO.md](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

Regla:

- `program` no redefine vision
- `program` convierte vision en secuencia de ejecucion
- si hay contradiccion entre `program` y `vision`, manda `vision`

## Orden recomendado de lectura

1. [VISION_FUSIONADA_SEMSE_PROMETEO.md](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)
2. [MASTERPLAN.md](/home/yoni/labsemse/program/MASTERPLAN.md)
3. [ARCHITECTURE_TARGET.md](/home/yoni/labsemse/program/ARCHITECTURE_TARGET.md)
4. [ROADMAP_12_MESES.md](/home/yoni/labsemse/program/ROADMAP_12_MESES.md)
5. [SEMSE_AI_EXECUTION_BACKLOG.md](/home/yoni/labsemse/program/execution/SEMSE_AI_EXECUTION_BACKLOG.md)
6. [PHASE_01_MVP.md](/home/yoni/labsemse/program/strategy/phases/PHASE_01_MVP.md)

## Estructura actual

### Núcleo activo en raíz

- `MASTERPLAN.md`
- `ARCHITECTURE_TARGET.md`
- `ROADMAP_12_MESES.md`

### Capa transversal de operacion asistida

`program/` ya reconoce una capa transversal de operación asistida que no pertenece al dominio del producto, pero condiciona la ejecución agentic y la continuidad del ecosistema.

Sus subcapas son:

- `operator_identity`
- `workspace_memory`
- `agent_runtime`
- `ephemeral_runtime_state`
- `backup_recovery`

La definición arquitectónica vive en:

- `ARCHITECTURE_TARGET.md`

La formalización constitucional vive en:

- `../constitution/04_AGENTIC_LAYER.md`

### `strategy/`

Modelos estratégicos, marcos de diseño y fases.

### `execution/`

Backlogs, planes y tableros ejecutables.

`execution/history/` conserva planes anteriores que siguen siendo útiles como trazabilidad, pero no describen por sí solos el estado vigente.

### `status/`

Estado operativo actual e historial de avance.

`status/history/` conserva estados previos y debe leerse como contexto histórico, no como fotografía presente.

### `governance/`

Coherencia, permisos y reglas estructurales del programa.

## Regla de uso

- la vision define hacia donde vamos;
- el masterplan define como vamos;
- la arquitectura define que sistema estamos construyendo;
- el roadmap define cuando se agrupan los objetivos;
- la ejecución define el trabajo concreto;
- el status registra avance real;
- la governance resuelve contradicciones internas del programa.

Para la operación asistida:

- `program/` no documenta detalles del runtime local por marca o herramienta;
- `program/` sí reconoce la función sistémica de esa capa dentro del ecosistema;
- la referencia absorbida vive en `agents/references/`;
- la trazabilidad fechada vive en `reportes/`.

No todo se construye de inmediato.
Todo lo que se construya debe ser compatible con la direccion principal.
