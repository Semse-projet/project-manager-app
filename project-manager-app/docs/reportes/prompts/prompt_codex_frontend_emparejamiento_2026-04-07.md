# Prompt para Codex — Emparejamiento frontend SEMSE

> Copia todo lo que está entre las líneas `---PROMPT START---` y `---PROMPT END---` y dáselo a Codex como contexto completo.

---PROMPT START---

## Proyecto

Eres un agente de codificación trabajando en el monorepo **SEMSE OS** ubicado en:

```
/home/yoni/labsemse/project-manager-app/
```

Stack:
- Frontend: Next.js 15 + React 19 + TypeScript — `apps/web/`
- Backend: NestJS 11 + Fastify — `apps/api/`
- DB: PostgreSQL + Prisma — `packages/db/`
- Validación: Zod — `packages/schemas/`

---

## Reglas obligatorias

1. **Leer antes de escribir** — Lee cada archivo referenciado antes de modificarlo.
2. **No borrar código existente** — Sólo agrega o reemplaza secciones específicas (datos mock → llamadas reales).
3. **Mismo estilo visual** — Mantén exactamente el mismo tema dark, tamaños de fuente, border-radius y colores de cada página.
4. **Texto en español** — Todo UI text permanece en español (México).
5. **TypeScript limpio** — Después de cada tarea ejecuta `npm exec tsc --workspace @semse/web -- --noEmit` y corrige todos los errores antes de continuar.
6. **No crear comentarios** salvo que el archivo original los tenga.
7. **Patrón de proxy** — Todos los API routes de Next.js deben seguir el patrón de `_server.ts`.

---

## Patrón de proxy routes (OBLIGATORIO seguirlo exactamente)

El archivo `apps/web/app/api/semse/_server.ts` expone:

```typescript
// Para usar en GET handlers (sin body):
fetchSemseData<T>(path: string, init?: RequestInit): Promise<T>

// Para usar en handlers con sesión del usuario:
fetchSemseDataForRequest<T>(path: string, req: NextRequest, init?: RequestInit): Promise<T>

// Para respuestas de error:
handleServerError(error: unknown): NextResponse
runtimeDisabledResponse(): NextResponse
```

**Ejemplo de GET proxy** (copia este patrón exacto):

```typescript
// apps/web/app/api/semse/jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>("/v1/jobs", request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
```

**Ejemplo de proxy con param dinámico**:

```typescript
// apps/web/app/api/semse/jobs/[jobId]/milestones/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const data = await fetchSemseData<Record<string, unknown>[]>(`/v1/jobs/${jobId}/milestones`);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
```

---

## Patrón de cliente semse-api.ts

El archivo `apps/web/app/semse-api.ts` contiene todas las funciones del cliente. El patrón para GET es:

```typescript
export async function fetchJobPayments(jobId: string): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/jobs/${jobId}/payments`);
}
```

Para POST/mutaciones:
```typescript
export async function approveJobMilestone(milestoneId: string): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/milestones/${milestoneId}/approve`);
}
```

---

## Endpoints del backend disponibles

### Jobs
- `GET /v1/jobs` — lista jobs (query: status, orgId, limit)
- `GET /v1/jobs/:jobId` — detalle del job
- `POST /v1/jobs` — crear job

### Milestones
- `GET /v1/jobs/:jobId/milestones` — lista milestones del job
- `POST /v1/jobs/:jobId/milestones` — crear milestone
- `POST /v1/milestones/:milestoneId/submit` — enviar milestone
- `POST /v1/milestones/:milestoneId/approve` — aprobar milestone
- `POST /v1/milestones/:milestoneId/reject` — rechazar (body: `{ reason: string }`)
- `POST /v1/milestones/:milestoneId/request-changes` — pedir cambios (body: `{ reason: string }`)

### Payments / Escrow
- `GET /v1/jobs/:jobId/escrow` — estado del escrow
- `POST /v1/jobs/:jobId/escrow/fund` — fondear escrow
- `GET /v1/jobs/:jobId/payments` — historial de transacciones
- `POST /v1/milestones/:milestoneId/escrow/release` — liberar pago del milestone

### Evidence
- `GET /v1/jobs/:jobId/evidence` — evidencias del job
- `POST /v1/evidence/presign` — pre-firmar upload (body: `{ jobId, milestoneId?, contentType, filename }`)
- `POST /v1/evidence` — registrar evidencia (body: `{ jobId, milestoneId?, kind, bucketKey, contentType, checksum }`)

