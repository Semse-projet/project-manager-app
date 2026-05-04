# Escrow, Payments and Evidence Boundaries

## Objetivo

Evitar que `escrow`, `payments` y `evidence` sigan mezclados por inercia
tecnica.

## Limites canonicos

### Escrow

Representa:

- fondos retenidos;
- balance;
- disponible;
- retenido;
- liberado;
- estado financiero agregado.

No representa:

- proveedor de pago;
- webhook;
- reconciliacion;
- payout semantics detallada.

### Payments

Representa:

- eventos de proveedor;
- funding intents;
- payout intents;
- webhooks;
- reconciliacion;
- fees;
- refunds;
- provider refs.

No representa:

- el agregado completo del dinero retenido.

### Evidence

Representa:

- prueba estructurada de avance;
- soporte visual/documental;
- metadata;
- linkage a milestone y job;
- insumo para review, dispute y trust.

No representa:

- simple archivo adjunto sin contexto de dominio.

## Estado actual

La implementacion actual aun usa rutas y ownership ligados a `projects` para
parte de estos flujos.

Eso se admite como transicion, pero no debe profundizarse.

## Regla de diseño

- `escrow` se piensa desde `Job`
- `payments` se piensa desde proveedor y ledger
- `evidence` se piensa desde `Milestone` y `Job`

## Gate contractual minimo

Mientras `PaymentEscrow` siga ligado tecnicamente a `Project`, el funding
canonico debe entrar por `Job` y usar `Contract` como precondicion.

Regla minima:

- `POST /v1/jobs/:jobId/escrow/fund` requiere contrato actual
- ese contrato debe tener al menos firma de cliente
- `POST /v1/milestones/:milestoneId/escrow/release` requiere contexto contractual activo
- `Project` puede seguir actuando como puente tecnico para persistencia
- las rutas por `project` se toleran como compatibilidad, no como centro del flujo

Transicion tecnica actual:

- `PaymentEscrow` conserva `projectId`
- `PaymentEscrow` ya debe cargar tambien `jobId` y `contractId` cuando existan
- los registros legacy de `PaymentTxn.type = DEPOSIT` deben leerse como semantica visible de `FUND`
- eso permite leer y auditar el dinero retenido desde el flujo canonico sin romper
  la compatibilidad heredada

## Rutas transicionales toleradas

- `POST /v1/projects/:projectId/escrow/deposit`
- `POST /v1/milestones/:milestoneId/escrow/release`
- `GET /v1/projects/:projectId/evidence`

## Rutas objetivo sugeridas

- `GET /v1/jobs/:jobId/escrow`
- `POST /v1/jobs/:jobId/escrow/fund`
- `GET /v1/jobs/:jobId/payments`
- `GET /v1/jobs/:jobId/evidence`
- `GET /v1/milestones/:milestoneId/evidence`

Regla de Sprint 1 para evidence:

- nuevos flujos deben registrar evidencia por `jobId` o `milestoneId`
- `projectId` sin `jobId` debe considerarse camino legacy/transicional

## Regla para cambios nuevos

Si se agrega una capacidad nueva:

- no colgarla primero de `projects/*` por costumbre
- justificar por que el agregado correcto no es `Job`, `Milestone` o `Escrow`
- documentar si es puente transicional
