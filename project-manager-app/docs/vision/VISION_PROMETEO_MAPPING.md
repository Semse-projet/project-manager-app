# Mapeo Visión Prometeo ↔ SEMSE Construido

> Documento vivo. Fecha: 2026-05-25.
> Compara los componentes de la visión civilizatoria de Prometeo contra el estado real del monorepo.

---

## Leyenda de estado

| Estado | Significado |
|--------|-------------|
| ✅ LIVE | Implementado, testeado, en Railway |
| 🟡 NASCENT | Existe en código, funcional pero incompleto respecto a la visión |
| 📋 DEFINIDO | Documentado en constitución/vision como destino, sin código aún |
| ❌ NO EXISTE | No está ni documentado ni codificado en SEMSE |

---

## 1. Identidad Soberana

**Visión:** DID (W3C), wallet autocustodiado, identidad que el usuario controla sin depender de SEMSE como custodio central.

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| Auth con tenantId + roles | ✅ LIVE | `apps/api/src/modules/auth/auth.service.ts` |
| Session signing (SEMSE Signed Token) | ✅ LIVE | `packages/auth/src/` |
| DID W3C autosoberana | ❌ NO EXISTE | — |
| Wallet autocustodiado | ❌ NO EXISTE | — |
| Criptografía post-cuántica (Dilithium) | ❌ NO EXISTE | — |

**Gap:** SEMSE tiene autenticación centralizada por tenant. La identidad soberana real (DID + wallet) es Capa 4 / Prometeo.

---

## 2. Gobernanza DAO

**Visión:** DAO con votación cuadrática, treasury, ejecución automática de propuestas, jurisdicciones locales, constitución inmutable.

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| Constitución documentada | ✅ LIVE | `docs/constitution/01_KERNEL.md` → `08_SPRINT_BACKLOG.md` |
| Payment governance (escrow + hitos) | ✅ LIVE | `apps/api/src/modules/payments/payment-governance.service.ts` |
| Escrow release con reglas | ✅ LIVE | `apps/api/src/modules/payments/escrow-release.service.ts` |
| DAO on-chain (votación cuadrática) | ❌ NO EXISTE | Definida en constitución como Capa 4 |
| ZKP (zk-SNARKs, commit-reveal) | ❌ NO EXISTE | — |
| Token de gobernanza (PROM) | ❌ NO EXISTE | — |
| Treasury DAO | ❌ NO EXISTE | — |
| Sub-DAOs / jurisdicciones locales | 📋 DEFINIDO | Multi-tenant existe, governance nodes no |

**Gap:** La gobernanza de pagos por hitos (escrow) es análoga a la idea de "treasury + ejecución automática" pero a escala de trabajo individual, no DAO global.

---

## 3. IA Mediadora (MCA — Motor de Conciencia Algorítmica)

**Visión:** IA que supervisa la gobernanza, audita propuestas, detecta colusión, propone mediación, emite informes XAI. No gobierna — supervisa.

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| ConsciousnessIndexService | ✅ LIVE | `apps/api/src/modules/ops/consciousness.service.ts` |
| SystemObserverService | ✅ LIVE | `apps/api/src/modules/ops/observer.service.ts` |
| EvolutionEngineService (señales + prioridades) | ✅ LIVE | `apps/api/src/modules/ops/evolution-engine.service.ts` |
| RecommendationEngineService | ✅ LIVE | `apps/api/src/modules/ops/recommendation-engine.service.ts` |
| SimulationEngineService (patches con guardrails) | ✅ LIVE | `apps/api/src/modules/ops/simulation-engine.service.ts` |
| ObserverPanel en /admin | ✅ LIVE | `apps/web/app/admin/` (ObserverPanel) |
| XAI (explicabilidad de decisiones) | 🟡 NASCENT | Logs existen, formato XAI formal no |
| Detección de colusión / captura de poder | ❌ NO EXISTE | — |
| Mediación algorítmica entre partes externas | ❌ NO EXISTE | — |

**Análogo fuerte:** `ConsciousnessIndexService` + `EvolutionEngineService` + `SimulationEngineService` es exactamente el MCA interno — el sistema se observa a sí mismo, detecta gaps, propone evolución, simula patches. El salto pendiente es aplicar esto a gobernanza *externa* (usuarios, DAOs, jurisdicciones).

