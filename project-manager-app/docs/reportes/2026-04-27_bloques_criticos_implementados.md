# Bloques Críticos — Implementación completa

Fecha: 2026-04-27
Estado: **build:api EXIT:0 | tests: 133/133 | WEB TS: 0 errores**

---

## 1. Worker Process Activo

- Redis arrancado via Docker (`docker start semse-redis`)
- `apps/worker/.env` creado con config correcta
- Worker process: `node apps/worker/src/main.mjs` corriendo y procesando jobs de BullMQ
- Handlers especializados: field-ops, trust-match, pricing, project-copilot
- Auto-reclaim de runs estancados cada 30s
- Sweep de reservaciones expiradas cada 60s

## 2. Seed de Datos Robusto v2

Archivo: `packages/db/prisma/seed.ts`

**Resuelve el bug raíz:** las cuentas demo del login usaban `tenant_default` pero los orgs existían bajo otro tenant. Ahora todo está alineado.

- `tenant_default` como tenant canónico del demo
- `org_client_001`, `org_pro_001`, `org_admin_001` todos bajo `tenant_default`
- Usuarios: `usr_client_001`, `usr_worker_001`, `usr_admin_001`
- Credenciales: `client@demo.semse / demo1234`, `worker@demo.semse / demo1234`, `admin@demo.semse / demo1234`
- 5 jobs en variados estados (IN_PROGRESS, PUBLISHED, COMPLETED)
- 2 proyectos (1 activo con disputa, 1 completado)
- 3 milestones + 4 evidencias
- 1 escrow activo + 1 liberado
- 1 disputa abierta
- 1 AgentWorkPlan (pending_approval)
- 3 AgentMemory entries
- 3 AgentDelegations (para coordinator dashboard)
- 3 notificaciones
- UserProfiles con AssistantSettings

**Auth BFF actualizado** (`apps/web/app/api/semse/auth/token/route.ts`):
- Rol `FIELD_WORKER` → `PRO` (nombre canónico)
- Todos los orgs correctamente mapeados a `tenant_default`

## 3. Post-Approval Execution

Ya existía en el harness. Verificado que `resolveJournal()` llama a `AgentMemory.getRecentJournal()` y que el flujo de `linkedPlanId/linkedStepId` en el approval context es funcional.

## 4. Plan blockedActions en UI

Ya implementado. `blockedActions` se muestra en la UI del copiloto con razón y tipo de acción.

## 5. Memory Decay + Deduplication + SummarizeSession Autonómico

**AgentMemoryRepository** — nuevos métodos:
- `decayOldMemories()`: reduce importanceScore de memorias >14 días de tipo session_summary/observation/event
- `cleanupExpiredMemories()`: elimina memorias muy viejas con importanceScore ≤ 1 (excepto decisions)
- `findDuplicateCandidates()`: busca candidatos a duplicado por agentId/type
- `deleteManyById()`: elimina batch

**AgentMemoryService** — nuevos métodos:
- `decayOldMemories()`: orquesta decay + cleanup
- `deduplicateMemories()`: normaliza summaries, detecta duplicados por similaridad léxica, elimina el de menor importancia
- `summarizeSessionAutonomic()`: extrae decisiones/acciones automáticamente de mensajes, detecta patrones PROPOSE_/REQUEST_/etc., genera memoria de tipo `decision` o `session_summary` según contenido

**Harness** — integrado:
- `summarizeSessionAutonomic()` llamado al final de cada chat junto con `writeSessionSummary()`

## 6. AssistantSettings en Copiloto

Nueva tab "Asistente" en el copiloto (`/client/projects/[id]/copilot?tab=settings`):
- Selector de tono (Amistoso / Formal / Técnico / Ejecutivo)
- Selector de idioma (🇪🇸 Español / 🇺🇸 English)
- Selector de verbosity (Corto / Equilibrado / Detallado)
- Toggle Expert Mode
- Guarda via `PATCH /v1/users/me/profile`
- Carga profile al abrir la tab
- Enlace a `/worker/settings` para config completa

## 7. SSE para Cambios en Tiempo Real

