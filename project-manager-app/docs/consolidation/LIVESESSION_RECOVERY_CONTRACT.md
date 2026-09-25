# Contrato de recuperación — Sesiones en vivo (LiveSession)

Fecha: 2026-09-07. Estado: **PENDIENTE — no integrado en esta consolidación.**

## Por qué no se integró en esta pasada

El spec `mobile-product-consolidation.spec.md` §2, §6 y §7 son explícitos: la
incorporación de sesiones en vivo **debe conservar su spec, modelos, migraciones
y aislamiento antes de activarse**; cualquier recuperación de modelos de
LiveSession se registra en su propio contrato y **SQL aditivo** antes del
despliegue, y **no se ejecutan migraciones de producción durante la consolidación
local**. `analyze.md` lo refuerza: "las sesiones en vivo recuperadas deben
mantener autorización antes de suscribir SSE. Estos puntos requieren corrección
y pruebas, no importación automática."

Traer LiveSession sin ese trabajo violaría el propio contrato de la consolidación
y `DOMAIN_INVARIANTS.md` (nuevas transiciones de estado + escritura de datos).

## Dónde está la fuente

`C:\Users\SEMSEproject\project-manager-app-main\project-manager-app`:
- Árbol **sin Git**, ~1 GB, marcado como duplicado obsoleto ("no tocar") en
  notas de sesiones previas. No es un origen versionado.
- `packages/db/prisma/schema.prisma` contiene el modelo:

```prisma
model LiveSession {
  id             String   @id @default(cuid())
  tenantId       String
  scopeType      LiveSessionScopeType   // enum
  scopeId        String
  purpose        LiveSessionPurpose     // enum
  status         LiveSessionStatus @default(REQUESTED)  // FSM
  version        Int      @default(0)
  createdById    String
  idempotencyKey String
  expiresAt      DateTime?
  endedAt        DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdBy      User     @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, status, createdAt])
  @@index([tenantId, scopeType, scopeId, status])
  @@index([tenantId, createdById, createdAt])
}
```
más los enums `LiveSessionStatus` / `LiveSessionScopeType` / `LiveSessionPurpose`
y relaciones inversas en `Tenant.liveSessions` y `User.liveSessionsCreated`.

El cliente móvil del spike (`apps/mobile` de ese mismo árbol) es prototipo
retirado (PR #439) y **no** contiene UI de LiveSession utilizable — hay que
partir del modelo + los endpoints, no de ese cliente.

## Qué exige una recuperación correcta (flujo SDD completo)

1. **spec** `docs/specs/api/live-sessions.spec.md` — FSM (`REQUESTED → …`),
   `scopeType`/`purpose`, `idempotencyKey`, `expiresAt`, `paymentGovernance: N/A`,
   `sse: sí` (suscripción autenticada, cierre al salir), `auditLog` de creación/fin.
2. **plan + tasks + checklist + analyze**.
3. **Migración Prisma aditiva** (`prisma migrate dev --name add_live_session`) —
   solo `CREATE TABLE`/`CREATE TYPE`/`CREATE INDEX`, nada destructivo; nunca
   `migrate deploy` a producción desde local.
4. **Tipos en `packages/schemas/src/`** (contrato Zod del record + inputs).
5. **Endpoints en `apps/api`** con `@RequirePermissions`, scope por tenant,
   ownership (`createdById`), idempotencia por `@@unique([tenantId, idempotencyKey])`.
6. **Tests de ownership/aislamiento** — un tenant no ve ni termina sesiones de otro.
7. **Cliente móvil**: pantalla + `src/api/liveSessions.ts` contra los endpoints
   reales; **LiveKit/capacidades nativas NO se cargan en Expo Go** (solo
   development build); estado "no disponible" explicado cuando corresponda.
8. **Canary autenticado** en device nativo antes de activar.

## Gate

`mobile-product-consolidation.tasks.md` T-022 queda `[~]` (bloqueado) hasta que
exista `live-sessions.spec.md` aprobado y su migración aditiva verificada en
local. La consolidación móvil puede cerrar sin esto; LiveSession es su propio
entregable.
