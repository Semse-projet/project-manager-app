# F0 — Reconciliacion de arquitectura y fuentes de verdad

**Fecha:** 2026-07-12
**Ramas:** `docs/architecture-master-f0`, `chore/sdd-baseline-repair`
**Base de cierre:** `main@80421571197c4ae1704dc9eddc2db1fe2d943b0c`

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
- Se normalizo la metadata canónica de specs legacy sin promover borradores.
- Se corrigio el validador para reconocer rutas NestJS compuestas por
  `@Controller` + decorator de handler en un mismo archivo.
- Se retiraron del metadata local referencias externas o puramente futuras; su
  alcance permanece documentado dentro de los specs correspondientes.
- Multi-stage Releases paso de `READY` a `IMPLEMENTED`: hay controller,
  service y test, pero se mantuvo fuera de `VERIFIED` hasta fortalecer pruebas
  de persistencia y pagos reales.

## Validacion

| Validacion | Resultado |
| --- | --- |
| `git diff --check` | PASS |
| Enlaces relativos en documentos canónicos | PASS |
| `node --check scripts/spec-index.mjs` | PASS |
| `pnpm spec:index` dos veces, mismo SHA-256 | PASS |
| `pnpm spec:coverage` | PASS: 63 specs; 92% con tests; 71% VERIFIED |
| `pnpm spec:validate -- --strict` | PASS: 63 specs; 0 errores; 0 warnings |

## Cierre de la deuda SDD

La linea base inicial tenia 17 errores y 15 warnings, concentrados en:

- metadata faltante en `rbac-explicit-boundary`, `readiness` y
  `m3.1-multi-stage-releases`;
- rutas externas/obsoletas en specs de Alexa, Graphify, storage y observer;
- endpoints declarados que el validador no encuentra;
- estado legacy `READY`.

Cada caso fue contrastado contra el arbol real antes de modificarlo. Los specs
de capacidades futuras conservaron `DRAFT`; las rutas externas de Alexa siguen
documentadas como dependencia fuera del monorepo, no como `related_files`
locales. F0 queda cerrado con el gate estricto en verde.

## Siguiente slice recomendado

Escribir el spec de F1 Event Backbone con un primer slice vertical. No
implementar outbox/Prisma antes de aprobar:

- envelope v2;
- compatibilidad v1;
- modelo outbox;
- ownership del dispatcher;
- idempotencia de consumer;
- DLQ/replay;
- migration y rollback;
- acceptance tests.
