# Aislamiento y correccion de `build:api` - 2026-04-06

## Objetivo

Resolver el bloqueo que quedaba en el monorepo canonico `project-manager-app` despues de reparar `nest`, `node_modules/.bin` y la instalacion del workspace.

Ruta del repo trabajado:

- `/home/yoni/labsemse/project-manager-app`

## Diagnostico

El error inicial ya no era de dependencias. `npm run build:api` estaba fallando por un `RangeError: Maximum call stack size exceeded` dentro del checker de TypeScript.

El aislamiento se hizo en tres niveles:

1. compilacion parcial por grupos de carpetas;
2. compilacion individual por archivo en `apps/api/src/common` y `apps/api/src/infrastructure`;
3. verificacion del archivo minimo que reproducia el problema.

Hallazgo principal:

- el overflow salia incluso fuera de los modulos nuevos;
- el archivo detonante fue `apps/api/src/infrastructure/persistence/persistence-mode.ts`;
- la causa no era la logica del archivo, sino el import de `@semse/db`, que arrastraba el tipo de `PrismaClient` solo para consultar si existia `DATABASE_URL`.

## Correccion aplicada

### 1. Corte del trigger de stack overflow

Se simplifico `databaseEnabled()` para leer `process.env.DATABASE_URL` directamente y dejar de importar `isDatabaseConfigured()` desde `@semse/db`.

Efecto:

- desaparecio el `Maximum call stack size exceeded`;
- `build:api` empezo a exponer errores reales y ya no se caia dentro del checker.

### 2. Reparacion pragmatica del tipado de transacciones Prisma

Despues de destrabar el checker, aparecio un problema de tipos en callbacks de `.$transaction(...)`: `TransactionClient` no exponia delegates como `agentRun`, `jobReservation`, `paymentEscrow`, `paymentTxn`, `job`, `project`, etc.

Se corrigio con un enfoque pragmático:

- se definieron aliases locales por repositorio usando interseccion entre `Prisma.TransactionClient` y `Pick<PrismaService, ...>`;
- dentro de cada callback se castea `tx` a un subtipo con solo los delegates realmente usados.

Archivos ajustados:

- `apps/api/src/modules/agents/agents.repository.ts`
- `apps/api/src/modules/bids/bids.repository.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`

### 3. Limpieza de `implicit any`

Con Prisma destrabado, el build quedo frenado por tipados faltantes en callbacks y arreglos.

Se corrigio en:

- `apps/api/src/modules/evidence/evidence.repository.ts`
- `apps/api/src/modules/ops/ops.service.ts`
- `apps/api/src/modules/trust/trust.repository.ts`

La correccion fue explicita y conservadora:

- aliases de filas/resultados;
- casts puntuales de arrays;
- anotaciones de parametros en `map`, `find`, `reduce`, `filter` y `sort`.

## Validacion

Comando ejecutado:

```bash
npm run build:api
```

Resultado final:

- `@semse/schemas build`: OK
- `@semse/api build`: OK
- `build:api`: OK

## Archivos tocados en esta fase

- `apps/api/src/infrastructure/persistence/persistence-mode.ts`
- `apps/api/src/modules/agents/agents.repository.ts`
- `apps/api/src/modules/bids/bids.repository.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`
- `apps/api/src/modules/evidence/evidence.repository.ts`
- `apps/api/src/modules/ops/ops.service.ts`
- `apps/api/src/modules/trust/trust.repository.ts`

## Estado resultante

La secuencia quedo asi:

1. workspace reparado;
2. bins restaurados;
3. Prisma regenerado;
4. stack overflow de TypeScript aislado y corregido;
5. tipado Prisma de transacciones destrabado;
6. `build:api` pasando completo.

## Siguiente paso recomendado

Con el backend compilando otra vez, el siguiente paso util es volver al runtime agentic:

1. validar flujo real `DomainEventBus -> AgentTriggerRouter -> AgentRun`;
2. correr smoke tests del worker y del API sobre los eventos `job.created`, `milestone.submitted` y `dispute.opened`;
3. documentar esa verificacion en un reporte separado.
