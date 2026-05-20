# FSM SPEC: Job Lifecycle
**Versión:** 1.0
**Dominio:** Marketplace / Work Management
**Estado:** APPROVED
**Implementado en:** packages/fsm/src/jobStateMachine.ts

## Estados

| Estado | Descripción | Quién puede estar aquí |
|---|---|---|
| `DRAFT` | Job creado pero no publicado | Client editing |
| `PUBLISHED` | Visible para pros, recibiendo bids | Client + Pros |
| `ASSIGNED` | Pro seleccionado, escrow fondeado | Client + Pro asignado |
| `IN_PROGRESS` | Pro inició el trabajo | Client + Pro asignado |
| `COMPLETED` | Todos milestones aprobados, job cerrado | Histórico |
| `CANCELLED` | Cancelado antes de IN_PROGRESS | Histórico |
| `DISPUTED` | En disputa durante IN_PROGRESS | Client + Pro + Admin |

## Transiciones

| Desde | Evento | Hacia | Guard | Efectos |
|---|---|---|---|---|
| `DRAFT` | `publish` | `PUBLISHED` | client owner, campos completos | AuditLog: JOB_PUBLISHED, Risk Agent async |
| `DRAFT` | `cancel` | `CANCELLED` | client owner | AuditLog: JOB_CANCELLED |
| `PUBLISHED` | `assign` | `ASSIGNED` | client owner, bid válido | AuditLog: JOB_ASSIGNED, EscrowAccount created, otros bids → REJECTED |
| `PUBLISHED` | `cancel` | `CANCELLED` | client owner | AuditLog: JOB_CANCELLED, bids notificados |
| `ASSIGNED` | `start` | `IN_PROGRESS` | pro asignado | AuditLog: JOB_STARTED, WorkOrder creado |
| `ASSIGNED` | `cancel` | `CANCELLED` | client owner, escrow no fondeado | AuditLog: JOB_CANCELLED |
| `IN_PROGRESS` | `complete` | `COMPLETED` | client owner, todos milestones APPROVED | AuditLog: JOB_COMPLETED, pago final liberado |
| `IN_PROGRESS` | `dispute` | `DISPUTED` | client o pro, miembro del job | AuditLog: JOB_DISPUTED, escrow congelado |
| `DISPUTED` | `resolve` | `COMPLETED` o `CANCELLED` | admin | AuditLog: DISPUTE_RESOLVED |

## Diagrama
```
[DRAFT] ──publish──► [PUBLISHED] ──assign──► [ASSIGNED] ──start──► [IN_PROGRESS]
   │                      │                      │                       │      │
 cancel                 cancel                 cancel                complete  dispute
   │                      │                      │                       │      │
   ▼                      ▼                      ▼                       ▼      ▼
[CANCELLED]           [CANCELLED]           [CANCELLED]           [COMPLETED] [DISPUTED]
                                                                               │
                                                                            resolve
                                                                               │
                                                                    [COMPLETED|CANCELLED]
```

## Invariantes
- Un job COMPLETED o CANCELLED nunca puede cambiar de estado
- Un job solo puede tener un pro asignado simultáneamente
- No se puede completar un job con milestones PENDING o IN_PROGRESS
- El escrow debe estar FUNDED antes de que el job pueda pasar a IN_PROGRESS
- Un job DISPUTED congela todos los pagos pendientes

## Tests requeridos
- [ ] DRAFT → PUBLISHED válido
- [ ] PUBLISHED → DRAFT (no permitido)
- [ ] COMPLETED → cualquier estado (no permitido)
- [ ] CANCELLED → cualquier estado (no permitido)
- [ ] IN_PROGRESS → COMPLETED con milestones pendientes (bloqueado)
- [ ] Job DISPUTED → escrow congelado
- [ ] Doble asignación bloqueada
