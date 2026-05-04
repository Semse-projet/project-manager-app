---
version: 2.0.0
fecha: 2026-03-30
estado: canonical
owner: arquitecto-principal
changelog: Actualizado para reflejar estado real del monorepo post-smoke-test-24/24. Conflictos resueltos anotados.
---

# 02_AUTHORITY_MAP — Mapa de Autoridad del Ecosistema

## Propósito

Este documento define qué manda sobre qué dentro del ecosistema SEMSEproject. Cuando dos fuentes contradicen, este mapa resuelve el conflicto sin debate.

---

## Jerarquía de autoridad por capa

```
NIVEL 1 — Constitución y visión soberana
  /home/yoni/labsemse/constitution/SEMSE_MARCO_MAESTRO_EXPANDIDO_2026-03-30.md
  /home/yoni/labsemse/constitution/01_KERNEL.md  (este + demás documentos canónicos)
  Manda sobre: todo. Si la visión dice X, el sistema se construye hacia X.

NIVEL 2 — Canon arquitectónico (documentos 01-07)
  /home/yoni/labsemse/constitution/01_KERNEL.md
  /home/yoni/labsemse/constitution/02_AUTHORITY_MAP.md
  /home/yoni/labsemse/constitution/03_NODE_REGISTRY.md
  /home/yoni/labsemse/constitution/04_AGENTIC_LAYER.md
  /home/yoni/labsemse/constitution/05_DATA_ARCHITECTURE.md
  /home/yoni/labsemse/constitution/06_EXECUTION_ROADMAP.md
  /home/yoni/labsemse/constitution/07_SELF_IMPROVING_AGENTS.md
  Mandan sobre: roadmap, fases, backlog, prioridades, secuencia de construcción.

NIVEL 2.5 — Referencias absorbidas y trazabilidad formal de operación asistida
  /home/yoni/labsemse/agents/references/infclaude/modelo_capa_operacion_asistida_semse_2026-04-12.md
  /home/yoni/labsemse/reportes/destilacion_capa_operacion_asistida_labsemse_2026-04-12.md
  Aportan: modelo funcional, trazabilidad y aterrizaje operativo.
  No mandan sobre la constitución, pero sí definen el puente entre observación del entorno y absorción canónica.

NIVEL 3 — Contratos de dominio
  /home/yoni/labsemse/project-manager-app/packages/db/prisma/schema.prisma
  /home/yoni/labsemse/project-manager-app/packages/schemas/src/
  Mandan sobre: definición de entidades, relaciones, validaciones, tipos.
  Si una app tiene un tipo diferente al del schema, el schema gana.

NIVEL 4 — Implementación canónica
  /home/yoni/labsemse/project-manager-app/apps/api/
  /home/yoni/labsemse/project-manager-app/apps/web/
  /home/yoni/labsemse/project-manager-app/apps/worker/
  Mandan sobre: implementación concreta de módulos, endpoints, UI, workers.

NIVEL 5 — Referencias y laboratorios
  /home/yoni/labsemse/src/
  /home/yoni/labsemse/app semse/web-assistant-portal/
  /home/yoni/labsemse/app semse/semse-control-mvp/
  Solo aportan por extracción controlada. No mandan sobre nada.
```

---

## Mapa de decisión por tipo de recurso

| Tipo de decisión | Fuente de autoridad | Dónde vive |
|---|---|---|
| Identidad del producto | Marco Maestro + `01_KERNEL.md` | `/home/yoni/labsemse/` |
| Mapa de autoridad y conflictos | `02_AUTHORITY_MAP.md` | `/home/yoni/labsemse/` |
| Inventario de nodos del sistema | `03_NODE_REGISTRY.md` | `/home/yoni/labsemse/` |
| Arquitectura de la capa agentic | `04_AGENTIC_LAYER.md` | `/home/yoni/labsemse/` |
| Operación asistida absorbida | `agents/references/infclaude/modelo_capa_operacion_asistida_semse_2026-04-12.md` + `reportes/destilacion_capa_operacion_asistida_labsemse_2026-04-12.md` | `/home/yoni/labsemse/` |
| Schema de base de datos | `packages/db/prisma/schema.prisma` | `project-manager-app/packages/db/` |
| Contratos de validación (Zod) | `packages/schemas/src/` | `project-manager-app/packages/schemas/` |
| Lógica de backend | `apps/api/src/modules/` | `project-manager-app/apps/api/` |
| Auth, JWT, guards globales | `apps/api/src/common/` | `project-manager-app/apps/api/src/common/` |
| AuditService (trazabilidad) | `apps/api/src/infrastructure/audit/` | `project-manager-app/apps/api/` |
| UI y páginas web | `apps/web/` | `project-manager-app/apps/web/` |
| Worker / jobs async | `apps/worker/` | `project-manager-app/apps/worker/` |
| Catálogo de agentes IA | `packages/agents/src/index.ts` | `project-manager-app/packages/agents/` |
| Componentes UI compartidos | `packages/ui/src/` | `project-manager-app/packages/ui/` |
| Tipos y utilidades compartidas | `packages/shared/src/` | `project-manager-app/packages/shared/` |
| Roadmap y fases | `06_EXECUTION_ROADMAP.md` + `08_SPRINT_BACKLOG.md` | `/home/yoni/labsemse/` |
| Sprint backlog activo | `08_SPRINT_BACKLOG.md` | `/home/yoni/labsemse/` |
| Reglas de permisos RBAC | `apps/api/src/common/rbac.ts` | `apps/api/src/common/` |
| Definición de permisos en DB | `packages/db/prisma/seed.ts` | `packages/db/prisma/` |

