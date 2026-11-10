# State Machines

## Objetivo

Formalizar los estados, transiciones y condiciones del dominio principal de
SEMSEproject para evitar lifecycle ambiguo o reglas implícitas repartidas entre
UI, API y persistencia.

## Precedencia

Este documento implementa y concreta:

- [`DOMAIN_MODEL.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/DOMAIN_MODEL.md)
- [`DOMAIN_INVARIANTS.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/DOMAIN_INVARIANTS.md)
- [`ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md)

Regla:

- ningún endpoint, worker o pantalla puede inventar una transición que no esté
  alineada con este documento o con una policy derivada explícita.

## Principios

1. Los estados visibles deben ser pocos, claros y explicables.
2. Los estados internos pueden existir, pero no deben contaminar el lenguaje de
   producto si no agregan valor operativo.
3. Los estados terminales no se reabren sin política explícita.
4. Un cambio de estado sensible debe quedar auditado.
5. El dinero, la evidencia y la disputa tienen prioridad sobre la comodidad de
   transición.

## Job

### Estados canónicos

- `DRAFT`
- `POSTED` (alias externo: `PUBLISHED`)
- `RESERVED`
- `ACCEPTED`
- `IN_PROGRESS`
- `REVIEW` (equivalente a WAITING_REVIEW en especificaciones previas)
- `COMPLETED`
- `DISPUTE`
- `CANCELLED`

Estados persistidos de compatibilidad, no visibles como estados nuevos:

- `PUBLISHED` se presenta como `POSTED`.
- `AWARDED` se presenta como `ACCEPTED` y puede avanzar a `IN_PROGRESS`.

`WAITING_REVIEW` de especificaciones antiguas se implementa como `REVIEW`.
`PARTIALLY_PAID` no fue implementado: los pagos parciales viven en cada milestone.

### Transiciones válidas

- `DRAFT -> POSTED`
- `DRAFT -> CANCELLED`
- `POSTED -> RESERVED`
- `POSTED -> CANCELLED`
- `PUBLISHED -> RESERVED` (alias de POSTED)
- `PUBLISHED -> CANCELLED`
- `RESERVED -> ACCEPTED`
- `RESERVED -> POSTED`
- `ACCEPTED -> IN_PROGRESS`
- `ACCEPTED -> CANCELLED`
- `IN_PROGRESS -> REVIEW`
- `IN_PROGRESS -> DISPUTE`
- `REVIEW -> COMPLETED`
- `REVIEW -> IN_PROGRESS`
- `DISPUTE -> COMPLETED`
- `DISPUTE -> CANCELLED`
- `AWARDED -> IN_PROGRESS`

### Autorización por transición

- Solo CLIENT puede ejecutar: `COMPLETED`, `CANCELLED`
- Solo PRO puede ejecutar: `REVIEW`, `DISPUTE`
- OPS_ADMIN puede ejecutar cualquier transición

### Condiciones

- `DRAFT -> POSTED`
  requiere title (≥5 chars), scope (≥10 chars), ownership válido.
- `POSTED -> RESERVED`
  requiere reserva activa válida y sin conflicto de concurrencia.
- `RESERVED -> ACCEPTED`
  requiere reserva no expirada y aceptación válida del flujo comercial.
- `ACCEPTED -> IN_PROGRESS`
  requiere base contractual mínima activa.
- `IN_PROGRESS -> REVIEW`
  requiere trabajo ejecutado; solo PRO puede solicitar review.
- `REVIEW -> COMPLETED`
  requiere revisión satisfactoria del cliente; milestones resueltos y escrow sin fondos retenidos abiertos.
- `* -> DISPUTE`
  requiere causa formal y trazabilidad; solo PRO puede abrir disputa.
- `* -> CANCELLED`
  requiere cierre operativo y financiero compatible; solo CLIENT u OPS_ADMIN.

## Reservation

### Estados

- `ACTIVE`
- `EXPIRED`
- `ACCEPTED`
- `RELEASED`

### Transiciones válidas

- `ACTIVE -> ACCEPTED`
- `ACTIVE -> EXPIRED`
- `ACTIVE -> RELEASED`

### Condiciones

- solo una reserva activa por `Job`
- una reserva expirada no puede aceptarse
- una reserva aceptada debe quedar auditada

## Contract

### Estados

- `DRAFT`
- `PENDING_SIGNATURES`
- `PARTIALLY_SIGNED`
- `ACTIVE`
- `SUPERSEDED`
- `VOID`

### Transiciones válidas

- `DRAFT -> PENDING_SIGNATURES`
- `PENDING_SIGNATURES -> PARTIALLY_SIGNED`
- `PENDING_SIGNATURES -> ACTIVE`
- `PARTIALLY_SIGNED -> ACTIVE`
- `ACTIVE -> SUPERSEDED`
- `DRAFT -> VOID`
- `PENDING_SIGNATURES -> VOID`

### Condiciones

- no hay `ACTIVE` sin condiciones mínimas de firma
- después de firma, términos deben ser inmutables o versionados
- `SUPERSEDED` requiere contrato posterior explícito

## Milestone

### Estados

- `DRAFT`
- `AWAITING_REVIEW` (compatibilidad; etiqueta de producto "Listo")
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `PAID`

### Transiciones válidas

- `DRAFT -> SUBMITTED`
- `AWAITING_REVIEW -> SUBMITTED`
- `REJECTED -> SUBMITTED`
- `SUBMITTED -> APPROVED`
- `SUBMITTED -> REJECTED`
- `APPROVED -> REJECTED` (corrección humana antes del pago)
- `APPROVED -> PAID`

### Condiciones

- `DRAFT|AWAITING_REVIEW|REJECTED -> SUBMITTED`
  requiere evidencia mínima y actor autorizado.
- `SUBMITTED -> APPROVED`
  requiere revisión válida.
- `APPROVED -> PAID`
  requiere release financiero exitoso.
- `REJECTED -> SUBMITTED`
  requiere nueva iteración, subsanación y evidencia válida.

## Evidence

### Estados

- `UPLOADED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `REJECTED`

### Transiciones válidas

- `UPLOADED -> UNDER_REVIEW`
- `UNDER_REVIEW -> ACCEPTED`
- `UNDER_REVIEW -> REJECTED`

### Condiciones

- evidencia sin contexto de job o milestone no debe entrar al flujo core
- toda validación debe registrar actor, motivo y timestamp

## PaymentEscrow

### Estados

- `PENDING`
- `FUNDED`
- `HELD`
- `PARTIALLY_RELEASED`
- `RELEASED`
- `DISPUTED`
- `REFUNDED`

### Transiciones válidas

- `PENDING -> FUNDED`
- `FUNDED -> HELD`
- `HELD -> PARTIALLY_RELEASED`
- `HELD -> RELEASED`
- `PARTIALLY_RELEASED -> HELD`
- `PARTIALLY_RELEASED -> RELEASED`
- `HELD -> DISPUTED`
- `PARTIALLY_RELEASED -> DISPUTED`
- `DISPUTED -> HELD`
- `DISPUTED -> RELEASED`
- `DISPUTED -> REFUNDED`

### Condiciones

- no liberar más de lo fondeado
- no pasar a `RELEASED` con ledger inconsistente
- disputa activa puede bloquear releases no obligatorios

## Dispute

### Estados

- `OPEN`
- `ASSIGNED`
- `UNDER_REVIEW`
- `RESOLVED`
- `REJECTED` (terminal de compatibilidad)

### Transiciones válidas

- `OPEN -> ASSIGNED`
- `ASSIGNED -> UNDER_REVIEW`
- `OPEN -> RESOLVED` (acuerdo explícito permitido por policy)
- `ASSIGNED -> RESOLVED`
- `UNDER_REVIEW -> RESOLVED`

### Condiciones

- toda resolución debe dejar outcome explícito:
  - `client_favor`
  - `pro_favor`
  - `partial_50_50`
  - `escalated_legal`
- el cliente dueño solo puede cerrar con `pro_favor`; los demás outcomes
  requieren `OPS_ADMIN`

## TrustProfile

### Estados operativos

- `NORMAL`
- `WATCH`
- `RESTRICTED`

### Reglas

- `trust` no reemplaza policy
- `trust` puede elevar riesgo, no autorizar por sí solo
- cambios de banda deben ser explicables por señales registradas

## LiveSession

> Reservado por [`../specs/prometeo/live-sessions.spec.md`](../specs/prometeo/live-sessions.spec.md)
> (`APPROVED` 2026-09-07). Productor pendiente — no hay módulo en `main`
> todavía. Sesión de vídeo/audio en vivo (`inspection`|`assist`) atada a un
> `Job`/`Project`; **no** muta la FSM de esos recursos.

### Estados

- `REQUESTED`
- `PERMISSION_PENDING`
- `CONNECTING`
- `ACTIVE`
- `PAUSED`
- `ENDING`
- `ENDED` (terminal)
- `CANCELLED` (terminal)
- `FAILED` (terminal)

### Transiciones válidas

- `REQUESTED -> PERMISSION_PENDING`
- `REQUESTED -> CANCELLED`
- `PERMISSION_PENDING -> CONNECTING`
- `PERMISSION_PENDING -> CANCELLED`
- `CONNECTING -> ACTIVE`
- `CONNECTING -> FAILED`
- `CONNECTING -> CANCELLED`
- `ACTIVE -> PAUSED`
- `ACTIVE -> ENDING`
- `PAUSED -> ACTIVE`
- `PAUSED -> ENDING`
- `ENDING -> ENDED`
- `ENDING -> FAILED`

### Autorización por transición

- `REQUESTED -> PERMISSION_PENDING` (`accept`): la contraparte del recurso
  (participante `inspector`/`assistant`), no el creador.
- `ACTIVE <-> PAUSED` (`pause`/`resume`), `-> ENDING` (`end`): cualquier
  participante activo con `live_sessions:write`.
- `* -> CANCELLED` (`cancel`): sólo desde `REQUESTED`/`PERMISSION_PENDING`/
  `CONNECTING`, por un participante `owner`; o el barrido de `expiresAt`.
- `PERMISSION_PENDING -> CONNECTING`: el backend, cuando **todos** los
  participantes activos reportaron permisos de cámara/mic (`participant-ready`).
- `CONNECTING -> ACTIVE`, `ENDING -> ENDED`, `CONNECTING -> FAILED`: drivers
  del webhook de LiveKit (`room_started`/`room_finished`/error), verificados
  contra la sesión.

### Condiciones

- Toda operación exige `tenantId` del actor **y** una fila activa (sin
  `leftAt`) en `LiveSessionParticipant`; sin eso la sesión responde `404`
  (no se distingue de "no existe").
- `transition` usa concurrencia optimista: `expectedVersion` debe coincidir
  con `LiveSession.version` o la transición falla con `409`.
- Los estados terminales (`ENDED`/`CANCELLED`/`FAILED`) no se reabren.
- Cada transición deja `AuditLog` (`live_session.<action>`, `beforeJson`/
  `afterJson`) y emite `live_session.status_changed.v1`.
- No se enruta media a Ollama ni se persiste stream en este alcance
  (`privacyCritical`).

## McpDelegatedConsent

> Reservado por [`../specs/platform/semse-mcp-delegated-consent.spec.md`](../specs/platform/semse-mcp-delegated-consent.spec.md)
> (`REVIEW` 2026-10-26). **No implementado**: no existe modelo Prisma ni
> servicio en `main`. Consentimiento OAuth delegado de S1/D7 que autoriza a un
> cliente MCP a leer el estado de proyectos de **una** org; **no** muta la FSM
> de `Project`/`Job`.

### Estados

- `PENDING`
- `ACTIVE`
- `REVOKED` (terminal)
- `EXPIRED` (terminal)

### Transiciones válidas

- `PENDING -> ACTIVE`
- `PENDING -> REVOKED`
- `PENDING -> EXPIRED`
- `ACTIVE -> REVOKED`
- `ACTIVE -> EXPIRED`

### Autorización por transición

- `PENDING -> ACTIVE`: el propio usuario, en un flujo de consentimiento
  confiable (D2), con `AuthSession ACTIVE`, `User active` y `projects:read`
  vigente en la org del grant.
- `* -> REVOKED`: v1, el propio usuario o `OPS_ADMIN` dentro de su tenant
  (uno a uno, motivo obligatorio); v1.1, además admin de org y revocación
  masiva por cliente; el flujo de supresión de User/Org (`subject_deleted`).
- `* -> EXPIRED`: solo workers (mantenimiento o anonimización), nunca la vía
  de lectura.

### Condiciones

- `REVOKED` y `EXPIRED` no se reabren; reautorizar crea un grant nuevo.
- La revocación es compare-and-set e idempotente.
- `expiresAt <= now()` se deniega aunque el estado siga `ACTIVE`.
- La verificación por llamada no escribe.
- Cada aceptación y revocación deja auditoría con IDs opacos y motivo.

## DecisionRecord (propuesto)

> **Propuesto, no implementado.** Lo reserva [`../specs/prometeo/decision-ledger.spec.md`](../specs/prometeo/decision-ledger.spec.md)
> (`REVIEW`). No existe modelo Prisma, migración ni servicio en `main`. Se
> registra aquí para cumplir la sección 6 del acta de Operational
> Intelligence; **no autoriza implementar** hasta que el spec esté
> `APPROVED`. Si el spec cambia, esta sección se actualiza con él.

El Decision Ledger es de solo-agregar: **ninguna fila cambia de estado**. El
estado de una decisión se **deriva** de las filas que la referencian por
`supersedesDecisionId`. No muta la FSM de ningún otro dominio.

### Estados derivados

- `ACTIVE`: no existe ninguna fila que la referencie.
- `SUPERSEDED` (terminal): existe una fila `CORRECTION` que la referencia.
- `VOIDED` (terminal): existe una fila `VOID` que la referencia.

### Transiciones válidas

- `ACTIVE -> SUPERSEDED` (se añade una fila `CORRECTION`)
- `ACTIVE -> VOIDED` (se añade una fila `VOID`)

Una fila `CORRECTION` nace `ACTIVE` y sigue las mismas reglas. No hay
transición hacia atrás.

### Autorización por transición

- Registrar una decisión o una corrección: solo el servicio del módulo
  productor, con una autoridad ya validada (humano, política o autoridad de
  dominio); no existe escritura pública.
- Anular: permiso de anulación aparte (`lineage:decisions:void`, propuesto),
  con motivo obligatorio y dentro del tenant.

### Condiciones

- `SUPERSEDED` y `VOIDED` no se reabren.
- Una decisión tiene como mucho un sucesor: unicidad
  `(tenantId, supersedesDecisionId)`.
- Un *trigger* de base de datos rechaza `UPDATE` y `DELETE` sobre las tablas
  del ledger.
- Cada registro, corrección o anulación deja `AuditLog` y emite el evento
  correspondiente de `EVENT_CATALOG.md` (también propuestos).

## Regla de implementación

- Controllers validan inputs y contexto.
- Services aplican transiciones y guards.
- Repositories persisten.
- Workers ejecutan transiciones automáticas solo si la regla existe aquí o en
  policy derivada.

## Definition of Done para una máquina de estados

Un lifecycle se considera bien implementado cuando:

1. existe en `packages/schemas` como enum/contrato;
2. existe en Prisma o capa de persistencia equivalente;
3. la API usa solo transiciones válidas;
4. la UI refleja el estado real sin inventar optimismo falso;
5. el cambio deja audit trail;
6. no hay transiciones duplicadas escondidas en frontend;
7. hay test o smoke que cubre el camino principal.

## Regla de scope

Durante migración de un flujo:

- no rediseñar;
- no ampliar alcance;
- no agregar nuevas capacidades no necesarias;
- solo replicar, conectar, estabilizar y absorber.
