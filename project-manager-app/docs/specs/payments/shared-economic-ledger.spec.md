---
id: "payments.shared-economic-ledger"
title: "Shared Economic Ledger F5"
domain: "payments"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/payments/payments.repository.ts
  - apps/api/src/modules/payments/payments.service.ts
  - apps/api/src/modules/payments/escrow-release.service.ts
  - apps/api/src/modules/payments/escrow-release.reconcile.ts
  - apps/api/src/modules/payments/stripe-connect.service.ts
  - apps/api/src/modules/finance/finance.service.ts
  - apps/api/src/modules/originator/originator.service.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-10"
---

# Spec: Shared Economic Ledger (F5)

> Contrato ejecutable SDD 2.0. **Estado `DRAFT`: no autoriza implementación.**
> Las decisiones abiertas de §13 requieren respuesta humana (producto/finanzas)
> antes de pasar a `REVIEW`. Código, CI, merge, deploy y activación se
> registran por separado.

## 1. Problema y resultado

**Para quién:** finanzas/operaciones de SEMSE (`OPS_ADMIN`), y aguas abajo
clientes, profesionales y originadores que hoy ven cifras derivadas de tablas
sin un libro común.

**Problema:** hoy el dinero vive en modelos que no cuadran entre sí.
`PaymentEscrow` + `PaymentTxn` (`DEPOSIT|RELEASE|HOLDBACK|FEE|REFUND`, monto
único, sin contrapartida) registran movimientos de una sola pata; `Invoice`,
`ProjectExpense`, `AgroCostEntry`, `OriginatorReward` y los costos del Labor
Engine guardan montos propios con su propia moneda y sin vínculo contable. No
existe doble partida, ni cuentas por cobrar/pagar, ni forma de demostrar que
"lo depositado = lo retenido + lo liberado + comisiones + reembolsos". La
auditoría de 2026-09-11 (F03) ya documentó tres rutas de liberación de pago
divergentes; sin un libro común cada ruta puede quedar inconsistente sin que
nada lo detecte.

**Resultado esperado:** un libro contable inmutable, de doble partida,
alimentado por los flujos económicos existentes **sin reemplazarlos**, con
reconciliación y balance de comprobación reproducibles. Este tramo es
*observacional primero*: el libro registra y concilia; no mueve dinero ni
sustituye a Stripe como fuente de verdad del proveedor.

## 2. Alcance

### Incluido

- Plan de cuentas versionado y por tenant (activos, pasivos, ingresos, gastos).
- `LedgerEntry` + `LedgerLine` balanceadas (Σ débitos = Σ créditos por entry,
  por moneda), inmutables; las correcciones son *reversals* nuevos.
- Normalización de costos e ingresos desde Payments (escrow/txn), Labor Engine,
  BuildOps (`ProjectExpense`), Agro (`AgroCostEntry`) y `OriginatorReward`.
- Comisiones (fees), reservas de escrow, cuentas por pagar y por cobrar.
- Reconciliación libro ↔ `PaymentTxn` ↔ proveedor (reutilizando
  `escrow-release.reconcile`) y balance de comprobación.
- Ingesta idempotente vía el Event Backbone (F1) con replay.
- Reportes de solo lectura reproducibles.

### Fuera de alcance

- Mover dinero, liberar o bloquear pagos (sigue en `PaymentsService`/gobernanza).
- Reemplazar o migrar `PaymentTxn`; se conserva y se concilia contra el libro.
- Contabilidad fiscal/impuestos por país, facturación electrónica, cierre
  contable legal. Multi-moneda con conversión FX (ver D4).
- Pago real a originadores (Fase 3 de `originador-referral-program`, gate legal).
- Activación global: el rollout es por canary de tenant, como F3/F4.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `ledger:read`, `ledger:reconcile` (nuevos) | tenant propio | consultar libro, balance, correr reconciliación | editar o borrar entries |
| Finanzas tenant | `ledger:read` | tenant/org propio | ver su libro | ver otros tenants |
| Servicio interno (consumer) | identidad `usr_worker_system` | tenant del evento | postear entries vía consumer | postear sin evento de origen |
| Agente Prometeo | tool read-only, F2 | tenant del caller | consultar con citas | postear, revertir, conciliar |

- Tenant boundary: toda fila lleva `tenantId` no nulo; toda consulta lo filtra
  (ver `semse-security-baseline`, patrón IDOR).
- Ownership/resource policy: no hay endpoint de escritura público; las entries
  nacen sólo de consumers de eventos con `idempotencyKey`.
