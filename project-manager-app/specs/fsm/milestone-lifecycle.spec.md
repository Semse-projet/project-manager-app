# FSM SPEC: Milestone Lifecycle
**Versión:** 1.0
**Dominio:** Work Management
**Estado:** APPROVED
**Implementado en:** packages/fsm/src/milestoneStateMachine.ts

## Estados

| Estado | Descripción |
|---|---|
| `PENDING` | Creado, esperando inicio |
| `IN_PROGRESS` | Pro trabajando activamente |
| `PENDING_REVIEW` | Pro solicitó aprobación con evidencia |
| `APPROVED` | Client aprobó, fondos liberados |
| `REJECTED` | Client rechazó, vuelve a IN_PROGRESS |
| `DISPUTED` | En disputa, fondos congelados |

## Transiciones

| Desde | Evento | Hacia | Guard | Efectos |
|---|---|---|---|---|
| `PENDING` | `start` | `IN_PROGRESS` | pro asignado, job IN_PROGRESS | AuditLog: MILESTONE_STARTED, SSE al client |
| `IN_PROGRESS` | `submit` | `PENDING_REVIEW` | pro asignado, min 1 evidencia válida | AuditLog: MILESTONE_SUBMITTED, Evidence Agent, notificación al client |
| `PENDING_REVIEW` | `approve` | `APPROVED` | client owner del job | AuditLog: MILESTONE_APPROVED, Payments Agent release |
| `PENDING_REVIEW` | `reject` | `IN_PROGRESS` | client owner del job, reason obligatorio | AuditLog: MILESTONE_REJECTED con reason, SSE al pro |
| `PENDING_REVIEW` | `dispute` | `DISPUTED` | client o pro, miembro del job | AuditLog: MILESTONE_DISPUTED, escrow congelado |
| `IN_PROGRESS` | `dispute` | `DISPUTED` | client o pro, miembro del job | AuditLog: MILESTONE_DISPUTED |
| `DISPUTED` | `resolve` | `APPROVED` o `REJECTED` | admin | AuditLog: DISPUTE_RESOLVED |

## Diagrama
```
[PENDING] ──start──► [IN_PROGRESS] ──submit──► [PENDING_REVIEW]
                          ▲  │                   │      │      │
                          │  dispute             │    approve reject
                          │  │               dispute     │      │
                     (reject)▼               │           ▼      │
                        [DISPUTED] ◄─────────┘      [APPROVED]  │
                             │                                   │
                          resolve                               (back)
                             │                                   │
                    [APPROVED|REJECTED] ◄────────────────────────┘
```

## Invariantes
- `APPROVED` es terminal — no puede cambiar
- Solo un milestone puede estar `IN_PROGRESS` por WorkOrder a la vez
- `submit` requiere al menos 1 evidencia con status VALID o PENDING_VALIDATION
- `approve` dispara automáticamente el release del escrow parcial
- Los fondos de un milestone `DISPUTED` permanecen congelados hasta `resolve`
- El orden de los milestones debe respetarse (no se puede iniciar el siguiente sin aprobar el anterior, configurable por job)

## Tests requeridos
- [ ] PENDING → IN_PROGRESS con pro correcto
- [ ] PENDING → PENDING_REVIEW (no permitido, debe pasar por IN_PROGRESS)
- [ ] APPROVED → cualquier estado (no permitido)
- [ ] submit sin evidencia → bloqueado
- [ ] approve → Payments Agent llamado
- [ ] reject → vuelve a IN_PROGRESS con reason en AuditLog
- [ ] Dos milestones IN_PROGRESS simultáneos → bloqueado
