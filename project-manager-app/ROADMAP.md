# Roadmap maestro de SEMSEproject

**Actualizado:** 2026-07-14
**Arquitectura:** [`docs/architecture/CURRENT_ARCHITECTURE.md`](docs/architecture/CURRENT_ARCHITECTURE.md)
**Matriz:** [`docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`](docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md)

El roadmap anterior describia una migracion futura hacia monorepo, API, Prisma y
RBAC. Esas fundaciones ya existen. El programa activo consolida el ecosistema
actual sin reescritura ni renombramiento masivo.

## Estado base

- Monorepo pnpm, Next.js, NestJS, Prisma, PostgreSQL, Redis y BullMQ existen.
- Core, Connect, Payments, Trust, AI, Agro, BuildOps, Knowledge e Integrations
  tienen implementacion real en distintos grados.
- Prometeo Runtime P2 esta fusionado y desplegado.
- CI, Railway Deploy y Production Health Gate estaban verdes para
  `main@8042157` en el corte de cierre F0.

## F0 — Sincronizar la verdad (COMPLETADO)

Entregables:

- arquitectura vigente canónica;
- contexto operativo para agentes;
- matriz implementado/parcial/pendiente;
- roadmap F0-F9;
- documentos historicos marcados como supersedidos;
- snapshot de `main` frente a produccion.

Gate de salida:

- ningun documento canónico afirma que el repo carece de API/DB/monorepo;
- Prometeo P2 aparece como desplegado;
- cada sistema transversal distingue estado real de arquitectura objetivo.
- `pnpm spec:validate -- --strict` pasa con 63 specs, 0 errores y 0 warnings.

## F1 — Event Backbone (F1-D CONSUMER/WORKER IMPLEMENTADO; F1-E SIGUIENTE)

Contrato ejecutable:

- [`docs/specs/platform/event-backbone.spec.md`](docs/specs/platform/event-backbone.spec.md)
- [`docs/specs/platform/event-backbone.plan.md`](docs/specs/platform/event-backbone.plan.md)
- [`docs/specs/platform/event-backbone.tasks.md`](docs/specs/platform/event-backbone.tasks.md)
- [`docs/architecture/ADR-022-transactional-outbox-bullmq.md`](docs/architecture/ADR-022-transactional-outbox-bullmq.md)

Objetivo: introducir entrega durable sin reemplazar de golpe el bus actual.

Entregables:

- envelope `SemseDomainEvent` v2;
- catalogo versionado y schemas Zod/JSON Schema;
- correlation, causation, idempotency, actor y trace context;
- modelo outbox y dispatcher;
- ingress BullMQ;
- consumer idempotente;
- retry, DLQ, replay y metricas de lag;
- primer slice vertical end-to-end.

Slice recomendado: `evidence.submitted -> review -> milestone readiness`, sin
activar liberacion monetaria automatica.

Estado del corte F1-D:

- `Evidence + outbox`, dispatcher BullMQ y consumer
  `evidence-readiness.v1` ya forman un slice durable;
- receipt y efecto se confirman en la misma transaccion;
- duplicados, crash/retry, no-op sin milestone y dead letter fueron probados
  contra PostgreSQL y Redis reales;
- `Milestone.status`, `paymentReadiness` y Payments no son mutados;
- dispatcher y consumers permanecen apagados por defecto;
- F1-E (Ops, replay, redaccion y trace extendido) sigue pendiente.

Gate de salida:

- business write + outbox se confirman atomicamente;
- replay no duplica efectos;
- un fallo llega a DLQ y se recupera desde una operacion auditada;
- compatibilidad con eventos v1 documentada.

## F2 — Prometeo Tool Registry gobernado

Entregables:

- contrato comun de adapters;
- permisos y scopes por tool;
- policy/risk/approval consistente;
- resultados estructurados y auditables;
- verification y compensacion;
- completar adapters read declarados;
- habilitar mutaciones de bajo riesgo gradualmente.

Gate de salida:

- ninguna tool declarada aparece como ejecutable sin adapter;
- write tools requieren aprobacion cuando corresponde;
- cada ejecucion deja auditRef, resultado y verification status.

## F3 — Project Lifecycle Projection

Crear un read model por proyecto que responda:

- etapa actual;
- bloqueos;
- responsable de la proxima accion;
- fechas y SLA en riesgo;
- costo, gasto, saldo y forecast;
- evidencia faltante;
- pago retenido;
- trust/risk signals.

Gate de salida: Connect, BuildOps, Payments, Evidence y Trust producen una vista
coherente y reconstituible por replay.

## F4 — Mission Control 2.0

Unificar exceptions y acciones de:

- servicios/deploys;
- events/outbox/DLQ;
- workers/loops;
- misiones y approvals;
- evidence/payments/disputes;
- BuildOps/Agro;
- integrations y observabilidad.

Gate de salida: pause/resume/retry/replay/escalate tienen permisos, motivo,
auditoria y runbook.

## F5 — Shared Economic Ledger

Entregables:

- accounts, entries y balanced lines;
- costos e ingresos normalizados;
- fees, reservas, payables/receivables;
- reversals inmutables;
- reconciliacion y trial balance;
- integracion Payments, BuildOps, Agro y Labor Engine.

Gate de salida: debitos = creditos, replay idempotente y reportes reproducibles.

## F6 — Agenda y Dispatch

Entregables:

- disponibilidad y conflictos;
- visitas, asignacion y rutas;
- reminders y SLA;
- rescheduling/escalation;
- sincronizacion con calendarios externos.

Gate de salida: no double booking, timezones probados y recordatorios
idempotentes.

## F7 — Prometeo Multimodal

Entregables:

- voz, camara, fotos y archivos binarios;
- video intelligence;
- transcripcion y Evidence capture;
- contexto de pantalla;
- streaming, tool cards y approval cards;
- quotas, retention y redaccion.

Gate de salida: lineage de archivos, limites y review humano para decisiones de
alto impacto.

## F8 — Domain Loops

Loops prioritarios:

- proyectos/hitos detenidos;
- evidencia vencida;
- costos fuera de presupuesto;
- pagos sin reconciliar;
- tracker sin sincronizacion;
- inventario critico y seguimiento Agro;
- contratos/licencias/seguros vencidos;
- integraciones caidas;
- drift spec-codigo.

Gate de salida: leases, budgets, max retries, kill switch, dry-run y human review.

## F9 — Production Hardening

Entregables:

- migration gates y rollback;
- backup/restore DB y storage;
- OTel y SLOs de negocio;
- rate limits, secret rotation y incident response;
- canary, load tests y DR drills;
- compliance y retencion verificables.

Gate de salida: RPO/RTO demostrados, runbooks operables y journeys criticos
estables durante canary.

## Reglas del programa

1. No big-bang rewrite ni rename masivo.
2. No introducir Temporal antes de demostrar que BullMQ no cubre el workflow.
3. No habilitar auto-merge ni mutaciones criticas autonomas.
4. Cada fase entrega un slice vertical verificable, no solo infraestructura.
5. Codigo, tests, merge y produccion se reportan por separado.
