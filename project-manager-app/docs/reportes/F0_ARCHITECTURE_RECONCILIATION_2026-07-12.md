# F0 — Reconciliacion de arquitectura y fuentes de verdad

**Fecha:** 2026-07-12
**Rama:** `docs/architecture-master-f0`
**Base auditada:** `main@b7691f4e209a4fdce250da063b75b790bd48679d`

## Objetivo

Convertir la arquitectura maestra de SEMSE en documentacion canónica verificada
contra el repositorio y el despliegue, sin tratar propuestas futuras como
implementacion existente.

## Hallazgos principales

1. El Blueprint y roadmap raiz describian todavia una app local sin API, DB,
   auth o monorepo.
2. La taxonomia aprobada de nueve dominios si mapea codigo real y se conserva.
3. Prometeo Runtime P2 ya esta en `main` y produccion; el 404 historico de
   `/v1/prometeo/tools` fue reemplazado por 401 sin autenticacion.
4. Domain Events existe como schema Zod, AuditLog, bus y routing, pero no como
   outbox transaccional general.
5. Communications tiene persistencia de deliveries, pero el provider se invoca
   en el mismo flujo; no equivale al backbone durable objetivo.
6. Prometeo declara 23 tools read y 7 write; 17 casos read estan cableados. Las
   mutaciones permanecen bloqueadas.
7. `PaymentTxn` y ledgers verticales no forman un ledger double-entry comun.
8. Mission Control, observabilidad, storage, offline y DR existen parcialmente.

## Cambios realizados

- Se creo `docs/architecture/CURRENT_ARCHITECTURE.md`.
- Se creo `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`.
- Se creo `docs/SEMSE_CONTEXT.md`.
- Se reemplazo el roadmap obsoleto por el programa F0-F9.
- Se enlazaron las nuevas fuentes desde README y SPEC_INDEX.
- Se marcaron blueprints, roadmaps y mapas historicos como supersedidos.
- Se corrigio `scripts/spec-index.mjs` para generar enlaces relativos validos y
  producir salida idempotente.

## Validacion

| Validacion | Resultado |
| --- | --- |
| `git diff --check` | PASS |
| Enlaces relativos en documentos canónicos | PASS |
| `node --check scripts/spec-index.mjs` | PASS |
| `pnpm spec:index` dos veces, mismo SHA-256 | PASS |
| `pnpm spec:coverage` | PASS: 63 specs; 83% con tests; 71% VERIFIED |
| `pnpm spec:validate` | FAIL baseline: 17 errores y 15 warnings no introducidos por F0 |

## Deuda SDD que impide cerrar F0 completo

Los 17 errores se concentran en:

- metadata faltante en `rbac-explicit-boundary`, `readiness` y
  `m3.1-multi-stage-releases`;
- rutas externas/obsoletas en specs de Alexa, Graphify, storage y observer;
- endpoints declarados que el validador no encuentra;
- estado legacy `READY`.

No se corrigieron mecanicamente porque requieren decidir si cada spec es
vigente, externa, reemplazada o debe actualizar su evidencia real.

## Siguiente slice recomendado

Cerrar la deuda de `spec:validate` y luego escribir el spec de F1 Event Backbone
con un primer slice vertical. No implementar outbox/Prisma antes de aprobar:

- envelope v2;
- compatibilidad v1;
- modelo outbox;
- ownership del dispatcher;
- idempotencia de consumer;
- DLQ/replay;
- migration y rollback;
- acceptance tests.
