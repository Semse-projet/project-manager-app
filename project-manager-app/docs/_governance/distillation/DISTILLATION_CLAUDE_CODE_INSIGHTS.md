---
version: 1.0.0
fecha: 2026-04-02
estado: canonical
owner: arquitecto-principal
fuente: Source code interno de Claude Code (Anthropic, filtrado 2026-03-31)
sprint_activo: Sprint 2.3+
---

# DISTILLATION — Insights del Source Code de Claude Code → SEMSE

> Este documento destila los sistemas internos descubiertos en el source code de Claude Code
> y los traduce en decisiones concretas para SEMSEproject. No es copia — es adaptación
> razonada al contexto de un marketplace de servicios con escrow, agentes IA y RBAC.

---

## MAPA DE SISTEMAS: Claude Code → SEMSE

| Sistema Claude Code | Equivalente en SEMSE | Estado actual en SEMSE | Brecha |
|---|---|---|---|
| BUDDY (mascota persistente por usuario) | Perfil de reputación + trust score | `RiskScore` existe, sin capa motivacional | Sin adaptación directa útil aún |
| KAIROS (always-on, tick prompts) | Worker polling + AgentRun lifecycle | `apps/worker` polling HTTP operativo | Tick proactivo no existe; worker es reactivo |
| ULTRAPLAN (planificación remota 30 min) | Orchestrator agent (Sprint 3.6) | Solo definido, sin implementación | Patrón aplicable al Orchestrator |
| autoDream (consolidación de memoria) | `07_SELF_IMPROVING_AGENTS.md` | Solo diseño, sin implementación | Patrón directamente aplicable a AgentMemory |
| Undercover Mode | No aplica a SEMSE | N/A | No construir |
| Coordinator Mode (multi-agent) | Orchestrator Agent + AgentRun | Catálogo definido, sin ejecución real | Patrón de scratchpad compartido es útil |
| Sistema de prompts modular + caché | System prompt de agentes | Sin sistema de prompts estructurado aún | Aplicable desde Sprint 3.0 |
| Feature gating compile-time | No implementado | Sin feature flags | Feature flags runtime útiles desde Sprint 2.4 |
| Permission system avanzado (YOLO/bypass/risk) | `RbacGuard` + `PolicyService` | Guards operativos, PolicyService definido | Risk classification aplicable ya |
| Beta headers / capability negotiation | Provider interface en AgentsModule | `openai` como provider fijo | Útil cuando haya multi-provider |
| Modelos no anunciados | No aplica | N/A | No aplica |

---

## LOS 5 INSIGHTS MÁS ACCIONABLES (Sprint 2.3 — Sprint 3.1)

---

### INSIGHT 1 — autoDream → `AgentMemoryConsolidator` para SEMSE

**Sistema original**: autoDream — fork en background, 4 fases (Orient → Gather Signal →
Consolidate → Prune/Index), 3 gates de activación (tiempo + volumen + lock), mantiene
MEMORY.md bajo 200 líneas / 25KB.

**Traducción a SEMSE**: El sistema de `AgentMemory` que ya está diseñado en
`07_SELF_IMPROVING_AGENTS.md` necesita exactamente este mecanismo de consolidación. El
catálogo tiene 24 agentes acumulando runs. Sin consolidación, la memoria crece sin límite
y la relevancia decae.

**Adaptación concreta para SEMSE**:

```
AgentMemoryConsolidator (BullMQ job — Sprint 3.0)
  Gates de activación (OR logic):
    - GATE_TIME: 24h desde última consolidación del agente
    - GATE_VOLUME: >= 20 AgentRuns COMPLETED del agente en el período
    - GATE_SIGNAL: > 3 runs con confidence < 0.6 (señal de degradación)

  Fases:
    1. ORIENT: Leer AgentRun[] del período — inputs, outputs, confidence, requiresHumanReview
    2. GATHER_SIGNAL: Extraer patrones — qué inputs producen high confidence, qué falló
    3. CONSOLIDATE: Actualizar AgentMemory[] relevantes, crear nuevas memorias si emerge
       patrón nuevo
    4. PRUNE_INDEX: Eliminar memorias con lastUsedAt > 30d, actualizar relevanceScore,
       recalcular embeddings si pgvector activo

  Límites (aplicar igual que autoDream):
    - Max 50 AgentMemory records activos por agente
    - Max 10KB por memory record
    - Lock distribuido Redis para evitar runs simultáneos del consolidador
```

