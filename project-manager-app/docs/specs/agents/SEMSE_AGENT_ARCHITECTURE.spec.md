---
id: semse-agent-architecture
title: "SEMSE Agent Architecture"
domain: agents
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/agents/src
  - apps/api/src/modules/agents
  - apps/api/src/modules/semse-agents
  - packages/schemas/src/agent.schema.ts
  - packages/schemas/src/agent-governance.schema.ts
related_tests:
  - apps/api/test/agent-governance.test.ts
  - apps/api/test/agent-policy.service.test.ts
  - apps/api/test/semse-agents.test.ts
related_endpoints:
  - v1/agents
  - v1/agents/semse
related_events:
  - agent.action_logged
  - agent.human_review_requested
related_agents:
  - marketplace
  - buildops
  - protools
  - evidence
  - crowd
  - prometeo
last_verified: 2026-05-25
---

# SPEC: Arquitectura de Agentes SEMSE OS
**Dominio:** packages/agents
**Versión:** 1.0
**Fecha:** 2026-05-20
**Estado:** APPROVED
**Prioridad:** P0 — Fundación del ecosistema

---

## Principio Central

```
Marketplace conecta.
BuildOps organiza.
ProTools calcula.
Evidence protege.
Crowd paga.
Prometeo explica.
```

Ningún agente viola la frontera del otro.

---

## Los 6 Agentes Especializados

### 1. ProTools Agent
**Rol:** Inteligencia técnica de construcción y estimación.

**Responsabilidades:**
- Calcular materiales, cantidades, herramientas, costos, mano de obra
- Estimar tiempo de trabajo por oficio
- Detectar riesgos técnicos (permisos, licencias, condiciones ocultas)
- Generar checklists de preparación y ejecución
- Comparar opciones: básico / estándar / premium
- Traducir necesidad del cliente en lista técnica real

**Límites (NO hace):**
- No maneja pagos ni disputas
- No organiza tareas ni asigna responsables
- No genera contratos ni documentos legales

**Módulos internos:**
- Material Calculator (25 trade engines en `packages/tools`)
- Labor Estimator (`labor-engine.ts`)
- Cost Estimator (`cost-engine.ts` + `quote-engine.ts`)
- Tool Recommender
- Checklist Generator (`evidence-engine.ts`)
- Risk Detector (`risk-engine.ts`)
- Option Comparator (básico/estándar/premium)

**Integra con:** BuildOps (entrega plan técnico), Crowd (entrega quote para escrow), Evidence (entrega checklist de documentación)

---

### 2. BuildOps Agent
**Rol:** Inteligencia operativa — convierte trabajos en flujos coordinados.

**Responsabilidades:**
- Crear plan de proyecto con fases y tareas
- Gestionar milestones y dependencias
- Asignar responsables y fechas
- Monitorear estado del proyecto
- Detectar retrasos y proponer replanificación
- Coordinar crews y agenda
- Seguimiento diario del avance

**Límites (NO hace):**
- No calcula materiales ni costos
- No decide sobre disputas
- No libera pagos

**Módulos internos:**
- Project Planner (phases + tasks)
- Milestone Manager
- Task Board
- Calendar Assistant
- Crew Coordination
- Job Status Tracker
- Delay Detector
- Replanning Engine

**Integra con:** ProTools (recibe plan técnico), Crowd (notifica milestone completado), Evidence (exige evidencia antes de cerrar milestone), Marketplace (recibe trabajo asignado)

---

### 3. Evidence Agent
**Rol:** Inteligencia legal/protectora — pruebas y trazabilidad.

**Responsabilidades:**
- Gestionar fotos (before/during/after) con timestamp + GPS
- Recibir y archivar documentos (contratos, facturas, recibos)
- Registrar cambios de alcance aprobados (change order log)
- Generar paquetes de evidencia para disputas
- Verificar completitud de evidencia por milestone
- Bloquear liberación de pago si evidencia incompleta
- Generar AI evidence summary

**Límites (NO hace):**
- No libera pagos por sí solo (provee evidencia a Crowd)
- No organiza el proyecto (eso es BuildOps)
- No calcula costos

**Módulos internos:**
- Evidence Vault (almacenamiento estructurado)
- Photo Timeline (cronología visual)
- Receipt Scanner
- Contract Snapshot
- Change Order Log
- Dispute Packet Generator
- Proof-of-Work Checklist
- AI Evidence Summary

**Integra con:** BuildOps (bloquea milestones sin evidencia), Crowd (aprueba o retiene pagos según evidencia), Prometeo (provee data para explicaciones)

---

