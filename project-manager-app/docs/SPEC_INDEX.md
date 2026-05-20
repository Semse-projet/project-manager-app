# SPEC_INDEX — Índice Canónico de Especificaciones SEMSE OS

**Versión:** 1.0 · **Fecha:** 2026-05-20
**Propósito:** Fuente de verdad sobre qué specs existen, cuál es su estado y qué falta.
**Regla de oro:** Ningún agente de IA genera código sin leer primero los specs `APPROVED` del dominio correspondiente.

---

## Cómo leer este índice

| Estado | Significado |
|--------|-------------|
| `APPROVED` | Spec vigente. Gobierna el código. No se viola sin ADR. |
| `DRAFT` | En revisión. Orienta pero no es contrato ejecutable aún. |
| `DEPRECATED` | Supersedado. No usar como referencia de decisión. |
| `MISSING` | Identificado como necesario. Aún no existe. Crear antes de codificar. |

---

## 1. Visión y Principios

> Leer antes de cualquier decisión de producto o arquitectura.

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md` | `APPROVED` | Visión integrada SEMSE + Prometeo. Documento rector principal. |
| `docs/vision/VISION_DECISIONS_LOCKED.md` | `APPROVED` | Decisiones inamovibles. No se discuten sin quórum de fundadores. |
| `docs/vision/VISION_PRINCIPLES_FOR_PRODUCT.md` | `APPROVED` | Principios que gobiernan cada decisión de producto. |
| `docs/vision/VISION_PILLARS.md` | `APPROVED` | Los 4 pilares estratégicos del ecosistema. |
| `docs/vision/VISION_SUCCESS_METRICS.md` | `APPROVED` | Métricas de éxito por fase. |
| `docs/vision/VISION_GLOSSARY.md` | `APPROVED` | Vocabulario canónico. Usar estos términos en código, docs y prompts. |
| `docs/vision/VISION_BOUNDARIES.md` | `APPROVED` | Qué NO es SEMSE. Límites del producto. |
| `docs/vision/VISION_EXECUTIVE_SUMMARY.md` | `APPROVED` | Resumen ejecutivo de 1 página. |
| `docs/vision/VISION_FOR_FOUNDERS.md` | `APPROVED` | Contexto estratégico para fundadores. |
| `docs/vision/VISION_NARRATIVE.md` | `APPROVED` | Historia de producto. Por qué existe SEMSE. |
| `docs/vision/VISION_FAQ.md` | `DRAFT` | Preguntas frecuentes sobre la visión. |
| `docs/vision/VISION_CHANGE_PROTOCOL.md` | `APPROVED` | Protocolo para proponer cambios a la visión. |
| `docs/vision/VISION_INDEX.md` | `APPROVED` | Índice interno del directorio /vision. |

---

## 2. Constitución del Sistema

> Estructura de autoridad, nodos canónicos y capas del sistema.

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/constitution/01_KERNEL.md` | `APPROVED` | Núcleo invariante del sistema. Lo que no cambia. |
| `docs/constitution/02_AUTHORITY_MAP.md` | `APPROVED` | Mapa de autoridad: quién decide qué. |
| `docs/constitution/03_NODE_REGISTRY.md` | `APPROVED` | Registro de nodos del ecosistema (apps, packages, servicios). |
| `docs/constitution/04_AGENTIC_LAYER.md` | `APPROVED` | Definición de la capa de agentes en la arquitectura. |
| `docs/constitution/05_DATA_ARCHITECTURE.md` | `APPROVED` | Arquitectura de datos canónica. Fuente de verdad de persistence. |
| `docs/constitution/06_EXECUTION_ROADMAP.md` | `DRAFT` | Roadmap de ejecución por fases. |
| `docs/constitution/07_SELF_IMPROVING_AGENTS.md` | `DRAFT` | Diseño de agentes auto-mejorables. Visión a largo plazo. |
| `docs/constitution/08_SPRINT_BACKLOG.md` | `DEPRECATED` | Backlog antiguo. Ver `docs/program/` para backlogs activos. |
| `docs/constitution/SEMSE_MARCO_MAESTRO_EXPANDIDO_2026-03-30.md` | `APPROVED` | Marco maestro expandido. Documento de síntesis de marzo 2026. |

