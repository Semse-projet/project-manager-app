# Prisma Escrow Status Reconciliation - 2026-05-24

## Resumen ejecutivo

Se reconcilio `PaymentEscrow.status` en una rama limpia separada:

- Rama: `fix/prisma-escrow-status-reconciliation`
- Base: `main` despues de integrar SDD hardening y el hotfix de `railway:preflight`
- Alcance: Prisma, pagos, seed, tipo API interno, prueba unitaria y este reporte
- Sin deploy
- Sin cambios de Angular, WhatsApp, env, Hermes ni Prometeo

El riesgo bloqueante detectado era convertir `PaymentEscrow.status` de `String` a enum mientras el codigo seguia escribiendo strings como `"active"`. La solucion usa un enum Prisma con valores de base de datos lowercase mediante `@map(...)` y actualiza las escrituras a constantes de Prisma.

## Estado inicial

En `main`, el modelo estaba asi:

```prisma
status String @default("active")
```

El diff sucio previo intentaba:

```prisma
enum EscrowStatus {
  ACTIVE
  PENDING_SETTLEMENT
  CLOSED
  CANCELLED
}

status EscrowStatus @default(ACTIVE)
```

Ese cambio era riesgoso porque el codigo y seed seguian usando strings lowercase y tambien existia un seed con `released`.

## Valores encontrados

Valores reales o relevantes observados para `PaymentEscrow.status`:

| Valor | Fuente | Decision |
| --- | --- | --- |
| `active` | schema default, payments repository, seed | Mantener como `EscrowStatus.ACTIVE` |
| `closed` | payments repository al cerrar refund completo | Mantener como `EscrowStatus.CLOSED` |
| `released` | seed demo de proyecto completado | Mantener como `EscrowStatus.RELEASED` |
| `pending_settlement` | diff sucio propuesto | Mantener como estado canonico futuro |
| `cancelled` | diff sucio propuesto | Mantener como estado canonico futuro |
| `pending-settlement` | posible variante legacy | Aceptar solo durante migracion y normalizar a `pending_settlement` |

Valores como `funded`, `held`, `partially_released`, `disputed`, `refunded` aparecen en tipos UI, tests de contrato o mocks, pero no como escrituras reales actuales a `PaymentEscrow.status` en Prisma.

## Cambios realizados

### Prisma schema

Archivo:

- `packages/db/prisma/schema.prisma`

Se agrego:

```prisma
enum EscrowStatus {
  ACTIVE             @map("active")
  PENDING_SETTLEMENT @map("pending_settlement")
  CLOSED             @map("closed")
  CANCELLED          @map("cancelled")
  RELEASED           @map("released")
}
```

Y el campo cambio a:

```prisma
status EscrowStatus @default(ACTIVE)
```

### Migracion

Archivo:

- `packages/db/prisma/migrations/20260524180000_payment_escrow_status_enum/migration.sql`

La migracion:

- crea el enum PostgreSQL `EscrowStatus` con valores lowercase;
- bloquea valores desconocidos antes de castear;
- normaliza `pending-settlement` a `pending_settlement`;
- conserva `active`, `closed` y `released`;
- no hace conversion silenciosa de datos desconocidos.

### Codigo de pagos

Archivo:

- `apps/api/src/modules/payments/payments.repository.ts`

Las escrituras cambiaron de strings a constantes de Prisma:

- `"active"` -> `EscrowStatus.ACTIVE`
- `"closed"` -> `EscrowStatus.CLOSED`

### Seed

Archivo:

- `packages/db/prisma/seed.ts`

El seed usa constantes Prisma:

- `EscrowStatus.ACTIVE`
- `EscrowStatus.RELEASED`

### Tipo API interno

Archivo:

- `apps/api/src/common/domain-store.ts`

`EscrowRecord.status` ahora cubre los estados canonicos del enum:

- `active`
- `pending_settlement`
- `closed`
- `cancelled`
- `released`

### Test

Archivo:

- `tests/unit/payment-escrow-status-prisma.test.ts`

La prueba valida que:

- el schema mantenga enum Prisma con `@map(...)` a valores DB lowercase;
- la migracion tenga guardia contra valores legacy desconocidos.

## Comandos ejecutados

```bash
git switch -c fix/prisma-escrow-status-reconciliation
DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy pnpm --filter @semse/db exec prisma validate
DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy pnpm --filter @semse/db prisma:generate
pnpm typecheck
pnpm test:unit
node --experimental-strip-types --test tests/unit/payment-escrow-status-prisma.test.ts
pnpm --filter @semse/api test:unit
git diff --check
pnpm build:api
```

## Resultados de validacion

| Comando | Resultado |
| --- | --- |
| `prisma validate` sin `DATABASE_URL` | Falla esperada por variable faltante |
| `DATABASE_URL=... pnpm --filter @semse/db exec prisma validate` | OK |
| `DATABASE_URL=... pnpm --filter @semse/db prisma:generate` | OK |
| `pnpm typecheck` | OK |
| `node --experimental-strip-types --test tests/unit/payment-escrow-status-prisma.test.ts` | OK, 2/2 |
| `pnpm --filter @semse/api test:unit` | Falla por 7 integration tests sin `DATABASE_URL`; 1010/1017 pasan |
| `pnpm test:unit` | Falla por resolucion de workspaces desde root en este worktree limpio; el test nuevo pasa |
| `git diff --check` | OK |
| `pnpm build:api` | OK |

No se ejecuto `pnpm test` completo porque `pnpm test:unit` bloquea antes de E2E en este worktree por resolucion de paquetes root (`@semse/schemas`, `@semse/agents`, `@semse/knowledge`). Ese fallo no aparece en el test nuevo ni en `typecheck`, y es independiente de `PaymentEscrow.status`.

Los fallos de `pnpm --filter @semse/api test:unit` son integration tests que intentan abrir Prisma Client sin `DATABASE_URL`:

- `buildops-legacy-promotion-integration.test.ts`
- `buildops-plan-approval-integration.test.ts`
- `buildops-plan-rerun-integration.test.ts`

## Riesgo residual

Riesgo bajo/medio:

- Si produccion contiene valores de `PaymentEscrow.status` fuera de la lista permitida, la migracion fallara de forma explicita. Eso es intencional y evita perdida silenciosa de significado.
- Todavia existe una diferencia conceptual entre estados API/UI historicos (`funded`, `held`, `partially_released`, etc.) y el estado persistido canonico de `PaymentEscrow`. No se resolvio aqui para no cambiar semantica de pagos sin un spec dedicado.

## Regla operativa

No volver a cambiar `PaymentEscrow.status` entre `String` y enum sin:

- migracion compatible;
- constantes Prisma en codigo que escribe status;
- seed alineado;
- typecheck;
- tests;
- revision de datos existentes antes de deploy.