### 4. Prometeo Agent
**Rol:** Inteligencia explicativa y cognitiva — la voz visible del sistema.

**Responsabilidades:**
- Explicar estado del proyecto en lenguaje simple
- Interpretar riesgos y recomendar decisiones
- Enrutar preguntas al agente correcto
- Resumir proyectos para cliente y profesional
- Consultar RAG (documentos, specs, historial)
- Responder "¿por qué está bloqueado?", "¿qué falta?", "¿qué sigue?"
- Traducir eventos técnicos del FSM a lenguaje natural

**Límites (NO hace):**
- No ejecuta pagos directamente
- No crea ni modifica tareas (eso es BuildOps)
- No toma decisiones — recomienda y explica

**Módulos internos:**
- Natural Language Explainer
- Risk Interpreter
- Agent Router
- RAG Assistant (Nexus DB / vector store)
- Project Summary Engine
- Decision Advisor
- User Guidance Engine

**Integra con:** todos los agentes (es el único que habla directamente con el usuario)

---

### 5. Crowd Agent
**Rol:** Inteligencia financiera — pagos, escrow y liberación de fondos.

**Responsabilidades:**
- Crear estructura de escrow por proyecto (depósito + milestones + holdback)
- Procesar pagos (Stripe Connect)
- Liberar fondos cuando BuildOps + Evidence aprueban milestone
- Gestionar retenciones y holdbacks por riesgo
- Generar facturas
- Calcular y deducir comisiones SEMSE (0.75%)
- Manejar reembolsos y disputas financieras
- Mantener ledger auditable por proyecto

**Límites (NO hace):**
- No aprueba trabajos sin evidencia verificada
- No libera fondos sin confirmación del FSM (BuildOps + Evidence)
- No calcula presupuestos de materiales

**Módulos internos:**
- Escrow Engine (`escrow-engine.ts`)
- Milestone Payment Engine (`milestone-builder.ts`)
- Invoice Generator
- Refund Manager
- Commission Calculator (0.75% SEMSE fee)
- Payout Scheduler
- Payment Risk Monitor
- Financial Ledger (`PaymentTxn`, `PaymentAllocation`)

**Integra con:** Evidence (espera aprobación de evidencia), BuildOps (espera cierre de milestone), Stripe (ejecuta pagos reales), Plaid (verifica cuentas ACH)

---

### 6. Marketplace Agent
**Rol:** Inteligencia comercial — conecta demanda con oferta y escala el ecosistema.

**Responsabilidades:**
- Recibir y clasificar necesidades de clientes
- Matching cliente-profesional (por oficio, zona, reputación, disponibilidad)
- Ranking de profesionales
- Recomendar presupuesto de rango esperado
- Gestionar publicaciones, categorías y zonas geográficas
- Reviews y reputación
- Captación y routing de leads
- Expansión por industria y ciudad
- Activar los demás agentes al momento del match

**Límites (NO hace):**
- No gestiona la ejecución del proyecto después de asignado (eso es BuildOps)
- No calcula materiales ni costos detallados
- No maneja pagos ni disputas

**Módulos internos:**
- Service Catalog
- Contractor Matching Engine
- Lead Routing
- Reputation Engine
- Quote Comparison
- Availability Engine
- Geo-Market Expansion
- Category Intelligence

**Integra con:** ProTools (activa estimación técnica), BuildOps (activa plan de proyecto), Crowd (activa estructura de pago), Evidence (activa vault), Prometeo (notifica al usuario del match)

---

## Flujo Completo: De Publicación a Cierre

```
PASO 1 — Marketplace recibe necesidad
  Cliente: "Quiero remodelar mi baño"
  → Marketplace clasifica: tipo, categoría, riesgo, profesionales requeridos
  → Marketplace activa: ProTools + BuildOps + Crowd + Evidence

PASO 2 — ProTools calcula
  → Genera: materiales, herramientas, estimado de costo, tiempo, riesgos, checklist
  → Entrega resultado a: Marketplace (quote), BuildOps (plan técnico), Evidence (checklist)

PASO 3 — BuildOps organiza
  → Crea fases: inspección → cotización → contrato → materiales → demolición →
                instalación → revisión → cierre
  → Crea milestones con condiciones de cierre
  → Asigna responsables y fechas

PASO 4 — Crowd prepara escrow
  → Crea estructura: depósito 35% + milestone 1 (40%) + milestone 2 (25%) + holdback
  → Fondos en hold en Stripe hasta que FSM los libere

PASO 5 — Evidence protege
  → Exige fotos BEFORE firmadas
  → Exige contrato firmado (HelloSign)
  → Bloquea avance de BuildOps hasta tener evidencia requerida

PASO 6 — Prometeo explica en cada paso
  → Usuario: "¿Por qué no puedo liberar el pago?"
  → Prometeo: "BuildOps muestra milestone 2 completo pero Evidence
     necesita fotos finales del baño y checklist de plomería firmado."
```

