# Domain Events UI en Admin Ops

Fecha: 2026-04-08
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Continuar la formalización de `domain-events` llevando la nueva superficie del API al frontend operativo.

La meta fue unir en una misma vista:

- `domain event`
- `correlationId`
- `agent runtime`
- `audit timeline`

## Inspiración aplicada

### infclaude

Se mantuvo como referencia la idea de:

- estado coordinado observable
- timeline por identidad estable
- trazabilidad entre causa y ejecución

En SEMSE eso quedó aterrizado como:

- evento raíz visible
- runs disparados visibles
- timeline compartido por `correlationId`

### satellites-archive

Se mantuvo como referencia el patrón:

- controller formal
- view models compartidos
- rutas web proxy explícitas

## Implementación

### 1. Proxy web de domain-events

Archivos creados:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/domain-events/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/domain-events/[correlationId]/route.ts`

Capacidad:

- listar eventos del dominio
- consultar trace por `correlationId`
- reenviar emisión controlada al API

### 2. Cliente web extendido

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/semse-api.ts`

Se añadieron:

- `fetchDomainEvents(...)`
- `fetchDomainEventTrace(correlationId)`
- tipos `DomainEventListView` y `DomainEventTraceView`

### 3. Integración en Admin Ops

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/admin/ops/page.tsx`

Cambios:

- nueva carga de `domain-events`
- nueva carga de `domain-event trace`
- nueva sección `Domain events`
- nueva sección `Event trace`
- selección sincronizada por `correlationId`

Resultado:

- el tablero ya no muestra solo el runtime agentic
- ahora muestra también el evento causal que originó ese runtime

## Lectura de producto

Con esta iteración, `/admin/ops` deja de ser solo una consola de runs.

Ahora funciona como un tablero causal:

- evento emitido
- triggers declarados
- runs derivados
- timeline de auditoría

Eso alinea mucho mejor el producto con la lógica del ecosistema SEMSE.

## Verificación

Comandos ejecutados:

- `npm exec tsc --workspace @semse/web -- --noEmit`
- `npm run build --workspace @semse/schemas`

Resultado:

- ambos pasan

## Siguiente paso recomendado

El siguiente paso con mejor retorno sería:

1. agregar una vista dedicada `/admin/domain-events`;
2. o añadir acciones controladas desde UI para `emit` en sandbox operativo;
3. o introducir `domain-events.policy.ts` si la emisión manual va a crecer.