---

## 3. Dominio (Fuente de Verdad del Modelo)

> Leer antes de modificar entidades, estados, eventos o permisos.

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/foundation/DOMAIN_MODEL.md` | `APPROVED` | Modelo de dominio completo. Entidades y relaciones. |
| `docs/foundation/DOMAIN_MODEL_MVP.md` | `APPROVED` | Modelo MVP: flujo canónico job→escrow→milestone→pago. |
| `docs/foundation/DOMAIN_INVARIANTS.md` | `APPROVED` | Invariantes de dominio que ningún endpoint puede violar. |
| `docs/foundation/DOMAIN_GLOSSARY.md` | `APPROVED` | Glosario técnico del dominio. Igual que VISION_GLOSSARY pero orientado a código. |
| `docs/foundation/STATE_MACHINES.md` | `APPROVED` | FSMs canónicas: Job, Milestone, Escrow, Dispute, Contract. |
| `docs/foundation/EVENT_CATALOG.md` | `APPROVED` | Catálogo de eventos del sistema. Todo cambio de estado produce evento. |
| `docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md` | `APPROVED` | Límites entre Escrow, Payments y Evidence. |
| `docs/foundation/JOB_VS_PROJECT_BOUNDARY.md` | `APPROVED` | Distinción Job (marketplace) vs Project (ejecución). |
| `docs/foundation/JOB_CENTRIC_TRANSITION_PLAN.md` | `DRAFT` | Plan de migración hacia Job-centric domain. |
| `docs/foundation/JOB_PROJECT_TRANSITION_PLAN.md` | `DRAFT` | Transición técnica Job↔Project. |
| `docs/foundation/API_BOUNDARIES.md` | `APPROVED` | Qué puede y no puede hacer cada módulo de API. |
| `docs/foundation/API_MODULE_MAP.md` | `APPROVED` | Mapa módulo→controlador→rutas. |
| `docs/foundation/TRUST_SIGNAL_MODEL.md` | `APPROVED` | Modelo de confianza y señales de riesgo. |
| `docs/foundation/PROJECTS_ACCESS_POLICY.md` | `APPROVED` | Política de acceso a proyectos por rol. |
| `docs/foundation/RESERVATIONS_CONTRACTS_BLUEPRINT.md` | `APPROVED` | Blueprint de reservations y contratos. |
| `docs/foundation/RESERVATIONS_CONTRACTS_POLICY.md` | `APPROVED` | Políticas de negocio para reservations. |
| `docs/foundation/SEMSE_DEVELOPER_RUNTIME_SPEC.md` | `APPROVED` | Spec del runtime de desarrollo. |
| `docs/foundation/SEMSE_DEVELOPER_RUNTIME_PRD.md` | `DRAFT` | PRD del Developer Runtime. |
| `docs/foundation/SCHEMA_RUNTIME_ALIGNMENT.md` | `APPROVED` | Alineación schema Prisma ↔ runtime. |
| `docs/foundation/IMPLEMENTATION_GAPS_VS_VISION.md` | `DRAFT` | Gaps entre implementación actual y visión. Leer antes de planificar. |
| `docs/foundation/LAUNCH_CORE.md` | `APPROVED` | Criterios mínimos de lanzamiento. |

---

## 4. Arquitectura Técnica

> Decisiones de arquitectura vigentes.

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/architecture/SEMSE_API_SURFACE_V1.md` | `APPROVED` | Superficie completa de endpoints REST v1. Lista de rutas. |
| `docs/architecture/SEMSEPROJECT_BLUEPRINT.md` | `APPROVED` | Blueprint maestro del monorepo. Stack, estructura, decisiones. |
| `docs/architecture/SEMSE_ASSISTANT_CONTEXT_LAYER.md` | `APPROVED` | Capa de contexto para asistentes IA. |
| `docs/architecture/SEMSE_IMPLEMENTATION_BACKLOG.md` | `DRAFT` | Backlog de implementación técnica pendiente. |
| `docs/frontend/FRONTEND_ARCHITECTURE.md` | `APPROVED` | Arquitectura del frontend Next.js. |
| `docs/auth.md` | `APPROVED` | Spec de autenticación: JWT, sesiones, middleware. |
| `docs/security/SECURITY_BASELINE.md` | `APPROVED` | Baseline de seguridad. RBAC, headers, secretos. |
| `docs/SOURCE_OF_TRUTH.md` | `APPROVED` | Mapa de fuentes de verdad por capa. Leer primero en cualquier sesión. |
| `docs/ai-orchestration.md` | `APPROVED` | Orquestación de LLMs: providers, routing, fallback. |