**Por qué importa ahora**: Cuando se activen LLM reales en Sprint 3.1, sin consolidación
cada llamada al LLM lleva contexto frío. La consolidación es el mecanismo que hace que
los agentes "aprendan" entre runs sin reentrenamiento.

**Archivos impactados**:
- `07_SELF_IMPROVING_AGENTS.md` — ya tiene el schema; añadir sección de consolidación
- `apps/worker/` — añadir `consolidation.processor.ts` (BullMQ job)
- `packages/db/prisma/schema.prisma` — `AgentMemory` model con campos de consolidación

---

### INSIGHT 2 — Sistema de prompts modular → `AgentPromptRegistry`

**Sistema original**: Secciones estáticas cacheables + secciones dinámicas con
`SYSTEM_PROMPT_DYNAMIC_BOUNDARY`. Cache por organización. `DANGEROUS_uncachedSystemPromptSection()`
para secciones volátiles.

**Traducción a SEMSE**: Los 16 agentes nombrados + 8 especializados tienen `systemPrompt`
definido como string estático en `packages/agents/src/index.ts`. Esto es un anti-patrón
cuando escale a LLM reales — no permite: contexto dinámico por tenant, especialización
por job category, inyección de hechos del sistema, o cache eficiente.

**Adaptación concreta**:

```typescript
// packages/agents/src/prompt-registry.ts

interface AgentPromptSection {
  id: string
  content: string
  cacheable: boolean     // true = estático, seguro cachear
  volatile: boolean      // true = cambio frecuente, no cachear
}

interface ComposedAgentPrompt {
  sections: AgentPromptSection[]
  compose(): string      // concatena en orden con boundary markers
  cacheKey(): string     // hash de secciones cacheables para cache hit
}

// Secciones estándar por agente:
// [STATIC]  Identidad y rol del agente           ← cacheable
// [STATIC]  Guardrails del sistema SEMSE          ← cacheable
// [STATIC]  Especialidad del dominio              ← cacheable
// [DYNAMIC] Contexto del tenant activo            ← volatile
// [DYNAMIC] Estado actual del job/contrato        ← volatile
// [DYNAMIC] Memorias relevantes del agente        ← semi-volatile (TTL 5min)
// [DYNAMIC] Instrucción específica del run        ← volatile
```

**Por qué importa para Sprint 3.0**: Antes de activar LLM reales, necesitamos este
registry. Sin él, cada llamada construye el prompt desde cero sin cache, y el costo
de tokens se multiplica innecesariamente.

**Regla derivada**: Toda sección que cambia por tenant o por job es `volatile`. Toda
sección que define el rol del agente es `cacheable`. El boundary entre ambas debe ser
explícito en el código.

**Archivos impactados**:
- `packages/agents/src/` — crear `prompt-registry.ts`
- `packages/agents/src/index.ts` — migrar `systemPrompt` strings al registry
- `apps/api/src/modules/agents/` — usar prompt compuesto al invocar LLM

---

### INSIGHT 3 — Risk Classification en Permission System → `ActionRiskClassifier`

**Sistema original**: Modos permission: default/auto/bypass/yolo. Risk classification:
LOW/MEDIUM/HIGH aplicada a toda acción antes de ejecutar. YOLO classifier (ML-based
auto-approval para acciones LOW). Protected files list.

**Traducción a SEMSE**: El `PolicyService` ya existe como infraestructura en Sprint 2.2,
pero evalúa reglas estáticas. Lo que falta es una clasificación de riesgo dinámica para
las acciones de agentes antes de ejecutarlas.

**Adaptación concreta — `ActionRiskClassifier`**:

```typescript
// apps/api/src/infrastructure/policy/action-risk-classifier.ts

enum ActionRisk {
  LOW    = 'LOW',     // Puede ejecutarse sin aprobación humana
  MEDIUM = 'MEDIUM',  // Requiere log explícito + notificación
  HIGH   = 'HIGH',    // Requiere HITL — no ejecutar sin operador
}

// Matriz de clasificación para SEMSE:
const SEMSE_RISK_MATRIX: Record<string, ActionRisk> = {
  // LOW — agentes pueden ejecutar sin aprobación
  'pricing:estimate':            ActionRisk.LOW,
  'job-planner:suggest':         ActionRisk.LOW,
  'trust-match:rank':            ActionRisk.LOW,
  'evidence-coach:feedback':     ActionRisk.LOW,
  'risk:flag':                   ActionRisk.LOW,

  // MEDIUM — ejecutar pero con AuditLog explícito + notificación a ops
  'job-planner:auto_milestone':  ActionRisk.MEDIUM,
  'trust-match:auto_reject':     ActionRisk.MEDIUM,
  'risk:escalate':               ActionRisk.MEDIUM,

  // HIGH — HITL obligatorio, no auto-ejecutar
  'dispute:recommend_resolution': ActionRisk.HIGH,
  'payment:release_escrow':       ActionRisk.HIGH,
  'payment:refund':               ActionRisk.HIGH,
  'contract:terminate':           ActionRisk.HIGH,
  'user:suspend':                 ActionRisk.HIGH,
}
```