- Step-up o aprobación humana: *reversals* manuales requieren `OPS_ADMIN` +
  motivo + aprobación (patrón `human_required` de F2-D). Ningún agente revierte.
- Datos `privacyCritical`: montos y contrapartes son sensibles; nada de esto
  se envía a modelos hospedados.
- Requisitos de auditoría: cada entry referencia evento de origen y actor;
  los reversals referencian la entry original.

## 4. Escenarios y criterios de aceptación

### P1 — Depósito, retención, liberación y comisión cuadran

```gherkin
DADO un escrow con depósito confirmado de 1000.00 USD
CUANDO se libera un milestone de 400.00 con comisión de plataforma del 10%
ENTONCES el libro tiene entries balanceadas para depósito y liberación
Y saldo escrow = 600.00; por pagar al profesional = 360.00; ingreso comisión = 40.00
Y el balance de comprobación del tenant suma débitos = créditos
```

### P2 — Replay idempotente

```gherkin
DADO un evento económico ya posteado
CUANDO el mismo evento se reentrega o se hace replay
ENTONCES no se crea una segunda entry (misma idempotencyKey)
Y los totales no cambian
```

### P3 — Reversal inmutable

```gherkin
DADO una entry posteada incorrectamente
CUANDO OPS_ADMIN aprueba un reversal con motivo
ENTONCES se crea una entry espejo que referencia a la original
Y la original no se modifica ni se borra
```

### P4 — Divergencia detectada

```gherkin
DADO un PaymentTxn SUCCEEDED sin entry en el libro (o con monto distinto)
CUANDO corre la reconciliación
ENTONCES se reporta la diferencia por txn, sin autocorregir
Y se emite señal hacia Mission Control (F4)
```

Casos borde:

- [ ] Entry desbalanceada rechazada por la capa de dominio *y* por constraint en DB.
- [ ] Reintento concurrente de la misma `idempotencyKey` (una sola gana).
- [ ] Evento sin tenant o con tenant inexistente → dead letter, no posteo.
- [ ] Líneas en monedas distintas dentro de una misma entry → rechazo (D4).
- [ ] Aislamiento cross-tenant en lectura y en reconciliación.
- [ ] Los tres caminos de liberación (F03) producen el mismo asiento o se marcan.
- [ ] `PaymentTxn` REVERSED/FAILED no produce asiento de éxito.

## 5. Contratos

> Borrador. Se cierran tras resolver §13.

### API — `GET /v1/ledger/trial-balance`

```yaml
auth: required
permissions: [ledger:read]
input_schema: { asOf?: ISO-8601, currency?: string }
output_schema: { accounts: [{ code, name, debit, credit }], balanced: boolean }
errors: { 400: asOf inválido, 401: sin sesión, 403: sin permiso, 404: n/a, 409: n/a }
effects: { audit_log: lectura sensible, domain_event: none, sse: none, payment_governance: none }
```

### API — `POST /v1/ledger/reconciliation/run`

```yaml
auth: required
permissions: [ledger:reconcile]
input_schema: { from, to, dryRun: true por defecto }
output_schema: { checked, matched, divergences: [{ txnId, expected, actual }] }
errors: { 400, 401, 403, 409: reconciliación en curso }
effects: { audit_log: sí, domain_event: ledger.reconciled (a catalogar), sse: none, payment_governance: none }
```

Sin endpoint de creación de entries (ver §3).

### UI

```yaml
surfaces: [admin/ledger (read-only), tarjeta en Mission Control para divergencias]
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior: [sólo lectura, exportable, sin cifras sin fuente]
```

### Agente/Prometeo

