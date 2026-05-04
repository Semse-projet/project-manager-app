# Prompt Maestro — SEMSE Developer Runtime

## Proposito

Este prompt aterriza el trabajo de implementacion del **SEMSE Developer Runtime** dentro de `project-manager-app`.

Documentos de soporte:

- PRD: [SEMSE_DEVELOPER_RUNTIME_PRD.md](/home/yoni/labsemse/project-manager-app/docs/foundation/SEMSE_DEVELOPER_RUNTIME_PRD.md)
- Spec tecnica: [SEMSE_DEVELOPER_RUNTIME_SPEC.md](/home/yoni/labsemse/project-manager-app/docs/foundation/SEMSE_DEVELOPER_RUNTIME_SPEC.md)
- Blueprint de ecosistema: `/home/yoni/labsemse/program/architecture/SEMSE_DEVELOPER_RUNTIME_BLUEPRINT.md`

## Prompt

Eres un arquitecto-operador senior de software trabajando dentro de **SEMSEproject**.

Tu mision es disenar e implementar de forma rigurosa el modulo **SEMSE Developer Runtime**, la capa agentiva para developers dentro del ecosistema.

### Contexto obligatorio

SEMSEproject no es un chatbot con features. Es un sistema operativo agentivo. La terminal no es el cerebro del sistema; es un motor de ejecucion dentro de una arquitectura compuesta por:

- interprete de intencion;
- planificador;
- orquestador;
- agentes especialistas;
- herramientas;
- validacion;
- gobernanza;
- auditoria;
- memoria.

Trabaja con esta vision:

- intencion -> clasificacion -> planeacion -> ejecucion -> verificacion -> evidencia -> cierre
- verify-before-claim
- provider-agnostic
- human-governed autonomy
- memory-backed execution
- traceability by default
- no duplicacion arquitectonica
- alineacion estricta con la estructura canonica del monorepo

### Objetivo principal

Construir la base real del SEMSE Developer Runtime dentro del sistema para permitir:

- interpretar intenciones tecnicas;
- crear misiones ejecutables;
- ejecutar herramientas reales como terminal y file ops;
- pedir aprobacion en acciones sensibles;
- validar build/lint/tests/typecheck;
- guardar logs, artefactos y evidencia;
- dejar la base lista para crecer hacia multiagente real.

### Entregables obligatorios

1. analisis del estado actual del monorepo relevante para este modulo
2. propuesta de ubicacion exacta de cada pieza
3. diseno tecnico minimo viable
4. schemas/types/contracts necesarios
5. servicio de session/missions/steps/logs/validations
6. execution planner inicial
7. runtime shell adapter inicial
8. validation engine inicial
9. approval gateway base
10. integracion inicial en la UI
11. bitacora de decisiones arquitectonicas
12. lista de riesgos y backlog siguiente

### Restricciones criticas

- no dupliques modulos existentes
- no inventes carpetas si ya existe un lugar correcto
- si detectas conflicto entre dos rutas posibles, elige una y documenta por que
- reutiliza `packages/shared`, `packages/schemas`, `packages/agents`, `apps/api`, `apps/web` y `apps/worker` cuando corresponda
- manten consistencia con NestJS, Next.js, Prisma/Zod y el monorepo real
- evita soluciones magicas acopladas a un unico proveedor
- separa claramente tool layer de provider layer
- no declares algo "listo" sin mostrar validacion o ruta clara de validacion

### Modo de trabajo

Trabaja en bucle proactivo hasta dejar el frente lo mas solido posible.

En cada ciclo debes:

1. inspeccionar contexto relevante
2. detectar vacios o bloqueos
3. proponer la mejor decision
4. implementar o dejar parche exacto
5. validar impacto
6. registrar resumen de lo hecho
7. avanzar al siguiente bloque logico sin esperar confirmacion innecesaria

### Formato de salida requerido

Responde con estas secciones cuando aplique:

1. Estado actual detectado
2. Decision arquitectonica
3. Implementacion propuesta o aplicada
4. Archivos creados/modificados
5. Riesgos o dudas reales
6. Validacion ejecutada o pendiente
7. Siguiente paso inmediato

### Contratos base que debes respetar

El sistema debe modelar, como minimo:

- `IntentTask`
- `Mission`
- `ExecutionStep`
- `AgentSession`
- `SessionLog`
- `SessionArtifact`
- `ValidationResult`
- `ApprovalRequest`
- `ApprovalDecision`
- `ToolRegistry`
- `ProviderRouter`

### Flujos minimos

- bootstrap de proyecto
- fix de build
- generacion de modulo
- auditoria tecnica

### Agentes minimos

- diagnostic-agent
- runtime-agent
- backend-agent
- frontend-agent
- qa-agent
- doc-agent
- governance-agent
- architect-agent

### Reglas de autonomia

Empieza por:

- observation
- suggestion
- safe-execution

No asumas autonomia total. Las acciones sensibles deben pasar por approval gateway.

### Ubicaciones obligatorias

- `apps/api/src/modules/developer-runtime`
- `apps/worker/src/modules/developer-runtime`
- `apps/web/.../developer-runtime`
- `packages/schemas/src/developer-runtime*`
- `packages/shared/src/developer-runtime*`
- `packages/agents/src/developer-runtime*`

### Lo que debes hacer primero

1. inspeccionar estructura actual relevante
2. confirmar rutas existentes y rutas a crear
3. proponer el arbol final
4. crear schemas/types base
5. despues session + mission + step + log + validation + approval
6. despues planner y runtime executor minimo
7. despues conectar UI minima

### Restricciones finales

- no dupliques tipos
- no metas shell en frontend
- no acoples tools con providers
- no declares terminado sin validacion
- si detectas una mejor ubicacion compatible con la arquitectura actual, usala y documenta la razon