**Integración en el flujo de AgentRun**:

```
AgentRun creado
  → ActionRiskClassifier.classify(agentType, actionType)
  → LOW:    ECV → ejecutar → AuditLog
  → MEDIUM: ECV → ejecutar → AuditLog → NotificationService (ops team)
  → HIGH:   ECV → AgentRun.requiresHumanReview = true → detener → notificar ops → esperar aprobación
```

**Por qué importa ahora (Sprint 2.3)**: La matriz de riesgo puede implementarse HOY
sin LLM. Es reglas estáticas sobre `agentType + actionType`. Cuando lleguen los LLM
reales, el clasificador ya estará integrado y el sistema no correrá el riesgo de
ejecutar acciones HIGH en automático.

**Archivos impactados**:
- `apps/api/src/infrastructure/policy/action-risk-classifier.ts` — nuevo
- `apps/api/src/modules/agents/agents.service.ts` — integrar clasificador en
  `startAgentRun()`
- `04_AGENTIC_LAYER.md` — ya tiene guardrail de HITL; este insight lo convierte en código

---

### INSIGHT 4 — Feature Gating → `FeatureFlags` para activación progresiva de agentes

**Sistema original**: Bun feature() constant-folding + dead-code elimination. Flags:
PROACTIVE, KAIROS, BUDDY, COORDINATOR_MODE, etc. Runtime: GrowthBook con valores
cacheados.

**Traducción a SEMSE**: Tenemos 8 agentes especializados que se activarán en sprints
distintos (3.1 → 3.7). Hoy no hay mecanismo para activar un agente solo para un tenant,
solo en sandbox, o solo cuando el LLM real esté disponible. El resultado: si se activa
un agente antes de tiempo, todo el sistema queda expuesto a comportamiento no probado.

**Adaptación concreta — `FeatureFlags` en base de datos**:

```prisma
// packages/db/prisma/schema.prisma

model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique    // 'agent:pricing', 'agent:evidence-coach', etc.
  enabled     Boolean  @default(false)
  tenantIds   String[] // vacío = todos los tenants; no vacío = solo esos
  rolloutPct  Int      @default(0) // 0-100 — porcentaje de usuarios
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Flags a definir desde Sprint 2.4**:

| Flag | Valor inicial | Activar en |
|---|---|---|
| `agent:pricing` | `false` | Sprint 3.1 |
| `agent:job-planner` | `false` | Sprint 3.2 |
| `agent:trust-match` | `false` | Sprint 3.2 |
| `agent:evidence-coach` | `false` | Sprint 3.3 |
| `agent:risk` | `false` | Sprint 3.4 |
| `agent:dispute` | `false` | Sprint 3.5 |
| `agent:orchestrator` | `false` | Sprint 3.6 |
| `agent:ecv` | `false` | Sprint 3.6 |
| `llm:real_calls` | `false` | Sprint 3.1 (primer agente real) |
| `storage:s3_real` | `false` | Sprint 2.3 |
| `payments:stripe_live` | `false` | Post Fase 2 |

**Uso en AgentsService**:

```typescript
async createAgentRun(dto: CreateAgentRunDto): Promise<AgentRun> {
  const flagKey = `agent:${dto.agentType}`
  const isEnabled = await this.featureFlagsService.isEnabled(flagKey, dto.tenantId)
  if (!isEnabled) {
    throw new ServiceUnavailableException(`Agent ${dto.agentType} is not enabled`)
  }
  // ... resto del flujo
}
```

**Por qué importa**: Sin feature flags, activar LLM reales es un interruptor binario de
todo-o-nada por el sistema entero. Con flags, se activa agente por agente, tenant por
tenant, con rollout controlado.

**Archivos impactados**:
- `packages/db/prisma/schema.prisma` — añadir `FeatureFlag` model
- `apps/api/src/infrastructure/feature-flags/` — nuevo módulo
- `apps/api/src/modules/agents/agents.service.ts` — consultar flag antes de crear run

---

### INSIGHT 5 — KAIROS (tick proactivo) → `ProactiveAgentScheduler` para hitos críticos

**Sistema original**: KAIROS recibe `<tick>` prompts en intervalos, tiene budget de 15
segundos para acciones no bloqueantes, modo Brief para respuestas ultra-concisas, puede
enviar PushNotification, suscribirse a PRs.

**Traducción a SEMSE**: El sistema tiene 3 agentes que se benefician de activación
proactiva sin esperar un trigger de usuario: `risk` (detecta anomalías en escrow),
`evidence-coach` (recuerda al profesional subir evidencia pendiente), y `dispute`
(detecta escalamiento). Actualmente todos son 100% reactivos.

**Adaptación concreta — `ProactiveAgentScheduler`**:

```typescript
// apps/worker/src/processors/proactive-scheduler.processor.ts
// BullMQ repeatable job — cada 15 minutos