---

## Comunicación Entre Agentes: Sistema de Eventos

### Eventos del Sistema
```typescript
type SemseAgentEvent =
  // Marketplace
  | 'PROJECT_PUBLISHED'
  | 'PROJECT_CLASSIFIED'
  | 'CONTRACTOR_MATCHED'
  | 'QUOTE_REQUESTED'

  // ProTools
  | 'ESTIMATE_REQUESTED'
  | 'MATERIALS_CALCULATED'
  | 'RISK_ASSESSED'
  | 'CHECKLIST_GENERATED'

  // BuildOps
  | 'PROJECT_PLANNED'
  | 'MILESTONE_CREATED'
  | 'TASK_ASSIGNED'
  | 'MILESTONE_COMPLETED'
  | 'DELAY_DETECTED'
  | 'PROJECT_CLOSED'

  // Evidence
  | 'EVIDENCE_UPLOADED'
  | 'EVIDENCE_VERIFIED'
  | 'EVIDENCE_INSUFFICIENT'
  | 'DISPUTE_PACKET_GENERATED'
  | 'CHANGE_ORDER_APPROVED'

  // Crowd
  | 'ESCROW_FUNDED'
  | 'PAYMENT_RELEASE_REQUESTED'
  | 'PAYMENT_RELEASED'
  | 'PAYMENT_HELD'
  | 'INVOICE_GENERATED'
  | 'REFUND_PROCESSED'

  // Prometeo
  | 'EXPLANATION_REQUESTED'
  | 'RISK_INTERPRETED'
  | 'GUIDANCE_PROVIDED'
  | 'AGENT_ROUTED'

  // System
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'PROJECT_COMPLETED'
```

### Reglas de Enrutamiento de Eventos
```
PROJECT_PUBLISHED       → Marketplace → ProTools, BuildOps, Crowd, Evidence
MILESTONE_COMPLETED     → BuildOps → Evidence (verificar) → Crowd (liberar si OK)
EVIDENCE_VERIFIED       → Evidence → Crowd (desbloquear pago)
EVIDENCE_INSUFFICIENT   → Evidence → BuildOps (bloquear milestone), Prometeo (notificar)
PAYMENT_RELEASED        → Crowd → BuildOps (siguiente fase), Prometeo (notificar usuario)
DELAY_DETECTED          → BuildOps → Prometeo (notificar), Crowd (actualizar timeline)
DISPUTE_OPENED          → Evidence (compilar paquete), Prometeo (explicar estado)
```

---

## Tipos TypeScript: Agent Definitions

```typescript
// packages/agents/src/semse-agents.types.ts

export type SemseAgentName =
  | 'marketplace'
  | 'buildops'
  | 'protools'
  | 'evidence'
  | 'crowd'
  | 'prometeo'

export interface SemseAgentDefinition {
  name: SemseAgentName
  displayName: string
  role: string
  capabilities: string[]
  forbiddenActions: string[]
  requiredInputs: string[]
  outputs: string[]
  integrates_with: SemseAgentName[]
  modules: string[]
}

export interface SemseAgentMessage {
  from: SemseAgentName
  to: SemseAgentName | 'broadcast'
  event: SemseAgentEvent
  payload: Record<string, unknown>
  projectId: string
  milestoneId?: string
  timestamp: Date
  correlationId: string
}

export interface SemseAgentContext {
  projectId: string
  tenantId: string
  userId: string
  role: 'client' | 'professional' | 'ops'
  activeAgents: SemseAgentName[]
  currentPhase: string
  currentMilestone?: string
}

export interface SemseAgentRunResult {
  agentName: SemseAgentName
  event: SemseAgentEvent
  success: boolean
  output: Record<string, unknown>
  nextEvents: SemseAgentEvent[]
  blockers: string[]
  explanation?: string  // para Prometeo
}
```

---

## Modelos Prisma Requeridos