### Contracts
- `GET /v1/jobs/:jobId/contracts/current` — contrato activo
- `POST /v1/jobs/:jobId/contracts` — crear contrato
- `POST /v1/contracts/:contractId/sign` — firmar contrato

### Disputes
- `GET /v1/disputes` — lista disputes
- `POST /v1/disputes` — crear disputa (body: `{ jobId, milestoneId?, reason }`)
- `POST /v1/disputes/:disputeId/resolve` — resolver (body: `{ resolution: string }`)

### Field-Ops
- `GET /v1/field-ops/units` — lista unidades (query: projectId, status)
- `GET /v1/field-ops/units/:unitId` — detalle unidad
- `PUT /v1/field-ops/units/:unitId/status` — cambiar status (body: `{ status: "PENDING"|"IN_PROGRESS"|"COMPLETE"|"ON_HOLD"|"CANCELLED" }`)
- `POST /v1/field-ops/units` — crear unidad
- `GET /v1/field-ops/worklogs` — lista worklogs (query: fieldUnitId, dateFrom, dateTo)
- `POST /v1/field-ops/worklogs` — crear worklog
- `GET /v1/field-ops/facts` — lista facts (query: subject, predicate)
- `POST /v1/field-ops/facts` — crear fact
- `GET /v1/field-ops/vendors` — lista vendors
- `POST /v1/field-ops/vendors` — crear vendor

### Ops
- `GET /v1/ops/audit` — audit log (últimos 100 eventos)
- `GET /v1/ops/risk-scores` — risk scores
- `GET /v1/ops/trust-overview` — trust overview por jobs
- `GET /v1/ops/dashboard` — dashboard de ops
- `GET /v1/ops/agent-runtime` — lista runs de agentes (query: eventType, status, agentType, limit)
- `GET /v1/ops/agent-runtime/:correlationId` — trace de un run

### Organizations (nuevo)
- `GET /v1/organizations` — lista orgs del tenant
- `GET /v1/organizations/:orgId` — detalle de org
- `GET /v1/organizations/:orgId/members` — miembros de la org

---

## Proxy routes que YA EXISTEN (no recrear)

```
app/api/semse/
├── _server.ts
├── auth/token/route.ts
├── control-surface/route.ts
├── cortex/route.ts, chat/route.ts, runtime/[correlationId]/route.ts
├── disputes/route.ts, [disputeId]/resolve/route.ts
├── domain-events/route.ts, [correlationId]/route.ts
├── evidence/presign/route.ts
├── field-ops/
│   ├── facts/route.ts               ← GET+POST /v1/field-ops/facts
│   ├── units/route.ts               ← GET+POST /v1/field-ops/units
│   ├── units/[unitId]/route.ts      ← GET /v1/field-ops/units/:id
│   ├── units/[unitId]/status/route.ts ← PUT /v1/field-ops/units/:id/status
│   ├── vendors/route.ts             ← GET+POST /v1/field-ops/vendors
│   ├── vendors/[vendorId]/compliance/route.ts
│   └── worklogs/route.ts            ← GET+POST /v1/field-ops/worklogs
├── jobs/route.ts                    ← GET+POST /v1/jobs
├── jobs/[jobId]/route.ts            ← GET /v1/jobs/:jobId
├── jobs/[jobId]/escrow/route.ts     ← GET+POST /v1/jobs/:jobId/escrow
├── jobs/[jobId]/evidence/route.ts   ← GET /v1/jobs/:jobId/evidence
├── jobs/[jobId]/milestones/route.ts ← GET+POST /v1/jobs/:jobId/milestones
├── milestones/[milestoneId]/[action]/route.ts ← POST submit/approve/reject/request-changes
├── milestones/[milestoneId]/release/route.ts  ← POST release escrow
└── ops/
    ├── agent-runtime/route.ts
    ├── agent-runtime/[correlationId]/route.ts
    ├── agent-runtime/[runId]/retry/route.ts
    ├── agent-runtime/[runId]/requeue/route.ts
    ├── alerts/[alertId]/ack/route.ts
    ├── incidents/route.ts
    └── runbooks/[runbookId]/execute/route.ts
```

---

## Enums del schema Prisma

