# DISTILLATION QUEUE — Pendientes de Destilar

> Qué se puede extraer de los satellites y cuándo hacerlo.
> Actualizar cada vez que se identifica nuevo valor rescatable o se ejecuta una destilación.

---

## REGLAS DE DESTILACIÓN

1. **No destilar sin documentación lista.** Primero documenta qué vas a copiar y por qué.
2. **Destilar en el sprint correcto.** La columna "Sprint objetivo" indica cuándo tiene sentido.
3. **Siempre verificar build + smokes después.** Si algo se rompe, ir a DISTILLATION_LOG.md.
4. **Si la destilación compila limpio** → mover el ítem a DISTILLATION_LOG.md como completado.
5. **Al terminar de destilar un satellite** → analizar residuos → actualizar su STATUS.md.

---

## QUEUE ACTIVA

### 🟠 PRIORIDAD MEDIA — Sprint 2.5

**Origen:** `web-assistant-portal`
**Qué destilar:** Field Ops UI completa
**Destino canónico:** `apps/web/src/app/field-ops/`
**Archivos clave:**
- `client/src/pages/SemseUnitsPage.tsx`
- `client/src/pages/SemseUnitDetailPage.tsx`
- `client/src/pages/SemseWorklogNewPage.tsx`
- `client/src/pages/SemseKnowledgePage.tsx`
**Por qué vale la pena:** Es la ÚNICA interfaz de usuario funcional para Field Ops en el ecosistema.
**Consideración:** Los componentes usan tRPC + MySQL local. Al migrar deben consumir REST API del core (`/v1/field-ops/*`).
**Estado:** ⏳ PENDIENTE — esperar Sprint 2.5

---

### 🟠 PRIORIDAD MEDIA — Sprint 2.3–2.5

**Origen:** `web-assistant-portal`
**Qué destilar:** AI Assistant + AIChatBox component
**Destino canónico:** `apps/web/src/app/cortex/`
**Archivos clave:**
- `client/src/components/AIChatBox.tsx`
- `client/src/pages/AIAssistantPage.tsx`
**Por qué vale la pena:** El core tiene `cortex/` como módulo pero sin UI de chat implementada.
**Estado:** ⏳ PENDIENTE — evaluar en Sprint 2.3

---

### 🟡 PRIORIDAD BAJA — Sprint 2.3

**Origen:** `web-assistant-portal`
**Qué destilar:** Documentación estratégica (30+ archivos en `docs/`)
**Destino canónico:** `labsemse/program/` o `labsemse/vision/`
**Archivos clave:**
- `docs/ADR-001-F1-Smart-Contracting.md`
- `docs/ADR-002-F2-Ejecucion-Asistida.md`
- `docs/entregable_estrategico/`
- `docs/recomendaciones_estrategicas.md`
**Por qué vale la pena:** ADRs y análisis estratégicos con IP institucional valiosa.
**Estado:** ⏳ PENDIENTE

---

### 🟡 PRIORIDAD BAJA — Sprint 2.2–2.3

**Origen:** `semse-control-mvp`
**Qué destilar:** Patrones de worklog, evidence flow, milestone ops
**Destino canónico:** `apps/api/src/modules/milestones/` + `apps/api/src/modules/evidence/`
**Por qué vale la pena:** MVP congelado tenía lógica madura de estados de milestones y flujo de evidencia.
**Estado:** ⏳ PENDIENTE — revisar al atacar Sprint 2.2

---

### 🔵 REFERENCIA SOLO — Sprint 4.x (post-MVP producción)

**Origen:** `Agent_Semse App Maximizada`
**Qué destilar:** Patrones de infra K8s, decisiones de arquitectura
**Destino canónico:** `labsemse/program/architecture/`
**sprint_target:** 4.x
**Estado:** ⏳ REFERENCIA — cuando se planifique infra de producción (Fase 4+)

---

---

