---
type: plan
feature: "jev-human-review-queue"
domain: "prometeo"
spec: "docs/specs/prometeo/jev-human-review-queue.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/jev-human-review-queue"
date: "2026-09-26"
---

# Plan técnico: Bandeja de revisión humana — Jev Decision Layer, Wave Marketplace

> Prerrequisito: spec `APPROVED`. El plan separa implementación, merge,
> despliegue y activación; ningún estado se infiere de otro.

## 1. Snapshot de verdad

- `origin/main` SHA: `98bd5a72c47ca5671ea1fe5814ab746ad790851a` (2026-09-26)
- SHA desplegado API: no verificado en esta pasada — no se infiere activación desde merge/deploy (ver Artículo XIII)
- SHA desplegado Web: no verificado en esta pasada
- Estado de servicios: no verificado en esta pasada (sin acceso a Railway en este entorno)
- Estado de migraciones: sin migración pendiente para esta feature (ver §4 del spec — `JevDecisionEvent` ya existe)
- Flags/allowlists actuales: `SEMSE_JEV_ENABLED`, `SEMSE_JEV_AGENT_ROUTER_ENABLED`, `SEMSE_JEV_VISION_GATE_ENABLED` ya en uso por `agent_router`/`vision_gate`; los nuevos (`SEMSE_JEV_MARKETPLACE_GATE_ENABLED`, `SEMSE_JEV_MARKETPLACE_GATE_MODE`) no existen aún en ningún entorno — su ausencia hoy equivale a "apagado".
- Drift o deuda previa: `DECISION_FEATURES` (decision.types.ts) es un registro cerrado por diseño — cualquier PR que lo toque debe limitarse a añadir `marketplace_classify`, sin tocar `agent_router`/`vision_gate`.

## 2. Constitution check