interface ProactiveTick {
  trigger: 'SCHEDULED_TICK'
  timestamp: Date
  checkType: ProactiveCheckType
}

enum ProactiveCheckType {
  // Chequeos de riesgo — ejecutar cada 15 min
  ESCROW_ANOMALY      = 'escrow_anomaly',     // escrow bloqueado > 48h sin movimiento
  MILESTONE_OVERDUE   = 'milestone_overdue',   // milestone sin evidencia > deadline

  // Chequeos de recordatorio — ejecutar cada 24h
  EVIDENCE_REMINDER   = 'evidence_reminder',   // milestone PENDING_EVIDENCE > 48h
  DISPUTE_STALE       = 'dispute_stale',        // disputa ASSIGNED sin movimiento > 72h
}
```

**Budget de tick (adaptado de KAIROS)**:
- Cada tick tiene `maxDurationMs: 10_000` — si supera 10s, se cancela
- Los ticks son `actionType: 'classify'` — solo leen y generan notificaciones
- Nunca modifican datos directamente — crean `AgentRun` de tipo `QUEUED` para
  procesamiento separado si se detecta algo

**Notificaciones proactivas a disparar**:

| Condición | Acción del ticker | Destino |
|---|---|---|
| Milestone con `deadline < now() + 24h` y sin evidencia | Crear notificación `evidence_due_soon` | Usuario PRO |
| EscrowBalance con `lockedAt < now() - 48h` y contrato ACTIVE sin avance | Flag risk agente | OPS_ADMIN |
| Disputa con `assignedAt < now() - 72h` sin `resolvedAt` | Escalar a ops | OPS_ADMIN |
| Job PUBLISHED sin bids en 7 días | Notificación `job_no_bids` | CLIENT |

**Por qué importa para Sprint 2.4**: El `NotificationService` se construye en Sprint 2.4.
El scheduler proactivo es el consumidor natural de ese servicio. Diseñarlos juntos
evita refactor posterior. El costo de agregar el ProactiveScheduler junto con BullMQ
es mínimo — es otro `processor.ts` en el worker.

**Archivos impactados**:
- `apps/worker/src/processors/proactive-scheduler.processor.ts` — nuevo
- `apps/api/src/modules/notifications/notifications.service.ts` — ya planificado en 2.4.4
- `apps/api/src/modules/agents/agents.service.ts` — `createAgentRun` para ticks

---

## QUÉ NO APLICAR (y por qué)

### BUDDY (mascota persistente por usuario)
**No aplicar en SEMSE.** El sistema de confianza de SEMSE se basa en reputación
verificable por comportamiento real: milestones completados, evidencia validada,
disputas ganadas/perdidas. Una mascota gamificada con stats procedurales (DEBUGGING,
CHAOS, SNARK) es dissonante con la propuesta de valor de SEMSE — confianza real, no
entretenimiento. Si en algún futuro se quiere engagement, el mecanismo correcto es
mejorar el `TrustScore` visible con componentes explicables.

**Sprint de revisión**: No antes de Sprint 4.x, y solo si hay evidencia de retención
problemática que un mecanismo motivacional pueda resolver.

### Undercover Mode
**No aplicar.** Este sistema oculta que Claude Code es IA en commits y PRs de repos
públicos. SEMSE no tiene este problema de identidad — los agentes de SEMSE son
componentes del producto visible, no contribuidores anónimos. Adicionalmente, el mandamiento
operativo #7 del KERNEL dice "Toda acción relevante genera AuditLog" — que es el
opuesto exacto de Undercover Mode.

### ULTRAPLAN (offload 30 min a Opus remoto)
**No aplicar ahora.** ULTRAPLAN asume disponibilidad de un modelo Opus-level remoto
con CCR, UI de aprobación en browser, y tareas que naturalmente duran 30 minutos.
El Orchestrator de SEMSE (Sprint 3.6) cubre el caso de uso de planificación compleja
multi-agente sin necesitar CCR externo. Cuando SEMSE esté en producción con carga real
y se identifiquen tareas de planificación que excedan la capacidad del Orchestrator local,
este patrón se puede revisar.

### Beta headers / capability negotiation
**No aplicar hasta Sprint 3.x.** Los beta headers negocian features con la API de
Anthropic (interleaved-thinking, context-1m, etc.). SEMSE aún no tiene llamadas LLM
reales activas. Cuando se implemente el `AgentPromptRegistry` (Insight 2) y se conecte
el primer agente real, ese es el momento de definir qué headers usar por agente. No
antes.

### Feature gating compile-time (Bun constant-folding)
**No aplicar la implementación compile-time.** SEMSE usa NestJS/Node no Bun.
El pattern de dead-code elimination por constant-folding no aplica. SÍ aplicar el
concepto — que es tener flags bien definidos con activación controlada. Por eso el
Insight 4 propone flags en base de datos, no en el build system.

### Modelos no anunciados (Capybara, Opus 4.7, Sonnet 4.8)
**No aplicar mitigaciones de producción** de modelos que no existen públicamente.
Las mitigaciones listadas (force safe boundary markers, smoosh reminder text) son
parches de producción para comportamientos específicos de esos modelos. Cuando SEMSE
integre LLM, comenzar con los modelos GA documentados (GPT-4o, Claude Sonnet) y
evaluar comportamiento desde cero.

---

## ADICIONES AL DISTILLATION_QUEUE.md

Los siguientes ítems deben agregarse al queue para sprints futuros:

---

### QUEUE: Sprint 3.0 — `AgentMemoryConsolidator`
**Fuente del insight**: autoDream (Anthropic internal)
**Qué construir**: BullMQ job que consolida AgentMemory por agente según 3 gates
(tiempo, volumen, señal de degradación). 4 fases: Orient → Gather Signal →
Consolidate → Prune/Index.
**Archivos destino**: `apps/worker/src/processors/consolidation.processor.ts`
**Dependencias**: `AgentMemory` model (07_SELF_IMPROVING_AGENTS.md), pgvector, BullMQ
**Estado**: PENDIENTE — no antes de Sprint 3.0

---

### QUEUE: Sprint 3.0 — `AgentPromptRegistry`
**Fuente del insight**: Sistema de prompts modular de Claude Code
**Qué construir**: Registry de secciones de prompt con boundary estático/dinámico,
cache key por secciones cacheables, composición lazy antes de llamada LLM.
**Archivos destino**: `packages/agents/src/prompt-registry.ts`
**Dependencias**: Ninguna — puede construirse antes de tener LLM real activo
**Estado**: PENDIENTE — puede avanzarse en Sprint 2.4 como preparación

---

### QUEUE: Sprint 2.4 — `FeatureFlag` model + `FeatureFlagsService`
**Fuente del insight**: Feature gating de Claude Code (GrowthBook pattern)
**Qué construir**: Modelo Prisma `FeatureFlag` + servicio con cache en Redis (TTL 60s).
Integrar en `AgentsService` como gate antes de crear AgentRun.
**Archivos destino**:
- `packages/db/prisma/schema.prisma` — modelo
- `apps/api/src/infrastructure/feature-flags/`
**Dependencias**: Redis (también Sprint 2.4 — TICKET 2.4.1)
**Estado**: PENDIENTE — Sprint 2.4 junto con Redis

---

### QUEUE: Sprint 2.4 — `ActionRiskClassifier`
**Fuente del insight**: Permission system avanzado de Claude Code (LOW/MEDIUM/HIGH)
**Qué construir**: Clasificador estático de riesgo por `agentType + actionType`.
Integrar en `AgentsService.startAgentRun()`. Matrices SEMSE ya definidas en Insight 3.
**Archivos destino**: `apps/api/src/infrastructure/policy/action-risk-classifier.ts`
**Dependencias**: PolicyService (ya existe desde Sprint 2.2)
**Estado**: PENDIENTE — Sprint 2.4 (o adelantar a Sprint 2.3 como zero-dependency item)

---

### QUEUE: Sprint 2.4 — `ProactiveAgentScheduler` (tick básico)
**Fuente del insight**: KAIROS (Anthropic internal)
**Qué construir**: BullMQ repeatable job cada 15 min con 4 chequeos: escrow_anomaly,
milestone_overdue, evidence_reminder, dispute_stale. Budget 10s. Solo genera
notificaciones, no modifica datos.
**Archivos destino**: `apps/worker/src/processors/proactive-scheduler.processor.ts`
**Dependencias**: BullMQ (TICKET 2.4.2), NotificationService (TICKET 2.4.4)
**Estado**: PENDIENTE — Sprint 2.4 como último ticket del sprint

---

## MATRIZ DE APLICABILIDAD POR SPRINT

| Insight | Sprint de aplicación | Complejidad | Impacto | Dependencia crítica |
|---|---|---|---|---|
| ActionRiskClassifier | 2.3 (adelantable) | Baja | Alto — seguridad agentes | PolicyService existente |
| FeatureFlag model | 2.4 | Baja-Media | Alto — control de activación | Redis |
| ProactiveAgentScheduler | 2.4 | Media | Medio — experiencia proactiva | BullMQ + NotificationService |
| AgentPromptRegistry | 2.4–3.0 | Media | Alto — costo LLM + coherencia | Ninguna (puede adelantarse) |
| AgentMemoryConsolidator | 3.0 | Alta | Alto — inteligencia acumulable | AgentMemory + pgvector + BullMQ |

---

## PRINCIPIOS DESTILADOS

Estos principios emergen de los sistemas de Claude Code y son coherentes con los
mandamientos del KERNEL de SEMSE:

**Principio D1 — Clasificación de riesgo antes de ejecución.**
Toda acción de agente sobre datos de producción debe ser clasificada (LOW/MEDIUM/HIGH)
antes de ejecutarse. Las acciones HIGH no se auto-ejecutan. Esto refuerza el mandamiento
"DisputeResolutionAgent requiere HITL siempre" ya existente en `04_AGENTIC_LAYER.md`.

**Principio D2 — Prompts como sistema, no como strings.**
Un prompt de agente es una composición de secciones con contratos claros (cacheable vs
volatile). Tratar el prompt como un string monolítico genera duplicación, inconsistencia
y costos innecesarios cuando escale a 24 agentes con LLM real.

**Principio D3 — Feature flags como mecanismo de seguridad, no solo de producto.**
En sistemas con agentes que pueden ejecutar acciones de alto riesgo, los feature flags
son un mecanismo de seguridad operativa. Activar un agente sin flag es un riesgo
equivalente a desplegar código sin tests.

**Principio D4 — Consolidación de memoria como ciudadano de primera clase.**
La memoria de los agentes sin consolidación activa acumula ruido. El diseño de
`AgentMemory` en SEMSE debe incluir desde el inicio el proceso de consolidación, no
agregarlo después. Los límites (50 records máx, 10KB máx) deben ser invariantes del
sistema, no parámetros configurables.

**Principio D5 — Proactividad acotada en tiempo y scope.**
Los agentes proactivos (tickers) tienen budget fijo de tiempo (10s en SEMSE) y solo
pueden generar notificaciones o crear AgentRuns — nunca modificar datos directamente.
Esta restricción evita que un ticker con bug corrompa datos de producción en un loop.

---

## REGISTRO DE DECISIONES DE ESTA DESTILACIÓN

| Decisión | Justificación |
|---|---|
| No adaptar BUDDY | Dissonante con propuesta de valor de confianza verificable |
| Adaptar autoDream como `AgentMemoryConsolidator` | Coherencia directa con diseño existente en `07_SELF_IMPROVING_AGENTS.md` |
| Usar feature flags en DB (no compile-time) | Stack es NestJS/Node, no Bun. DB + Redis es el patrón correcto para este stack |
| Risk classifier como reglas estáticas primero, ML después | SEMSE no tiene datos de training. Reglas estáticas son auditables y seguras para la etapa actual |
| ProactiveScheduler en Sprint 2.4 junto con BullMQ | Dependencia natural — mismo sprint reduce complejidad de integración |
| AgentPromptRegistry puede empezar en Sprint 2.4 | Zero dependency — no requiere LLM real. Mejor construirlo antes de activar agentes |

---

_Documento producido en sesión 2026-04-02. Siguiente revisión: al completar Sprint 2.4._
_Actualizar cuando: se active el primer LLM real, se complete AgentMemory schema, o se identifiquen nuevos patterns relevantes._