```
JobStatus:       DRAFT | POSTED | PUBLISHED | RESERVED | ACCEPTED | IN_PROGRESS | REVIEW | DISPUTE | COMPLETED | AWARDED | CANCELLED
MilestoneStatus: DRAFT | AWAITING_REVIEW | SUBMITTED | APPROVED | REJECTED | PAID
PaymentTxnType:  DEPOSIT | RELEASE | HOLDBACK | FEE | REFUND
PaymentTxnStatus:PENDING | SUCCEEDED | FAILED | REVERSED
DisputeStatus:   OPEN | ASSIGNED | UNDER_REVIEW | RESOLVED | REJECTED
EvidenceKind:    PHOTO | VIDEO | DOCUMENT
FieldUnitStatus: PENDING | IN_PROGRESS | COMPLETE | ON_HOLD | CANCELLED
```

---

## TAREA 1 — Crear página de detalle de job `/client/jobs/[jobId]/page.tsx`

**Archivo a crear:**
`apps/web/app/(app)/client/jobs/[jobId]/page.tsx`

**Esta página NO existe.** Créala desde cero.

**Comportamiento:**
- Es una página `"use client"` con `useParams()` para extraer `jobId`
- Al montar, carga en paralelo (Promise.all o useEffect separados):
  - `fetchJob(jobId)` → `GET /api/semse/jobs/:jobId`
  - `fetchJobMilestones(jobId)` → `GET /api/semse/jobs/:jobId/milestones`
  - `fetchJobEscrow(jobId)` → `GET /api/semse/jobs/:jobId/escrow`
  - `fetchJobEvidence(jobId)` → `GET /api/semse/jobs/:jobId/evidence`
- Muestra estados de loading (skeleton) y error

**Layout de la página (4 secciones):**

**Sección A — Header del job:**
- Badge de estado (`job.status`) con color según JobStatus
- Título del job (`job.title`)
- Descripción/scope (`job.scope` o `job.description`)
- Presupuesto: `$job.budgetMin – $job.budgetMax`
- Metadatos: categoría, ubicación, urgencia, deadline

**Sección B — Escrow panel:**
- Estado del escrow: `funded | pending | released | in_dispute`
- Total amount, holdback %, montos retenidos/liberados
- Si `escrow.status !== "FUNDED"`: botón "Fondear escrow"
- Lista de transacciones con tipo (DEPOSIT/RELEASE/FEE) y status

**Sección C — Milestones timeline:**
- Lista vertical de milestones en orden de `sequence`
- Cada milestone muestra: título, amount, status badge
- Si `status === "SUBMITTED"` o `"AWAITING_REVIEW"`: botones "Aprobar" y "Pedir cambios"
  - Aprobar llama `mutateMilestone(milestoneId, "approve")`
  - Pedir cambios abre un input inline para ingresar `reason`, luego llama `mutateMilestone(milestoneId, "request-changes", { reason })`
- Si `status === "APPROVED"`: botón "Liberar pago" → `releaseMilestoneEscrow(milestoneId)`
- Recargar milestones después de cada acción

**Sección D — Evidencias:**
- Grid de evidencias (foto/video/documento) con thumbnails o iconos
- Cada item: kind badge, filename/key, fecha de upload
- Si no hay evidencias: estado vacío

**Estilo:** Mismo tema dark que el resto de las páginas admin/client del proyecto. Usa `var(--ink)`, `var(--muted)`, `var(--surface)`, `var(--border)`, `var(--brand)`, `var(--accent)`. Border-radius 12-16px. Font sizes 11-22px.

**Funciones de semse-api.ts a usar** (ya existen):
- `fetchJob(jobId)` — si no existe, créala como `fetchSemse<Record<string, unknown>>(`/api/semse/jobs/${jobId}`)`
- `fetchJobMilestones(jobId)` — ya existe
- `fetchJobEscrow(jobId)` — ya existe
- `fetchJobEvidence(jobId)` — ya existe
- `mutateMilestone(milestoneId, action, body?)` — ya existe
- `releaseMilestoneEscrow(milestoneId)` — ya existe

**Proxy routes necesarios** (crear sólo si no existen):
- `GET /api/semse/jobs/[jobId]/payments/route.ts` → `fetchSemseData<...>(`/v1/jobs/${jobId}/payments`)`
- `GET /api/semse/jobs/[jobId]/contracts/current/route.ts` → `fetchSemseData<...>(`/v1/jobs/${jobId}/contracts/current`)`

---

## TAREA 2 — Conectar `/client/milestones/page.tsx` a API real

**Archivo a modificar:**
`apps/web/app/(app)/client/milestones/page.tsx`

**Actualmente:** Usa el array estático `MILESTONES_DATA`.

**Cambio requerido:**
1. Eliminar la variable `MILESTONES_DATA` y toda su declaración
2. Agregar `useEffect` que:
   a. Llama `fetchJobs()` → `GET /api/semse/jobs`
   b. Para cada job activo (status IN_PROGRESS, REVIEW, ACCEPTED), llama `fetchJobMilestones(jobId)`
   c. Agrupa los milestones por job