---

## Estado de cada app y repositorio al 2026-03-30

| App / Repositorio | Estado | Rol | Puede recibir desarrollo nuevo |
|---|---|---|---|
| `project-manager-app` | Canonical | Tronco oficial de SEMSEproject | Sí — es el destino de todo |
| `labsemse/` (documentos canónicos) | Canonical | Visión, arquitectura y roadmap | Solo actualizaciones de visión aprobadas |
| `app semse/web-assistant-portal` | Transitional | Portal funcional con Express + React + tRPC + MySQL | Solo mantenimiento. Migrar a monorepo canónico |
| `src/` | Transitional | UI de referencia, 13 páginas y 59 componentes | Solo como especificación UX temporal |
| `supabase/` | Transitional | Infra heredada (auth, storage, edge) | No. Migrar dominio por dominio a PostgreSQL |
| `app semse/semse-control-mvp` | Reference Only | MVP autónomo con Next.js 14 + SQLite | No. Solo extraer módulos útiles |
| `app semse/Agent_Semse App Maximizada` | Reference Only | Blueprint ampliado, k8s, 7 microservicios agentes | No. Solo extraer patrones de infra y agentes |
| `app semse/Agent_Matriz de agentes` | Frozen | Prototipo visual de matriz de agentes | No |
| `dist/` | Ignore as source | Build generado | N/A |

## Regla específica para la operación asistida

La capa de operación asistida se resuelve así:

1. la constitución define sus fronteras;
2. `program/` define su papel dentro de la arquitectura objetivo;
3. `agents/references/infclaude/` conserva el patrón absorbido;
4. `reportes/` conserva la evidencia fechada;
5. ninguna carpeta del entorno del operador gana autoridad por proximidad física al runtime real.

---

## Mapa de módulos NestJS y su estado real al 2026-03-30

| Módulo NestJS | Dominio de negocio | Ruta en monorepo | Estado real |
|---|---|---|---|
| `HealthModule` | infraestructura | `apps/api/src/modules/health/` | operative |
| `AuthModule` | identidad y acceso | `apps/api/src/modules/auth/` | operative — login/register/me con JWT |
| `JobsModule` | publicación de trabajos | `apps/api/src/modules/jobs/` | building — CRUD parcial, filtros pendientes |
| `BidsModule` | propuestas y oferta | `apps/api/src/modules/bids/` | building — CRUD básico, selección pendiente |
| `ReservationsModule` | reservas de trabajo | `apps/api/src/modules/reservations/` | building — CRUD, sin timer de expiración |
| `ContractsModule` | contratos digitales | `apps/api/src/modules/contracts/` | building — firma parcial |
| `MilestonesModule` | hitos de ejecución | `apps/api/src/modules/milestones/` | operative — submit/approve/reject/release + policy |
| `EvidenceModule` | evidencias por hito | `apps/api/src/modules/evidence/` | building — sin storage S3 real |
| `PaymentsModule` | pagos y escrow | `apps/api/src/modules/payments/` | building — mock provider, escrow funcional |
| `DisputesModule` | disputas y resolución | `apps/api/src/modules/disputes/` | building — open/resolve básico |
| `TrustModule` | confianza y reputación | `apps/api/src/modules/trust/` | building — trust score por job |
| `FieldOpsModule` | operaciones en campo | `apps/api/src/modules/field-ops/` | operative — FieldUnit, Worklog, KnowledgeFact, Vendor |
| `AgentsModule` | agentes IA | `apps/api/src/modules/agents/` | operative — AgentRun CRUD, catálogo, chat threads |
| `OpsModule` | auditoría y control | `apps/api/src/modules/ops/` | operative — AuditLog, dashboard, risk-scores, incidents |
| `ProjectsModule` | proyectos (bridge job→milestones) | `apps/api/src/modules/projects/` | operative — bridge confirmado, Project model activo |

