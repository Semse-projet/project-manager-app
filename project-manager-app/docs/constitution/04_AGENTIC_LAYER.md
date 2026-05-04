---
version: 2.0.0
fecha: 2026-03-30
estado: canonical
owner: ai-lead
changelog: Actualizado para reflejar catálogo real de agentes en @semse/agents. 16 agentes nombrados + 8 especializados ya definidos. Worker polling activo. LLM pendiente.
---

# 04_AGENTIC_LAYER — Arquitectura de la Capa de Agentes IA

## Propósito

Este documento define la arquitectura oficial de la capa de agentes inteligentes de SEMSEproject: qué agentes existen, cómo operan, cómo se ejecutan, cómo persisten memoria y cómo se controlan.

---

## Estado real al 2026-03-30

### Lo que ya existe y funciona

- **`@semse/agents` package**: Catálogo completo de 16 agentes nombrados + 8 agentes especializados. Tipos, interfaces y definiciones completas.
- **`AgentsModule` en `apps/api`**: CRUD de `AgentRun`, catálogo, chat threads (`createThread`, `appendMessage`, `generateAgentResponse`).
- **`AgentRun` model en PostgreSQL**: Con lifecycle completo (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`), campos de observabilidad, `requiresHumanReview`, `confidence`.
- **`AuditService` integrado**: Cada acción de AgentRun genera `AuditLog`.
- **`apps/worker`**: Worker polling HTTP funcional — poll, heartbeat, reclaim de AgentRuns muertos.
- **`RiskScore` model**: Calcula y persiste scores por entidad (User, Job, Contract).

### Lo que NO está activo aún

- Llamadas reales a OpenAI / Anthropic (LLM real)
- pgvector para embeddings y búsqueda semántica
- AgentMemory persistente
- BullMQ queues (actualmente polling HTTP)
- Ejecutores backend de agentes especializados

---

## Separación fundamental

La capa de agentes tiene dos tipos completamente distintos de agentes.

### Agentes de OPERACIÓN
Ayudan a los usuarios finales del sistema (clientes, profesionales, operadores). Operan sobre datos de producción. Son parte del producto.

Subfamilia A — **Agentes Nombrados** (interfaz conversacional):
16 agentes con nombre, personalidad y contexto de activación. El usuario los percibe como asistentes especializados.

Subfamilia B — **Agentes Especializados** (backend workers):
8 agentes que ejecutan tareas estructuradas en background. No tienen conversación directa — producen outputs JSON.

### Agentes de CONSTRUCCIÓN
Ayudan al equipo de desarrollo a construir el ecosistema. Operan sobre código, documentos y decisiones técnicas. Son herramientas del equipo, no del producto.

Este documento cubre principalmente los **agentes de operación**.

---

## Subcapas formales de la operación asistida

Además de los agentes de operación y de construcción, `SEMSE` reconoce una subarquitectura operativa que habilita la ejecución agentic del ecosistema. Esta subarquitectura no debe nombrarse por marca de herramienta. Debe nombrarse por función.

### Taxonomía oficial

| Subcapa | Función | Naturaleza |
|---|---|---|
| `operator_identity` | identidad operativa del operador, credenciales, configuración persistente y memoria transversal | persistente |
| `workspace_memory` | memoria operativa contextual por workspace y por ecosistema | persistente |
| `agent_runtime` | runtimes versionados, bundles de ejecución, sandboxes y entornos aislados | recreable |
| `ephemeral_runtime_state` | caches, logs y artefactos temporales regenerables | efímera |
| `backup_recovery` | copias externas validadas para resiliencia | respaldo |

### Principio rector

- `SEMSE` no debe confundir memoria con runtime.
- `SEMSE` no debe confundir backup con runtime activo.
- `SEMSE` no debe confundir cache con conocimiento institucional.

### Aplicación al ecosistema

#### Identidad operativa

Corresponde a credenciales, configuración persistente y memoria global del operador.  
No pertenece al dominio del producto, pero sí condiciona la continuidad operativa.

#### Memoria de workspace

Corresponde a la memoria contextual de un ecosistema concreto, por ejemplo `labsemse/.claude` leído funcionalmente como `workspace_memory`.  
Esta subcapa sí forma parte del sistema vivo de operación agentic del proyecto.

#### Runtime agentic

Corresponde a bundles locales, imágenes de ejecución, runtimes versionados y sandboxes.  
Es pesado pero recreable. No es conocimiento crítico.

#### Estado efímero

Corresponde a caches, logs y artefactos temporales.  
Siempre es purgable.

#### Respaldo

Corresponde a copias externas validadas.  
Nunca debe tratarse como sustituto directo del runtime activo si el medio no soporta semántica Unix completa.

### Referencias canónicas asociadas

La destilación de esta subcapa queda aterrizada en:

- `agents/references/infclaude/modelo_capa_operacion_asistida_semse_2026-04-12.md`
- `reportes/destilacion_capa_operacion_asistida_labsemse_2026-04-12.md`

La primera opera como referencia estable absorbida por la arquitectura agentic.  
La segunda conserva la trazabilidad fechada del análisis y de las acciones ejecutadas.

---

## Catálogo oficial de agentes nombrados (16)

Todos definidos en `packages/agents/src/index.ts`. Provider actual: `openai` (gpt-4o-mini por defecto).

| Agente | Rol | Especialidad | Contexto trigger | Estado |
|---|---|---|---|---|
| SEMSE | assistant | Asistente central del ecosistema | dashboard, marketplace, jobs | defined |
| Marta | marta | Gestión de proyectos y milestones | milestones, projects, contracts | defined |
| Planner | planner | Planificación y estimaciones | jobs/new, proposals, bids | defined |
| Felix | felix | Soporte técnico de campo y construcción | units, evidence, worklogs | defined |
| Escrow | escrow | Pagos y transacciones seguras | escrow, payments, milestones | defined |
| Justus | justus | Contratos digitales y legal | contracts, legal | defined |
| Legal | legal | Normativas y cumplimiento regulatorio | compliance, contracts | defined |
| Vesper | vesper | Análisis de riesgo y confiabilidad | trust, disputes, professionals | defined |
| Security | security | Seguridad de cuenta y autenticación | auth, settings, admin | defined |
| Pulse | pulse | Métricas, analytics y KPIs | dashboard, reports, analytics | defined |
| Binary | binary | Integraciones técnicas y API | api, integrations, webhooks | defined |
| Tech | tech | Arquitectura del sistema y stack | architecture, cortex | defined |
| Design | design | UX/UI y experiencia del usuario | dashboard, marketplace | defined |
| Marketing | marketing | Crecimiento y adquisición | professionals, profile, marketplace | defined |
| Health | health | Bienestar del equipo e incidentes | incidents, worklogs, units | defined |
| Evidence Coach | evidence_coach | Documentación de evidencia de alta calidad | evidence, milestones | defined |

---

## Catálogo oficial de agentes especializados (8)

Todos definidos en `packages/agents/src/index.ts`. Se ejecutan como `AgentRun` en el sistema.

### 1. Pricing Agent (`pricing`)

| Campo | Valor |
|---|---|
| Propósito | Cálculo de precios estimados con datos de mercado |
| Trigger | Nuevo job publicado o solicitud explícita de estimación |
| Input | `{ jobCategory, location, scope }` |
| Output | `{ estimatedMin, estimatedMax, confidence, breakdown[] }` |
| Fase | Sprint 3.1 |

### 2. Job Planner Agent (`job-planner`)

| Campo | Valor |
|---|---|
| Propósito | Generar milestones y cronograma sugerido para un job |
| Trigger | Creación de scope o bid acceptance |
| Input | `{ title, scope, budget, deadline? }` |
| Output | `{ milestones[], estimatedDays, risks[] }` |
| Fase | Sprint 3.2 |

### 3. Trust Match Agent (`trust-match`)

| Campo | Valor |
|---|---|
| Propósito | Matching de profesionales por reputación, historial verificado y compatibilidad |
| Trigger | Nuevo job publicado o solicitud de matching |
| Input | `{ jobId, category, budget, location }` |
| Output | `{ matches[], topMatch, reasoning }` |
| Dependencias especiales | pgvector (Fase 3) |
| Fase | Sprint 3.2 |

### 4. Evidence Coach Agent (`evidence-coach`)

| Campo | Valor |
|---|---|
| Propósito | Coaching adaptativo de evidencia estructurada por hito |
| Trigger | Milestone evidence upload |
| Input | `{ milestoneId, jobCategory, uploadedFiles[] }` |
| Output | `{ feedback, missingItems[], qualityScore, approved }` |
| Fase | Sprint 3.3 |

### 5. Risk Assessment Agent (`risk`)

| Campo | Valor |
|---|---|
| Propósito | Evaluación de riesgo por job, contrato y actor del sistema |
| Trigger | Payment intent, contract creation, fraud signal |
| Input | `{ jobId, actorId, context }` |
| Output | `{ riskScore, riskLevel, flags[], recommendation }` |
| Modelo | Rules Engine + LLM hybrid |
| Fase | Sprint 3.4 |

### 6. Dispute Resolution Agent (`dispute`)

| Campo | Valor |
|---|---|
| Propósito | Análisis asistido de disputas con propuesta de resolución |
| Trigger | Disputa abierta por cliente o profesional |
| Input | `{ disputeId, evidence[], timeline[] }` |
| Output | `{ recommendation, favoredParty, reasoning, confidence }` |
| REGLA CRÍTICA | Siempre requiere HITL. Nunca resuelve sin operador humano |
| Fase | Sprint 3.5 |

### 7. Orchestrator (`orchestrator`)

| Campo | Valor |
|---|---|
| Propósito | Coordinar agentes especializados para tareas complejas multi-agente |
| Trigger | Tarea que requiere múltiples agentes especializados |
| Input | `{ task, context }` |
| Output | `{ result, agentsUsed[], executionMs }` |
| Fase | Sprint 3.6 |

### 8. ECV — Ethical Constitutional Validator (`ecv`)

| Campo | Valor |
|---|---|
| Propósito | Validar que los outputs de agentes cumplan los principios del sistema |
| Trigger | Cualquier output de agente antes de aplicarlo |
| Input | `{ agentRole, response, context }` |
| Output | `{ passed, violations[], revisedResponse? }` |
| Fase | Sprint 3.6 |

---

## Arquitectura de ejecución actual

### Stack actual (polling HTTP)

```
POST /v1/agents/runs  (AgentsController)
  → AgentRun creado en DB (QUEUED)
  → Worker polling detecta el run (cada 3s por defecto)
  → Worker: PUT /v1/agents/runs/:id/start (RUNNING)
  → Worker: simula ejecución o llama LLM (futuro)
  → Worker: PUT /v1/agents/runs/:id/complete | /fail (COMPLETED | FAILED)
  → AuditLog generado en cada transición
```

### Stack objetivo (BullMQ — Sprint 2.4)

```
BullMQ Queue (Redis)
  → NestJS AgentProcessor (apps/worker)
    → AgentRun creado en DB (QUEUED → RUNNING)
    → @semse/agents ejecuta el agente con LLM real
    → AgentRun actualizado (RUNNING → COMPLETED | FAILED)
    → Evento publicado al módulo correspondiente
    → NotificationService disparado si aplica
```

### Queues objetivo por agente (post BullMQ)

| Queue | Agente | Concurrencia | Prioridad |
|---|---|---|---|
| `agent:pricing` | Pricing Agent | 10 | Media |
| `agent:planner` | Job Planner | 5 | Media |
| `agent:trust-match` | Trust Match | 5 | Media |
| `agent:evidence` | Evidence Coach | 3 | Media |
| `agent:risk` | Risk Assessment | 10 | Alta |
| `agent:dispute` | Dispute Resolution | 2 | Alta |
| `agent:orchestrator` | Orchestrator | 5 | Variable |
| `agent:ecv` | ECV Validator | 10 | Alta |

---

## Modelo de datos Prisma — estado real

### AgentRun (operativo en producción)

```prisma
model AgentRun {
  id            String         @id @default(cuid())
  tenantId      String
  agentType     String         // Rol del agente (libre — del catálogo)
  triggerType   String         // tipo de evento que inició el run
  inputJson     Json           // contexto de entrada
  outputJson    Json?          // resultado producido
  status        AgentRunStatus @default(QUEUED)
  correlationId String         // para agrupar runs relacionados
  workerId      String?        // qué worker tomó el run
  attempts      Int            @default(0)
  maxAttempts   Int            @default(3)
  deadLettered  Boolean        @default(false)
  error         String?
  startedAt     DateTime?
  heartbeatAt   DateTime?
  endedAt       DateTime?
  // Observabilidad
  actionType          String?  // classify | recommend | validate | alert | auto_resolve | escalate
  inputSummary        String?
  outputSummary       String?
  confidence          Decimal? @db.Decimal(4, 3)  // 0.000–1.000
  requiresHumanReview Boolean  @default(false)
  // Relaciones
  tenant        Tenant         @relation(...)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

enum AgentRunStatus {
  QUEUED | RUNNING | COMPLETED | FAILED | CANCELLED
}
```

### RiskScore (operativo en producción)

```prisma
model RiskScore {
  id           String   @id @default(cuid())
  tenantId     String
  subjectType  String   // User | Job | Contract | Org
  subjectId    String
  score        Decimal  @db.Decimal(5, 4)
  factorsJson  Json
  modelVersion String
  computedAt   DateTime @default(now())
}
```

### AgentMemory (pendiente — Fase 3)

Ver `07_SELF_IMPROVING_AGENTS.md` para el schema completo de AgentMemory con pgvector.

---

## Capa de experiencia unificada (Cortex)

En `apps/web/app/cortex/` existe la superficie de interfaz conversacional con los agentes nombrados.

El usuario percibe un solo asistente contextual que cambia de especialidad según el módulo activo. Internamente, `getAgentsForContext(currentPath)` selecciona el agente relevante.

Esta unificación es una **capa de experiencia**, no una mezcla de responsabilidades.

---

## Sistema de memoria de agentes (diseño objetivo — Fase 3)

### Capa 1 — Memoria de corto plazo
Contexto de la conversación actual. Vive en el context window del LLM. Se descarta al terminar el AgentRun.

### Capa 2 — Memoria de trabajo
Datos activos de una tarea. Se almacenará en Redis con TTL por agente.

### Capa 3 — Memoria de largo plazo
Hechos y decisiones que persisten entre AgentRuns. Se almacenará en `AgentMemory` en PostgreSQL.

### Capa 4 — Memoria semántica
Embeddings de entidades para búsqueda por similitud. Requiere pgvector. Se implementa en Fase 3.

---

## Guardrails y safety

### Reglas de seguridad obligatorias

1. **Ningún agente modifica datos directamente.** Los agentes producen `proposals` o `recommendations`. Las acciones de escritura las ejecuta el servicio del dominio correspondiente tras validación.

2. **DisputeResolutionAgent requiere HITL siempre.** Ninguna resolución de disputa se aplica sin aprobación de un operador humano. `requiresHumanReview: true` obligatorio.

3. **RiskAssessmentAgent solo flagea, no bloquea.** El bloqueo de cuentas o retención de pagos requiere confirmación del equipo de ops.

4. **Toda llamada LLM genera un AgentRun.** No existen llamadas a OpenAI fuera del sistema de registro de AgentRuns.

5. **ECV valida outputs antes de aplicarlos.** Todo output de agente que impacte datos de producción debe pasar por el ECV.

6. **Límites de costo y timeout por run.** Configurables en `AgentRun.maxAttempts`. Extensibles con `heartbeatAt` para detección de stale runs.

---

## Métricas de observabilidad

Cada AgentRun registra automáticamente:

| Métrica | Fuente | Alerta si |
|---|---|---|
| Intentos | `attempts` | >= `maxAttempts` → `deadLettered` |
| Confianza | `confidence` | < 0.6 → revisar calidad del output |
| HITL requerido | `requiresHumanReview` | > 50% → revisar carga operativa |
| Dead letters | `deadLettered` | > 0 → alerta inmediata |
| Status FAILED | `status = FAILED` + `error` | > 5% en 1h → alerta |

Panel de monitoreo: implementar en `apps/web/app/cortex/` + `apps/web/app/dashboard/` en Fase 3.

---

## Roadmap de implementación

| Sprint | Qué se construye | Estado |
|---|---|---|
| Sprint 3.0 | AgentMemory model + pgvector + BullMQ queues | Pendiente |
| Sprint 3.1 | Pricing Agent — pricing real con LLM | Pendiente |
| Sprint 3.2 | Trust Match Agent + Job Planner Agent | Pendiente |
| Sprint 3.3 | Evidence Coach Agent — Vision API | Pendiente |
| Sprint 3.4 | Risk Assessment Agent — rules + LLM hybrid | Pendiente |
| Sprint 3.5 | Dispute Resolution Agent — Plan-and-Execute + HITL | Pendiente |
| Sprint 3.6 | Orchestrator + ECV | Pendiente |
| Sprint 3.7 | Activar 16 agentes nombrados con OpenAI real | Pendiente |
