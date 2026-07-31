# Contexto operativo canónico de SEMSEproject

**Leer antes de planificar o modificar SEMSE.**
**Corte verificado:** 2026-07-31 (`main/producción@3c2ac45d`; F3 verificado en canary)

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
- SHA actual de `main` y producción: `3c2ac45d4f5d3c43a081767c54405eb08d31c788`;
  F3 event-driven fue mergeado en `f1234291`.
- `/v1/prometeo/tools` existe y requiere Bearer token.
- Tool Registry: 31 descriptors (24 read, 7 write); 23/24 read y 7/7 write
  tienen adapter, con policy/audit/approval para escritura.
- `vision.analyze_video` permanece `adapter_pending`.
- El Event Backbone tiene envelope v2, producer atómico Evidence, outbox,
  dispatcher BullMQ, worker, consumers idempotentes y ops/replay. F3 ejercitó
  cinco publicaciones/consumos y replay en canary; F1-F transversal sigue
  pendiente.
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
- Railway CLI está autenticada. La activación del Event Backbone está acotada
  por allowlists para Evidence/F3; PI sigue sin activación verificada.
- F3 está `VERIFIED` con `activation_status: CANARY` para `tenant_default`:
  snapshot durable, mismatch cero, rebuild tenant-scoped, consumer
  `project-lifecycle-projection.v1`, duplicado y replay `no_op`.
- Evidence + outbox son atómicos. Los demás hooks F3 son post-commit
  best-effort y usan read-through/rebuild como recuperación.
- `api.semseproject.com` sigue pendiente por certificado/hostname aunque DNS y
  Railway indiquen sync activo; usar el dominio Railway para probes API.

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

El bus actual es parcial. La atomicidad está demostrada para Evidence y para el
effect+receipt de consumers. F3 adoptó eventos/replay en canary, pero sus hooks
fuera de Evidence son post-commit hasta la migración explícita de cada dominio.

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
4. F3: Project Lifecycle Projection (`VERIFIED` en canary).
5. F4: Mission Control 2.0 (siguiente child; SDD pendiente).
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
