# ECOSYSTEM STATUS — Dashboard Maestro

> Última actualización: 2026-03-31 (Sprint 2.2)
> Generado por: sesión Claude Code

---

## LEYENDA DE ESTADOS

| Etiqueta | Significado |
|----------|-------------|
| `CANONICAL:ACTIVE` | Canónico principal. Aquí vive el código que importa. |
| `SATELLITE:ARCHIVED` | Congelado, en archivo. No crece. Fuente de referencia o destilación. |
| `SATELLITE:FROZEN` | Congelado en origen. No tocar. Solo lectura. |
| `PENDING_DISTILLATION` | Tiene valor identificado que debe migrar al canónico en sprint futuro. |
| `DISTILLING` | Actualmente en proceso de destilación hacia el canónico. |
| `FULLY_DISTILLED` | Todo lo valioso fue extraído. Puede archivarse definitivamente. |
| `REFERENCE_ONLY` | Útil solo como referencia histórica. No distilable. |
| `BLOCKED` | No se puede avanzar por dependencia externa. |
| `BOTTLENECK` | Cuello de botella activo — documentado en STATUS.md del componente. |

---

## 1. CANÓNICO

### `project-manager-app`
- **Ruta:** `project-manager-app/`
- **Estado:** `CANONICAL:ACTIVE`
- **Stack:** NestJS 11 + Next.js 15.5 + Prisma 6.4 + PostgreSQL + Zod
- **Sprint actual:** 2.2 — **COMPLETADO** ✅
- **Sprint siguiente:** 2.3 — Storage S3/R2, Stripe sandbox, Disputes completo
- **Build:** ✅ Limpio (EXIT 0, 2026-03-31)
- **Smokes:** ⏳ Requieren Docker + migración DB
- **Migración DB pendiente (acumulada Sprint 2.1 + 2.2):**
  ```bash
  cd packages/db
  npx prisma migrate dev --name "sprint21_refresh_tokens_bid_withdrawn"
  npx prisma migrate dev --name "sprint22_contract_status_fully_signed"
  npx tsx prisma/seed.ts
  ```
- **Rutas Sprint 2.1:**
  - `POST /v1/auth/refresh` ← refresh token rotativo
  - `POST /v1/auth/logout` ← revocación de sesión
  - `PUT /v1/bids/:id/reject` ← cliente rechaza bid
  - `PUT /v1/bids/:id/withdraw` ← pro retira bid
  - `GET /v1/jobs?category=&location=&urgency=&budgetMin=&budgetMax=&page=&limit=` ← filtros completos
- **Rutas Sprint 2.2:**
  - `DELETE /v1/contracts/:contractId` ← cancelar contrato (CLIENT o OPS_ADMIN)
  - `GET /v1/ops/audit?entityType=&entityId=&actorUserId=&action=&fromDate=&toDate=&page=&limit=` ← audit log filtrable y paginado
- **Cuellos de botella actuales:**
  - 🔴 Sin migración DB ejecutada (Sprint 2.1 + Sprint 2.2 acumulados)
  - 🔴 PostgreSQL requiere Docker levantado para smokes
  - 🟡 Frontend (apps/web) no consume aún los endpoints nuevos

---

## 2. SATELLITES EN ARCHIVO

### `web-assistant-portal`
- **Ruta:** `app semse/_satellites-archive/web-assistant-portal/`
- **Estado:** `SATELLITE:ARCHIVED | PENDING_DISTILLATION`
- **Stack original:** Vite + React 19 + Express + tRPC + Drizzle + MySQL
- **Movido a archivo:** 2026-03-31
- **Ver detalle:** `app semse/_satellites-archive/web-assistant-portal/STATUS.md`
- **Próxima destilación:** Sprint 2.5 (Field Ops UI) / Sprint 2.3 (AI Chat hacia cortex)

---

### `semse-control-mvp`
- **Ruta:** `app semse/_satellites-archive/semse-control-mvp/`
- **Estado:** `SATELLITE:FROZEN | PENDING_DISTILLATION`
- **Stack original:** Next.js + Prisma + PostgreSQL
- **Congelado desde:** 2026-03-09
- **Ver detalle:** `app semse/_satellites-archive/semse-control-mvp/STATUS.md`
- **Valor rescatable:** Patrones de worklog, evidence flow, knowledge, reporting, milestone ops
- **Próxima destilación:** Sprint 2.2–2.3 (cuando se trabajen milestones y evidence avanzados)

---

### `Agent_Semse App Maximizada`
- **Ruta:** `app semse/_satellites-archive/Agent_Semse App Maximizada/`
- **Estado:** `SATELLITE:FROZEN | REFERENCE_ONLY`
- **Contenido:** Blueprint K8s + infraestructura ampliada
- **Valor:** Solo referencia de infraestructura futura. No distilable a código, sí a decisiones de arquitectura.
- **Ver detalle:** `app semse/_satellites-archive/Agent_Semse App Maximizada/STATUS.md`

---

### `Agent_Matriz de agentes`
- **Ruta:** `app semse/_satellites-archive/Agent_Matriz de agentes/`
- **Estado:** `SATELLITE:FROZEN | REFERENCE_ONLY`
- **Contenido:** Frontend paralelo experimental
- **Ver detalle:** `app semse/_satellites-archive/Agent_Matriz de agentes/STATUS.md`

---

### `Agent_Chat semántico sobre PDFs`
- **Ruta:** `app semse/_satellites-archive/Agent_Chat semántico sobre PDFs/`
- **Estado:** `SATELLITE:FROZEN | REFERENCE_ONLY`
- **Contenido:** Spike de knowledge chat sobre documentos
- **Valor:** Referencia para RAG en cortex. No distilable directamente.
- **Ver detalle:** `app semse/_satellites-archive/Agent_Chat semántico sobre PDFs/STATUS.md`

---

## 3. PRÓXIMOS SPRINTS (roadmap de ejecución)

| Sprint | Foco | Dependency | Estado |
|--------|------|-----------|--------|
| 2.1 | Auth refresh, RBAC unificado, Jobs filtros, Bids reject/withdraw | - | ✅ COMPLETO |
| 2.2 | ContractStatus FULLY_SIGNED, contracts.policy, reservations.policy, AuditService query | migración DB 2.1 | ✅ COMPLETO |
| 2.3 | Storage S3/R2, Stripe sandbox, Disputes completo | migración DB 2.1+2.2 | ⏳ SIGUIENTE |
| 2.4 | Redis + BullMQ, expiración reservas, NotificationService | 2.3 | PENDIENTE |
| 2.5 | Frontend conectado E2E, auth JWT real en web, E2E tests | 2.4 | PENDIENTE |

---

## 4. CUÁNDO LEER ESTE ARCHIVO

- Al inicio de cada sesión de trabajo
- Antes de tocar cualquier componente del ecosistema
- Antes de crear cualquier archivo nuevo
- Después de completar un sprint (actualizar este dashboard)