---

## 5. Sistema de Agentes

> Contratos del sistema multi-agente de SEMSE.

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/agents/README.md` | `APPROVED` | Índice del sistema de agentes. |
| `docs/agents/agent-persona-registry.md` | `APPROVED` | Registro de agentes: nombre, rol, permisos. |
| `docs/agents/SEMSE_AGENT_ROUTING.md` | `APPROVED` | Routing de agentes por dominio y trigger. |
| `docs/agents/PROMETEO_OPERATIONAL_CONTEXT.md` | `APPROVED` | Contexto operativo de Prometeo Engine. |
| `docs/agents/foundations/anatomy-domain.md` | `APPROVED` | Anatomía del dominio de agentes. |
| `docs/agents/foundations/fundamentos-agentes-semse_2026-04-05.md` | `APPROVED` | Fundamentos del sistema de agentes. |
| `docs/agents/harnesses/diseno_formal_agent_harness_semse_2026-04-05.md` | `APPROVED` | Diseño formal del harness de agentes. |
| `docs/agents/harnesses/contrato_tecnico_dispute_harness_semse_2026-04-05.md` | `APPROVED` | Contrato técnico: Dispute Agent. |
| `docs/agents/harnesses/contrato_tecnico_payments_harness_semse_2026-04-05.md` | `APPROVED` | Contrato técnico: Payments Agent. |
| `docs/agents/harnesses/contrato_tecnico_project_copilot_harness_semse_2026-04-05.md` | `APPROVED` | Contrato técnico: Project Copilot. |
| `docs/agents/memory/diseno_formal_agent_memory_service_semse_2026-04-05.md` | `APPROVED` | Diseño del servicio de memoria de agentes. |
| `docs/agents/logic/anatomy-reasoning-rules.md` | `APPROVED` | Reglas de razonamiento por agente. |
| `docs/agents/logic/diseno_plan_mode_payments_disputes_semse_2026-04-05.md` | `APPROVED` | Plan mode para Payments y Disputes. |
| `docs/agents/context/contexto-de-agentes-semse_2026-04-05.md` | `APPROVED` | Contexto operativo de agentes. |
| `docs/agents/cycles/ciclos-operativos-agentes-semse_2026-04-05.md` | `APPROVED` | Ciclos operativos: polling, trigger, respuesta. |

---

## 6. Programa y Ejecución

> Estado del roadmap, backlogs activos y plan de entrega.

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/program/MASTERPLAN.md` | `APPROVED` | Plan maestro. Prioridades y fases de entrega. |
| `docs/program/ROADMAP_12_MESES.md` | `APPROVED` | Roadmap a 12 meses por fase. |
| `docs/program/ARCHITECTURE_TARGET.md` | `APPROVED` | Arquitectura objetivo final. |
| `docs/program/strategy/phases/PHASE_01_MVP.md` | `APPROVED` | Definición de la Fase 1 / MVP. |
| `docs/program/execution/SEMSE_FASTLANE_PLAN.md` | `APPROVED` | Plan fastlane: qué se entrega primero y por qué. |
| `docs/program/execution/SEMSE_AI_EXECUTION_BACKLOG.md` | `DRAFT` | Backlog de features IA por implementar. |
| `docs/program/architecture/SEMSE_MODULE_MAP.md` | `APPROVED` | Mapa de módulos del sistema. |
| `docs/program/architecture/SEMSE_ROLE_MODEL.md` | `APPROVED` | Modelo de roles: client, pro, ops_admin, platform. |
| `docs/program/architecture/SEMSE_TOOLKIT_MATRIX.md` | `APPROVED` | Matriz de herramientas por rol. |
| `docs/program/governance/SEMSE_PERMISSION_MATRIX.md` | `APPROVED` | Matriz de permisos por rol y recurso. |
| `docs/program/architecture/SEMSE_AI_EVENT_FLOW.md` | `APPROVED` | Flujo de eventos IA: trigger→agente→acción→audit. |

