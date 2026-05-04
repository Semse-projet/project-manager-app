# Agentes SEMSE

Base documental canónica del subsistema de agentes de `SEMSE`.

## Qué vive aquí

Esta carpeta debe contener conocimiento relativamente estable del dominio de agentes:

- fundamentos;
- contexto;
- memoria;
- lógica;
- harnesses;
- mapas de implementación;
- runbooks operativos que siguen vigentes;
- arquitectura del `agent-runtime`.

## Qué no debe vivir aquí

La evidencia fechada, cierres de ejecución, matrices finales por entorno y reportes de validación deben ir en:

- `/home/yoni/labsemse/reportes`

En particular, la evidencia histórica del runtime se consolidó en:

- `/home/yoni/labsemse/reportes/agent-runtime`

## Estructura actual

### Fundacional

- `foundations/fundamentos-agentes-semse_2026-04-05.md`
- `cycles/ciclos-operativos-agentes-semse_2026-04-05.md`
- `context/contexto-de-agentes-semse_2026-04-05.md`
- `memory/memoria-de-agentes-semse_2026-04-05.md`
- `memory/diseno_formal_agent_memory_service_semse_2026-04-05.md`
- `logic/logica-de-agentes-semse_2026-04-05.md`
- `logic/diseno_plan_mode_payments_disputes_semse_2026-04-05.md`

Estas piezas forman el canon conceptual del subsistema:

- qué es un agente en `SEMSE`;
- cómo se organiza el contexto;
- cómo se organiza la memoria;
- cómo se estructura la lógica y el ciclo operativo.

### Arneses e implementación

- `harnesses/arneses-de-agentes-semse_2026-04-05.md`
- `harnesses/diseno_formal_agent_harness_semse_2026-04-05.md`
- `harnesses/contrato_tecnico_project_copilot_harness_semse_2026-04-05.md`
- `harnesses/contrato_tecnico_payments_harness_semse_2026-04-05.md`
- `harnesses/contrato_tecnico_dispute_harness_semse_2026-04-05.md`
- `implementation/mapa-codigo-agentes-semse_2026-04-05.md`
- `implementation/secuencia_adopcion_harnesses_semse_2026-04-05.md`

Estas piezas no duplican el bloque fundacional. Lo aterrizan a contratos técnicos, harnesses y rutas de adopción.

### Runtime operativo estable

- `agent-runtime/README.md`
- `agent-runtime/architecture/`
- `agent-runtime/operations/`
- `agent-runtime/automation/`
- `agent-runtime/decision-packages/`

Este bloque es el más denso. Aquí conviven:

- arquitectura viva del runtime;
- runbooks operativos todavía útiles;
- decisiones y paquetes de migración de abril 5.

Ahora ya no vive plano. Se separó por función para evitar que blueprint, automatización y paquetes de decisión compitan narrativamente al mismo nivel. La evidencia final de ejecución vive en `reportes/agent-runtime/`.

### Referencias externas aterrizadas

- `references/infclaude/analisis_aterrizaje_infclaude_semse_2026-04-05.md`
- `references/infclaude/modelo_capa_operacion_asistida_semse_2026-04-12.md`

Estas referencias no son visión global ni reportes de ejecución. Son análisis de sistemas externos que sirven para absorber patrones útiles dentro de la arquitectura agentic de `SEMSE`.

## Principio rector

- `SEMSE` debe separar claramente `loop`, `contexto`, `memoria`, `logica`, `permisos`, `tools`, `audit` y `delegacion`.
- El agente no es solo el prompt. El agente es el conjunto de runtime, memoria, herramientas, governance y trazabilidad.
