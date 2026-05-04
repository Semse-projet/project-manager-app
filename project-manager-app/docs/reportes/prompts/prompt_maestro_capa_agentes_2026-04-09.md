# Prompt Maestro — Capa de Agentes SEMSE

Trabaja dentro del repositorio real de SEMSEproject y termina por completo la capa de agentes del sistema vivo.

## Repositorio objetivo

- implementación viva: [project-manager-app](/home/yoni/labsemse/project-manager-app)

## Canon documental y de contexto

Usa como referencia estructural estable:

- [agents](/home/yoni/labsemse/agents)
- [agents/references/infclaude](/home/yoni/labsemse/agents/references/infclaude)
- [program](/home/yoni/labsemse/program)
- [vision](/home/yoni/labsemse/vision)
- [constitution](/home/yoni/labsemse/constitution)
- [repository-rules](/home/yoni/labsemse/repository-rules)

Usa como evidencia histórica y validación previa:

- [reportes](/home/yoni/labsemse/reportes)
- [reportes/agent-runtime](/home/yoni/labsemse/reportes/agent-runtime)
- [reportes/audits](/home/yoni/labsemse/reportes/audits)

Usa solo como insumo previo y no como canon:

- [reportes/prompts](/home/yoni/labsemse/reportes/prompts)
- [reportes/planning](/home/yoni/labsemse/reportes/planning)

No uses [archive/prototypes/semse-agent-runtime](/home/yoni/labsemse/archive/prototypes/semse-agent-runtime) como runtime vivo. Es `REFERENCE_ONLY`.

## Regla de verdad

Si hay conflicto entre documentación y repo actual, la fuente de verdad es:

1. código actual;
2. filesystem actual;
3. referencia estructural estable;
4. evidencia histórica como contexto.

## Misión

Fortalecer, cerrar e integrar la capa de agentes de SEMSEproject dejándola:

- terminada;
- integrada;
- compilando;
- tipada;
- gobernada por políticas;
- con risk scoring;
- con auditoría estructurada;
- con approval flow base;
- y sin errores atribuibles a esta capa.

## Modo de ejecución obligatorio

Trabaja en bucle autónomo hasta cerrar la capa:

`INSPECCIONAR -> DIAGNOSTICAR -> DISEÑAR -> IMPLEMENTAR -> COMPILAR -> PROBAR -> CORREGIR -> REEJECUTAR`

No entregues solo análisis.
No dejes stubs ni TODOs evitables.
No pidas validaciones innecesarias.
Si aparece un error corregible, arréglalo y sigue.

## Inspección inicial obligatoria

Antes de tocar código:

1. inspecciona [project-manager-app](/home/yoni/labsemse/project-manager-app);
2. revisa la capa actual en `packages/agents`;
3. localiza runtime(s) canónicos en `apps/api`, `apps/worker` y `apps/web`;
4. revisa [agents/references/infclaude](/home/yoni/labsemse/agents/references/infclaude);
5. revisa [reportes/agent-runtime](/home/yoni/labsemse/reportes/agent-runtime);
6. confirma que [archive/prototypes/semse-agent-runtime](/home/yoni/labsemse/archive/prototypes/semse-agent-runtime) es histórico y no operativo.

## Bloques obligatorios de la capa

La capa viva debe cubrir, adaptada al repo real:

1. `Agent Identity Layer`
   id, nombre, rol, descripción, versión, estado, capacidades, tools permitidas, rango de riesgo, políticas y metadata.
2. `Capability & Permission Manifests`
   permisos explícitos por agente, acciones permitidas, targets, restricciones y contextos accesibles.
3. `Policy Engine`
   respuesta estructurada con `allow | deny | require_approval`, `reason`, `riskScore`, `violatedPolicies`, `requiredApprovals`, `auditTags`.
4. `Risk Classification Layer`
   scoring reutilizable por acción y target.
5. `Agent Runtime Layer`
   ejecución tipada, separación entre decisión y ejecución, validación previa, hooks de auditoría y errores robustos.
6. `Tool Registry / Tool Contracts`
   tools registradas, tipadas, categorizadas y gobernadas por capacidades y policy engine.
7. `Audit & Observability Layer`
   rastro estructurado por `agentId`, `runId` o naming real, acción, tool, target, riesgo, decisión, estado, duración y error.
8. `Approval Flow Base`
   acciones autoaprobables, acciones con aprobación y acciones denegadas.
9. `Memory / Context Discipline`
   acceso mínimo a contexto, inyección controlada y registro de acceso sensible.
10. `Integration Layer`
   integración estable con `apps/api`, `apps/web`, `apps/worker`, `packages/agents`, `packages/db`, `packages/schemas`, `packages/auth` y `packages/shared`.

## Reglas de arquitectura

- No inventes un runtime paralelo.
- No revivas `semse-agent-runtime`.
- No dupliques la capa de agentes en varios lugares.
- Consolida duplicaciones si las encuentras.
- Respeta el naming real del repo para `runId`, `correlationId`, traces y eventos.
- Favorece allowlists sobre permisos implícitos.
- Separa capacidad de autorización.
- No permitas acceso indiscriminado a memoria/contexto.

## Criterios de aceptación duros

No consideres terminado el trabajo hasta que:

- compile el proyecto;
- compile la capa de agentes;
- no haya imports rotos;
- no haya tipos rotos;
- no haya contratos inconsistentes;
- el runtime inicialice agentes válidos;
- el policy engine responda estructuradamente;
- el risk scoring funcione;
- las tools queden gobernadas;
- la auditoría registre eventos;
- la integración con apps y packages quede estable;
- el sistema afectado pueda correr.

Si existen `build`, `typecheck`, `lint` o `tests`, ejecútalos y corrige todo lo atribuible a esta capa.

## Salida final obligatoria

Entrega al terminar:

1. resumen técnico de lo implementado;
2. arquitectura final de la capa;
3. archivos creados o modificados;
4. decisiones clave;
5. checks ejecutados;
6. estado de compilación;
7. estado de tests;
8. comandos para correr;
9. riesgos remanentes, si existen;
10. siguientes extensiones recomendadas, pero solo después de dejar terminado el módulo base.
