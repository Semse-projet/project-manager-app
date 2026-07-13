# Contexto operativo canónico de SEMSEproject

**Leer antes de planificar o modificar SEMSE.**
**Corte verificado:** 2026-07-12

## Identidad

SEMSEproject es un sistema operativo modular para coordinar personas,
organizaciones, proyectos, trabajo de campo, evidencia, pagos, confianza,
conocimiento e IA.

- Repositorio: `Semse-projet/project-manager-app`.
- Raiz de aplicacion: `project-manager-app/`.
- Arquitectura vigente: [`architecture/CURRENT_ARCHITECTURE.md`](architecture/CURRENT_ARCHITECTURE.md).
- Estado de capacidades: [`architecture/IMPLEMENTATION_STATUS_MATRIX.md`](architecture/IMPLEMENTATION_STATUS_MATRIX.md).
- Specs: [`SPEC_INDEX.md`](SPEC_INDEX.md).
- Roadmap: [`../ROADMAP.md`](../ROADMAP.md).

## Fuentes de verdad

Orden obligatorio:

1. `main` actual.
2. Specs, Zod, Prisma, migrations y tests.
3. Produccion verificada.
4. Documentacion vigente.
5. Vision/conversaciones.
6. Investigacion externa.

No afirmar que una capacidad esta en produccion solo porque esta en codigo.

## Nueve dominios

1. SEMSE Core.
2. SEMSE Connect.
3. SEMSE Payments.
4. SEMSE Trust.
5. SEMSE AI.
6. SEMSE Agro.
7. SEMSE BuildOps.
8. SEMSE Knowledge.
9. SEMSE Integrations.

No crear identidad, permisos, pagos, evidencia o knowledge paralelos dentro de
un vertical. Reutilizar los contratos transversales.

## Topologia actual

```text
apps/web             Next.js + BFF
apps/api             NestJS + Prisma
apps/worker          BullMQ y jobs
apps/vision-service  Vision especializado
apps/autonomy-server runtime de autonomia
apps/mobile          cliente movil/offline

packages/agents      packages/auth       packages/autonomy
packages/db          packages/knowledge  packages/schemas
packages/sdk         packages/shared     packages/tools
packages/ui
```

`apps/angular` y `apps/assistant-portal` son superficies adicionales o de
transicion. No cambiar la raiz canónica ni hacer rename big-bang.

## Estado verificado importante

- Prometeo Runtime P2 esta implementado, fusionado y desplegado.
- SHA de produccion del corte: `bd0d98cd3c6815c5f0a0867852c4dbf7c1169e48`.
- `/v1/prometeo/tools` existe y requiere Bearer token.
- Tool Registry: 23 herramientas read, 7 write; 17 casos read cableados.
- Write tools de Prometeo siguen bloqueadas por el runtime actual.
- Hay schema y bus de domain events, pero no outbox transaccional general.
- Hay movimientos `PaymentTxn`, pero no ledger double-entry compartido.
- Mission Control, observabilidad, storage, offline y DR son capacidades
  parciales, no ausentes ni completas.
- La linea base SDD esta saneada: `pnpm spec:validate -- --strict` pasa con
  64 specs, 0 errores y 0 warnings.
- F1 Event Backbone tiene spec, plan, tasks y ADR aprobados. F1-A agrega
  contratos Zod v2 y migracion aditiva de outbox/receipts; producer,
  dispatcher y consumer siguen pendientes hasta PRs posteriores.

## Reglas de Prometeo

Runtime:

```text
OBSERVE -> INTERPRET -> PLAN -> REQUEST APPROVAL
        -> EXECUTE -> VERIFY -> LEARN
```

- Prometeo no sustituye modulos de dominio.
- Read-only puede autoaprobarse si permisos/policy lo permiten.
- Write/critical requiere aprobacion, auditoria, verification y compensacion.
- No ejecutar mutaciones criticas directamente desde un LLM.
- No crear tools fuera del registry.

## Reglas de eventos

Objetivo:

```text
domain transaction + outbox row
  -> dispatcher
  -> BullMQ
  -> idempotent consumers
  -> projections/ledger/notifications/agents
  -> Mission Control
```

El bus actual es parcial. No afirmar atomicidad donde hoy solo existe AuditLog y
routing best-effort.

Todo evento nuevo debe declarar:

- producer y bounded context;
- schema versionado;
- actor, tenant y org;
- correlation/causation;
- idempotency;
- consumers;
- retry/DLQ/replay;
- impacto de seguridad y PII.

## Reglas economicas

- Separar estados de proyecto, hito, evidencia, autorizacion, pago y ledger.
- Stripe no equivale automaticamente a escrow legal.
- Usar “pagos protegidos por hitos” salvo contrato/legal especifico.
- `PaymentTxn` no debe presentarse como ledger double-entry.

## Secuencia activa

1. F0: sincronizar documentacion y verdad (completado).
2. F1: Event Backbone (siguiente fase activa).
3. F2: Prometeo Tool Registry gobernado.
4. F3: Project Lifecycle Projection.
5. F4: Mission Control 2.0.
6. F5: Shared Economic Ledger.
7. F6: Agenda y Dispatch.
8. F7: Prometeo Multimodal.
9. F8: Domain Loops.
10. F9: Production Hardening.

No saltar directamente al ledger o a mutaciones autonomas sin cerrar el backbone
de eventos, idempotencia y supervision.

## Comandos de validacion

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build:api
pnpm verify:workspace
pnpm spec:preflight
pnpm test:unit
pnpm test:e2e
```

Elegir los comandos proporcionados al riesgo y documentar lo no ejecutado.

## Regla de entrega

Cada PR debe indicar:

- problema y bounded context;
- spec/ADR aplicable;
- cambios de datos y rollback;
- permisos/policy;
- eventos producidos/consumidos;
- pruebas ejecutadas;
- estado local, CI y produccion como evidencias separadas.
