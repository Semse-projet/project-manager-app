# Admin Domain Events y domain-events.policy

Fecha: 2026-04-08
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Cerrar los dos pasos pedidos:

1. crear una vista dedicada `/admin/domain-events`;
2. endurecer la emisión manual con `domain-events.policy.ts`.

## Implementación

### 1. Policy explícita para emisión manual

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.policy.ts`

Reglas aplicadas:

- no todos los eventos válidos por schema son emitibles manualmente;
- solo se permiten:
  - `risk.flag_raised`
  - `risk.recalculated`
  - `policy.triggered`
  - `agent.action_logged`
  - `agent.human_review_requested`
- `tenantId` del evento debe coincidir con el tenant del actor;
- no se permite `actorType = system` en emisión manual;
- requiere rol `OPS_ADMIN`.

### 2. Integración de la policy en el backend

Archivos:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.controller.ts`

Cambios:

- `emit()` ahora pasa por `assertDomainEventEmittable(...)`
- nuevo endpoint:
  - `GET /v1/domain-events/manual-catalog`
- `POST /v1/domain-events/emit` ahora usa también los `roles` del actor

### 3. Cliente web extendido

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/semse-api.ts`

Se añadieron:

- `fetchDomainEventManualCatalog()`
- `emitDomainEvent(event)`

### 4. Nueva vista dedicada

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/admin/domain-events/page.tsx`

Capacidades:

- listado dedicado de domain events
- filtro por tipo
- búsqueda por tipo, trigger o `correlationId`
- trace detallado por `correlationId`
- formulario de emisión manual controlada

### 5. Navegación admin actualizada

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/layout.tsx`

Cambio:

- nuevo acceso lateral `Domain Events` para admin

## Resultado

Ahora existen dos superficies distintas y complementarias:

- `/admin/ops`
  - orientada a runtime, runs, retry, requeue e incidentes

- `/admin/domain-events`
  - orientada a causa, evento raíz, trace causal y emisión manual controlada

Esto separa mejor:

- operación del runtime;
- inspección del plano de eventos.

## Verificación

Comandos ejecutados:

- `npm run build:api`
- `npm exec tsc --workspace @semse/web -- --noEmit`
- `npm run build --workspace @semse/schemas`

Resultado:

- los tres pasan

## Lectura de arquitectura

Con esta iteración, `domain-events` ya no es solo:

- schema
- bus
- router

Ahora también es:

- policy explícita
- catálogo de emisión manual
- superficie admin dedicada
- puente completo API -> web -> operador

## Siguiente paso recomendado

Los pasos con mejor retorno ahora son:

1. crear `users` module;
2. crear `ratings` module;
3. ir agregando `policy.ts` explícitas donde hoy solo hay RBAC por permisos.