3. Mientras carga: mostrar skeleton o spinner donde estaba la tabla
4. Si hay error: mostrar mensaje de error inline
5. Los datos reales tienen esta forma (ajustar los campos del template):
   ```typescript
   // Job:
   { id, title, status, budgetMin, budgetMax }
   // Milestone:
   { id, title, amount, status, sequence, jobId }
   ```
6. Los botones "Aprobar" y "Rechazar" que existan en la UI deben llamar `mutateMilestone(milestoneId, "approve")` y `mutateMilestone(milestoneId, "reject", { reason })` respectivamente, con recarga posterior
7. **Mantener exactamente el mismo layout visual** — sólo cambia la fuente de datos

---

## TAREA 3 — Conectar `/client/payments/page.tsx` a API real

**Archivo a modificar:**
`apps/web/app/(app)/client/payments/page.tsx`

**Actualmente:** Usa el array estático `TRANSACTIONS` y `TYPE_CONFIG`.

**Cambio requerido:**
1. Eliminar `TRANSACTIONS` (mantener `TYPE_CONFIG` si se usa para labels/colores)
2. Agregar `useEffect` que:
   a. Llama `fetchJobs()` para obtener todos los jobs del usuario
   b. Para cada job llama `fetch(`/api/semse/jobs/${job.id}/payments`)` y agrega `jobId` + `jobTitle` a cada transacción
   c. Concatena y ordena por fecha desc
3. Mientras carga: spinner o skeleton
4. Si hay error: mensaje inline
5. Cada transacción real tiene:
   ```typescript
   { id, type, amount, status, providerRef, createdAt, milestoneId? }
   ```
   - `type`: DEPOSIT | RELEASE | HOLDBACK | FEE | REFUND
   - `amount`: number (puede ser Decimal string, convertir con `Number()`)
   - `status`: PENDING | SUCCEEDED | FAILED | REVERSED
6. Mantener el mismo layout de tabla/lista, sólo cambiar los datos

**Proxy route a crear** (si no existe):
```
apps/web/app/api/semse/jobs/[jobId]/payments/route.ts
```
→ `GET /v1/jobs/:jobId/payments`

---

## TAREA 4 — Conectar `/admin/field-ops/page.tsx` a API real

**Archivo a modificar:**
`apps/web/app/(app)/admin/field-ops/page.tsx`

**Actualmente:** Usa `DEMO_UNITS`, `DEMO_WORKLOGS`, `DEMO_FACTS`, `DEMO_VENDORS`.

**Los proxy routes YA EXISTEN:**
- `/api/semse/field-ops/units` → GET/POST
- `/api/semse/field-ops/units/[unitId]` → GET
- `/api/semse/field-ops/units/[unitId]/status` → PUT
- `/api/semse/field-ops/worklogs` → GET/POST
- `/api/semse/field-ops/facts` → GET/POST
- `/api/semse/field-ops/vendors` → GET/POST

**Cambio requerido:**
1. Eliminar todos los arrays `DEMO_*`
2. Crear funciones en `semse-api.ts` para cada endpoint (si no existen):
   ```typescript
   fetchFieldUnits(query?: { status?: string }): Promise<...>
   fetchFieldWorklogs(query?: { fieldUnitId?: string }): Promise<...>
   fetchFieldFacts(query?: { subject?: string }): Promise<...>
   fetchFieldVendors(): Promise<...>
   ```
   Usando `fetchSemse<...>("/api/semse/field-ops/units")` etc.
3. Cargar datos reales al montar con `useEffect`
4. Cada pestaña (Units, Worklogs, Knowledge/Facts, Vendors) carga sus datos de forma independiente
5. Mantener el mismo layout de pestañas y filtros
6. Adaptar los campos del template a la forma real de los datos:
   ```typescript
   // FieldUnit: { id, code, name, address, status, metadataJson }
   // WorklogEntry: { id, date, doneToday, pendingNext, blockers, notes, createdBy }
   // KnowledgeFact: { id, subject, predicate, object, confidence }
   // Vendor: { id, name, phone, email, notes }
   ```

---

## TAREA 5 — Conectar `/worker/tracker/page.tsx` a API real

**Archivo a modificar:**
`apps/web/app/(app)/worker/tracker/page.tsx`

**Actualmente:** Usa arrays `JOBS` y `WORKLOG` estáticos.

