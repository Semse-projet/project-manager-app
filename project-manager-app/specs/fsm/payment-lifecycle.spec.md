# FSM SPEC: Payment / Escrow Lifecycle
**Versión:** 1.0
**Dominio:** Payments / Escrow
**Estado:** APPROVED
**Implementado en:** packages/payments/src/EscrowService.ts

## Estados

| Estado | Descripción |
|---|---|
| `UNFUNDED` | EscrowAccount creado, sin fondos |
| `FUNDED` | Client fondeó el escrow completo |
| `PARTIALLY_RELEASED` | Al menos un milestone pagado, aún hay fondos retenidos |
| `FULLY_RELEASED` | Todos los fondos liberados al pro |
| `DISPUTED` | Fondos congelados por disputa activa |
| `RESOLVED_PRO` | Disputa resuelta a favor del pro |
| `RESOLVED_CLIENT` | Disputa resuelta, fondos devueltos al client |
| `RESOLVED_SPLIT` | Disputa resuelta con distribución mixta |
| `REFUNDED` | Fondos devueltos al client (job cancelado antes de IN_PROGRESS) |

## Transiciones

| Desde | Evento | Hacia | Guard | Efectos |
|---|---|---|---|---|
| `UNFUNDED` | `fund` | `FUNDED` | client, job ASSIGNED, payment procesado | AuditLog: ESCROW_FUNDED, Ledger DEBIT client CREDIT escrow, SSE al pro |
| `UNFUNDED` | `cancel` | `REFUNDED` | job CANCELLED antes de IN_PROGRESS | AuditLog: ESCROW_CANCELLED |
| `FUNDED` | `release_partial` | `PARTIALLY_RELEASED` | milestone APPROVED, Payments Agent | AuditLog: ESCROW_RELEASED, Ledger entries, SSE al pro |
| `FUNDED` | `dispute` | `DISPUTED` | miembro del job | AuditLog: ESCROW_DISPUTED, fondos congelados |
| `PARTIALLY_RELEASED` | `release_partial` | `PARTIALLY_RELEASED` | siguiente milestone APPROVED | AuditLog: ESCROW_RELEASED |
| `PARTIALLY_RELEASED` | `release_final` | `FULLY_RELEASED` | último milestone APPROVED | AuditLog: ESCROW_FULLY_RELEASED |
| `PARTIALLY_RELEASED` | `dispute` | `DISPUTED` | miembro del job | AuditLog: ESCROW_DISPUTED |
| `DISPUTED` | `resolve_pro` | `RESOLVED_PRO` | admin | Ledger: fondos → pro, AuditLog: DISPUTE_RESOLVED |
| `DISPUTED` | `resolve_client` | `RESOLVED_CLIENT` | admin | Ledger: fondos → client, AuditLog: DISPUTE_RESOLVED |
| `DISPUTED` | `resolve_split` | `RESOLVED_SPLIT` | admin, ratio válido | Ledger: split, AuditLog: DISPUTE_RESOLVED |

## Diagrama
```
[UNFUNDED] ──fund──► [FUNDED] ──release_partial──► [PARTIALLY_RELEASED] ──release_final──► [FULLY_RELEASED]
    │                  │  │                              │  │
  cancel            dispute│                          dispute│
    │                  │   └──────────────────────────┘   │
    ▼                  ▼                                   ▼
[REFUNDED]         [DISPUTED] ◄────────────────────────────┘
                       │
              resolve_pro / resolve_client / resolve_split
                       │
        [RESOLVED_PRO | RESOLVED_CLIENT | RESOLVED_SPLIT]
```

## Invariantes
- `FULLY_RELEASED`, `REFUNDED`, `RESOLVED_*` son estados terminales
- Ningún release puede ocurrir si el escrow está `DISPUTED`
- Cada release debe tener un `milestoneId` y un `agentRunId` trazables
- El total de releases nunca puede superar el `totalAmount` del escrow
- Toda transición genera al menos una entrada en el Ledger
- Los releases son idempotentes: el mismo `milestoneId` no puede liberarse dos veces

## Ledger entries requeridas por transición

| Transición | Entries |
|---|---|
| UNFUNDED → FUNDED | DEBIT: client account, CREDIT: escrow account |
| * → PARTIALLY/FULLY_RELEASED | DEBIT: escrow account, CREDIT: pro pending payout |
| DISPUTED → RESOLVED_PRO | DEBIT: escrow account, CREDIT: pro payout |
| DISPUTED → RESOLVED_CLIENT | DEBIT: escrow account, CREDIT: client refund |
| DISPUTED → RESOLVED_SPLIT | DEBIT: escrow account, CREDIT: pro (ratio), CREDIT: client (1-ratio) |
| UNFUNDED → REFUNDED | DEBIT: escrow account, CREDIT: client refund |

## Tests requeridos
- [ ] UNFUNDED → FUNDED con pago procesado
- [ ] FUNDED → PARTIALLY_RELEASED tras milestone APPROVED
- [ ] PARTIALLY_RELEASED → FULLY_RELEASED en último milestone
- [ ] Release doble del mismo milestone → bloqueado (idempotencia)
- [ ] Release en estado DISPUTED → bloqueado
- [ ] Total releases no supera totalAmount
- [ ] Cada transición genera ledger entries correctas
- [ ] RESOLVED_SPLIT con ratio 0.7 → distribución correcta
