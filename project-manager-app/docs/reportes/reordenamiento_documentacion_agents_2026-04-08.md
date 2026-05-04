# Reordenamiento de documentación de agentes

Fecha: 2026-04-08
Base: `/home/yoni/labsemse`

## Decisión

La carpeta canónica del subsistema de agentes debe seguir en:

- `/home/yoni/labsemse/agents`

No conviene moverla a `reportes` porque su contenido principal no es evidencia histórica sino documentación estructural del dominio.

## Criterio usado

### Se queda en `agents`

Todo lo que define conocimiento estable:

- fundamentos;
- ciclos;
- memoria;
- contexto;
- lógica;
- harnesses;
- mapas de implementación;
- runbooks operativos vigentes;
- arquitectura del `agent-runtime`.

### Va a `reportes`

Todo lo que representa evidencia o cierre fechado:

- matrices finales;
- evidencia por entorno;
- cierres formales;
- memos ejecutivos de cierre;
- reportes de ejecución real.

## Cambios realizados

### Se dejó `agents` como base documental canónica

Actualizado:

- `/home/yoni/labsemse/agents/README.md`

### Se limpió `agents/agent-runtime`

Actualizado:

- `/home/yoni/labsemse/agents/agent-runtime/README.md`

### Se creó espacio de evidencia en reportes

Creado:

- `/home/yoni/labsemse/reportes/agent-runtime/README.md`

### Se movió evidencia histórica desde `agents/agent-runtime` a `reportes/agent-runtime`

Movidos:

- `cierre_formal_migracion_runtime_2026-04-05.md`
- `evidencia_staging_2026-04-05.md`
- `evidencia_production_2026-04-05.md`
- `matriz_validacion_final_por_entorno_2026-04-05.md`
- `memo_ejecutivo_cierre_runtime_2026-04-05.md`

## Resultado

La estructura ahora distingue mejor entre:

- documentación canónica del subsistema de agentes;
- evidencia histórica de ejecución.

Eso evita que `agents/` se convierta en una mezcla de diseño, operación y reportes, y deja más claro dónde debe buscarse cada cosa.