---

## 7. Operaciones y Runbooks

> Procedimientos operativos. No son spec de producto.

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/runbooks/LOCAL_BOOTSTRAP.md` | `APPROVED` | Setup local: DB, env, seed, arranque. |
| `docs/runbooks/LOCAL_LLM_OLLAMA.md` | `APPROVED` | Arranque Ollama local para desarrollo. |
| `docs/runbooks/DEMO_OPERATOR_PACK.md` | `APPROVED` | Pack para demos: script, escenarios, checklist. |
| `docs/runbooks/DEMO_SCRIPT_5_MIN.md` | `APPROVED` | Script demo 5 min. |
| `docs/runbooks/DEMO_READINESS.md` | `APPROVED` | Checklist de demo-readiness. |
| `docs/runbooks/AGENTS_SMOKE_TEST.md` | `APPROVED` | Smoke test del sistema de agentes. |
| `docs/runbooks/API_INTEGRATION_TEST.md` | `APPROVED` | Test de integración del API. |
| `docs/bcp/BCP_OVERVIEW.md` | `APPROVED` | Business Continuity Plan overview. |
| `docs/bcp/OPERACION_ASISTIDA_BACKUP_RECOVERY_RUNBOOK.md` | `APPROVED` | Runbook de backup y recovery. |

---

## 8. Gobernanza Documental

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docs/_governance/protocol/AGENT_PROTOCOL.md` | `APPROVED` | Protocolo de comunicación entre agentes y Claude. |
| `docs/_governance/status/ECOSYSTEM_STATUS.md` | `APPROVED` | Estado actual del ecosistema. Actualizar por sesión. |
| `docs/_governance/distillation/DISTILLATION_LOG.md` | `APPROVED` | Log de destilación de conocimiento entre sesiones. |

---

## 9. Reportes Históricos

> No son specs. Son evidencia de decisiones pasadas.
> Consultar solo para entender contexto histórico, no para decidir arquitectura.

Los reportes en `docs/reportes/` (220+ archivos) son artefactos de sesiones anteriores.
No representan el estado actual del sistema.
**No leer como fuente de verdad.** Para el estado actual, consultar las secciones 1-8 de este índice.

Reportes notables para contexto:
- `docs/reportes/monetizable_cycle_e2e_smoke_2026-05-17.md` — Validación del ciclo monetizable
- `docs/reportes/prometeo_rag_phase_4_agents_2026-05-18.md` — RAG Fase 4
- `docs/reportes/trade_knowledge_library_v2_2026-05-19.md` — Trade Knowledge Library

---

## 10. GAPS — Specs que faltan (MISSING)

> Estos son los contratos que el SDD requiere y aún no existen.
> **Ningún feature nuevo en estos dominios sin escribir el spec primero.**

### Contratos de API (Nivel 3 SDD)