**Cambio requerido:**
1. Eliminar array `JOBS` estático
2. Al montar, cargar `fetchJobs()` filtrando por status `IN_PROGRESS` o `ACCEPTED`
3. El selector de job usa los jobs reales
4. El timer y formulario de worklog siguen funcionando igual (pueden ser estado local)
5. Si hay un endpoint de worklog disponible (`POST /api/semse/field-ops/worklogs`), el botón de guardar worklog debe hacer la llamada real:
   ```typescript
   // body: { fieldUnitId: selectedJobId, date, doneToday, pendingNext, blockers, notes }
   ```
6. Mantener el mismo layout visual del timer, selector y formulario

---

## TAREA 6 — Crear proxies faltantes de Ops y Organizations

Crear estos archivos de proxy:

### `apps/web/app/api/semse/ops/audit/route.ts`
```typescript
// GET → /v1/ops/audit
```

### `apps/web/app/api/semse/ops/trust-overview/route.ts`
```typescript
// GET → /v1/ops/trust-overview
```

### `apps/web/app/api/semse/ops/risk-scores/route.ts`
```typescript
// GET → /v1/ops/risk-scores
```

### `apps/web/app/api/semse/organizations/route.ts`
```typescript
// GET → /v1/organizations
```

### `apps/web/app/api/semse/organizations/[orgId]/route.ts`
```typescript
// GET → /v1/organizations/:orgId
```

### `apps/web/app/api/semse/organizations/[orgId]/members/route.ts`
```typescript
// GET → /v1/organizations/:orgId/members
```

Todos usando el patrón estándar de `_server.ts` con `fetchSemseDataForRequest`.

---

## TAREA 7 — Agregar funciones a semse-api.ts

Agregar al final de `apps/web/app/semse-api.ts` las funciones que falten (leer el archivo primero para no duplicar):

```typescript
// Field-ops (si no existen)
export async function fetchFieldUnits(query?: { status?: string }): Promise<Record<string, unknown>[]>
export async function fetchFieldWorklogs(query?: { fieldUnitId?: string }): Promise<Record<string, unknown>[]>
export async function fetchFieldFacts(): Promise<Record<string, unknown>[]>
export async function fetchFieldVendors(): Promise<Record<string, unknown>[]>

// Payments
export async function fetchJobPayments(jobId: string): Promise<Record<string, unknown>[]>

// Contracts
export async function fetchJobContract(jobId: string): Promise<Record<string, unknown>>

// Organizations
export async function fetchOrganizations(): Promise<Record<string, unknown>[]>
export async function fetchOrganizationMembers(orgId: string): Promise<Record<string, unknown>[]>

// Ops
export async function fetchOpsAuditLog(): Promise<Record<string, unknown>[]>
export async function fetchOpsTrustOverview(): Promise<Record<string, unknown>>
export async function fetchOpsRiskScores(): Promise<Record<string, unknown>[]>
```

Para funciones con query params opcionales:
```typescript
export async function fetchFieldUnits(query?: { status?: string }): Promise<Record<string, unknown>[]> {
  const params = query?.status ? `?status=${query.status}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/field-ops/units${params}`);
}
```

---

## Orden de ejecución

Ejecutar en este orden para minimizar bloqueos:

```
1. TAREA 7 — Funciones en semse-api.ts (todas las páginas dependen de esto)
2. TAREA 6 — Proxy routes nuevos (no dependen de nada)
3. TAREA 3 — Crear proxy jobs/[jobId]/payments (necesario para TAREA 3 y 1)
4. TAREA 1 — Página /client/jobs/[jobId] (la más crítica del MVP)
5. TAREA 2 — /client/milestones conectado
6. TAREA 3 — /client/payments conectado
7. TAREA 4 — /admin/field-ops conectado
8. TAREA 5 — /worker/tracker conectado
```

---

## Verificación final

Después de completar TODAS las tareas:

```bash
cd /home/yoni/labsemse/project-manager-app
npm exec tsc --workspace @semse/web -- --noEmit
```

Debe terminar con **0 errores**.

Luego iniciar el servidor de desarrollo:
```bash
npm run dev:web
```

Y verificar que:
- `/client/jobs` lista jobs reales
- `/client/jobs/[un-id-real]` carga el detalle con milestones y escrow
- `/client/milestones` muestra milestones agrupados por job
- `/client/payments` muestra transacciones reales
- `/admin/field-ops` carga units/worklogs/vendors/facts reales
- `/worker/tracker` lista los jobs reales en el selector

---PROMPT END---
