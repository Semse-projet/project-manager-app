# Plan de migración — SEMSE OS Capability Control Plane

**Estado:** IMPLEMENTED_LOCAL_VERIFIED
**Fecha:** 2026-07-19
**Task:** T-007
**Riesgo:** critical
**Scope:** F4 aditiva autorizada; solo PostgreSQL local/efímero
**Ruta implementada:**
`packages/db/prisma/migrations/20260719000000_semse_os_capability_control_plane/migration.sql`

La ruta se confirmó libre antes de F4 y fue creada bajo la aprobación ligada a
`sha256:20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa`.
No se aplicó a staging ni producción.

## Decisiones de compatibilidad

1. Se agregan tablas/enums; no se alteran ni backfillean tablas de negocio.
2. IDs conservan `String @default(cuid())`, convención actual del monorepo. No se
   introduce una extensión UUIDv7 en este slice.
3. Timestamps nuevos se diseñan como `timestamptz(3)`/UTC y deben validarse con
   Prisma migrate diff antes de aceptar el SQL.
4. JSON se limita a manifest, policy decision, plan y output ya redactado; no se
   crean índices JSONB sin una query demostrada.
5. No se introduce RLS aislada para estas tablas: authorization sigue en API +
   repository tenant-scoped, igual que el backend canónico. Least privilege de
   la identidad de aplicación sigue siendo obligatorio.

## Gap resuelto: no existe tabla `Workspace`

El schema actual no tiene agregado Prisma `Workspace`. Para evitar ampliar scope,
`workspaceId` será un identificador opaco acotado por `tenantId` y validado por
ownership en el backend; no tendrá FK en esta migration. Todos los uniques e
índices que lo usan comienzan por `tenantId`. Crear una tabla Workspace requiere
un spec/ADR separado.

`CapabilityInstallation` incluye `capabilityName`, ya presente en el contrato
TypeScript, para imponer una instalación por capability/workspace sin confundir
la identidad estable con la versión de `CapabilityDefinition`.

## Tablas y constraints

| Tabla | Campos/constraints mínimos | Relaciones |
| --- | --- | --- |
| `CapabilityDefinition` | name, version, publisher, manifestJson, manifestDigest, status; unique(name, version) | global, sin tenant |
| `RuntimeTarget` | tenantId, workspaceId, kind, name, configRef, status; unique(tenantId, workspaceId, name) | Tenant |
| `CapabilityInstallation` | tenantId, orgId, workspaceId, capabilityName, definitionId, runtimeTargetId, desired/observed state, versions, configurationRevision, lastOperationId, observedAt; unique(tenantId, workspaceId, capabilityName) | Tenant, Org, Definition, Target |
| `CapabilityOperation` | installationId, intent, status, risk, idempotencyKey, policyDecisionJson, planJson, planDigest, correlationId, requester, nextAttemptAt y lease fields; unique(tenantId, idempotencyKey) | Tenant, Installation |
| `CapabilityOperationApproval` | operationId, mode, slot, status, bindings, requester/decider, reason y expiración; unique(operationId, mode, slot) | Tenant, Operation, Target, User actors |
| `CapabilityExecutionReceipt` | operationId, stepId, adapterKind, status, outputJsonRedacted y tiempos; unique(operationId, stepId) | Operation |

Constraints adicionales:

- `configurationRevision >= 1`;
- expiry posterior a creation y decision solo con actor/timestamp;
- requester distinto de decider en cada fila;
- partial unique `(operationId, decidedByUserId)` cuando decider no es null;
- receipt completedAt no anterior a startedAt;
- enums cerrados para intent, lifecycle, risk, approval y receipt status;
- FKs críticas usan `Restrict`/`SetNull` según auditoría; no hay cascade que
  borre operations/approvals/receipts por eliminar definition o target.

Dos aprobadores humanos distintos para `critical` es una invariance entre filas
y se aplica en service/policy dentro de la transacción; el índice parcial evita
que una identidad cuente dos veces.

## Índices mínimos

- índice en cada FK; PostgreSQL no los crea automáticamente;
- `RuntimeTarget(tenantId, workspaceId, status)`;
- `CapabilityInstallation(tenantId, workspaceId, observedState)` y
  `(runtimeTargetId, observedState)`;
- `CapabilityOperation(tenantId, workspaceId, status, createdAt)`;
- `CapabilityOperation(installationId, status, createdAt)`;
- claim index `(tenantId, status, nextAttemptAt, lockExpiresAt)`;
- `CapabilityOperationApproval(tenantId, status, expiresAt)`;
- `CapabilityExecutionReceipt(operationId, status)`.

La columna de igualdad queda antes que tiempo/rango. Índices parciales para
pending/active se añaden solo si EXPLAIN y cardinalidad real justifican el costo.
No se particionan tablas en MVP.

## Concurrencia y transacciones

- claim atómico con `FOR UPDATE SKIP LOCKED` o update equivalente;
- orden de locks estable: operation -> installation -> runtime target;
- compare-and-set por status/configurationRevision;
- transacciones cortas con statement/lock timeout acotado;
- ninguna llamada Docker, red o broker dentro de la transacción;
- state + AuditLog + outbox se confirman juntos;
- retries reutilizan operation/digest y receipts impiden doble apply.

## Secuencia ejecutada en F4

1. Se confirmó baseline y que la ruta reservada seguía libre.
2. Se modificó `schema.prisma` dentro de `CP-F4-DATA` aprobado.
3. Se creó/revisó el SQL línea por línea; no se usó `db push`.
4. Se verificaron nombres de constraints, tipos UTC, todos los FK indexes y ausencia
   de cambios/drop sobre tablas existentes.
5. `prisma validate`, generate y migrate diff estático ejecutados.
6. Se aplicaron las 64 migrations solo a PostgreSQL efímero/local y se pasaron
   CP-005/006/011/012.
7. Executor y API capability permanecen sin wiring hasta gates posteriores.

## Rollback

Rollback operacional durante incidentes:

1. kill switch OFF;
2. detener claims y esperar/expirar leases;
3. conservar operations, approvals, receipts, AuditLog y outbox;
4. volver código a read-only/dry-run compatible;
5. no ejecutar down migration destructiva.

Antes de que exista cualquier dato y solo en una base efímera, el SQL inverso
puede validarse como ejercicio de migración. Staging/producción requieren un
DecisionPackage separado; este plan no los autoriza.

## Evidencia requerida para cerrar T-040/T-048

- migrate diff sin drops/alter de tablas existentes;
- listado de FKs e índices esperado vs real;
- tests concurrentes con dos claimers;
- rollback transaccional state+outbox;
- query plans de claims/listados tenant-scoped;
- conteos cero antes/después y ausencia de data backfill;
- revisión independiente Data Architecture + Security.
