# SEMSE Agent Routing

Fecha: 2026-04-28
Estado: activo en `apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts`

## Objetivo

Hacer que los agentes visibles en UI dejen de ser decorativos. La selección del panel afecta la ruta real del mensaje.

## Agentes UI

| UI id | Agente real | Responsabilidad |
|-------|-------------|-----------------|
| `assistant` | `Prometeo` / `SEMSE Core` | orquestación central |
| `marta` | `Marta` | legal, cumplimiento, contratos |
| `felix` | `Felix` | evidencias, documentos, búsqueda |
| `pulse` | `Pulse` | métricas, salud, actividad |
| `justus` | `Justus` | pagos, escrow, disputas |
| `planner` | `Planner` | hitos, agenda, próximos pasos |

## Pipeline

1. UI manda `message`, `agentId`, `threadId`, `projectId`
2. `PrometeoOrchestratorService.classifyIntent()` detecta intención
3. `routeToAgent(intent, requestedAgentId)` decide agente primario
4. si `agentId !== assistant`, el agente del panel tiene prioridad
5. se construye prompt con persona del agente y contexto operativo
6. si no hay proyecto y la intención lo exige, entra guardrail
7. si sí hay proyecto, la intención se convierte a `AiTaskType`
8. `AiModelGatewayService` selecciona modelo

## Intenciones

| Intent | Agente por defecto |
|--------|--------------------|
| `operational_summary` | `SEMSE Core` |
| `project_report` | `Pulse` |
| `evidence_review` | `Felix` |
| `payment_status` | `Justus` |
| `dispute_status` | `Justus` |
| `schedule_plan` | `Planner` |
| `legal_compliance` | `Marta` |
| `system_health` | `Pulse` |
| `developer_diagnostics` | `Prometeo` |

## Mapeo a taskType

- `legal_compliance` -> `construction_contract_analysis`
- `payment_status` / `dispute_status` -> `risk_analysis`
- `project_report` -> `project_planning`
- `evidence_review` -> `document_summary`
- `operational_summary` -> `document_summary`

## Guardrails

- sin `projectId`:
  - `legal_compliance`, `payment_status`, `evidence_review`, `schedule_plan`, `project_report` usan `context_only`
- con `projectId`:
  - el mensaje entra a gateway y puede usar Claude, DeepSeek, Kimi u Ollama según router

## Observabilidad

Todas las rutas ya quedan reflejadas en `AiInteractionLog`, incluyendo:

- respuestas LLM reales
- `prometeo-context-guard`
- `prometeo-operational-report`
