# Schema Runtime Alignment

## Objetivo

Definir como `packages/schemas` debe alinearse con el dominio maestro y con el
runtime real, sin seguir mezclando contratos canonicos, compatibilidad legacy y
tipos puramente visuales sin clasificacion explicita.

## Regla

- los shared schemas no describen una fantasia;
- cada archivo debe declarar si es:
  - canonico;
  - runtime vigente;
  - compatibilidad transitoria;
  - view model local transicional.

## Estado actual por archivo

| Archivo | Rol actual | Estado | Riesgo | Accion |
|---|---|---|---|---|
| `job.schema.ts` | creacion/listado de jobs | `Transitional` | medio | separar definitivamente contratos canonicos de compatibilidad legacy |
| `marketplace.schema.ts` | jobs, reservations, contracts, milestones, disputes | `Transitional` | alto | dividir por dominio y reducir mezcla de estados visibles y heredados |
| `project.schema.ts` | agregado tecnico heredado | `Legacy runtime` | alto | mantener solo mientras `Project` siga vivo en API |
| `ops.schema.ts` | snapshots ops/cortex | `Runtime stable` | medio | mantener, tipar mejor estados y reducir strings genericos |
| `payment.schema.ts` | deposit/release/webhook | `Canonical parcial` | medio | conectar con `EscrowAccount` y `PaymentTransaction` canonicos |
| `evidence.schema.ts` | presign/register | `Transitional` | medio | retirar dependencia conceptual de `projectId` como camino principal |
| `dispute.schema.ts` | create/assign/resolve | `Transitional` | medio | separar create por `jobId` como camino oficial, dejar `projectId` como legacy |
| `trust.schema.ts` | trust snapshot | `Runtime stable` | bajo | preservar y expandir por señales canonicas |
| `agent.schema.ts` | trigger de runs | `Canonical parcial` | medio | expandir a contratos de acciones y outputs estructurados |
| `domain-events.schema.ts` | eventos de dominio | `Canonical` | bajo | exportar y convertir en fuente de workers/agentes/audit |
| `client.types.ts` | tipos UI heredados | `Transitional` | alto | llevar tipos de dominio a schemas canonicos y dejar aqui solo view models |
| `escrow-view.types.ts` | respuesta API actual de escrow | `Runtime stable` | medio | mantener mientras el endpoint oficial migra a view model canonico |

## Principales desalineaciones

### 1. Estados duplicados o mezclados

- `job.schema.ts` usa estados en minuscula con legacy incluido;
- `marketplace.schema.ts` usa estados en mayuscula;
- Prisma define estados de runtime y compatibilidad;
- UI aun usa tipos propios en `client.types.ts`.

Decision:

- `packages/schemas` debe convertirse en la fuente oficial de enums compartidos;
- cualquier adaptacion de casing queda en mapping local, no en semantica nueva.

### 2. `Project` sigue vivo como agregado tecnico

`project.schema.ts` no es la verdad canonica del producto, pero sigue siendo parte
del runtime.

Decision:

- mantener `project.schema.ts` como contrato runtime mientras exista en API;
- prohibir expandirlo como lenguaje de producto;
- migrar nuevos flujos a `Job`, `Contract`, `Milestone`, `Evidence`, `Escrow`.

### 3. `client.types.ts` es demasiado grande

Hoy mezcla:

- tipos de dominio;
- tipos de presentacion;
- interfaces heredadas desde `src/`.

Decision:

- tipos compartidos reales deben ir a Zod + tipos derivados o a view models canonicos;
- `client.types.ts` entra en camino de reduccion progresiva;
- solo debe conservar shapes visuales que no pertenezcan al dominio compartido.

## Acciones obligatorias

1. Exportar `domain-events.schema.ts` desde el barrel principal.
2. Introducir una convencion clara:
   - `Canonical schema`
   - `Runtime schema`
   - `Legacy compatibility`
3. Reducir `project.schema.ts` a compatibilidad documentada.
4. Crear mapeos explicitos para `JobStatus`, `MilestoneStatus`, `DisputeStatus`, `EscrowStatus`.
5. Mover futuros contratos UI/API a `packages/schemas`, no a `client.types.ts`.

## Definition of Done

La alineacion de `packages/schemas` esta completa cuando:

1. cada dominio core tiene contrato compartido explicito;
2. los estados compartidos salen de un solo lugar;
3. eventos de dominio se exportan desde el paquete;
4. `client.types.ts` deja de ser la fuente principal del dominio UI;
5. toda compatibilidad legacy queda marcada y acotada.
