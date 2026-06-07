---
version: 2.0.0
fecha: 2026-03-30
estado: canonical
owner: arquitecto-principal
changelog: Actualizado para reflejar estado real post-smoke-test-24/24 (2026-03-30)
---

# 01_KERNEL — Núcleo e Identidad de SEMSEproject

## Definición oficial

> SEMSEproject es una plataforma operativa-inteligente de servicios reales, gobernada por un dominio trazable, una arquitectura canónica, evidencia estructurada, pagos por hitos, control operativo, memoria compartida y agentes internos que ayudan a construir y operar el ecosistema.

No es una app. No es un dashboard. No es una IA. Es la integración disciplinada de todas esas capacidades en capas construidas en orden.

---

## Por qué existe

### El problema central

El trabajo real entre clientes y profesionales ocurre sin trazabilidad, sin contratos verificables, sin evidencia estructurada, sin pagos controlados y sin mecanismos de confianza que sobrevivan más allá de la transacción individual.

El resultado: disputas sin resolución, pagos en riesgo, profesionales sin reputación verificable, clientes sin protección real, operadores sin visibilidad.

### La solución que construimos

Un sistema que coordina el ciclo completo de un trabajo de servicios:

1. publicación del trabajo con especificaciones claras
2. selección de profesional con criterios verificables
3. contrato digital con hitos definidos
4. fondeo en escrow antes de empezar
5. ejecución con evidencia estructurada por hito
6. revisión y aprobación con criterios auditables
7. liberación de fondos por hito aprobado
8. disputas con mecanismo de resolución
9. reputación construida desde comportamiento real, no solo calificaciones

---

## Las 4 capas del ecosistema

### Capa 1 — SEMSE Jobs (MVP)
Marketplace operativo. Flujo completo de trabajo real.
Dominios: `jobs`, `bids`, `reservations`, `contracts`, `milestones`, `evidence`, `payments`, `disputes`, `trust`.

### Capa 2 — SEMSE Ops
Supervisión y control operativo. Automatización de procesos.
Dominios: `field-ops`, `ops`, auditoría (`AuditLog`), `AuditService`, workers, alertas, runbooks, backoffice.

### Capa 3 — SEMSE Trust
Capa de confianza, riesgo y reputación.
Dominios: trust score, `RiskScore`, evidence scoring, dispute analytics, behavioral reputation.

### Capa 4 — Prometeo
Capa futura institucional y de gobernanza programable.
Dominios: governance, policy engine, identity soberana, wallets, treasury, sub-DAOs.
Estado: definida. No entra al MVP. Se preserva como destino de evolución.

---

## Capacidad transversal soberana — Operacion asistida

Ademas de las cuatro capas del ecosistema, `SEMSEproject` reconoce una capacidad transversal soberana que habilita continuidad operativa, memoria contextual y ejecucion agentic disciplinada.

Esta capacidad se llama:

- `operacion asistida`

Sus subcapas oficiales son:

1. `operator_identity`
2. `workspace_memory`
3. `agent_runtime`
4. `ephemeral_runtime_state`
5. `backup_recovery`

### Definicion soberana

La operacion asistida:

- no sustituye al producto;
- no redefine la vision;
- no constituye por si sola una capa de negocio;
- si habilita al operador y al ecosistema para construir, operar, observar y sostener la capa agentic con continuidad y trazabilidad.

### Regla soberana

`SEMSEproject` debe distinguir siempre:

- memoria del ecosistema;
- runtime recreable;
- estado efimero;
- respaldo frio.

Confundir estas capas degrada gobernanza, trazabilidad y capacidad de recuperacion.

---

## El núcleo inmutable

Estas capacidades deben existir en toda versión del sistema. Sin ellas, SEMSEproject no es SEMSEproject:

| Capacidad | Descripción | Módulo / Nodo |
|---|---|---|
| Identidad y control de acceso | JWT real, roles RBAC, sesiones seguras | `AuthModule`, `AuthGuard`, `RbacGuard` |
| Ciclo de trabajo completo | job → bid → contract → milestone → evidence → payment | `JobsModule`, `ContractsModule`, `MilestonesModule` |
| Evidencia estructurada | Fotos, videos, documentos por hito con metadatos y validación | `EvidenceModule` |
| Pagos por hitos con escrow | Fondeo previo, liberación por aprobación, reversión por disputa | `PaymentsModule`, `PaymentEscrow` |
| Trazabilidad de auditoría | `AuditLog` en PostgreSQL — append-only por acción del sistema | `AuditService`, `OpsModule` |
| Dominio unificado | Un solo schema Prisma, un solo contrato de datos | `@semse/db`, `@semse/schemas` |
| Capa de agentes registrados | `AgentRun` persistido, catálogo vivo, worker polling | `AgentsModule`, `@semse/agents` |

