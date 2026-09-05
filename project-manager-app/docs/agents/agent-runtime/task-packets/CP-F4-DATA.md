# TaskPacket CP-F4 — Persistencia aditiva

**Tasks:** T-040..T-048  
**Estado:** COMPLETE_BUILDER_VERIFIED  
**Builder:** Control Plane Data Builder  
**Verifier futuro:** Data Architecture + Security/QA independiente  
**Tasks digest autorizado:**
`sha256:20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa`

## Dependencias satisfechas

- F0 excepto T-006, que solo bloquea F7/T-094;
- F1-F3 completas y verificadas;
- autorización humana posterior para F4, Prisma/PostgreSQL local y lock importer.

## Allowed paths

- `pnpm-lock.yaml` solo para `packages/control-plane: {}`;
- `packages/db/prisma/schema.prisma`;
- migration reservada `20260719000000_semse_os_capability_control_plane`;
- `apps/api/src/modules/capabilities/capabilities.repository.ts`;
- `apps/api/test/capability-persistence.integration.test.ts`;
- evidencia/documentación gobernada asociada.

## Contrato de datos

- cambios exclusivamente aditivos, IDs CUID y timestamps UTC;
- todos los FK indexados y queries tenant/workspace con índices compuestos;
- unique tenant/idempotency, lease/claim CAS y receipt por operation/step;
- transactions cortas; lock order operation → installation → target;
- state + AuditLog + DomainOutboxEvent atómicos antes de cualquier efecto;
- observe-before-apply; drift genera bloqueo/incidente, nunca adopción silenciosa;
- no índices JSONB sin query demostrada y no RLS parcial aislada.

## Verificación

- `prisma format --check` equivalente, validate y generate;
- migrate diff/SQL estático sin drop/alter de tablas existentes;
- PostgreSQL local/efímero: idempotencia, dos claimers, CAS, receipt y rollback
  de transacción state+audit+outbox;
- lockfile contiene solo el importer vacío adicional;
- F5+ permanece ausente.

## Stop conditions

No usar `db push`, Docker, Railway ni DB externa/productiva. No crear controller,
service de negocio, module, worker, queue, executor o seed/RBAC.

## Evidencia del builder

- DDL aditivo y schema Prisma alineados para todas las entidades `Capability*`.
- Catálogo PostgreSQL local: 6 tablas, 11 enums, 15 FKs, 16 checks y 24
  índices no primarios; todos los FKs tienen índice aplicable.
- Suite `capability-persistence.integration.test.ts`: 8 pass, 0 fail, 0 skip.
- `prisma validate` y `generate`: PASS; diff sin deriva F4 y sin mutaciones de
  tablas existentes en la migration.
- El verifier independiente sigue pendiente de F9.