## INSIGHTS EXTERNOS — Source Code Claude Code (2026-04-02)

> Destilación completa en: `_governance/DISTILLATION_CLAUDE_CODE_INSIGHTS.md`
> Fuente: Source code interno de Claude Code (Anthropic, filtrado 2026-03-31)

---

### 🔴 PRIORIDAD ALTA — Sprint 2.3 (adelantable, zero-dependency)

**Insight:** ActionRiskClassifier — Risk classification LOW/MEDIUM/HIGH para acciones de agentes
**Fuente:** Permission system avanzado de Claude Code
**Qué construir:** Clasificador estático (`agentType + actionType → risk level`). Integrar en `AgentsService.startAgentRun()`.
**Archivos destino:** `apps/api/src/infrastructure/policy/action-risk-classifier.ts`
**Dependencias:** PolicyService (ya existe desde Sprint 2.2) — puede hacerse YA
**Estado:** ⏳ PENDIENTE — recomendado adelantar a Sprint 2.3

---

### 🟠 PRIORIDAD MEDIA — Sprint 2.4

**Insight:** FeatureFlag model + FeatureFlagsService — activación controlada de agentes por tenant
**Fuente:** Feature gating system de Claude Code (GrowthBook pattern)
**Qué construir:** Modelo Prisma `FeatureFlag` + servicio con cache Redis (TTL 60s). Gate en `AgentsService`.
**Archivos destino:** `packages/db/prisma/schema.prisma` + `apps/api/src/infrastructure/feature-flags/`
**Dependencias:** Redis (TICKET 2.4.1)
**Estado:** ⏳ PENDIENTE — Sprint 2.4

---

### 🟠 PRIORIDAD MEDIA — Sprint 2.4

**Insight:** ProactiveAgentScheduler — tick cada 15 min para detección proactiva de anomalías
**Fuente:** KAIROS (always-on Claude, tick prompts)
**Qué construir:** BullMQ repeatable job. 4 chequeos: escrow_anomaly, milestone_overdue, evidence_reminder, dispute_stale. Budget 10s. Solo crea notificaciones.
**Archivos destino:** `apps/worker/src/processors/proactive-scheduler.processor.ts`
**Dependencias:** BullMQ (TICKET 2.4.2) + NotificationService (TICKET 2.4.4)
**Estado:** ⏳ PENDIENTE — Sprint 2.4 (último ticket del sprint)

---

### 🟠 PRIORIDAD MEDIA — Sprint 2.4–3.0 (preparación anticipada)

**Insight:** AgentPromptRegistry — sistema de prompts modular con secciones cacheable/volatile
**Fuente:** Sistema de prompts modular con SYSTEM_PROMPT_DYNAMIC_BOUNDARY
**Qué construir:** Registry de secciones con boundary estático/dinámico, cache key, composición lazy.
**Archivos destino:** `packages/agents/src/prompt-registry.ts`
**Dependencias:** Ninguna — puede construirse antes del LLM real
**Estado:** ⏳ PENDIENTE — puede adelantarse a Sprint 2.4 como preparación para Sprint 3.0

---

### 🟡 PRIORIDAD BAJA — Sprint 3.0

**Insight:** AgentMemoryConsolidator — consolidación de memoria de agentes con 3 gates y 4 fases
**Fuente:** autoDream (motor de consolidación de memoria de Claude Code)
**Qué construir:** BullMQ job con gates (tiempo 24h / volumen 20 runs / degradación confidence<0.6). Fases: Orient → Gather Signal → Consolidate → Prune/Index. Límites: 50 records/agente, 10KB/record.
**Archivos destino:** `apps/worker/src/processors/consolidation.processor.ts`
**Dependencias:** AgentMemory model + pgvector + BullMQ
**Estado:** ⏳ PENDIENTE — no antes de Sprint 3.0

---

## ITEMS COMPLETADOS → Ver DISTILLATION_LOG.md