---

## 4. Reputación Verificable

**Visión:** Reputación basada en contribución real, no seguidores. No comprable, con decadencia temporal. VCS (Valor de Contribución Sistémica).

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| Trust scoring por job/proyecto | ✅ LIVE | `apps/api/src/modules/trust/trust.service.ts` |
| Trust policy engine | ✅ LIVE | `apps/api/src/modules/trust/trust.policy.ts` |
| Ratings module | ✅ LIVE | `apps/api/src/modules/ratings/` |
| Risk scoring | ✅ LIVE | `apps/api/src/modules/intelligence/risk-scoring.service.ts` |
| Behavioral reputation (evidencia real) | ✅ LIVE | Evidence + milestones alimentan trust |
| VCS (contribución sistémica, no solo trabajo) | ❌ NO EXISTE | — |
| Decadencia temporal del trust | ❌ NO EXISTE | — |
| Portabilidad / on-chain de reputación | ❌ NO EXISTE | — |

**Gap principal:** El trust score de SEMSE está correctamente construido sobre comportamiento real. Falta: que sea portable (no atrapado en SEMSE), que tenga decadencia, y que cubra contribuciones más allá del trabajo (VCS).

---

## 5. Economía de Incentivos

**Visión:** Token no especulativo ligado a participación/contribución. RBU dinámico. Mercados internos. Competencia meritocrática sin plutocracia.

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| Escrow por hitos (fondo controlado) | ✅ LIVE | `apps/api/src/modules/payments/escrow-release.service.ts` |
| Finance hub (facturas, gastos, margen) | ✅ LIVE | `apps/api/src/modules/finance/` |
| Stripe Connect (pagos reales) | ✅ LIVE | `apps/api/src/modules/payments/stripe-connect.service.ts` |
| Pricing engine | ✅ LIVE | `apps/api/src/modules/pricing/` |
| Token de gobernanza / economía interna | ❌ NO EXISTE | — |
| RBU dinámico | ❌ NO EXISTE | — |
| Anti-plutocracia en votación | ❌ NO EXISTE | — |

---

## 6. Agentes Autónomos

**Visión:** Agentes especializados que coordinan, ejecutan tareas complejas, aprenden, crean sub-agentes. Workforce digital.

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| PrometeoAgent, BuildOpsAgent, EvidenceAgent | ✅ LIVE | `apps/api/src/modules/semse-agents/` |
| MarketplaceAgent, CrowdAgent, ProToolsAgent | ✅ LIVE | `apps/api/src/modules/semse-agents/` |
| AgentWorkPlanService (plan mode) | ✅ LIVE | `apps/api/src/modules/agents/agent-work-plan.service.ts` |
| AgentDelegationService | ✅ LIVE | `apps/api/src/modules/agents/agent-delegation.service.ts` |
| CoordinatorService (orquestador) | ✅ LIVE | `apps/api/src/modules/agents/coordinator.service.ts` |
| AgentMemoryService (con decay) | ✅ LIVE | `apps/api/src/modules/knowledge/agent-memory.service.ts` |
| SkillLoader + SkillMatcher | ✅ LIVE | `apps/api/src/modules/skills/` |
| Human-in-the-loop (aprobación de planes) | ✅ LIVE | `agent-approval.service.ts`, plan approval UI |
| Agentes que crean sub-agentes | ❌ NO EXISTE | — |
| Agentes multi-nodo (distribuidos) | ❌ NO EXISTE | — |

**Estado más avanzado del roadmap:** La arquitectura de agentes de SEMSE ya implementa la mayoría de la capa de "agentes autónomos especializados" de la visión. Es el módulo más maduro.

---

## 7. Global Brain / Inteligencia Colectiva

