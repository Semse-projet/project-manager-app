---
id: api-consciousness-observer
title: "Consciousness and Observer API"
type: spec
feature: "Consciousness & Observer — Espejo Interno del Ecosistema"
domain: "ops"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: medium
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/ops
  - packages/schemas/src/ops.schema.ts
  - apps/web/app/(app)/admin
related_tests:
  - apps/api/test/semse-consciousness.test.ts
  - apps/api/test/semse-observer.test.ts
  - apps/api/test/ecosystem-metrics.test.ts
related_endpoints:
  - v1/ops
related_events:
  - agents:system
related_agents:
  - mission-control
last_verified: 2026-06-09
---

# Spec: Consciousness & Observer

> El Consciousness Index es el espejo interno de SEMSE OS:
> reporta el estado de madurez del sistema (0-100) y qué módulos están activos.
> El Observer captura señales del ecosistema en tiempo real.
> Basado en `apps/api/src/modules/ops/ops.controller.ts` (consciousness + observer).

---

## 1. Qué resuelve

Permite a OPS_ADMIN y al sistema observar la salud interna del ecosistema:
qué agentes están activos, qué módulos tienen RAG, SSE, audit habilitado,
y un índice de madurez global que evoluciona con cada nuevo feature.

**privacyCritical:** `false` — datos de salud del sistema, no de usuarios.

---

## 2. Actores y Permisos

Todos los endpoints de Consciousness y Observer son de `ops:dashboard:read/write`.
No requieren tenant específico — son métricas de plataforma.

---

## 3. Contratos de API

### `GET /v1/ops/consciousness/index`
```yaml
output:
  - maturityScore: number (0-100) — índice de madurez del sistema
  - autonomyLevel: number (1-5) — nivel de autonomía actual
  - modules: ModuleStatus[] — estado de cada módulo
    - name, hasBackend, hasFrontend, hasTests, hasSSE, hasRAG, hasAudit
  - observedAt: string (ISO)
```

### `POST /v1/ops/consciousness/query`
```yaml
input: { question: string — pregunta sobre el estado del sistema }
output:
  - answer: string — respuesta sobre el ecosistema
  - maturityScore: number
  - autonomyLevel: number
privacyCritical: false
```

### `GET /v1/ops/observer/snapshot`
```yaml
output: ObserverSnapshot
  - tenantId: string
  - activeJobs: number
  - activeProjects: number
  - pendingMilestones: number
  - openDisputes: number
  - recentAgentRuns: AgentSignal[]
  - systemHealth: "healthy" | "degraded" | "critical"
  - observedAt: string (ISO)
```

### `GET /v1/ops/observer/latest`
```yaml
output: ObserverSnapshot más reciente (de caché si existe)
```

### `GET /v1/ops/observer/history`
```yaml
output: array de ObserverSnapshot históricos
```

---

## 4. Tests Requeridos

```typescript
describe("GET /v1/ops/consciousness/index") {
  it("retorna maturityScore entre 0 y 100")
  it("retorna autonomyLevel entre 1 y 5")
  it("retorna modules array con al menos un módulo")
  it("rechaza con 403 sin ops:dashboard:read")
}
describe("GET /v1/ops/observer/snapshot") {
  it("retorna snapshot con activeJobs >= 0")
  it("incluye systemHealth en healthy|degraded|critical")
}
```

---

## 5. Invariantes

- `maturityScore` es calculado — no hardcodeado. Evoluciona al activar módulos.
- `autonomyLevel` es el nivel actual de toma de decisiones autónomas del sistema.
- El Observer es la **única fuente de percepción** del Consciousness — no usa DB directamente.
- Frecuencia de observación: cada request a `/observer/snapshot` toma una nueva foto.