- [x] Spec aprobado antes de código (PR #687, sign-off 2026-09-26)
- [x] Tenant/org/ownership y RBAC definidos (spec §3: `ops:dashboard:read`/`write`, sin ownership por usuario individual)
- [x] Evidence/Payment Governance revisados si aplica — no aplica: este gate no mueve dinero ni evidencia, sólo pausa el `dispatch` de clasificación (Artículo IV no aplica directamente, pero se respeta su espíritu: ninguna acción financiera queda involucrada)
- [x] Audit/events definidos para cambios críticos (spec §3, §5: `AuditLog` en approve/reject — Artículo V)
- [x] Tests preceden implementación (Fase 1 de tareas, antes de Fase 2/3 — Artículo II)
- [x] No se expone secreto ni se agrega backend paralelo — reutiliza `JevDecisionEvent`/`semse-agents` bus existentes, no crea infraestructura duplicada (Artículo X)
- [x] Código, CI, merge, deploy y activación se medirán por separado (Artículo XIII — este plan nunca marca `VERIFIED` sin evidencia de cada etapa)

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura: `JevDecisionEvent` (Postgres, vía Prisma) — ya existe, sin cambio de schema.
- Read models/proyecciones: ninguno nuevo; la bandeja lee directo de `JevDecisionEvent` filtrado por `feature = "marketplace_classify"` y `finalSystemAction = "HUMAN_REVIEW"` sin resolver.
- Módulos afectados: `ai-models/decision` (registro de features + flags), `semse-agents` (Marketplace agent + controller), `admin/agents` (UI web).
- Contratos Zod: nuevos schemas para el body de `approve`/`reject` (override de clasificación, `reason` de rechazo) — viven junto a los ya existentes de `semse-agents` en `packages/schemas` si el patrón del módulo los centraliza allí, o inline en el controller si el resto de `semse-agents.controller.ts` ya usa `Record<string, unknown>` sin Zod (verificar convención real del módulo antes de decidir, no asumir).
- API/BFF/UI: 3 endpoints nuevos en `semse-agents.controller.ts` + 3 rutas BFF espejo + nueva sección en `admin/agents/page.tsx`.
- Worker/queues: sin cambios — el bus de `semse-agents` es in-memory, no pasa por BullMQ.
- Agentes/tools: `MarketplaceAgent.handleMessage` gana una rama condicional antes del `dispatch` actual; no se tocan `BuildOpsAgent`/`ProToolsAgent`/`EvidenceAgent`/`CrowdAgent`/`PrometeoAgent`.
- ADR requerido: no — esto extiende una arquitectura ya `APPROVED` (`prometeo.jev-decision-layer`), no introduce una nueva.

## 4. Datos y migración

- Cambio Prisma: ninguno. `JevDecisionEvent.feature` es `String`, no un enum de base de datos — el nuevo valor `"marketplace_classify"` no requiere migración.
- SQL y checksum: no aplica.
- Expand/contract: no aplica.
- Backfill/shadow read: no aplica — no hay eventos históricos que reclasificar.
- Compatibilidad durante deploy: total — cualquier consulta existente filtrada por `feature IN ('agent_router','vision_gate')` sigue funcionando igual; sólo se le suma una tercera categoría de fila.
- Pre-deploy command: ninguno.
- Rollback o forward-fix: revert del PR de código; sin dato que revertir (nada se escribe hasta que `SEMSE_JEV_MARKETPLACE_GATE_ENABLED=true`).
- Prueba de migración: no aplica.

## 5. Seguridad y política

- Permisos: `ops:dashboard:read` (ver bandeja), `ops:dashboard:write` (approve/reject) — mismos permisos ya usados por `pause`/`resume`/`dispatch` en `semse-agents.controller.ts`.
- Tenant/org/resource scope: todo query de `JevDecisionEvent` filtra por `tenantId` del actor autenticado; test explícito de aislamiento cross-tenant (spec §4, caso borde).
- Step-up/aprobación: es el propósito del feature — `HUMAN_REVIEW` nunca se auto-resuelve.
- Auditoría: `AuditLog` en cada approve/reject con actor, before/after de la clasificación, `correlationId`.
- Riesgos de pagos/evidencia: ninguno directo — este gate está aguas arriba de BuildOps/Crowd/Evidence, no toca escrow ni evidencia.
- Abuse cases: un actor con `ops:dashboard:write` podría aprobar clasificaciones incorrectas repetidamente para acelerar el flujo — mitigado por auditoría (queda registrado quién aprobó qué), no por bloqueo técnico; es un control operativo, no de producto.

## 6. Eventos, idempotencia y reconstrucción

- Productores: `MarketplaceAgent.handleMessage` escribe el `JevDecisionEvent` antes (shadow) o en vez de (live) disparar `ESTIMATE_REQUESTED`/`PROJECT_PLANNED`.
- Outbox atómico: no aplica — el bus de `semse-agents` ya es fire-and-forget in-memory, sin outbox; consistente con el resto del módulo.
- Consumers/receipts: `approve`/`reject` actúan como el "receipt" — cada uno es idempotente por `eventId` (segunda llamada devuelve `duplicate: true`, no reprocesa).
- Replay: no aplica en esta wave.
- DLQ: no aplica.
- Rebuild: no aplica.
- Correlation/traces: reutiliza `correlationId` ya presente en `SemseAgentMessage` y en `JevDecisionEvent`.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Test rojo: "clasificación con matchScore < umbral en modo live NO dispara ESTIMATE_REQUESTED/PROJECT_PLANNED hasta approve".
- Test rojo: "en modo shadow, el dispatch ocurre igual pero se registra el evento".
- Contrato de los 3 endpoints (`GET review`, `POST review/:id/approve`, `POST review/:id/reject`) contra los `input_schema`/`output_schema`/`errors` del spec §5.

### Fase B — Datos y dominio

- Sin migración (§4). Añadir `marketplace_classify` a `DECISION_FEATURES` (decision.types.ts) con sus `actions`/`caution`/`certaintyActions`/`question`.
- Añadir `SEMSE_JEV_MARKETPLACE_GATE_ENABLED`/`_MODE` a `decision-flags.ts`, siguiendo el patrón exacto de `agent_router`.
- Implementar la evaluación del gate dentro de `MarketplaceAgent.handleMessage` (branch antes del dispatch existente).

### Fase C — API/BFF/UI

- Endpoints en `semse-agents.controller.ts` con `@RequirePermissions` correctos.
- Rutas BFF espejo bajo `apps/web/app/api/semse/agents/review/**`.
- Sección "Revisión pendiente" en `admin/agents/page.tsx` con los 6 estados UX (spec §5).

### Fase D — Verificación local/CI

- `pnpm --filter @semse/api test:unit` dirigido a los nuevos tests.
- `pnpm typecheck` workspace completo (mismo hábito que en PRs anteriores de esta sesión).
- `pnpm spec:validate:strict` + `pnpm spec:index`.

### Fase E — Integración

- PR contra `main` (no contra `feat/f4-mission-control-2` ni `fix/dependabot-security-patches` — rama nueva desde `main` actualizado).
- Esperar CI terminal (mismo patrón de espera de `quality-gates`/`e2e` ya visto en PRs #678/#680 de esta sesión).
- Merge sólo tras CI verde; registrar SHA de merge en el spec (`production_evidence`).

### Fase F — Producción

- Deployment terminal API/Web — verificar, no asumir, per Artículo XIII.
- `SEMSE_JEV_MARKETPLACE_GATE_ENABLED` permanece `false`/ausente en producción tras el deploy — el deploy en sí NO activa nada (mismo patrón que Mission Control 2.0 y Jev Decision Layer).
- Activación gradual: (1) shadow global — sólo observabilidad, cero riesgo; (2) live en `SEMSE_JEV_CANARY_TENANT_IDS=tenant_default`; (3) live general sólo tras revisar tasa de `HUMAN_REVIEW` en shadow durante tráfico real (spec §8).
- Rollback: apagar el flag (instantáneo, sin revert de código necesario) si la tasa de `HUMAN_REVIEW` es anómala o el gate bloquea trabajos legítimos.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Umbral compartido (`SEMSE_JEV_MIN_CONFIDENCE`) mal calibrado para Marketplace específicamente (bloquea trabajos legítimos en modo live) | Media | Alto (fricción real para clientes) | Fase shadow obligatoria antes de live; medir tasa de `HUMAN_REVIEW` con tráfico real antes de activar | Tasa de `HUMAN_REVIEW` > 50% en shadow, o quejas de clientes sobre jobs "atascados" en canary live |
| Un admin aprueba sistemáticamente sin revisar (fatiga de alertas) | Baja-media | Medio (el gate se vuelve teatro) | Auditoría visible de quién aprobó qué; sin mitigación técnica adicional en esta wave | Tasa de aprobación >95% sin ediciones, sostenida en el tiempo |
| Confusión entre este `feature: "marketplace_classify"` y los dos existentes en dashboards/queries que asumen sólo 2 valores | Baja | Bajo (dato, no rompe nada) | Test explícito de que queries existentes no excluyen la nueva fila por accidente (spec §9) | N/A — se detecta en tests, no en producción |
| Scope creep hacia BuildOps/Evidence/Crowd durante la implementación | Media | Medio (retrasa el PR, dificulta review) | Plan y tareas explícitamente acotados a Marketplace únicamente (spec §2, "Fuera de alcance") | Un PR que toca archivos fuera del mapa de implementación (spec §10) sin spec nuevo |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| No aplica | — | Esta wave reutiliza 100% infraestructura interna ya `APPROVED` (Jev Decision Layer, PrometeoProposedAction); no se evalúa ninguna librería ni proveedor externo nuevo (spec §11) |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (spec §10, reproducido en §3/§7 de este plan)
- [x] Migración y rollback definidos (§4 — no aplica; rollback = apagar flag)
- [x] Tests ordenados antes del código (§7 Fase A antes de B/C)
- [x] Canary/feature flag definidos (§7 Fase F, reutiliza `SEMSE_JEV_CANARY_*` existentes)
- [x] Evidencia requerida para cada estado de entrega (spec §8: conteo shadow + ciclo aprobar/rechazar en canary)
- [x] Scope cabe en un PR reversible (un solo módulo de dominio — `semse-agents` + `ai-models/decision` — más UI; sin migración; flag apagado por defecto hace el revert trivial)