```yaml
tools: [ledger.get_trial_balance (read)]
source_citations_required: true
approval_policy: none (sólo lectura)
forbidden_behavior: [postear, revertir, conciliar, inferir cifras]
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno se muta. `escrow-lifecycle.spec.md` exige "no
  pasar a RELEASED con ledger inconsistente"; este spec provee el chequeo pero
  **no lo activa como bloqueo** en este tramo (D6).
- Invariantes: `DOMAIN_INVARIANTS.md` (revisar antes de pasar a `REVIEW`).
- Eventos de entrada existentes: `payment.funded`, `payment.released`,
  `payment.refunded`, `payment.reconciled` (`EVENT_CATALOG.md`). Los de salida
  (`ledger.*`) **no existen en el catálogo**: se proponen y se agregan al
  catálogo antes de usarse; no se inventan.
- Productor + outbox atómico: el posteo ocurre en el consumer, en una sola
  transacción con el registro de recepción (patrón F1-D).
- Consumidores + idempotencia: `idempotencyKey = <eventId>:<ruleVersion>`,
  `@@unique` en DB.
- Replay/rebuild: el libro es reconstruible desde eventos + reglas versionadas.
- DLQ/compensación: evento no mapeable → DLQ de F1-E; nunca posteo parcial.

## 7. Datos y migración

- Modelos Prisma (propuestos): `LedgerAccount`, `LedgerEntry`, `LedgerLine`.
  Montos como `Decimal(14,2)` o enteros en centavos (D5).
- Migración: aditiva, tablas nuevas; sin tocar `PaymentTxn`.
- Estrategia expand/contract: sólo *expand* en este tramo.
- Backfill: opcional y separado; por defecto el libro empieza en la fecha de
  activación por tenant (D3).
- Compatibilidad hacia atrás: total; nada existente lee el libro.
- Verificación de drift: `semse-prisma-workflow`; **nunca `db push`**.
- Rollback de código: flag apagado.
- Rollback/forward-fix de datos: entries inmutables → corrección por reversal.
- Constraint de DB: balance por entry verificable (trigger o chequeo en
  transacción) — decisión técnica en el plan, con prueba contra Postgres real.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: lag de posteo vs evento, divergencias abiertas, entries en DLQ.
- Logs/traces: `traceId`/`correlationId` del evento de origen.
- Feature flags/allowlists (propuestos): `SEMSE_LEDGER_POSTING_ENABLED`,
  `SEMSE_LEDGER_CANARY_TENANT_IDS`.
- Plan de canary: `tenant_default`, flag apagado → encendido sólo con
  reconciliación en cero divergencias sobre una muestra.
- Evidencia de producción requerida: reconciliación real sin divergencias,
  replay idempotente, balance de comprobación cuadrado. Un deploy no basta.
- Señal de rollback: cualquier divergencia sin explicación o entry desbalanceada.
- Owner operativo: por definir (D7).

## 9. Tests requeridos

- [ ] Unitarios: reglas de asiento por tipo de evento; rechazo de desbalance.
- [ ] Contrato API/BFF.
- [ ] Permiso denegado y aislamiento tenant.
- [ ] Idempotencia/reintento/concurrencia contra PostgreSQL real.
- [ ] Reversal inmutable.
- [ ] Reconciliación detecta divergencias sintéticas.
- [ ] Migración aditiva desde cero.
- [ ] UI loading/empty/forbidden/degraded/error.
- [ ] Canary autenticado en producción.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/ledger/` (nuevo): dominio, repositorio, consumers, reportes.
- Hooks de lectura sobre `payments/` (sin cambiar su comportamiento).

### Web

- `apps/web/app/admin/ledger/` + BFF según `semse-bff-pattern`.

### Worker/Packages/DB

- Consumers en `apps/worker`; contratos en `packages/schemas`; modelos en `packages/db`.

### Tests

- `apps/api/test/ledger-*.test.ts`

## 11. Investigación externa

- Reporte con tres búsquedas primarias: **pendiente** (gate previo a `REVIEW`).
- Temas a cubrir: modelado de doble partida inmutable, tratamiento de escrow
  de terceros/marketplace (Stripe Connect), reconciliación con proveedor.
- Aplicado ahora / Backlog / Descartado: pendiente.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`

## 13. Decisiones abiertas (bloquean `REVIEW`)

| # | Decisión | Recomendación inicial |
|---|---|---|
| D1 | ¿Quién es dueño/aprobador contable de este spec (finanzas)? | Samuel como owner provisional |
| D2 | ¿El libro es *observacional* (concilia) o *autoritativo* (bloquea liberaciones)? | Observacional en este tramo; bloqueo en un child posterior |
| D3 | ¿Backfill histórico o arranque en la fecha de activación? | Arranque limpio por tenant; backfill separado |
| D4 | ¿Una sola moneda por entry/tenant o multi-moneda con FX? | Una moneda por entry, sin FX |
| D5 | ¿Decimal(14,2) o centavos enteros? (hoy conviven ambos: `PaymentTxn` Decimal, `platformFeeCents` entero) | Centavos enteros en el libro, conversión explícita en el borde |
| D6 | ¿Se conecta el chequeo "ledger consistente" a `escrow-lifecycle` como gate? | No en este tramo |
| D7 | ¿Owner operativo y runbook de divergencias? | OPS_ADMIN vía Mission Control |
| D8 | F03 (tres rutas de liberación): ¿se unifican antes o el libro las modela tal cual? | Modelar tal cual y marcar divergencias; unificar es decisión de producto aparte |