**Visión:** Red de mentes IA conectadas. Optimización global de recursos. Predicción de crisis. Coordinación multi-nodo.

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| ConsciousnessIndex (espejo interno) | ✅ LIVE | `apps/api/src/modules/ops/consciousness.service.ts` |
| OperationalSignalsService | ✅ LIVE | `apps/api/src/modules/operational-intelligence/` |
| EcosystemMetricsService | ✅ LIVE | `apps/api/src/modules/ops/ecosystem-metrics.service.ts` |
| DigitalTwinService (gemelo de proyecto) | ✅ LIVE | `apps/api/src/modules/intelligence/digital-twin.service.ts` |
| Ecosystem5DService | ✅ LIVE | `apps/api/src/modules/intelligence/ecosystem-5d.service.ts` |
| BuildOpsIntelligenceAgent + RAG | ✅ LIVE | `apps/api/src/modules/operational-intelligence/buildops-intelligence.agent.ts` |
| Trade Knowledge Library (RAG híbrido) | ✅ LIVE | `apps/api/src/modules/knowledge/` + `apps/api/skills/` |
| Human Feedback Loop (score boost) | ✅ LIVE | Phase 5 completada |
| Coordinación multi-tenant real | 🟡 NASCENT | tenantId existe, sincronización inter-tenant no |
| Predicción de crisis sistémicas | 🟡 NASCENT | SimulationEngine cubre esto a nivel de código, no de economía |

---

## 8. Infraestructura

**Visión:** Cloud distribuido, edge nodes, red fotónica, criptografía post-cuántica, quantum-ready.

| Componente | Estado | Dónde vive en SEMSE |
|------------|--------|---------------------|
| Railway deploy (API + Worker + Web) | ✅ LIVE | `infra/railway/` |
| BullMQ workers | ✅ LIVE | `apps/worker/src/` |
| SSE real-time | ✅ LIVE | `apps/api/src/infrastructure/sse/` |
| Storage (evidencia) | ✅ LIVE | `apps/api/src/infrastructure/storage/` |
| Multi-provider LLM (Anthropic, OpenAI, Ollama) | ✅ LIVE | `apps/api/src/infrastructure/llm/` |
| Edge nodes distribuidos | ❌ NO EXISTE | — |
| Red fotónica / QKD | ❌ NO EXISTE | — |
| Post-quantum crypto | ❌ NO EXISTE | — |

---

## Resumen ejecutivo

### Lo que SEMSE ya es respecto a la visión

```
SEMSE hoy = Fases 0-1 del roadmap Prometeo

✅ MVP funcional con gobernanza de pagos por hitos (escrow)
✅ Reputación basada en comportamiento real (trust score)
✅ Agentes autónomos especializados con memory, plan mode, delegation
✅ Espejo interno (Consciousness + Observer + Evolution) = embrión del MCA
✅ RAG sobre conocimiento de oficios = base del Global Brain sectorial
✅ Identidad por tenant con RBAC = base (no soberana aún)
✅ Simulación de parches con guardrails = autonomía estratificada real
```

### Lo que falta para las fases siguientes

| Fase Prometeo | Gap principal | Esfuerzo estimado |
|---------------|--------------|-------------------|
| Identidad soberana | DID W3C + wallet portátil | Alto |
| DAO on-chain | Votación cuadrática + treasury + ZKP | Muy alto |
| Token no especulativo | Tokenómica + anti-plutocracia | Alto |
| MCA externo | Observer aplicado a gobernanza de usuarios, no solo código | Medio |
| VCS (contribución sistémica) | Métrica de valor más allá del trabajo ejecutado | Medio |
| Sub-DAOs / nodos locales | Governance multi-tenant real | Alto |
| Post-quantum crypto | Dilithium, zk-SNARKs | Muy alto |

### Analogía directa más potente

> El `ConsciousnessIndexService` + `EvolutionEngineService` + `SimulationEngineService` de SEMSE **es** el Motor de Conciencia Algorítmica (MCA) de la visión — aplicado hoy al sistema interno, extensible mañana a gobernanza externa.

> El sistema de `trust` + `evidence` + `milestones` + `escrow` de SEMSE **es** la capa de economía meritocrática de la visión — aplicada hoy a trabajos individuales, extensible mañana a VCS y DAO.

---

## Próximos pasos concretos hacia la visión

1. **Corto plazo (ya en roadmap):** Consolidar el MCA como fuente única de verdad interna. `ConsciousnessIndex` ya en Railway.
2. **Medio plazo:** Externalizar el trust score — hacerlo portable entre tenants / exportable. Primer paso hacia reputación soberana.
3. **Largo plazo:** Governance layer sobre el trust engine existente. Propuestas, votación, ejecución automática — primero dentro de SEMSE, luego on-chain.