---

## Tabla maestra de recursos y autoridad

| Recurso | Autoridad | Estado | Notas |
|---|---|---|---|
| `schema.prisma` | `packages/db` (canónico) | canonical | Un solo schema. 30+ modelos. 6 migraciones aplicadas |
| Schemas Zod | `packages/schemas` (canónico) | building | Contratos de validación para módulos clave |
| Tipos TypeScript compartidos | `packages/shared` | building | No duplicar tipos en apps |
| Componentes UI base | `packages/ui` | building | Componentes portados desde `src/` |
| Catálogo de agentes | `packages/agents` | operative | 16 agentes nombrados + 8 especializados definidos |
| Auth guards globales | `apps/api/src/common/` | operative | `AuthGuard` + `RbacGuard` globales en APP_GUARD |
| RBAC permissions | `apps/api/src/common/rbac.ts` | operative | 4 roles: CLIENT, PRO, OPS_ADMIN, WORKER |
| AuditService | `apps/api/src/infrastructure/audit/` | operative | Escribe `AuditLog` en PostgreSQL — append-only |
| API REST / NestJS | `apps/api` | operative | Backend oficial. 14 módulos respondiendo |
| Frontend Next.js | `apps/web` | building | Rutas: jobs, dashboard, cortex, field-ops, login |
| Worker polling | `apps/worker` | operative | Polling HTTP de AgentRuns (no BullMQ aún) |
| PostgreSQL | `packages/db` + Prisma | canonical | La única base de datos del sistema activa |
| Redis | No activo | defined | Pendiente para BullMQ y sesiones |
| PolicyEngine | `PolicyRule` en schema | defined | Schema existe, PolicyService pendiente de integración |
| Notificaciones | `Notification` en schema | defined | Schema existe, dispatcher pendiente |

---

## Reglas de conflicto

### Regla 1 — Constitución vs Código
Si el código implementa algo que contradice los documentos canónicos, el código se corrige. La constitución no se adapta al código.

### Regla 2 — Schema vs App
Si una app define un tipo o relación que no existe en `packages/db/schema.prisma`, la app está equivocada. El schema es la fuente de verdad de los datos.

### Regla 3 — Roadmap vs Urgencia
Si alguien quiere construir algo fuera de la fase activa alegando urgencia, debe: (a) documentarlo en `08_SPRINT_BACKLOG.md`, (b) obtener aprobación explícita, (c) registrar el impacto en el roadmap.

### Regla 4 — Dos implementaciones del mismo dominio
Si existen dos implementaciones del mismo módulo, la implementación canónica es la del monorepo oficial. La otra entra en modo transitional con fecha de migración.

### Regla 5 — Laboratorio vs Producción
Ningún laboratorio (`Reference Only`, `Frozen`, `Archived`) puede recibir desarrollo activo de features de producción.

---

## Conflictos conocidos activos al 2026-03-30

| Conflicto | Descripción | Decisión tomada | Estado |
|---|---|---|---|
| MySQL vs PostgreSQL | `web-assistant-portal` usa MySQL + Drizzle | PostgreSQL es canónico. MySQL es transitional | Pendiente migración |
| Express vs NestJS | `web-assistant-portal/server/` tiene Express + tRPC | NestJS canónico. Express transitional | Pendiente consolidación |
| `src/` vs `apps/web/` | 13 páginas y 59 componentes en `src/` no portados | `apps/web/` es destino. `src/` solo como especificación UX | En progreso |
| Worker BullMQ vs polling HTTP | Worker actual usa polling HTTP, arquitectura planifica BullMQ | BullMQ es destino. Polling es transitional | Decidido — migrar en Sprint 2.4 |
| PolicyRule en schema pero sin integración | `PolicyRule` existe en DB pero `PolicyService` no evalúa en transiciones | PolicyService debe integrarse en Jobs, Milestones, Payments | Pendiente Sprint 2.2 |
| Permisos en `rbac.ts` vs seed `PERMISSIONS` | Hay granularidad distinta: rbac.ts tiene permisos granulares como `bids:accept`, seed tiene permisos simples como `bids:read` | Unificar en próximo sprint — `rbac.ts` es más rico y debe prevalecer | Pendiente Sprint 2.1 |
| Refresh tokens no implementados | Auth actual solo emite accessToken sin refreshToken | Implementar `POST /v1/auth/refresh` en Sprint 2.1 | Pendiente |
