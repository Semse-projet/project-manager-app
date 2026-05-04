# Consolidación del prompt maestro de capa de agentes

Fecha: 2026-04-09
Tipo: Normalización de prompt operativo

## Objetivo

Reducir el bloque largo de instrucciones para la capa de agentes a una versión más compacta, reutilizable y alineada con el estado real del repositorio.

## Acción ejecutada

Se creó:

- [prompt_maestro_capa_agentes_2026-04-09.md](/home/yoni/labsemse/reportes/prompts/prompt_maestro_capa_agentes_2026-04-09.md)

Y se actualizó:

- [reportes/prompts/README.md](/home/yoni/labsemse/reportes/prompts/README.md)

## Criterios preservados

El prompt compacto mantiene:

- uso de [project-manager-app](/home/yoni/labsemse/project-manager-app) como implementación viva;
- uso de [agents](/home/yoni/labsemse/agents) y [agents/references/infclaude](/home/yoni/labsemse/agents/references/infclaude) como referencia estable;
- uso de [reportes](/home/yoni/labsemse/reportes) solo como evidencia e historial;
- desautorización explícita de [archive/prototypes/semse-agent-runtime](/home/yoni/labsemse/archive/prototypes/semse-agent-runtime) como runtime vivo;
- el ciclo autónomo `INSPECCIONAR -> DIAGNOSTICAR -> DISEÑAR -> IMPLEMENTAR -> COMPILAR -> PROBAR -> CORREGIR -> REEJECUTAR`;
- los criterios duros de cierre técnico para la capa agentic.

## Resultado

Ya existe una versión lista para reutilizar sin redundancias narrativas y sin arrastrar rutas o jerarquías viejas del repositorio.