```prisma
// Extensión de AgentRun existente con agent name tipado
model AgentRun {
  // campos existentes +
  agentName  String  // 'marketplace' | 'buildops' | 'protools' | 'evidence' | 'crowd' | 'prometeo'
  event      String  // SemseAgentEvent
  projectId  String?
  milestoneId String?
}

// Nuevo: registro de mensajes entre agentes
model AgentMessage {
  id            String   @id @default(cuid())
  tenantId      String
  fromAgent     String
  toAgent       String
  event         String
  payload       Json
  projectId     String?
  milestoneId   String?
  correlationId String
  processedAt   DateTime?
  createdAt     DateTime @default(now())

  @@index([projectId])
  @@index([correlationId])
  @@index([fromAgent, toAgent])
}

// Nuevo: estado activo de agentes por proyecto
model ProjectAgentState {
  id        String   @id @default(cuid())
  tenantId  String
  projectId String
  agentName String
  status    String   // 'idle' | 'active' | 'waiting' | 'blocked'
  context   Json?
  updatedAt DateTime @updatedAt

  @@unique([projectId, agentName])
}
```

---

## Endpoints API Requeridos

```
POST   /v1/agents/route               ← Prometeo: enrutar pregunta al agente correcto
GET    /v1/agents/project/:id/state   ← estado de todos los agentes en un proyecto
POST   /v1/agents/protools/estimate   ← ProTools: calcular estimado completo
POST   /v1/agents/buildops/plan       ← BuildOps: generar plan de proyecto
POST   /v1/agents/evidence/verify     ← Evidence: verificar completitud de evidencia
POST   /v1/agents/crowd/release       ← Crowd: solicitar liberación de pago
GET    /v1/agents/prometeo/explain    ← Prometeo: explicar estado actual
POST   /v1/agents/marketplace/match   ← Marketplace: matching cliente-profesional
```

---

## Componentes Frontend Requeridos

```
apps/web/components/agents/
├── AgentConsole.tsx          ← panel de estado de todos los agentes
├── AgentStatusCard.tsx       ← tarjeta individual de agente (activo/bloqueado/idle)
├── ProToolsWidget.tsx        ← calculadora técnica embebida
├── BuildOpsTimeline.tsx      ← timeline de fases y milestones
├── EvidenceVault.tsx         ← galería de evidencia por milestone
├── CrowdEscrowPanel.tsx      ← estado de escrow y pagos
├── PrometeoChat.tsx          ← chat con Prometeo (ya existe)
└── MarketplaceSearch.tsx     ← búsqueda y matching de profesionales
```

---

## Tests Requeridos

```
packages/agents/src/__tests__/
├── agent-routing.spec.ts          ← enrutamiento de eventos entre agentes
├── agent-boundaries.spec.ts       ← que cada agente respeta sus límites
├── protools-agent.spec.ts         ← estimación técnica end-to-end
├── buildops-agent.spec.ts         ← plan de proyecto + milestone management
├── evidence-agent.spec.ts         ← verificación de evidencia + bloqueo
├── crowd-agent.spec.ts            ← escrow + liberación de fondos
├── prometeo-agent.spec.ts         ← explicaciones + enrutamiento
└── marketplace-agent.spec.ts      ← matching + activación de agentes
```

---

## Roadmap de Implementación por Fases

### Fase 0 (Esta fase): Contratos y Tipos
- [ ] `packages/agents/src/semse-agents.types.ts` ← tipos base
- [ ] `packages/agents/src/agent-registry.ts` ← registro de los 6 agentes
- [ ] `packages/agents/src/agent-events.ts` ← sistema de eventos
- [ ] Nuevos modelos Prisma: `AgentMessage`, `ProjectAgentState`
- [ ] Tests de contratos (que los tipos son correctos)

### Fase 1: ProTools Agent (ya tiene engines, conectar al registro)
- [ ] `packages/agents/src/agents/protools.agent.ts`
- [ ] Conectar `packages/tools` → ProTools Agent
- [ ] Endpoint `POST /v1/agents/protools/estimate`

### Fase 2: BuildOps + Evidence (ya tienen módulos en API)
- [ ] `packages/agents/src/agents/buildops.agent.ts`
- [ ] `packages/agents/src/agents/evidence.agent.ts`
- [ ] Sistema de bloqueo Evidence → BuildOps

### Fase 3: Crowd Agent (conectar con Stripe)
- [ ] `packages/agents/src/agents/crowd.agent.ts`
- [ ] Integrar con Stripe Connect (Plan 1.3)
- [ ] Flujo: Evidence aprueba → Crowd libera

### Fase 4: Prometeo + Marketplace
- [ ] `packages/agents/src/agents/prometeo.agent.ts` (ya existe base)
- [ ] `packages/agents/src/agents/marketplace.agent.ts`
- [ ] Agent Console UI

### Fase 5: Orquestación completa
- [ ] Agent Router inteligente
- [ ] Flujo end-to-end: publicación → cierre → pago
- [ ] AgentMessage bus en BullMQ
