# Contexto operativo canónico de SEMSEproject

**Leer antes de planificar o modificar SEMSE.**
**Corte verificado:** 2026-07-29 (`main@39f6ecbd` sigue desplegado; F3 validado localmente)

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

Usar los ejes de `SOURCE_OF_TRUTH.md`: intención autorizada, código `main`,
producción observada y contratos ejecutables se registran por separado. Una
contradicción es drift a reconciliar, no permiso para ignorar uno de los ejes.

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
apps/angular         superficie adicional
apps/assistant-portal superficie adicional

packages/agents      packages/auth       packages/autonomy
packages/db          packages/knowledge  packages/product-events
packages/schemas     packages/sdk        packages/shared
packages/tools       packages/ui
```

`apps/angular` y `apps/assistant-portal` son superficies adicionales o de
transicion. No cambiar la raiz canónica ni hacer rename big-bang.

## Estado verificado importante

- Prometeo Runtime P2 esta implementado, fusionado y desplegado.
- SHA de producción del corte: `39f6ecbdb0d6e08c51b7c8651e0ad855444d3c5e`.
- `/v1/prometeo/tools` existe y requiere Bearer token.
- Tool Registry: 31 descriptors (24 read, 7 write); 23/24 read y 7/7 write
  tienen adapter, con policy/audit/approval para escritura.
- `vision.analyze_video` permanece `adapter_pending`.
- El slice Evidence del Event Backbone tiene envelope v2, producer atomico,
  outbox, dispatcher BullMQ, worker y consumer idempotente con receipt atomico.
  Ops/replay, canary y adopcion general siguen pendientes.
- Hay movimientos `PaymentTxn`, pero no ledger double-entry compartido.
- Mission Control, observabilidad, storage, offline y DR son capacidades
  parciales, no ausentes ni completas.
- La línea base SDD está saneada: 97 specs y
  `pnpm spec:validate:strict` pasa con 0 errores/0 warnings.
- F1 Event Backbone tiene F1-A..F1-E en `main`; F1-F
  (flags/canary/cierre) sigue pendiente.
- Product Intelligence PI-00..PI-06 esta implementado: SDK separado de domain
  events, contratos/modelos, ingesta/retencion, instrumentacion auth/wizard y
  funnels de experiencia/economico. PI-07 Friction Engine es el siguiente
  incremento.
- Railway CLI está autenticada. Se inventariaron nombres de flags sin leer ni
  publicar valores; activación F1/PI sigue no verificada.
- F3 tiene la migración de proyección aplicada y tabla vacía en producción.
  Su SQL/modelo/código ya están reconciliados en la rama F3; la migración
  aditiva `Evidence.updatedAt`, CI, merge, deploy y activación siguen
  pendientes bajo SDD `operations.project-lifecycle-projection`.

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

El bus actual es parcial. La atomicidad solo esta demostrada para el producer y
consumer del slice Evidence F1; el resto de dominios conserva contratos y
routing anteriores hasta su migracion explicita.

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

1. F0: sincronizar documentación y verdad (revalidado 2026-07-28).
2. F1: Event Backbone (F1-F cierra con canary).
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
