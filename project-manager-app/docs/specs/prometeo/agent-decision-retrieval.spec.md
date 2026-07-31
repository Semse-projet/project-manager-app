---
id: "prometeo.agent-decision-retrieval"
title: "SPEC-AGT-003 — Retrieval de AgentDecision vía Prometeo"
type: spec
domain: "prometeo"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
date: "2026-07-31"
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/ops/loops.service.ts
  - apps/api/src/modules/ops/mission-control/mission-control.service.ts
  - apps/api/src/modules/prometeo/prometeo.retrieval.ts
  - apps/api/src/modules/prometeo/prometeo.service.ts
  - apps/api/src/modules/knowledge/agent-memory.service.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-31"
---

# SPEC-AGT-003 — Retrieval de `AgentDecision` vía Prometeo

**Deriva de:** `ADR-021-anatomia-agente-semse.md` §4.4, `ADR-023-sense-agentic-architecture-v1.md` §2.3 ítem 4
**Módulos afectados:** `apps/api/src/modules/prometeo`
**Fase Matriz:** child spec de F8 (Domain Loops)

---

## 1. Propósito

`ADR-021` (2026-07-02) ya identificó este gap: existe una tabla de memoria
episódica (`AgentDecision`) pero ningún camino de retrieval hacia la capa
conversacional de Prometeo. Este spec cierra ese gap dándole a Prometeo
acceso de solo lectura a "qué se decidió antes sobre X y por qué", sin crear
tablas nuevas ni tocar los dos consumidores que ya existen.

## 2. Estado real (verificado en código)

| Pieza | Qué hace hoy | Evidencia |
|---|---|---|
| `AgentDecision` (modelo Prisma) | Existe: `loopId`, `runId`, `agentType`, `target`, `kind` (finding/proposal/rejection), `decision` (recorded/proposed/accepted/rejected/suppressed), `rationale`, `outcome`, `confidence`, `evidence`, indexado por `[loopId, target]`, `[agentType, createdAt]`, `[decision, createdAt]` | `packages/db/prisma/schema.prisma:3489-3506` |
| `ops/loops.service.ts` | Usa `AgentDecision` como memoria de rechazos: los loops permanentes no re-proponen dentro del cooldown lo ya rechazado (comentario propio del archivo) | `loops.service.ts:8-11` |
| `ops/mission-control/mission-control.service.ts` | `findMany` filtrado por `loopId`/`decision: "proposed"`/`outcome: "pending_review"` para la cola de excepciones | `mission-control.service.ts:1068` |
| `prometeo.service.ts` / `prometeo.retrieval.ts` / `agent-memory.service.ts` | **Cero referencias a `AgentDecision`** (confirmado por grep en todo `apps/api/src`) | ausencia confirmada |

**Consecuencia real:** un usuario que le pregunta a Prometeo/Justus/Marta
"¿por qué se rechazó esto antes?" no obtiene respuesta basada en memoria
real — Prometeo no tiene ningún camino hacia `AgentDecision`. Esa memoria
solo sirve hoy a los loops de fondo, no a la conversación con el usuario.

## 3. Diseño propuesto

Añadir un método de retrieval de solo lectura en `prometeo.retrieval.ts` (o
un archivo hermano `agent-decision-retrieval.service.ts` en el mismo
módulo), que:

1. Consulta `AgentDecision` filtrado por `target` (p. ej. un `projectId`,
   `milestoneId` u otro identificador de negocio que ya aparece en
   `evidence`/`payload`) y opcionalmente `agentType`.
2. Se expone como una fuente de contexto adicional (`AgentContextSource`),
   siguiendo el mismo patrón que `ADR-021 §5` ya declaró para
   `knowledge.rag`: "los agentes gobernados consumen Prometeo como
   `AgentContextSource` adicional". No es una tool nueva de escritura, es
   una fuente de contexto más para el `ContextEngine`.
3. Pasa por `token-budget-engine.ts` igual que el resto de fuentes — no se
   inyecta la tabla completa por proyecto, se resume/pagina por relevancia
   (mismo criterio que `agent-memory.service.ts` aplica a sus otros tipos de
   memoria: decision/run_summary/task_state/runtime_fact/repo_fact/operator_note).
4. **No se crea ninguna tabla nueva.** `AgentDecision` se reutiliza tal cual
   existe; no se propone ninguna escritura nueva a la tabla en este spec.

## 4. Alcance y límites

- Es una fuente de contexto de **solo lectura**. No se propone ninguna
  mutación de `AgentDecision` desde Prometeo.
- El scoping por `tenantId` debe ser explícito en la query — hoy
  `mission-control.service.ts` ya filtra por contexto de tenant en otras
  consultas del mismo servicio; este retrieval debe seguir el mismo patrón,
  porque `rationale`/`evidence` de un loop puede contener referencias a
  datos de proyecto/tenant que Prometeo no debe filtrar entre tenants.
- No sustituye ni modifica la lógica de cooldown de `loops.service.ts` ni la
  cola de `mission-control.service.ts` — es un tercer consumidor de solo
  lectura, no una refactorización de los dos existentes.

## 5. Riesgos

- `risk: medium`: es de solo lectura (menor riesgo que una mutación), pero
  el riesgo real es de privacidad/aislamiento — un `rationale` mal scopeado
  podría filtrar contexto de un proyecto/tenant distinto al de la
  conversación actual si la query no respeta el mismo `tenantId` que ya usa
  el resto del `ContextEngine`.
- Volumen: `AgentDecision` puede crecer sin límite con los loops permanentes
  (`SPEC-AUT-001`, ya `IMPLEMENTED`); el retrieval debe acotar por fecha o
  relevancia, no traer todo el historial de un `target`.

## 6. Criterios de aceptación

- [ ] El retrieval nunca cruza `tenantId` — verificado con un test que
      confirme que un `target` de otro tenant no aparece en el contexto.
- [ ] El contexto inyectado respeta el presupuesto de `token-budget-engine.ts`
      (no se vuelca la tabla completa).
- [ ] Ningún consumidor existente (`loops.service.ts`,
      `mission-control.service.ts`) cambia de comportamiento — este spec
      solo añade un tercer consumidor de lectura.
- [ ] Una pregunta conversacional de tipo "¿por qué se rechazó X?" puede
      responderse con datos reales de `AgentDecision`, no solo con el
      conocimiento genérico del modelo.

## 7. No implementado en este spec

Queda en `status: DRAFT`. Sigue el mismo flujo que los specs anteriores:
`APPROVED` → `/speckit.plan` → `/speckit.tasks` → tests antes de código →
`/speckit.implement`.