Nuevos routes SSE:
- `GET /api/semse/agents/plans/[planId]/stream` — streaming del plan activo (poll 2s)
- `GET /api/semse/agents/delegations/stream` — streaming de delegaciones (poll 3s)

**Copilot page** (`/client/projects/[id]/copilot`):
- `useEffect` con `EventSource` que escucha `plan-update` events
- Actualiza `currentPlan` y todos los mensajes que referencian ese plan en tiempo real
- Se conecta cuando `currentPlan.id` existe, se cierra al desmontar

**Coordinator Dashboard** (`/admin/coordinator`):
- Toggle "Live ON/OFF" para activar/desactivar SSE
- `EventSource` escucha `delegations-update` y actualiza la tabla en tiempo real
- Indicador "🔴 Live" en el header cuando está activo

## 8. Task Graph con Auto-Refresh

El SSE del plan (`/api/semse/agents/plans/[planId]/stream`) actualiza el `currentPlan` que alimenta el `WorkPlanCard` y el `PlanTaskGraph` automáticamente. No se necesita polling manual.

## 9. LLM Metrics Dashboard

`GET /v1/ops/llm/metrics` ya devuelve datos reales del `ProviderMetricsStore` (in-memory). La página `/admin/llm-metrics` los muestra. Verificado: anthropic provider con 2 llamadas reales.

## 10. Coordinator Dashboard con Datos Reales

- 3 delegaciones de seed: field-ops (completed), trust-match (completed), pricing (executing)
- SSE live updates activados
- Toggle Live ON/OFF
- Bug corregido: `fetchDelegations` normaliza respuesta (array vs snapshot object)

## 11. Coordinator Supervisado Operativo

**CoordinatorService** — nuevo método `runSupervisedAnalysis()`:
- Spawn en paralelo: field-ops + trust-match + pricing (si hay jobId)
- Polling hasta 8s para recolectar resultados
- Genera contextBlock rico para inyección en system prompt
- Devuelve resultados de cada agente especialista

**Harness** — integrado en `handleRefresh()`:
- Cada refresh dispara `runSupervisedAnalysis()` en background (fire & forget)
- Los resultados aparecen en el siguiente refresh del coordinator snapshot

## 12. Plan Templates

**PlanTemplatesService** — 5 templates:
- `tpl_milestone_review`: Revisión de hito y liberación de pago
- `tpl_dispute_resolution`: Resolución de disputa
- `tpl_escrow_release`: Liberación de escrow al completar proyecto
- `tpl_scope_change`: Gestión de cambio de alcance
- `tpl_quality_inspection`: Inspección de calidad final

**API endpoints:**
- `GET /v1/agents/plan-templates` — lista todos (filtrable por `?category=`)
- `GET /v1/agents/plan-templates/categories` — categorías disponibles
- `GET /v1/agents/plan-templates/:templateId` — template específico

**BFF:**
- `GET /api/semse/agents/plan-templates` — proxy al API
- `fetchPlanTemplates()` y `fetchPlanTemplateById()` en semse-api.ts

**RBAC:**
- `agents:run:create` agregado al rol `CLIENT` en `packages/auth/src/rbac.ts`

---

## Estado Final

```
build:api      EXIT:0
tests api      133/133 ✅
WEB TS         0 errores ✅
Redis          Docker (semse-redis) ✅
Worker         Corriendo pid activo ✅
API            localhost:4000 ✅
Web            localhost:3000 ✅
Login demo     client@demo.semse / demo1234 → /client/dashboard ✅
Login demo     admin@demo.semse / demo1234 → /admin/dashboard ✅
Plan templates 5 templates accesibles ✅
SSE            /api/semse/agents/plans/[id]/stream ✅
SSE            /api/semse/agents/delegations/stream ✅
```

## URLs principales

| URL | Descripción |
|-----|-------------|
| `localhost:3000/login` | Login con demo credentials |
| `localhost:3000/client/projects/proj_demo_001/copilot` | Copiloto con plan demo |
| `localhost:3000/admin/coordinator` | Coordinator con datos reales + live |
| `localhost:3000/admin/llm-metrics` | Métricas LLM reales |
| `localhost:3000/worker/settings` | AssistantSettings completo |