---

## Estado real del sistema al 2026-03-30

### Lo que está implementado y funcionando (smoke test 24/24 pasado)

| Capacidad | Endpoint / Módulo | Estado |
|---|---|---|
| Auth login | `POST /v1/auth/login` | Operativo |
| Auth register | `POST /v1/auth/register` | Operativo |
| Auth me | `GET /v1/auth/me` | Operativo |
| AuthGuard global (JWT Bearer) | `AuthGuard` en `APP_GUARD` | Operativo |
| RbacGuard global | `RbacGuard` en `APP_GUARD` | Operativo |
| Decoradores `@Public()` y `@CurrentUser()` | common/ | Operativo |
| Seed completo | Tenant `semse`, 4 roles, 22 permisos, admin user | Operativo |
| Módulo jobs | Responde con RBAC | Operativo (shell + lógica parcial) |
| Módulo bids | Responde con RBAC | Operativo (shell + lógica parcial) |
| Módulo contracts | Responde con RBAC | Operativo (lógica parcial) |
| Módulo milestones | Submit/Approve/Reject/Release con política | Operativo |
| Módulo evidence | Upload, list, validación | Operativo (sin storage S3 real) |
| Módulo payments | Deposit escrow, release por hito | Operativo (mock provider) |
| Módulo disputes | Open, resolve | Operativo (shell) |
| Módulo reservations | CRUD básico | Operativo (shell) |
| Módulo trust | Trust score por job | Operativo |
| Módulo ops | Audit, dashboard, risk-scores, runbooks | Operativo |
| Módulo agents | AgentRun CRUD, catálogo, chat threads | Operativo |
| Módulo field-ops | FieldUnit, WorklogEntry, KnowledgeFact, Vendor | Operativo |
| AuditLog persistente | Escrito por `AuditService` en PostgreSQL | Operativo |
| Worker polling | `apps/worker` — poll/heartbeat/reclaim de AgentRuns | Operativo (sin BullMQ, polling HTTP) |
| Web app (Next.js) | Rutas: jobs, dashboard, cortex, field-ops, login | Parcialmente conectada a API real |
| PolicyEngine (`PolicyRule`) | Schema definido, evaluable por PolicyService | Definido (no integrado en flujo) |
| Notificaciones | Schema `Notification` en DB | Definido (no integrado) |
| Agentes nombrados (16) | Catálogo en `@semse/agents` | Definido (sin LLM real activo) |
| Agentes especializados (8) | Catálogo en `@semse/agents` | Definido (sin ejecutores reales) |

### Lo que no está implementado aún

| Capacidad | Estado | Prioridad |
|---|---|---|
| Storage S3/R2 real para evidencia | Solo mock `bucketKey` | P1 Fase 2 |
| Payment provider real (Stripe/Conekta) | Solo `mock` provider | P1 Fase 2 |
| Flujo completo job→bid→contract→milestone→evidence→payment de punta a punta | Piezas existen, flujo no orquestado | P0 Fase 2 |
| Frontend conectado completamente a API | Parcialmente conectado | P1 Fase 2 |
| Worker con BullMQ (actualmente polling HTTP) | Polling funcional pero no es BullMQ | P2 Fase 2 |
| pgvector y embeddings | No instalado | P3 Fase 3 |
| LLM real en agentes (OpenAI) | Catálogo definido, sin llamadas reales | P2 Fase 3 |
| PolicyService integrado en flujo de milestones/payments | Schema existe, no evaluado en transiciones | P2 Fase 2 |
| Sistema de notificaciones activo | Schema existe, no disparado | P2 Fase 2 |
| Refresh tokens | No implementado | P1 Fase 2 |

---

## Las 4 capas del ecosistema — estado actualizado

### Capa 1 — SEMSE Jobs
Estado: **building (70%)**
Próxima acción: orquestar flujo completo de punta a punta, conectar frontend a API real.