| Spec a crear | Dominio | Prioridad |
|-------------|---------|-----------|
| `docs/specs/api/jobs.spec.md` | Jobs/Marketplace | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/api/milestones.spec.md` | Work Management | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/api/evidence.spec.md` | Evidence Center | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/api/payments.spec.md` | Escrow/Payments | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/api/contracts.spec.md` | Contratos | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/api/disputes.spec.md` | Disputas | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/api/intake.spec.md` | Smart Intake | 🟡 P2 |
| `docs/specs/api/buildops.spec.md` | BuildOps | 🟡 P2 |
| `docs/specs/api/prometeo.spec.md` | Prometeo/RAG | 🟢 P3 |
| `docs/specs/api/consciousness.spec.md` | Consciousness/Observer | 🟢 P3 |
| `docs/specs/api/communications.spec.md` | Communications/WhatsApp | 🟢 P3 |

Formato de cada spec de API:
```
Método + ruta · Input schema (Zod) · Output schema · Errores posibles
Rol requerido · Efectos (eventos, audit, notificaciones) · Transición FSM
```

### Contratos de FSM (Nivel 2 SDD — incompleto)

| Spec a crear | Estado actual |
|-------------|---------------|
| `docs/specs/fsm/job-lifecycle.spec.md` | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/fsm/milestone-lifecycle.spec.md` | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/fsm/escrow-lifecycle.spec.md` | ✅ `APPROVED` — 2026-05-20 |
| `docs/specs/fsm/buildops-lifecycle.spec.md` | 🟡 MISSING |

### Contratos de UI (Nivel 4 SDD)

| Spec a crear | Descripción |
|-------------|-------------|
| `docs/specs/ui/client-flows.spec.md` | Flujos del cliente: post job → milestone approval |
| `docs/specs/ui/pro-flows.spec.md` | Flujos del contratista: bid → evidencia → cobro |
| `docs/specs/ui/admin-flows.spec.md` | Flujos de ops: review → dispute → release |
| `docs/specs/ui/intake-flow.spec.md` | Flujo Smart Intake anónimo |

### Mapa de integración

| Spec a crear | Descripción |
|-------------|-------------|
| `docs/specs/integration-map.md` | Cómo `web-assistant-portal` ↔ `project-manager-app` API se comunican |
| `docs/specs/data-schema.spec.md` | Schema Prisma como spec versionada (complementa `schema.prisma`) |

---

## Protocolo SDD — Reglas operativas para agentes IA

Antes de generar cualquier código nuevo:

1. **¿Existe el spec del feature?** → Si no, crear en `docs/specs/` primero
2. **¿El spec está en APPROVED?** → Si es DRAFT, confirmarlo con el humano
3. **¿El spec referencia un FSM?** → Verificar `STATE_MACHINES.md` antes de implementar transiciones
4. **¿El endpoint existe en `SEMSE_API_SURFACE_V1.md`?** → Si no está, agregar antes de implementar
5. **¿El test cubre el contrato del spec?** → El test es el spec ejecutable
6. **Después de implementar** → Actualizar `_governance/status/ECOSYSTEM_STATUS.md`

---

## Navegación rápida por dominio

| Quiero codificar... | Leer primero |
|--------------------|-------------|
| Un endpoint nuevo | `SOURCE_OF_TRUTH.md` → `API_BOUNDARIES.md` → `DOMAIN_INVARIANTS.md` → spec del dominio |
| Un cambio de estado | `STATE_MACHINES.md` → `EVENT_CATALOG.md` → `DOMAIN_INVARIANTS.md` |
| Un agente nuevo | `agent-persona-registry.md` → `SEMSE_AGENT_ROUTING.md` → harness del dominio |
| Un flujo de UI | `SEMSE_ROLE_MODEL.md` → `SEMSE_PERMISSION_MATRIX.md` → ui-flow spec del rol |
| Payments/Escrow | `ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md` → `STATE_MACHINES.md` → `payments.spec.md` (MISSING) |
| Cualquier cosa | `VISION_DECISIONS_LOCKED.md` → `DOMAIN_INVARIANTS.md` → este índice |