### Capa 2 — SEMSE Ops
Estado: **building (50%)**
Próxima acción: activar PolicyService en transiciones de estado, notificaciones, BullMQ.

### Capa 3 — SEMSE Trust
Estado: **building (25%)**
Próxima acción: mejorar TrustService con señales reales post-job completo.

### Capa 4 — Prometeo
Estado: **vision (5%)**
Próxima acción: preservar como horizonte, no construir ahora.

---

## Los 10 mandamientos operativos

**1. Un solo backend canónico.**
Todo código estructural de backend vive en `apps/api`. No se crea backend estructural fuera de ese punto.

**2. Un solo schema de datos.**
El schema Prisma oficial vive en `packages/db/prisma/schema.prisma`. No existe otro schema autorizado.

**3. Un solo frontend destino.**
La aplicación web canónica vive en `apps/web`. No hay otro destino de desarrollo UI nuevo.

**4. La visión manda sobre el código.**
Si hay conflicto entre `labsemse/` y cualquier implementación, gana `labsemse/`.

**5. No se duplican modelos.**
Un modelo de dominio existe en un solo lugar.

**6. No se construye lo que no está en la fase actual.**
Cada decisión técnica se valida contra el roadmap de fases.

**7. Toda acción relevante genera un AuditLog.**
`AuditService.append()` debe llamarse en cada cambio de estado relevante del sistema.

**8. Los laboratorios no son tronco.**
Los repos legacy (`Reference Only`, `Frozen`, `Archived`) solo aportan por extracción controlada.

**9. Los contratos de datos son los que mandan en la integración.**
`@semse/schemas` (Zod) y `@semse/db` (Prisma) definen los contratos. Las apps solo consumen esos contratos.

**10. La consolidación es una acción explícita, no un accidente.**
Mover código de laboratorios al tronco canónico requiere proceso controlado.

---

## Cómo evoluciona el sistema

```
VISIÓN DEFINIDA
      ↓
EXPLORACIÓN (laboratorios, spikes, prototipos)
      ↓
FRAGMENTACIÓN TEMPORAL (múltiples experimentos en paralelo)
      ↓
CONSOLIDACIÓN ACTIVA (extracción controlada al tronco canónico)
      ↓
NÚCLEO ESTABLE (módulos sólidos, contratos limpios, tests)
      ↓
NUEVA EXPANSIÓN (desde el núcleo hacia la siguiente capa)
```

**Estado actual (2026-03-30)**: En construcción activa del Núcleo Estable de Capa 1.
El sistema tiene auth real, auditoría persistente, módulos respondiendo y smoke test 24/24.
El siguiente paso es el flujo de punta a punta del marketplace.

---

## Nota sobre el modelo de agentes

El `@semse/agents` package tiene dos familias ya definidas:

1. **Agentes nombrados (16)**: Marta, Planner, Felix, Escrow, Justus, Vesper, etc. — interfaz conversacional por rol.
2. **Agentes especializados (8)**: pricing, job-planner, trust-match, evidence-coach, risk, dispute, orchestrator, ecv — backend workers.

El worker actual (`apps/worker`) implementa polling HTTP de `AgentRun`. El diseño final usará BullMQ.
La capa agentic conversacional está en `apps/web/app/cortex/`.

---

## Resumen de estado actual al 2026-03-30

| Capa | Estado | Próxima acción |
|---|---|---|
| SEMSE Jobs | building (70%) | Flujo completo de punta a punta + frontend conectado |
| SEMSE Ops | building (50%) | PolicyService activo + notificaciones + BullMQ |
| SEMSE Trust | building (25%) | TrustService con señales reales post-job |
| Prometeo | vision (5%) | Preservar como horizonte, no construir ahora |

## Nota soberana sobre la operacion asistida

La capa de operacion asistida se formaliza en:

- `constitution/04_AGENTIC_LAYER.md`
- `program/ARCHITECTURE_TARGET.md`
- `repository-rules/CANONICITY.md`
- `program/governance/OPERACION_ASISTIDA_TRACEABILITY_MAP.md`

La referencia absorbida vive en:

- `agents/references/infclaude/modelo_capa_operacion_asistida_semse_2026-04-12.md`

La evidencia fechada vive en:

- `reportes/destilacion_capa_operacion_asistida_labsemse_2026-04-12.md`
